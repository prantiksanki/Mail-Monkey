import { ORPCError } from "@orpc/client";
import {
	createSnoozedEmail,
	getEmailById,
	updateEmailLabels,
} from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMessage, modifyMessageLabels } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

export const snoozeMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/snooze",
		tags: ["Mailboxes"],
		summary: "Snooze an email until a chosen time",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			messageId: z.string(),
			snoozeUntil: z.string().datetime(),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const snoozeUntil = new Date(input.snoozeUntil);
		// Require a future time (small grace window for clock skew).
		if (snoozeUntil.getTime() <= Date.now() - 60_000) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Snooze time must be in the future.",
			});
		}

		// Remove from the Gmail inbox.
		await modifyMessageLabels(
			mailbox.accountId,
			input.messageId,
			[],
			["INBOX"],
		);

		// Gather display fields + original labels. Prefer the local Email row
		// (and update it so the message leaves the DB-served inbox at once);
		// otherwise fall back to one Gmail metadata fetch.
		let from = "";
		let subject = "(No subject)";
		let snippet = "";
		let internalDate = new Date();
		let isUnread = true;
		let threadId: string | null = null;
		let originalLabelIds: string[] = ["INBOX"];

		const localEmail = await getEmailById(input.mailboxId, input.messageId);
		if (localEmail) {
			from = localEmail.from;
			subject = localEmail.subject || "(No subject)";
			snippet = localEmail.snippet;
			internalDate = localEmail.internalDate;
			isUnread = localEmail.isUnread;
			threadId = localEmail.threadId;
			originalLabelIds = localEmail.labelIds;

			await updateEmailLabels(
				input.messageId,
				localEmail.labelIds.filter((l) => l !== "INBOX"),
			);
		} else {
			try {
				const msg = await getMessage(
					mailbox.accountId,
					input.messageId,
					"metadata",
				);
				const headers = msg.payload?.headers ?? [];
				const getHeader = (name: string) =>
					headers.find(
						(h) => h.name?.toLowerCase() === name.toLowerCase(),
					)?.value ?? "";
				const fromRaw = getHeader("from");
				const nameMatch = fromRaw.match(/^([^<]+)</);
				from = nameMatch ? nameMatch[1].trim() : fromRaw;
				subject = getHeader("subject") || "(No subject)";
				snippet = msg.snippet ?? "";
				internalDate = msg.internalDate
					? new Date(Number(msg.internalDate))
					: new Date();
				isUnread = (msg.labelIds ?? []).includes("UNREAD");
				threadId = msg.threadId ?? null;
			} catch {
				// Non-fatal — keep defaults so the snooze still records.
			}
		}

		const snoozed = await createSnoozedEmail({
			mailboxId: input.mailboxId,
			messageId: input.messageId,
			threadId,
			from,
			subject,
			snippet,
			internalDate,
			isUnread,
			originalLabelIds,
			snoozeUntil,
		});

		return {
			id: snoozed.id,
			snoozeUntil: snoozed.snoozeUntil.toISOString(),
		};
	});
