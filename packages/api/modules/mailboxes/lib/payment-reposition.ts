import {
	getPaymentCardsForReposition,
	updatePaymentCardKanbanStatusOnly,
} from "@repo/database";
import { logger } from "@repo/logs";
import { deriveKanbanStatus } from "./payment-status-deriver";

// Pure date math against already-known dueDate/paymentStatus — no AI call, so
// this can run a much larger batch per tick than the classification poller.
const REPOSITION_BATCH_SIZE = 200;

/**
 * Re-derives kanbanStatus for every AUTOMATIC, unpaid, due-dated card so a
 * bill moves Upcoming -> Due Soon -> Overdue purely as days pass, without
 * needing a new email to trigger reclassification. Never touches MANUAL or
 * PAID cards — those are frozen by definition (see payment-card-writer.ts's
 * "don't fight the user" rule and deriveKanbanStatus's paid-wins check).
 */
export async function repositionDuePaymentCards(): Promise<{
	checked: number;
	moved: number;
}> {
	const cards = await getPaymentCardsForReposition(REPOSITION_BATCH_SIZE);

	let moved = 0;
	for (const card of cards) {
		const newStatus = deriveKanbanStatus({
			dueDate: card.dueDate,
			paymentStatus: card.paymentStatus,
		});
		if (newStatus !== card.kanbanStatus) {
			try {
				await updatePaymentCardKanbanStatusOnly(card.id, newStatus);
				moved += 1;
			} catch (error) {
				logger.error(
					"[payment-reposition] Failed to update card status",
					{
						cardId: card.id,
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				);
			}
		}
	}

	return { checked: cards.length, moved };
}
