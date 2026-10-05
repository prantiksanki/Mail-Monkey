import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { encodeRfc2822 } from "../lib/email-encoder";
import { createDraft, updateDraft } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

/**
 * Create-or-update a Gmail draft. Used by compose autosave: with no draftId it
 * creates a new draft; with a draftId it updates that draft in place (so
 * continuous typing never duplicates). All content fields are optional.
 */
export const saveDraft = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/drafts",
		tags: ["Mailboxes"],
		summary: "Create or update a draft",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			draftId: z.string().optional(),
			to: z.string().optional(),
			cc: z.string().optional(),
			bcc: z.string().optional(),
			subject: z.string().optional(),
			body: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const raw = encodeRfc2822({
			from: mailbox.email,
			to: input.to,
			cc: input.cc,
			bcc: input.bcc,
			subject: input.subject,
			body: input.body,
		});

		const draft = input.draftId
			? await updateDraft(mailbox.accountId, input.draftId, raw)
			: await createDraft(mailbox.accountId, raw);

		return {
			draftId: draft.id ?? input.draftId ?? null,
			messageId: draft.message?.id ?? null,
		};
	});
