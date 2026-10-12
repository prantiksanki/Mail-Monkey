import { auth } from "@repo/auth";
import { db, getMailboxById } from "@repo/database";
import { logger } from "@repo/logs";
import { httpRequestDuration } from "@repo/metrics";
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
	publicContactFormLimiter,
	publicImapVerifyLimiter,
	telegramWebhookLimiter,
	zoomWebhookLimiter,
} from "./lib/rate-limit";
import { startEmailClassificationPoller } from "./modules/mailboxes/lib/email-classification-poller";
import { startImapSyncPoller } from "./modules/mailboxes/lib/imap-sync-poller";
import { subscribeToMailbox } from "./modules/mailboxes/lib/inbox-notifier";
import { startPaymentRepositionPoller } from "./modules/mailboxes/lib/payment-reposition-poller";
import { startPaymentScanPoller } from "./modules/mailboxes/lib/payment-scan-poller";
import { startReminderPoller } from "./modules/mailboxes/lib/reminder-poller";
import { startScheduledEmailPoller } from "./modules/mailboxes/lib/scheduled-poller";
import { startSnoozePoller } from "./modules/mailboxes/lib/snooze-poller";
import { startWatchRenewalPoller } from "./modules/mailboxes/lib/watch-renewal-poller";
import {
	disconnectZoom,
	getZoomConnectionStatus,
} from "./modules/mailboxes/lib/zoom-client";
import { gmailWebhookHandler } from "./modules/mailboxes/webhooks/gmail";
import { outlookWebhookHandler } from "./modules/mailboxes/webhooks/outlook";
import { zoomWebhookHandler } from "./modules/mailboxes/webhooks/zoom";
import { startTrialExpiryPoller } from "./modules/payments/lib/trial-expiry-poller";
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

// Fire due reminders on an in-process interval, same rationale as above.
startReminderPoller();

// Renew Gmail/Outlook watch subscriptions before they expire so push
// notifications — and thus new-mail sync — never silently stop.
startWatchRenewalPoller();

// Poll every connected IMAP/SMTP mailbox for new mail — generic IMAP has no
// push/webhook equivalent to the two pollers above.
startImapSyncPoller();

// Downgrade expired Pro trials back to the free plan on an in-process interval
// so trial expiry works without an external cron trigger (essential for local dev).
startTrialExpiryPoller();

// Classify newly-synced emails into Dashboard categories on an in-process
// interval so the Inbox Overview breakdown stays current without an external
// cron trigger (essential for local dev).
startEmailClassificationPoller();

// Scan newly-synced emails for payment/bill relevance on an in-process
// interval so the Payments Kanban board stays current without an external
// cron trigger (essential for local dev).
startPaymentScanPoller();

// Re-derive each payment card's Kanban column (Upcoming/Due Soon/Overdue)
// against today's date on an hourly in-process interval, so a bill moves
// automatically as its due date approaches/passes — not just when a new
// email triggers reclassification.
startPaymentRepositionPoller();

// Authorize internal/cron endpoints via `Authorization: Bearer ${CRON_SECRET}`.
// When CRON_SECRET is unset (local dev), the check is a no-op.
function isInternalRequestAuthorized(c: {
	req: { header: (name: string) => string | undefined };
}) {
	const cronSecret = process.env.CRON_SECRET;
	return (
		!cronSecret || c.req.header("authorization") === `Bearer ${cronSecret}`
	);
}

// Labels httpRequestDuration by the matched route pattern (e.g.
// "/api/mailboxes/:mailboxId/inbox/events"), not the raw path, so a metric
// series never grows per resource ID. Requests handled by the oRPC catch-all
// below don't have a specific Hono pattern (it's registered on "*"), so those
// are bucketed as rpc vs openapi traffic instead of one series per procedure.
// The SSE inbox-events stream is excluded entirely: `next()` doesn't resolve
// until the connection closes, so its "duration" is connection lifetime, not
// request latency, and would just pile into the histogram's overflow bucket.
const SSE_ROUTE_SUFFIX = "/inbox/events";

