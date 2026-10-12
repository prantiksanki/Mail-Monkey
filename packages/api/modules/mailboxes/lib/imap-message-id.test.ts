import { describe, expect, it } from "vitest";
import { decodeMessageId, encodeMessageId } from "./imap-message-id";

describe("imap-message-id", () => {
	it("round-trips folder and uid", () => {
		const id = encodeMessageId("INBOX", 42);
		expect(id).toBe("INBOX:42");
		expect(decodeMessageId(id)).toEqual({ folder: "INBOX", uid: 42 });
	});

	it("handles folder names containing a colon-adjacent path delimiter", () => {
		const id = encodeMessageId("Labels/Work", 7);
		expect(decodeMessageId(id)).toEqual({ folder: "Labels/Work", uid: 7 });
	});

	it("throws on a malformed id with no separator", () => {
		expect(() => decodeMessageId("not-a-valid-id")).toThrow(
			/Malformed IMAP message id/,
		);
	});
});
