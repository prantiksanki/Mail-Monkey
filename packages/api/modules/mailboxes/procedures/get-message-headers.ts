import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMessage } from "../lib/gmail-client";
import { parseEmailHeaders } from "../lib/header-parser";
import { imapProvider } from "../lib/imap-provider";
import { getOutlookMessage } from "../lib/outlook-client";
import { verifyMailboxOwnership } from "../lib/ownership";

// Returns the Gmail-style "sender details" metadata for a single message.
//
// Raw headers are not persisted on the Email row, so they are fetched live from
// the provider on demand (only when the user opens the details popup). Gmail's
// "full" format and Outlook's `internetMessageHeaders` both expose the complete
// raw header set, including DKIM-Signature, Authentication-Results, Return-Path
// and Received — everything the parser needs.
export const getMessageHeaders = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/headers",
		tags: ["Mailboxes"],
		summary:
			"Get parsed email header metadata for the sender details popup",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			messageId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		let rawHeaders: Record<string, string> = {};

		if (mailbox.provider === "IMAP") {
			const parsed = await imapProvider.getParsedMessage(
				mailbox.accountId,
				input.messageId,
			);
			rawHeaders = parsed.headers;
		} else if (mailbox.provider === "OUTLOOK") {
			const msg = await getOutlookMessage(
				mailbox.accountId,
				input.messageId,
			);
			for (const h of msg.internetMessageHeaders ?? []) {
				rawHeaders[h.name.toLowerCase()] = h.value;
			}
		} else {
			const msg = await getMessage(
				mailbox.accountId,
				input.messageId,
				"full",
			);
			for (const h of msg.payload?.headers ?? []) {
				if (h.name && typeof h.value === "string") {
					rawHeaders[h.name.toLowerCase()] = h.value;
				}
			}
		}

		return parseEmailHeaders(rawHeaders);
	});
