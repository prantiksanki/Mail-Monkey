import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
	getMailboxesWithExpiringWatch,
	updateMailboxWatchState,
} from "@repo/database";
import { logger } from "@repo/logs";
import { getBaseUrl } from "@repo/utils";
import { google } from "googleapis";
import { startWatch, stopWatch } from "./gmail-client";
import { getOAuth2Client } from "./google-auth";
import {
	createOutlookSubscription,
	deleteOutlookSubscription,
	renewOutlookSubscription,
} from "./outlook-client";

const PUBSUB_TOPIC = process.env.GOOGLE_PUBSUB_TOPIC as string;

const PUBSUB_TOPIC_PATTERN = /^projects\/([^/]+)\/topics\/[^/]+$/;

/**
 * Validate the configured Pub/Sub topic before calling Gmail's `users.watch`.
 *
 * Gmail requires the topic to live in the SAME GCP project as the OAuth client.
 * A mismatch (or a missing topic) makes Google return an opaque 400, so we
 * fail loudly here with an actionable message. If `GOOGLE_PUBSUB_PROJECT` is
 * set, we additionally assert the topic belongs to that project.
 */
function assertPubSubTopicConfigured() {
	if (!PUBSUB_TOPIC) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message:
				"Email watch is not configured: GOOGLE_PUBSUB_TOPIC is missing.",
		});
	}

	const match = PUBSUB_TOPIC.match(PUBSUB_TOPIC_PATTERN);
	if (!match) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: `Email watch is misconfigured: GOOGLE_PUBSUB_TOPIC must look like "projects/<project>/topics/<topic>" (got "${PUBSUB_TOPIC}").`,
		});
	}

	const expectedProject = process.env.GOOGLE_PUBSUB_PROJECT;
	if (expectedProject && match[1] !== expectedProject) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: `Email watch is misconfigured: GOOGLE_PUBSUB_TOPIC points at project "${match[1]}" but GOOGLE_PUBSUB_PROJECT is "${expectedProject}". The Pub/Sub topic must be in the same GCP project as the OAuth client.`,
		});
	}
}

export async function enableWatchForMailbox(
	mailboxId: string,
	accountId: string,
	provider: "GOOGLE" | "OUTLOOK" | "IMAP" = "GOOGLE",
) {
	if (provider === "OUTLOOK") {
		return enableOutlookSubscription(mailboxId, accountId);
	}
	if (provider === "IMAP") {
		// No push/webhook subscription exists for generic IMAP — new mail is
		// already picked up by imap-sync-poller.ts regardless, so this is a
		// deliberate no-op rather than an error.
		return;
	}
	return enableGmailWatch(mailboxId, accountId);
}

export async function disableWatchForMailbox(
	mailboxId: string,
	accountId: string,
	provider: "GOOGLE" | "OUTLOOK" | "IMAP" = "GOOGLE",
	subscriptionId?: string | null,
) {
	if (provider === "OUTLOOK") {
		return disableOutlookSubscription(
			mailboxId,
			accountId,
			subscriptionId ?? null,
		);
	}
	if (provider === "IMAP") {
		return;
	}
	return disableGmailWatch(mailboxId, accountId);
}

async function enableGmailWatch(mailboxId: string, accountId: string) {
	assertPubSubTopicConfigured();

	const auth = await getOAuth2Client(accountId);
	const gmail = google.gmail({ version: "v1", auth });
	const profile = await gmail.users.getProfile({ userId: "me" });
	logger.info("[watch-manager] Token identity check", {
		mailboxId,
		accountId,
		authenticatedAs: profile.data.emailAddress,
	});

	const result = await startWatch(accountId, PUBSUB_TOPIC);
	const watchExpiry = new Date(Number(result.expiration));

	logger.info("[watch-manager] Gmail watch registered", {
		mailboxId,
		watchHistoryId: result.historyId,
		watchExpiry: watchExpiry.toISOString(),
	});

	await updateMailboxWatchState({
		id: mailboxId,
		watchEnabled: true,
		watchExpiry,
		lastHistoryId: result.historyId,
	});
}

