/**
 * IMAP UIDs are only unique within a single folder, unlike Gmail/Outlook's
 * globally unique message IDs — so every message this integration hands to
 * the rest of the app is identified as "<folder>:<uid>", and every call site
 * that receives one parses it back apart. Shared between imap-provider.ts
 * (per-message actions) and imap-sync.ts (bulk ingestion) so both agree on
 * the same id a synced Email row will later be looked up by.
 */
export function encodeMessageId(folder: string, uid: number): string {
	return `${folder}:${uid}`;
}

export function decodeMessageId(messageId: string): {
	folder: string;
	uid: number;
} {
	const idx = messageId.indexOf(":");
	if (idx === -1) {
		throw new Error(`Malformed IMAP message id: ${messageId}`);
	}
	return {
		folder: messageId.slice(0, idx),
		uid: Number(messageId.slice(idx + 1)),
	};
}
