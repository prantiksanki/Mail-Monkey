import { db } from "@repo/database";
import { google } from "googleapis";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { getOAuth2Client } from "../lib/google-auth";

export const diagnoseMailbox = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/diagnose",
		tags: ["Mailboxes"],
		summary: "Diagnose mailbox watch issues",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		// 1. Fetch mailbox with account
		const mailbox = await db.mailbox.findUnique({
			where: { id: input.mailboxId },
			include: { account: true },
		});

		if (!mailbox) {
			return { error: "Mailbox not found" };
		}

		if (mailbox.userId !== context.user.id) {
			return { error: "Not your mailbox" };
		}

		const diagnostics: Record<string, unknown> = {
			mailbox: {
				id: mailbox.id,
				email: mailbox.email,
				accountId: mailbox.accountId,
				watchEnabled: mailbox.watchEnabled,
				watchExpiry: mailbox.watchExpiry,
				lastHistoryId: mailbox.lastHistoryId,
			},
			account: {
				id: mailbox.account.id,
				providerId: mailbox.account.providerId,
				accountId: mailbox.account.accountId, // Google sub
				hasAccessToken: !!mailbox.account.accessToken,
				hasRefreshToken: !!mailbox.account.refreshToken,
				accessTokenExpiresAt: mailbox.account.accessTokenExpiresAt,
				scope: mailbox.account.scope,
			},
		};

		// 2. Check ALL accounts for this user (detect duplicates)
		const allAccounts = await db.account.findMany({
			where: { userId: context.user.id, providerId: "google" },
			select: {
				id: true,
				accountId: true,
				scope: true,
				accessTokenExpiresAt: true,
				createdAt: true,
			},
		});
		diagnostics.allGoogleAccounts = allAccounts;

		// 3. Check ALL mailboxes for this user
		const allMailboxes = await db.mailbox.findMany({
			where: { userId: context.user.id },
			select: {
				id: true,
				email: true,
				accountId: true,
				watchEnabled: true,
				watchExpiry: true,
				lastHistoryId: true,
			},
		});
		diagnostics.allMailboxes = allMailboxes;

		// 4. Verify token identity — which Gmail account do the tokens authenticate as?
		try {
			const auth = await getOAuth2Client(mailbox.accountId);
			const gmail = google.gmail({ version: "v1", auth });
			const profile = await gmail.users.getProfile({ userId: "me" });

			diagnostics.tokenIdentity = {
				authenticatedAs: profile.data.emailAddress,
				currentHistoryId: profile.data.historyId,
				messagesTotal: profile.data.messagesTotal,
				threadsTotal: profile.data.threadsTotal,
			};

			// Critical check: does the token identity match the mailbox email?
			diagnostics.identityMatch =
				profile.data.emailAddress?.toLowerCase() ===
				mailbox.email.toLowerCase();
		} catch (error) {
			diagnostics.tokenIdentity = {
				error: error instanceof Error ? error.message : String(error),
			};
			diagnostics.identityMatch = false;
		}

		// 5. Check Pub/Sub topic
		diagnostics.pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC;

		return diagnostics;
	});