async function disableGmailWatch(mailboxId: string, accountId: string) {
	try {
		await stopWatch(accountId);
	} catch {
		logger.warn("stopWatch failed (may already be stopped)", { mailboxId });
	}
	await updateMailboxWatchState({
		id: mailboxId,
		watchEnabled: false,
		watchExpiry: null,
	});
	logger.info("Gmail watch disabled", { mailboxId });
}

async function enableOutlookSubscription(mailboxId: string, accountId: string) {
	const webhookUrl = `${getBaseUrl()}/api/webhooks/outlook`;
	const clientState = randomBytes(32).toString("hex");

	const subscription = await createOutlookSubscription(
		accountId,
		webhookUrl,
		clientState,
	);

	const watchExpiry = new Date(subscription.expirationDateTime);

	logger.info("[watch-manager] Outlook subscription created", {
		mailboxId,
		subscriptionId: subscription.id,
		watchExpiry: watchExpiry.toISOString(),
	});

	await updateMailboxWatchState({
		id: mailboxId,
		watchEnabled: true,
		watchExpiry,
		subscriptionId: subscription.id,
		subscriptionClientState: clientState,
	});
}

async function disableOutlookSubscription(
	mailboxId: string,
	accountId: string,
	subscriptionId: string | null,
) {
	if (subscriptionId) {
		try {
			await deleteOutlookSubscription(accountId, subscriptionId);
		} catch (error) {
			logger.warn(
				"deleteOutlookSubscription failed (may already be deleted)",
				{
					mailboxId,
					subscriptionId,
					error:
						error instanceof Error ? error.message : String(error),
				},
			);
		}
	}

	await updateMailboxWatchState({
		id: mailboxId,
		watchEnabled: false,
		watchExpiry: null,
		subscriptionId: null,
		subscriptionClientState: null,
	});
	logger.info("Outlook subscription disabled", { mailboxId });
}

export async function renewExpiringWatches() {
	const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000);
	const mailboxes = await getMailboxesWithExpiringWatch(threshold);

	logger.info("Renewing expiring watches", { count: mailboxes.length });

	for (const mailbox of mailboxes) {
		try {
			if (!mailbox.account?.refreshToken) {
				logger.warn(
					"Skipping watch renewal — account missing or no refresh token",
					{ mailboxId: mailbox.id },
				);
				await updateMailboxWatchState({
					id: mailbox.id,
					watchEnabled: false,
					watchExpiry: null,
				});
				continue;
			}

			if (mailbox.provider === "OUTLOOK") {
				await renewOutlookWatch(mailbox);
			} else {
				await enableGmailWatch(mailbox.id, mailbox.accountId);
			}
		} catch (error) {
			logger.error("Failed to renew watch", {
				mailboxId: mailbox.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

async function renewOutlookWatch(mailbox: {
	id: string;
	accountId: string;
	subscriptionId?: string | null;
}) {
	if (mailbox.subscriptionId) {
		try {
			const renewed = await renewOutlookSubscription(
				mailbox.accountId,
				mailbox.subscriptionId,
			);
			await updateMailboxWatchState({
				id: mailbox.id,
				watchEnabled: true,
				watchExpiry: new Date(renewed.expirationDateTime),
			});
			logger.info("[watch-manager] Outlook subscription renewed", {
				mailboxId: mailbox.id,
				subscriptionId: mailbox.subscriptionId,
			});
			return;
		} catch (error) {
			logger.warn(
				"[watch-manager] Outlook subscription renewal failed, recreating",
				{
					mailboxId: mailbox.id,
					error:
						error instanceof Error ? error.message : String(error),
				},
			);
		}
	}
	// Subscription is gone — create a new one
	await enableOutlookSubscription(mailbox.id, mailbox.accountId);
}
