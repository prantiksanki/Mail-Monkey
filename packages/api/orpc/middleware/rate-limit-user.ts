// Per-user rate limiting for expensive oRPC procedures.
//
// Keys on `context.user.id` and throws `ORPCError("RATE_LIMITED")` when the
// window limit is hit. In-process Map — same single-instance caveat as the
// Hono-layer MemoryStore; swap to Redis if we horizontally scale.

import { ORPCError, os } from "@orpc/server";
import { auth } from "@repo/auth";
import { logger } from "@repo/logs";

interface UserBucket {
	count: number;
	resetAt: number;
}

interface UserLimitOptions {
	tier: string;
	limit: number;
	windowMs: number;
}

function isDevBypassEnabled(): boolean {
	return process.env.DISABLE_RATE_LIMIT === "1";
}

function createUserRateLimit({ tier, limit, windowMs }: UserLimitOptions) {
	const buckets = new Map<string, UserBucket>();

	return os
		.$context<{ headers: Headers }>()
		.middleware(async ({ context, next }) => {
			if (isDevBypassEnabled()) {
				return await next({ context });
			}

			const session = await auth.api.getSession({
				headers: context.headers,
			});
			if (!session) {
				// protectedProcedure will reject UNAUTHORIZED a step later; don't
				// double-up on errors here.
				return await next({ context });
			}
			const userId = session.user.id;

			const now = Date.now();
			const bucket = buckets.get(userId);

			if (!bucket || bucket.resetAt <= now) {
				buckets.set(userId, { count: 1, resetAt: now + windowMs });
				return await next({ context });
			}

			if (bucket.count >= limit) {
				const retryAfter = Math.max(
					1,
					Math.ceil((bucket.resetAt - now) / 1000),
				);
				logger.warn("[rate-limit] exceeded", {
					tier,
					userId,
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

export const userExpensiveLimiter = createUserRateLimit({
	tier: "user-expensive",
	limit: 50,
	windowMs: 60_000,
});
