import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMessage, listMessages } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

export const testGmail = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/test-gmail",
		tags: ["Mailboxes"],
		summary: "Test Gmail API connection",
	})
	.input(
		z.object({
			mailboxId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const list = await listMessages(mailbox.accountId, { maxResults: 1 });

		if (!list.messages?.length) {
			return {
				success: true as const,
				message: "Connected but inbox is empty",
				data: null,
			};
		}

		const messageId = list.messages[0].id;
		if (!messageId) {
			throw new Error(
				"Gmail listMessages returned a message without an id",
			);
		}

		const msg = await getMessage(mailbox.accountId, messageId, "metadata");

		const headers = msg.payload?.headers ?? [];
		const subject =
			headers.find((h) => h.name?.toLowerCase() === "subject")?.value ??
			"(No subject)";
		const from =
			headers.find((h) => h.name?.toLowerCase() === "from")?.value ??
			"(Unknown sender)";

		return {
			success: true as const,
			message: "Gmail API connection successful",
			data: { subject, from, snippet: msg.snippet ?? "" },
		};
	});
