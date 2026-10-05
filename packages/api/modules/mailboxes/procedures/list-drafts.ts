import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { parseGmailMessage } from "../lib/email-parser";
import { getDraft, listDrafts } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

/** Strips HTML tags/entities so a rich draft's snippet reads as plain text. */
function snippetToText(snippet: string): string {
	return snippet
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

export const listDraftsProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/drafts",
		tags: ["Mailboxes"],
		summary: "List drafts",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const list = await listDrafts(mailbox.accountId, { maxResults: 50 });
		const draftRefs = list.drafts ?? [];

		// drafts.list only returns ids, so fetch metadata per draft to render
		// the row (recipient/subject/snippet/date).
		const drafts = await Promise.all(
			draftRefs.map(async (ref) => {
				if (!ref.id) {
					return null;
				}
				const draft = await getDraft(
					mailbox.accountId,
					ref.id,
					"metadata",
				);
				const message = draft.message;
				const parsed = message
					? parseGmailMessage(
							message as Parameters<typeof parseGmailMessage>[0],
						)
					: null;
				return {
					draftId: ref.id,
					messageId: message?.id ?? null,
					to: parsed?.to ?? "",
					subject: parsed?.subject ?? "",
					snippet: snippetToText(parsed?.snippet ?? ""),
					date: parsed
						? parsed.date.toISOString()
						: new Date().toISOString(),
				};
			}),
		);

		return {
			drafts: drafts.filter(
				(d): d is NonNullable<typeof d> => d !== null,
			),
		};
	});
