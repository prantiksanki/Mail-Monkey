/**
 * Single choke point for creating/updating PaymentCard rows from a
 * classification result. Centralizing writes here (rather than in the
 * poller or query layer) is what makes the "never fight a manual override"
 * rule enforceable in exactly one place.
 */

import { db, getPaymentCardByMailboxAndEmail } from "@repo/database";
import { logger } from "@repo/logs";
import type { PaymentClassification } from "./payment-classifier";
import { deriveKanbanStatus } from "./payment-status-deriver";

const CONFIDENCE_THRESHOLD = 0.6;

interface EmailForPaymentCard {
	id: string;
	mailboxId: string;
	threadId: string;
}

/**
 * Applies a classification result to a PaymentCard, respecting manual
 * overrides. Always marks the source Email as scanned (payment or
 * not-payment) so the poller never reprocesses it.
 */
export async function upsertPaymentCardFromClassification(
	userId: string,
	email: EmailForPaymentCard,
	classification: PaymentClassification,
): Promise<void> {
	if (
		!classification.isPaymentEmail ||
		classification.confidence < CONFIDENCE_THRESHOLD
	) {
		await db.email.update({
			where: { id: email.id },
			data: { paymentScanCategory: "not-payment" },
		});
		return;
	}

	const dueDate = classification.dueDate
		? new Date(classification.dueDate)
		: null;
	// Guard against an unparsable AI-supplied date string (Invalid Date) —
	// never persist a bad date, just treat it as absent.
	const safeDueDate =
		dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;

	const existing = await getPaymentCardByMailboxAndEmail(
		email.mailboxId,
		email.id,
	);

	if (existing && existing.statusSource === "MANUAL") {
		// A human already decided this card's column — automation may refresh
		// descriptive fields but must never touch kanbanStatus/statusSource,
		// regardless of what the new classification says (including a
		// confident "paid" signal).
		await db.$transaction([
			db.paymentCard.update({
				where: { id: existing.id },
				data: {
					paymentType:
						classification.paymentType ?? existing.paymentType,
					merchant: classification.merchant ?? existing.merchant,
					amount: classification.amount ?? existing.amount,
					currency: classification.currency ?? existing.currency,
					confidence: classification.confidence,
				},
			}),
			db.email.update({
				where: { id: email.id },
				data: { paymentScanCategory: "payment" },
			}),
		]);
		return;
	}

	const kanbanStatus = deriveKanbanStatus({
		dueDate: safeDueDate,
		paymentStatus: classification.paymentStatus ?? "unknown",
	});

	try {
		await db.$transaction([
			db.paymentCard.upsert({
				where: {
					mailboxId_emailId: {
						mailboxId: email.mailboxId,
						emailId: email.id,
					},
				},
				create: {
					userId,
					mailboxId: email.mailboxId,
					emailId: email.id,
					threadId: email.threadId,
					paymentType: classification.paymentType ?? "other",
					merchant: classification.merchant ?? "Unknown",
					amount: classification.amount,
					currency: classification.currency,
					dueDate: safeDueDate,
					paymentStatus: classification.paymentStatus ?? "unknown",
					confidence: classification.confidence,
					kanbanStatus,
					statusSource: "AUTOMATIC",
				},
				update: {
					paymentType: classification.paymentType ?? "other",
					merchant: classification.merchant ?? "Unknown",
					amount: classification.amount,
					currency: classification.currency,
					dueDate: safeDueDate,
					paymentStatus: classification.paymentStatus ?? "unknown",
					confidence: classification.confidence,
					kanbanStatus,
					statusSource: "AUTOMATIC",
				},
			}),
			db.email.update({
				where: { id: email.id },
				data: { paymentScanCategory: "payment" },
			}),
		]);
	} catch (error) {
		logger.error("[payment-card-writer] Failed to upsert payment card", {
			emailId: email.id,
			mailboxId: email.mailboxId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
