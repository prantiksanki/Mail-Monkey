import { auth } from "@repo/auth";
import { getMailboxById } from "@repo/database";
import { logger } from "@repo/logs";
import { webhookHandler as paymentsWebhookHandler } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import {
	authLimiter,
	globalLimiter,
	gmailWebhookLimiter,
	outlookWebhookLimiter,
	paymentsWebhookLimiter,
	telegramWebhookLimiter,
} from "./lib/rate-limit";
import { subscribeToMailbox } from "./modules/mailboxes/lib/inbox-notifier";
import { startScheduledEmailPoller } from "./modules/mailboxes/lib/scheduled-poller";
import { startSnoozePoller } from "./modules/mailboxes/lib/snooze-poller";
import { startWatchRenewalPoller } from "./modules/mailboxes/lib/watch-renewal-poller";
import { gmailWebhookHandler } from "./modules/mailboxes/webhooks/gmail";
import { outlookWebhookHandler } from "./modules/mailboxes/webhooks/outlook";
import {
	deleteTelegramWebhook,
	setTelegramWebhook,
} from "./modules/telegram/client";
import {
	createTelegramConnectLink,
	disconnectTelegramForUser,
	getTelegramUserStatus,
	sendDueTelegramDigests,
	setTelegramDeliveryForUser,
} from "./modules/telegram/service";
import { telegramWebhookHandler } from "./modules/telegram/webhook";
import { openApiHandler, rpcHandler } from "./orpc/handler";

// Send due scheduled emails on an in-process interval so scheduling works
// without an external cron trigger (essential for local dev).
startScheduledEmailPoller();

// Return due snoozed emails to the inbox on an in-process interval so snooze
// works without an external cron trigger (essential for local dev).
startSnoozePoller();

// Renew Gmail/Outlook watch subscriptions before they expire so push
// notifications — and thus new-mail sync — never silently stop.
startWatchRenewalPoller();

function isInternalRequestAuthorized(c: {
	req: { header: (name: string) => string | undefined };
}) {
	const cronSecret = process.env.CRON_SECRET;
	return (
		!cronSecret || c.req.header("authorization") === `Bearer ${cronSecret}`
	);
}

export const app = new Hono()
	.basePath("/api")
	// Logger middleware
	.use(honoLogger((message, ...rest) => logger.log(message, ...rest)))
	// Cors middleware
	.use(
		cors({
			// Dev only: also allow the Expo web dev server (Metro, :8081).
			origin:
				process.env.NODE_ENV === "production"
					? getBaseUrl()
					: (origin) =>
							/^http:\/\/(localhost|127\.0\.0\.1):8081$/.test(origin)
								? origin
								: getBaseUrl(),
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length", "set-auth-token"],
			maxAge: 600,
			credentials: true,
		}),
	)
	// Rate limiting: global (all paths) + per-tier stacks on top
	.use(globalLimiter)
	.use("/auth/*", authLimiter)
	.use("/webhooks/gmail", gmailWebhookLimiter)
	.use("/webhooks/outlook", outlookWebhookLimiter)
	.use("/webhooks/payments", paymentsWebhookLimiter)
	.use("/webhooks/telegram", telegramWebhookLimiter)
	// Auth handler
	.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw))
	// Payments webhook handler
	.post("/webhooks/payments", (c) => paymentsWebhookHandler(c.req.raw))
	// Gmail webhook handler
	.post("/webhooks/gmail", (c) => gmailWebhookHandler(c.req.raw))
	// Outlook (Microsoft Graph) webhook handler
	.post("/webhooks/outlook", (c) => outlookWebhookHandler(c.req.raw))
	// Telegram bot webhook handler
	.post("/webhooks/telegram", (c) => telegramWebhookHandler(c.req.raw))
	// Telegram connection status for the logged-in web user
	.get("/telegram/status", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}

		return c.json(await getTelegramUserStatus(session.user.id));
	})
	// Create a short-lived Telegram deep link for the logged-in web user
	.on(["GET", "POST"], "/telegram/link", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}

		return c.json(await createTelegramConnectLink(session.user.id));
	})
	// Pause Telegram delivery for the logged-in web user
	.post("/telegram/disconnect", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}

		return c.json(await disconnectTelegramForUser(session.user.id));
	})
	// Resume Telegram delivery for the logged-in web user
	.post("/telegram/resume", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}

		return c.json(await setTelegramDeliveryForUser(session.user.id, true));
	})
	// Cron job to renew expiring watches (every day)
	.on(["GET", "POST"], "/internal/cron/renew-watches", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		const { renewExpiringWatches } = await import(
			"./modules/mailboxes/lib/watch-manager"
		);
		await renewExpiringWatches();
		return c.json({ success: true });
	})
	// Cron job to send due scheduled emails (run every minute)
	.post("/internal/cron/send-scheduled", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		const { processDueScheduledEmails } = await import(
			"./modules/mailboxes/lib/scheduled-sender"
		);
		const result = await processDueScheduledEmails();
		return c.json({ success: true, ...result });
	})
	// Cron job to return due snoozed emails to the inbox (run every minute)
	.post("/internal/cron/wake-snoozed", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		const { processDueSnoozedEmails } = await import(
			"./modules/mailboxes/lib/snooze-waker"
		);
		const result = await processDueSnoozedEmails();
		return c.json({ success: true, ...result });
	})
	// Cron job to send due Telegram email briefings
	.on(["GET", "POST"], "/internal/cron/telegram-digests", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		const result = await sendDueTelegramDigests();
		return c.json({ success: true, ...result });
	})
	// Internal helper to register Telegram's production webhook
	.post("/internal/telegram/set-webhook", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		const webhookUrl =
			process.env.TELEGRAM_WEBHOOK_URL ||
			`${getBaseUrl()}/api/webhooks/telegram`;
		await setTelegramWebhook(webhookUrl);
		return c.json({ success: true, webhookUrl });
	})
	// Internal helper to remove Telegram's webhook while debugging
	.post("/internal/telegram/delete-webhook", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		await deleteTelegramWebhook();
		return c.json({ success: true });
	})
	// Health check
	.get("/health", (c) => c.text("OK"))
	// SSE: real-time inbox notifications
	.get("/mailboxes/:mailboxId/inbox/events", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}

		const mailboxId = c.req.param("mailboxId");
		const mailbox = await getMailboxById(mailboxId);
		if (!mailbox || mailbox.userId !== session.user.id) {
			return c.text("Not found", 404);
		}

		let unsubscribe: (() => void) | undefined;

		const stream = new ReadableStream({
			start(ctrl) {
				// Send an immediate keepalive so the browser confirms the connection
				ctrl.enqueue(new TextEncoder().encode(": connected\n\n"));
				unsubscribe = subscribeToMailbox(mailboxId, ctrl);

				// Keepalive ping every 25 seconds to prevent proxy timeouts
				const timer = setInterval(() => {
					try {
						ctrl.enqueue(
							new TextEncoder().encode(": keepalive\n\n"),
						);
					} catch {
						clearInterval(timer);
					}
				}, 25_000);
			},
			cancel() {
				unsubscribe?.();
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			},
		});
	})
	// oRPC handlers (for RPC and OpenAPI)
	.use("*", async (c, next) => {
		const context = {
			headers: c.req.raw.headers,
		};

		const isRpc = c.req.path.includes("/rpc/");

		const handler = isRpc ? rpcHandler : openApiHandler;

		const prefix = isRpc ? "/api/rpc" : "/api";

		const { matched, response } = await handler.handle(c.req.raw, {
			prefix,
			context,
		});

		if (matched) {
			return c.newResponse(response.body, response);
		}

		await next();
	});
