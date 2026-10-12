import { getEmailById, updateEmailLabels } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveLabelNameToId } from "../lib/label-resolver";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership } from "../lib/ownership";

export const applyLabelMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/label",
		tags: ["Mailboxes"],
		summary: "Apply a label to an email message",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			messageId: z.string(),
			label: z.string().min(1).max(100),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		await getMailProvider(mailbox.provider).applyLabel(
			mailbox.accountId,
			input.messageId,
			input.label,
		);

		// Mirror the change in the local DB so the label shows without a
		// resync. applyLabel resolves/creates the label at the provider but
		// only returns void, so re-resolve name -> id the same way
		// searchEmails already does for filtering by label name.
		const localEmail = await getEmailById(input.mailboxId, input.messageId);
		if (localEmail) {
			const labelId = await resolveLabelNameToId(
				mailbox.accountId,
				input.label,
			);
			if (labelId && !localEmail.labelIds.includes(labelId)) {
				await updateEmailLabels(input.messageId, [
					...localEmail.labelIds,
					labelId,
				]);
			}
		}

		return { success: true };
	});