function getMetricsRoute(routePath: string | undefined, path: string): string {
	if (routePath && routePath !== "*") {
		return routePath;
	}
	return path.includes("/rpc/") ? "/api/rpc/*" : "/api/openapi/*";
}

export const app = new Hono()
	.basePath("/api")
	// Request duration metric — first middleware so it times the full chain
	// (rate limiting, auth, handler) and always sees the final status code.
	.use(async (c, next) => {
		const start = performance.now();
		await next();
		if (c.req.path.endsWith(SSE_ROUTE_SUFFIX)) {
			return;
		}
		httpRequestDuration.observe(
			{
				method: c.req.method,
				route: getMetricsRoute(c.req.routePath, c.req.path),
				status_code: String(c.res.status),
			},
			(performance.now() - start) / 1000,
		);
	})
	// Logger middleware
	.use(honoLogger((message, ...rest) => logger.log(message, ...rest)))
	// Cors middleware
	.use(
		cors({
			// A static string here gets inlined by Next's build-time replacement
			// of process.env.NEXT_PUBLIC_* (getBaseUrl() reads it directly), so
			// the allowed origin silently freezes at whatever value the build
			// secret had — not the server's actual runtime .env. A function is
			// evaluated per-request instead, and also covers the bare apex
			// domain, which 301-redirects to the canonical host in Nginx but
			// browsers still send as the page's real Origin before that
			// redirect is followed on a cross-origin fetch.
			origin: (origin) => {
				const base = getBaseUrl();
				const bare = base.replace(/^https:\/\/www\./, "https://");
				return origin === base || origin === bare ? origin : base;
			},
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
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
	.use("/webhooks/zoom", zoomWebhookLimiter)
	.use("/creator-profiles/*/contact", publicContactFormLimiter)
	.use("/creator-profiles/*/bookings", publicContactFormLimiter)
	.use("/creator-profiles/*/bookings/checkout", publicContactFormLimiter)
	.use("/creator-profiles/bookings/cancel", publicContactFormLimiter)
	.use("/api/mailboxes/verify-imap", publicImapVerifyLimiter)
	.use("/api/rpc/mailboxes/verifyImap", publicImapVerifyLimiter)
	// Auth handler
	.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw))
	// Payments webhook handler
	.post("/webhooks/payments", (c) => paymentsWebhookHandler(c.req.raw))
	// Gmail webhook handler
	.post("/webhooks/gmail", (c) => gmailWebhookHandler(c.req.raw))
	// Outlook (Microsoft Graph) webhook handler
	.post("/webhooks/outlook", (c) => outlookWebhookHandler(c.req.raw))
	// Telegram bot webhook handler
	.post("/webhooks/telegram", (c) => telegramWebhookHandler(c.req.raw))
	// Zoom Marketplace webhook: endpoint validation + app deauthorization
	.post("/webhooks/zoom", (c) => zoomWebhookHandler(c.req.raw))
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
	// Pause Telegram delivery
	.post("/telegram/disconnect", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}
		return c.json(await disconnectTelegramForUser(session.user.id));
	})
	// Resume Telegram delivery
	.post("/telegram/resume", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}
		return c.json(await setTelegramDeliveryForUser(session.user.id, true));
	})
	// Zoom connection status for the logged-in web user
	.get("/zoom/status", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}
		return c.json(await getZoomConnectionStatus(session.user.id));
	})
	// Disconnect Zoom (removes the stored OAuth account for this user)
	.post("/zoom/disconnect", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}
		return c.json(await disconnectZoom(session.user.id));
	})
	// Zoho Meeting connection status for the logged-in web user
	.get("/zoho/status", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}
		const account = await db.account.findFirst({
			where: { userId: session.user.id, providerId: "zoho" },
			orderBy: { createdAt: "desc" },
			select: { refreshToken: true },
		});
		return c.json({
			connected: !!account?.refreshToken,
			// The OAuth provider is only registered when creds are set, so the
			// UI can disable "Connect" until Zoho is configured for this env.
			configured: !!(
				process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET
			),
		});
	})
	// Disconnect Zoho (removes the stored OAuth account for this user)
	.post("/zoho/disconnect", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.text("Unauthorized", 401);
		}
		await db.account.deleteMany({
			where: { userId: session.user.id, providerId: "zoho" },
		});
		return c.json({ success: true });
	})
	// Cron: send due Telegram digests
	.on(["GET", "POST"], "/internal/cron/telegram-digests", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		const result = await sendDueTelegramDigests();
		return c.json({ success: true, ...result });
	})
	// Internal: register the production webhook (uses TELEGRAM_WEBHOOK_URL)
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
	// Internal: delete the webhook (debugging)
	.post("/internal/telegram/delete-webhook", async (c) => {
		if (!isInternalRequestAuthorized(c)) {
			return c.text("Unauthorized", 401);
		}
		await deleteTelegramWebhook();
		return c.json({ success: true });
	})
	// Cron job to renew expiring watches (every day)
	.post("/internal/cron/renew-watches", async (c) => {
		const cronSecret = process.env.CRON_SECRET;
		if (
			cronSecret &&
			c.req.header("authorization") !== `Bearer ${cronSecret}`
		) {
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
		const cronSecret = process.env.CRON_SECRET;
		if (
			cronSecret &&
			c.req.header("authorization") !== `Bearer ${cronSecret}`
		) {
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
		const cronSecret = process.env.CRON_SECRET;
		if (
			cronSecret &&
			c.req.header("authorization") !== `Bearer ${cronSecret}`
		) {
			return c.text("Unauthorized", 401);
		}
		const { processDueSnoozedEmails } = await import(
			"./modules/mailboxes/lib/snooze-waker"
		);
		const result = await processDueSnoozedEmails();
		return c.json({ success: true, ...result });
	})
	// Cron job to downgrade expired Pro trials to the free plan (run hourly)
	.post("/internal/cron/expire-trials", async (c) => {
		const cronSecret = process.env.CRON_SECRET;
		if (
			cronSecret &&
			c.req.header("authorization") !== `Bearer ${cronSecret}`
		) {
			return c.text("Unauthorized", 401);
		}
		const { expireDueTrials } = await import(
			"./modules/payments/lib/expire-trials"
		);
		const result = await expireDueTrials();
		return c.json({ success: true, ...result });
	})
	// Cron job to classify newly-synced emails into Dashboard categories (run every minute)
	.post("/internal/cron/classify-emails", async (c) => {
		const cronSecret = process.env.CRON_SECRET;
		if (
			cronSecret &&
			c.req.header("authorization") !== `Bearer ${cronSecret}`
		) {
			return c.text("Unauthorized", 401);
		}
		const { processDueEmailClassification } = await import(
			"./modules/mailboxes/lib/email-classification-backfill"
		);
		const result = await processDueEmailClassification();
		return c.json({ success: true, ...result });
	})
	// Cron job to scan newly-synced emails for payment/bill relevance (run every minute)
	.post("/internal/cron/classify-payments", async (c) => {
		const cronSecret = process.env.CRON_SECRET;
		if (
			cronSecret &&
			c.req.header("authorization") !== `Bearer ${cronSecret}`
		) {
			return c.text("Unauthorized", 401);
		}
		const { processDuePaymentScans } = await import(
			"./modules/mailboxes/lib/payment-scan-backfill"
		);
		const result = await processDuePaymentScans();
		return c.json({ success: true, ...result });
	})
	// Cron job to re-derive payment cards' Kanban column against today's date (run hourly)
	.post("/internal/cron/reposition-payments", async (c) => {
		const cronSecret = process.env.CRON_SECRET;
		if (
			cronSecret &&
			c.req.header("authorization") !== `Bearer ${cronSecret}`
		) {
			return c.text("Unauthorized", 401);
		}
		const { repositionDuePaymentCards } = await import(
			"./modules/mailboxes/lib/payment-reposition"
		);
		const result = await repositionDuePaymentCards();
		return c.json({ success: true, ...result });
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
