import { ORPCError, os } from "@orpc/server";
import { auth } from "@repo/auth";
import { logger } from "@repo/logs";

export const publicProcedure = os.$context<{
	headers: Headers;
}>();

export const protectedProcedure = publicProcedure.use(
	async ({ context, next }) => {
		let session: Awaited<ReturnType<typeof auth.api.getSession>>;

		try {
			session = await auth.api.getSession({
				headers: context.headers,
			});
		} catch (error) {
			// The session store (DB) failed to answer, not "no session" - a
			// generic UNAUTHORIZED would make callers treat this identically
			// to a logged-out user. Surface it distinctly so it's diagnosable
			// and callers can retry instead of bouncing to login.
			logger.error("Session lookup failed", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Could not verify your session. Please try again.",
			});
		}

		if (!session) {
			throw new ORPCError("UNAUTHORIZED");
		}

		return await next({
			context: {
				session: session.session,
				user: session.user,
			},
		});
	},
);

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		if (context.user.role !== "admin") {
			throw new ORPCError("FORBIDDEN");
		}

		if (!context.user.twoFactorEnabled) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Two-factor authentication is required for administrative access.",
			});
		}

		return await next();
	},
);
