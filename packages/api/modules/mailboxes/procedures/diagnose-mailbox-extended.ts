import { db } from "@repo/database";
import { google } from "googleapis";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { getOAuth2Client } from "../lib/google-auth";

export const diagnoseMailboxExtended = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/diagnose-extended",
		tags: ["Mailboxes"],
		summary: "Extended Gmail watch diagnostics",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
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
			mailboxEmail: mailbox.email,
			accountId: mailbox.accountId,
		};

		try {
			const auth = await getOAuth2Client(mailbox.accountId);
			const gmail = google.gmail({ version: "v1", auth });

			// Get current profile
			const profile = await gmail.users.getProfile({ userId: "me" });
			diagnostics.profile = {
				emailAddress: profile.data.emailAddress,
				emailAddressMatch:
					profile.data.emailAddress?.toLowerCase() ===
					mailbox.email.toLowerCase(),
				currentHistoryId: profile.data.historyId,
				messagesTotal: profile.data.messagesTotal,
			};

			// Check watch state by listing messages (will fail if watch has issues)
			try {
				// This tests if Gmail API is accessible with these tokens
				const messages = await gmail.users.messages.list({
					userId: "me",
					maxResults: 1,
				});
				diagnostics.apiAccess = {
					success: true,
					messageCount: messages.data.resultSizeEstimate,
				};
			} catch (error) {
				diagnostics.apiAccess = {
					success: false,
					error:
						error instanceof Error ? error.message : String(error),
				};
			}

			// Try to get current history (tests if history API works)
			try {
				const history = await gmail.users.history.list({
					userId: "me",
					startHistoryId: profile.data.historyId ?? undefined,
					maxResults: 1,
				});
				diagnostics.historyAccess = {
					success: true,
					currentHistoryId: history.data.historyId,
					hasHistoryItems: (history.data.history?.length ?? 0) > 0,
				};
			} catch (error) {
				diagnostics.historyAccess = {
					success: false,
					error:
						error instanceof Error ? error.message : String(error),
				};
			}

			// Get Pub/Sub topic from ENV
			diagnostics.pubsubTopic = process.env.GOOGLE_PUBSUB_TOPIC;

			return diagnostics;
		} catch (error) {
			diagnostics.error =
				error instanceof Error ? error.message : String(error);
			// Stack traces leak internal file paths/library internals — only
			// useful for local debugging, never to a production API response.
			if (process.env.NODE_ENV !== "production") {
				diagnostics.stack =
					error instanceof Error ? error.stack : undefined;
			}
			return diagnostics;
		}
	});
