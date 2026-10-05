// In-memory rate limiters for the Hono layer.
//
// Uses `hono-rate-limiter`'s default MemoryStore. This is safe while we run as
// a single Railway instance. If we ever horizontally scale (replicas, Vercel
// serverless, edge), counters will fragment per process — swap the store for
// UnstorageStore + Redis at that point.

import { logger } from "@repo/logs";
import type { Context, MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";

const ONE_MINUTE_MS = 60_000;

const EXCLUDED_PATH_PREFIXES = ["/api/health", "/api/internal/cron/"] as const;

function isExcludedPath(path: string): boolean {
	return EXCLUDED_PATH_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(prefix),
	);
}

function isDevBypassEnabled(): boolean {
	if (process.env.NODE_ENV !== "production") {
		return process.env.RATE_LIMIT_IN_DEV !== "1";
	}
	return process.env.DISABLE_RATE_LIMIT === "1";
}

// Railway's ingress proxy appends the real client IP to `x-forwarded-for` on
// the right. Take the last entry, fall back to `x-real-ip`, then anonymous.
export function getClientIp(c: Context): string {
	const xff = c.req.header("x-forwarded-for");
	if (xff) {
		const parts = xff
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const last = parts.at(-1);
		if (last) {
			return last;
		}
	}
	const realIp = c.req.header("x-real-ip");
	if (realIp) {
		return realIp;
	}
	return "anonymous";
}

function shouldSkip(c: Context): boolean {
	if (isDevBypassEnabled()) {
		return true;
	}
	if (c.req.method === "OPTIONS") {
		return true;
	}
	return isExcludedPath(c.req.path);
}

interface LimiterSpec {
	tier: string;
	limit: number;
	windowMs?: number;
	requestPropertyName: string;
	keyByUser?: boolean;
}

function makeLimiter({
	tier,
	limit,
	windowMs = ONE_MINUTE_MS,
	requestPropertyName,
}: LimiterSpec): MiddlewareHandler {
	return rateLimiter({
		windowMs,
		limit,
		standardHeaders: "draft-7",
		requestPropertyName,
		keyGenerator: (c: Context) => getClientIp(c),
		skip: (c: Context) => shouldSkip(c),
		handler: (c: Context) => {
			const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
			logger.warn("[rate-limit] exceeded", {
				tier,
				ip: getClientIp(c),
				path: c.req.path,
				method: c.req.method,
			});
			c.header("Retry-After", String(retryAfterSeconds));
			return c.json(
				{
					error: "Too many requests",
					retryAfter: retryAfterSeconds,
				},
				429,
			);
		},
	}) as unknown as MiddlewareHandler;
}

export const globalLimiter = makeLimiter({
	tier: "global",
	limit: 100,
	requestPropertyName: "rlGlobal",
});

export const authLimiter = makeLimiter({
	tier: "auth",
	limit: 10,
	requestPropertyName: "rlAuth",
});

export const gmailWebhookLimiter = makeLimiter({
	tier: "webhook-gmail",
	limit: 200,
	requestPropertyName: "rlGmailWebhook",
});

export const outlookWebhookLimiter = makeLimiter({
	tier: "webhook-outlook",
	limit: 200,
	requestPropertyName: "rlOutlookWebhook",
});

export const paymentsWebhookLimiter = makeLimiter({
	tier: "webhook-payments",
	limit: 50,
	requestPropertyName: "rlPaymentsWebhook",
});

export const telegramWebhookLimiter = makeLimiter({
	tier: "webhook-telegram",
	limit: 200,
	requestPropertyName: "rlTelegramWebhook",
});
