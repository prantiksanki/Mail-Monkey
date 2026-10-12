import { countUnreadInbox } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { listImapLabelFolders } from "../lib/imap-provider";
import { verifyMailboxOwnership } from "../lib/ownership";
import { getUserLabelsWithCounts } from "../lib/user-labels";

/**
 * Returns the number of emails carrying each user label in the mailbox, keyed by
 * label name, plus the Inbox unread count shown next to "Inbox" in the sidebar.
 * Labels are derived from the mailbox's rules (a rule's LABEL action), matching
 * how the sidebar builds its label list. Counts match both the label name and
 * its Gmail label ID so rows synced with only the raw ID (e.g. "Label_10") are
 * included.
 */
export const labelCounts = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/inbox/label-counts",
		tags: ["Mailboxes"],
		summary: "Count emails per user label",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const labels = await getUserLabelsWithCounts(mailbox);
		const counts: Record<string, number> = {};
		for (const { name, count } of labels) {
			counts[name] = count;
		}

		// Custom (IMAP) mailboxes: the account's own folders act as labels, so
		// surface them (with unread counts) alongside the rule-created ones.
		const folderLabels: string[] = [];
		if (mailbox.provider === "IMAP") {
			try {
				const folders = await listImapLabelFolders(mailbox.accountId);
				// A rule label that matches a folder (applyLabel copies mail into a
				// folder of that name) shows that folder's unread count instead of
				// the DB count, which is always 0 for IMAP.
				const ruleLabelByLower = new Map(
					Object.keys(counts).map((k) => [k.toLowerCase(), k]),
				);
				for (const { name, unread } of folders) {
					const ruleLabel = ruleLabelByLower.get(name.toLowerCase());
					if (ruleLabel) {
						counts[ruleLabel] = unread;
					} else {
						folderLabels.push(name);
						counts[name] = unread;
					}
				}
			} catch (error) {
				logger.warn("[label-counts] Failed to list IMAP folders", {
					mailboxId: mailbox.id,
					error:
						error instanceof Error ? error.message : String(error),
				});
			}
		}

		const inboxUnreadCount = await countUnreadInbox(mailbox.id);

		return { counts, folderLabels, inboxUnreadCount };
	});
