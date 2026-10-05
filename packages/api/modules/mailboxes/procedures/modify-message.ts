import { updateEmailLabels } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { modifyMessageLabels } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

const actionSchema = z.enum([
	"archive",
	"trash",
	"untrash",
	"markRead",
	"markUnread",
]);

export const modifyMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/messages/{messageId}/modify",
		tags: ["Mailboxes"],
		summary: "Archive, trash, or change read state of a message",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			messageId: z.string(),
			action: actionSchema,
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const { action, messageId } = input;
		const accountId = mailbox.accountId;

		let addLabels: string[] = [];
		let removeLabels: string[] = [];

		switch (action) {
			case "archive":
				removeLabels = ["INBOX"];
				break;
			case "trash":
				addLabels = ["TRASH"];
				removeLabels = ["INBOX"];
				break;
			case "untrash":
				addLabels = ["INBOX"];
				removeLabels = ["TRASH"];
				break;
			case "markRead":
				removeLabels = ["UNREAD"];
				break;
			case "markUnread":
				addLabels = ["UNREAD"];
				break;
		}

		// Apply to Gmail
		const updated = await modifyMessageLabels(
			accountId,
			messageId,
			addLabels,
			removeLabels,
		);

		// Mirror to local DB — fire-and-forget, non-blocking
		const newLabelIds = updated.labelIds ?? [];
		if (newLabelIds.length > 0) {
			void updateEmailLabels(messageId, newLabelIds).catch(() => {
				// Ignore — DB may not have this email yet (still syncing)
			});
		}

		return { success: true };
	});
