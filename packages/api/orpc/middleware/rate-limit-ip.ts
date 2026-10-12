// IP-keyed rate limiting for oRPC procedures reachable by anonymous visitors
// (no session to key on, unlike `userExpensiveLimiter`).
//
// In-process Map — same single-instance caveat as the Hono-layer MemoryStore
// in `packages/api/lib/rate-limit.ts`; swap to Redis if we horizontally scale.

import { ORPCError, os } from "@orpc/server";
import { logger } from "@repo/logs";

interface IpBucket {
	count: number;
	resetAt: number;
}

interface IpLimitOptions {
	tier: string;
	limit: number;
	windowMs: number;
}

function isDevBypassEnabled(): boolean {
	return process.env.DISABLE_RATE_LIMIT === "1";
}

// Strip a trailing ":<port>" from an "IPv4:port" or "[IPv6]:port" value.
// Mirrors `stripPort` in `packages/api/lib/rate-limit.ts` — Azure App
// Service's ingress appends the client IP *with* its source port to
// `x-forwarded-for`, and the port changes per TCP connection, so leaving it
// in would make every request a distinct rate-limit key.
function stripPort(value: string): string {
	const v = value.trim();
	if (v.startsWith("[")) {
		const end = v.indexOf("]");
		return end === -1 ? v : v.slice(1, end);
	}
	const firstColon = v.indexOf(":");
	if (firstColon !== -1 && v.indexOf(":", firstColon + 1) === -1) {
		return v.slice(0, firstColon);
	}
	return v;
}

// Header-only twin of `getClientIp` in `packages/api/lib/rate-limit.ts` — the
// oRPC middleware only has access to raw `Headers`, not the Hono `Context`
// that function expects.
function getClientIpFromHeaders(headers: Headers): string {
	const azureClientIp = headers.get("x-azure-clientip");
	if (azureClientIp?.trim()) {
		return stripPort(azureClientIp);
	}
	const xff = headers.get("x-forwarded-for");
	if (xff) {
		const parts = xff
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const last = parts.at(-1);
		if (last) {
			return stripPort(last);
		}
	}
	const realIp = headers.get("x-real-ip");
	if (realIp?.trim()) {
		return stripPort(realIp);
	}
	return "anonymous";
}

function createIpRateLimit({ tier, limit, windowMs }: IpLimitOptions) {
	const buckets = new Map<string, IpBucket>();

	return os
		.$context<{ headers: Headers }>()
		.middleware(async ({ context, next }) => {
			if (isDevBypassEnabled()) {
				return await next({ context });
			}

			const ip = getClientIpFromHeaders(context.headers);

			const now = Date.now();
			const bucket = buckets.get(ip);

			if (!bucket || bucket.resetAt <= now) {
				buckets.set(ip, { count: 1, resetAt: now + windowMs });
				return await next({ context });
			}

			if (bucket.count >= limit) {
				const retryAfter = Math.max(
					1,
					Math.ceil((bucket.resetAt - now) / 1000),
				);
				logger.warn("[rate-limit] exceeded", {
					tier,
					ip,
					limit,
				});
				throw new ORPCError("RATE_LIMITED", {
					message: `You're doing that too fast. Try again in ${retryAfter}s.`,
					data: { retryAfter },
				});
			}

			bucket.count += 1;
			return await next({ context });
		});
}

// Anonymous marketing-page voice demo — tighter than the per-user limiter
// since one IP can be many anonymous visitors (shared NAT/office), and this
// is unauthenticated so there's no per-account cost accounting downstream.
export const anonymousVoiceLimiter = createIpRateLimit({
	tier: "anonymous-voice",
	limit: 10,
	windowMs: 60_000,
});
