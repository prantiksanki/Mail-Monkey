import { ORPCError } from "@orpc/client";
import { getPaymentCardById, updatePaymentCardStatus } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";

const KANBAN_STATUSES = ["UPCOMING", "DUE_SOON", "OVERDUE", "PAID"] as const;

/**
 * Drag-and-drop persistence endpoint — the only place statusSource becomes
 * MANUAL. Once set, the payment-scan poller (payment-card-writer.ts) will
 * never overwrite kanbanStatus/statusSource again for this card.
 */
export const updateCardStatus = protectedProcedure
	.route({
		method: "PATCH",
		path: "/payment-tracking/cards/{id}/status",
		tags: ["Payment Tracking"],
		summary: "Move a payment card to a different Kanban column",
	})
	.input(
		z.object({
			id: z.string(),
			kanbanStatus: z.enum(KANBAN_STATUSES),
		}),
	)
	.handler(async ({ input, context }) => {
		const card = await getPaymentCardById(input.id, context.user.id);
		if (!card) {
			throw new ORPCError("NOT_FOUND");
		}

		await verifyMailboxOwnership(card.mailboxId, context.user.id);

		const updated = await updatePaymentCardStatus(card.id, {
			kanbanStatus: input.kanbanStatus,
			statusSource: "MANUAL",
			manuallyOverriddenAt: new Date(),
		});

		return {
			id: updated.id,
			kanbanStatus: updated.kanbanStatus,
			statusSource: updated.statusSource,
		};
	});
