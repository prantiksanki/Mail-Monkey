import { getMailboxByEmail } from "@repo/database";
import { logger } from "@repo/logs";
import { notifyMailboxClients } from "../lib/inbox-notifier";
import { processMailboxNotification } from "../lib/rule-engine";

interface PubSubPush {
	message: { data: string; messageId: string };
	subscription: string;
}

interface GmailNotification {
	emailAddress: string;
	historyId: number;
}

export async function gmailWebhookHandler(req: Request): Promise<Response> {
	try {
		const body: PubSubPush = await req.json();
		const decoded = Buffer.from(body.message.data, "base64").toString(
			"utf-8",
		);
		const notification: GmailNotification = JSON.parse(decoded);

		logger.info("Gmail push received", {
			email: notification.emailAddress,
			historyId: notification.historyId,
		});

		const mailbox = await getMailboxByEmail(notification.emailAddress);

		if (!mailbox || !mailbox.watchEnabled) {
			logger.info("Ignoring push for missing or disabled mailbox", {
				email: notification.emailAddress,
				reason: !mailbox ? "mailbox_not_found" : "watch_disabled",
			});
			return new Response("OK", { status: 200 });
		}

		// Notify SSE clients immediately — new mail is arriving regardless of rules
		notifyMailboxClients(mailbox.id);

		// Process rules in background — acknowledge Pub/Sub immediately
		processMailboxNotification({
			id: mailbox.id,
			email: mailbox.email,
			accountId: mailbox.accountId,
			lastHistoryId: mailbox.lastHistoryId,
			userId: mailbox.userId,
		}).catch((error) => {
			logger.error("Notification processing failed", {
				mailboxId: mailbox.id,
				error: error instanceof Error ? error.message : String(error),
			});
		});

		return new Response("OK", { status: 200 });
	} catch (error) {
		logger.error("Gmail webhook error", {
			error: error instanceof Error ? error.message : String(error),
		});
		// Return 200 even on error to stop Pub/Sub from retrying infinitely
		return new Response("OK", { status: 200 });
	}
}
