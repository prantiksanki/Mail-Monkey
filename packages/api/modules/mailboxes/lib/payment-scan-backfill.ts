import {
	db,
	getEmailsPendingPaymentScan,
	getMailboxIdsWithUnscannedEmails,
} from "@repo/database";
import { logger } from "@repo/logs";
import { fastPathCategoryFromGmailLabels } from "./email-categorizer";
import { upsertPaymentCardFromClassification } from "./payment-card-writer";
import {
	classifyPaymentEmail,
	NOT_A_PAYMENT_EMAIL,
} from "./payment-classifier";

// Same conservative sizing as email-classification-backfill's ongoing poller
// — this runs quietly every tick with no visible progress UI, and every email
// not caught by the fast path below costs a real Sarvam call.
const POLLER_MAILBOX_LIMIT = 5;
const POLLER_BATCH_SIZE_PER_MAILBOX = 10;

/**
 * Bills, invoices, and receipts never arrive as marketing, social, or
 * newsletter mail — so an email already known to be one of those (via its
 * own category, or Gmail's labels when the category poller hasn't run yet)
 * can skip the Sarvam call entirely. Same idea as
 * email-categorizer.ts's fastPathCategoryFromGmailLabels, applied one layer
 * up since we already have both signals on the Email row.
 */
function isFastPathNotPayment(email: {
	category: string | null;
	labelIds: string[];
}): boolean {
	const category =
		email.category ?? fastPathCategoryFromGmailLabels(email.labelIds);
	return (
		category === "PROMOTION" ||
		category === "SOCIAL" ||
		category === "NEWSLETTER"
	);
}

/**
 * Scans a small batch of not-yet-scanned emails per mailbox, classifies each
 * for payment relevance, and upserts a PaymentCard when appropriate. Called
 * from payment-scan-poller.ts and the /internal/cron/classify-payments
 * fallback route. Mirrors processDueEmailClassification's shape.
 */
export async function processDuePaymentScans(): Promise<{
	scanned: number;
	cardsCreated: number;
	errors: number;
}> {
	const mailboxIds =
		await getMailboxIdsWithUnscannedEmails(POLLER_MAILBOX_LIMIT);

	let scanned = 0;
	let cardsCreated = 0;
	let errors = 0;

	for (const mailboxId of mailboxIds) {
		const emails = await getEmailsPendingPaymentScan(
			mailboxId,
			POLLER_BATCH_SIZE_PER_MAILBOX,
		);
		if (emails.length === 0) {
			continue;
		}

		const mailbox = await db.mailbox.findUnique({
			where: { id: mailboxId },
			select: { userId: true },
		});
		if (!mailbox) {
			continue;
		}

		const results = await Promise.allSettled(
			emails.map(async (email) => {
				const classification = isFastPathNotPayment(email)
					? NOT_A_PAYMENT_EMAIL
					: await classifyPaymentEmail({
							from: email.from,
							fromEmail: email.fromEmail,
							subject: email.subject,
							snippet: email.snippet,
							bodyText: email.bodyText,
							internalDate: email.internalDate,
						});

				// null = Sarvam's quota/billing is exhausted right now — leave
				// this email unscanned rather than mislabeling a possible real
				// bill as "not-payment"; a later, healthy tick will retry it.
				if (classification === null) {
					return "skipped" as const;
				}

				logger.info("[payment-scan] classified email", {
					emailId: email.id,
					subject: email.subject.slice(0, 80),
					fastPath: isFastPathNotPayment(email),
					isPaymentEmail: classification.isPaymentEmail,
					confidence: classification.confidence,
					paymentType: classification.paymentType,
					paymentStatus: classification.paymentStatus,
				});

				await upsertPaymentCardFromClassification(
					mailbox.userId,
					{
						id: email.id,
						mailboxId: email.mailboxId,
						threadId: email.threadId,
					},
					classification,
				);

				return classification.isPaymentEmail;
			}),
		);

		for (const result of results) {
			if (result.status === "fulfilled") {
				if (result.value === "skipped") {
					continue;
				}
				scanned += 1;
				if (result.value) {
					cardsCreated += 1;
				}
			} else {
				scanned += 1;
				errors += 1;
				logger.error(
					"[payment-scan-backfill] Failed to scan email for payment relevance",
					{
						mailboxId,
						error:
							result.reason instanceof Error
								? result.reason.message
								: String(result.reason),
					},
				);
			}
		}
	}

	return { scanned, cardsCreated, errors };
}
