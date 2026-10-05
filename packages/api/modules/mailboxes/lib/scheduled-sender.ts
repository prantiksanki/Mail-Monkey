import {
	getDueScheduledEmails,
	markScheduledEmailFailed,
	markScheduledEmailSent,
} from "@repo/database";
import { logger } from "@repo/logs";
import { sendEmailViaGmail } from "./email-sender";

export interface ProcessScheduledResult {
	processed: number;
	sent: number;
	failed: number;
}

/**
 * Sends all scheduled emails whose time is due. Each message is processed
 * independently — one failure never blocks the rest. Intended to be invoked
 * from a cron trigger every minute.
 */
export async function processDueScheduledEmails(
	now: Date = new Date(),
	limit = 50,
): Promise<ProcessScheduledResult> {
	const due = await getDueScheduledEmails(now, limit);

	let sent = 0;
	let failed = 0;

	for (const item of due) {
		try {
			const { messageId } = await sendEmailViaGmail({
				accountId: item.mailbox.accountId,
				from: item.mailbox.email,
				to: item.to,
				cc: item.cc,
				bcc: item.bcc,
				subject: item.subject,
				body: item.body,
			});
			await markScheduledEmailSent(item.id, messageId);
			sent++;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error("Failed to send scheduled email", {
				scheduledEmailId: item.id,
				mailboxId: item.mailboxId,
				error: message,
			});
			await markScheduledEmailFailed(item.id, message);
			failed++;
		}
	}

	return { processed: due.length, sent, failed };
}
