import { getMailboxBySubscriptionId } from "@repo/database";
import { logger } from "@repo/logs";
import { processOutlookNotification } from "../lib/rule-engine";

interface GraphNotification {
	subscriptionId: string;
	clientState: string;
	changeType: string;
	resourceData?: { id?: string };
}

interface GraphNotificationBody {
	value: GraphNotification[];
}

export async function outlookWebhookHandler(req: Request): Promise<Response> {
	// Graph validation handshake: GET/POST with ?validationToken=...
	const url = new URL(req.url);
	const validationToken = url.searchParams.get("validationToken");
	if (validationToken) {
		logger.info(
			"[outlook-webhook] Graph subscription validation handshake",
		);
		return new Response(validationToken, {
			status: 200,
			headers: { "Content-Type": "text/plain" },
		});
	}

	try {
		const body: GraphNotificationBody = await req.json();

		if (!Array.isArray(body.value) || body.value.length === 0) {
			return new Response("OK", { status: 200 });
		}

		logger.info("[outlook-webhook] Outlook push received", {
			count: body.value.length,
		});

		// Group notifications by subscription
		const bySubscription = new Map<string, string[]>();
		for (const notification of body.value) {
			const msgId = notification.resourceData?.id;
			if (!msgId) {
				continue;
			}
			const existing =
				bySubscription.get(notification.subscriptionId) ?? [];
			existing.push(msgId);
			bySubscription.set(notification.subscriptionId, existing);
		}

		// Process each subscription's notifications
		for (const [subscriptionId, messageIds] of bySubscription) {
			const notification = body.value.find(
				(n) => n.subscriptionId === subscriptionId,
			);
			if (!notification) {
				continue;
			}

			const mailbox = await getMailboxBySubscriptionId(subscriptionId);

			if (!mailbox || !mailbox.watchEnabled) {
				logger.info(
					"[outlook-webhook] Ignoring push for missing or disabled mailbox",
					{
						subscriptionId,
						reason: !mailbox
							? "mailbox_not_found"
							: "watch_disabled",
					},
				);
				continue;
			}

			// Validate clientState — reject if unset (unconfigured subscription)
			// or if the value doesn't match the stored secret.
			if (
				!mailbox.subscriptionClientState ||
				notification.clientState !== mailbox.subscriptionClientState
			) {
				logger.warn(
					"[outlook-webhook] clientState mismatch — rejecting notification",
					{ subscriptionId, mailboxId: mailbox.id },
				);
				continue;
			}

			// Process in background — acknowledge Graph immediately
			processOutlookNotification(
				{
					id: mailbox.id,
					email: mailbox.email,
					accountId: mailbox.accountId,
					userId: mailbox.userId,
				},
				[...new Set(messageIds)],
			).catch((error) => {
				logger.error(
					"[outlook-webhook] Notification processing failed",
					{
						mailboxId: mailbox.id,
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				);
			});
		}

		return new Response("OK", { status: 200 });
	} catch (error) {
		logger.error("[outlook-webhook] Webhook error", {
			error: error instanceof Error ? error.message : String(error),
		});
		// Return 200 to stop Graph from retrying infinitely
		return new Response("OK", { status: 200 });
	}
}
