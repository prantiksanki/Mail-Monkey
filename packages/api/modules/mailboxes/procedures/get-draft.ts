import { ORPCError } from "@orpc/client";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getDraft } from "../lib/gmail-client";
import { getImapDraft } from "../lib/imap-drafts";
import { verifyMailboxOwnership } from "../lib/ownership";
import { looksLikeHtml } from "../lib/sanitize-html";

/** Decodes a base64url string (Gmail's raw message encoding) to UTF-8. */
function decodeBase64Url(data: string): string {
	return Buffer.from(
		data.replace(/-/g, "+").replace(/_/g, "/"),
		"base64",
	).toString("utf-8");
}

/**
 * Parses To/Cc/Bcc/Subject and the body out of a raw RFC822 message. Reading
 * the raw draft (rather than Gmail's parsed metadata) is what makes Cc and
 * especially Bcc survive — Gmail omits Bcc from the structured
 * `payload.headers` it returns from drafts.get with format "full".
 *
 * Decodes the body per its Content-Transfer-Encoding and reports whether it is
 * HTML (from the Content-Type, or as a fallback for legacy text/plain drafts
 * whose body is actually HTML markup).
 */
function parseRawDraft(raw: string) {
	const normalized = raw.replace(/\r\n/g, "\n");
	const splitAt = normalized.indexOf("\n\n");
	const headerBlock =
		splitAt === -1 ? normalized : normalized.slice(0, splitAt);
	let body = splitAt === -1 ? "" : normalized.slice(splitAt + 2);

	// Unfold folded headers (continuation lines start with whitespace).
	const unfolded = headerBlock.replace(/\n[ \t]+/g, " ");
	const headers: Record<string, string> = {};
	for (const line of unfolded.split("\n")) {
		const idx = line.indexOf(":");
		if (idx === -1) {
			continue;
		}
		const name = line.slice(0, idx).trim().toLowerCase();
		const value = line.slice(idx + 1).trim();
		if (name && !(name in headers)) {
			headers[name] = value;
		}
	}

	// Decode the body if it was base64 transfer-encoded (HTML drafts are).
	if (
		headers["content-transfer-encoding"]?.toLowerCase().trim() === "base64"
	) {
		body = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
	}
	body = body.trim();

	const contentType = headers["content-type"]?.toLowerCase() ?? "";
	const isHtml = contentType.includes("text/html") || looksLikeHtml(body);

	return {
		to: headers.to ?? "",
		cc: headers.cc ?? "",
		bcc: headers.bcc ?? "",
		subject: headers.subject ?? "",
		body,
		isHtml,
	};
}

/**
 * Returns a draft's editable fields so it can be reopened in the compose
 * dialog. Reads live from Gmail (the source of truth for drafts).
 */
export const getDraftProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/drafts/{draftId}",
		tags: ["Mailboxes"],
		summary: "Get a draft's editable content",
	})
	.input(z.object({ mailboxId: z.string(), draftId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		if (mailbox.provider === "OUTLOOK") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Drafts aren't supported for Outlook mailboxes yet.",
			});
		}

		if (mailbox.provider === "IMAP") {
			const imapDraft = await getImapDraft(
				mailbox.accountId,
				input.draftId,
			);
			if (!imapDraft) {
				throw new ORPCError("NOT_FOUND", {
					message: "This draft no longer exists.",
				});
			}
			return {
				draftId: input.draftId,
				to: imapDraft.to,
				cc: imapDraft.cc,
				bcc: imapDraft.bcc,
				subject: imapDraft.subject,
				body: imapDraft.html ? "" : imapDraft.text,
				bodyHtml: imapDraft.html || undefined,
			};
		}

		const draft = await getDraft(mailbox.accountId, input.draftId, "raw");
		const rawData = draft.message?.raw;
		if (!rawData) {
			throw new ORPCError("NOT_FOUND", {
				message: "This draft no longer exists.",
			});
		}

		const parsed = parseRawDraft(decodeBase64Url(rawData));

		return {
			draftId: input.draftId,
			to: parsed.to,
			cc: parsed.cc,
			bcc: parsed.bcc,
			subject: parsed.subject,
			// `body` stays for back-compat / plain-text drafts; `bodyHtml` is set
			// when the draft is rich content so the editor renders it (not raw
			// markup).
			body: parsed.isHtml ? "" : parsed.body,
			bodyHtml: parsed.isHtml ? parsed.body : undefined,
		};
	});
