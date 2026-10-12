import { updateMailboxCountInUserSubscription } from "@repo/auth";
import { deleteAccountById, deleteMailboxById } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { revokeOAuthToken } from "../lib/google-auth";
import { verifyMailboxOwnership } from "../lib/ownership";
import { disableWatchForMailbox } from "../lib/watch-manager";

export const disconnectMailbox = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/disconnect",
		tags: ["Mailboxes"],
		summary: "Disconnect a mailbox",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const provider = mailbox.provider as "GOOGLE" | "OUTLOOK" | "IMAP";

		// 1. Stop watch / subscription (best-effort)
		if (mailbox.watchEnabled) {
			try {
				await disableWatchForMailbox(
					mailbox.id,
					mailbox.accountId,
					provider,
					mailbox.subscriptionId,
				);
			} catch (error) {
				logger.warn("Failed to disable watch during disconnect", {
					mailboxId: mailbox.id,
					error:
						error instanceof Error ? error.message : String(error),
				});
			}
		}

		// 2. Revoke OAuth token — Google only (Microsoft has no revoke endpoint)
		if (provider === "GOOGLE") {
			await revokeOAuthToken(mailbox.accountId);
		}

		// 3. Delete Mailbox (cascades: Rules, RuleExecutionLogs, MailboxUsageTracking)
		await deleteMailboxById(mailbox.id);

		// 4. Delete Account record (OAuth tokens)
		await deleteAccountById(mailbox.accountId);

		// 5. Update subscription seat count
		await updateMailboxCountInUserSubscription(context.user.id);

		logger.info("Mailbox disconnected", {
			mailboxId: mailbox.id,
			accountId: mailbox.accountId,
			userId: context.user.id,
			email: mailbox.email,
			provider,
		});

		return { success: true };
	});
