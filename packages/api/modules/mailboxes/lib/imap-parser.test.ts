import { describe, expect, it } from "vitest";
import { isUnreadFromFlags, parseImapMessage } from "./imap-parser";

function rawMessage(overrides: { references?: string } = {}): Buffer {
	const referencesHeader = overrides.references
		? `References: ${overrides.references}\r\n`
		: "";
	return Buffer.from(
		"From: Sender Name <sender@example.com>\r\n" +
			"To: Recipient Name <recipient@example.com>\r\n" +
			"Subject: Hello there\r\n" +
			"Date: Mon, 15 Jan 2024 10:00:00 +0000\r\n" +
			"Message-ID: <msg-1@example.com>\r\n" +
			referencesHeader +
			"Content-Type: text/plain; charset=utf-8\r\n" +
			"\r\n" +
			"This is the body of the email.\r\n",
	);
}

describe("parseImapMessage", () => {
	it("maps basic fields from a raw RFC 5322 message", async () => {
		const result = await parseImapMessage({
			uid: 42,
			flags: new Set(["\\Seen"]),
			source: rawMessage(),
		});

		expect(result.id).toBe("42");
		expect(result.from).toContain("Sender Name");
		expect(result.fromEmail).toBe("sender@example.com");
		expect(result.toEmail).toBe("recipient@example.com");
		expect(result.subject).toBe("Hello there");
		expect(result.bodyText.trim()).toBe("This is the body of the email.");
		expect(result.labelIds).toContain("SEEN");
	});

	it("derives threadId from References when present", async () => {
		const result = await parseImapMessage({
			uid: 43,
			flags: new Set(),
			source: rawMessage({ references: "<root@example.com>" }),
		});
		expect(result.threadId).toBe("<root@example.com>");
	});

	it("falls back to the message's own id when there is no thread ancestry", async () => {
		const result = await parseImapMessage({
			uid: 44,
			flags: new Set(),
			source: rawMessage(),
		});
		expect(result.threadId).toBe("<msg-1@example.com>");
	});

	it("has no SEEN label when the \\Seen flag is absent", async () => {
		const result = await parseImapMessage({
			uid: 45,
			flags: new Set(["\\Flagged"]),
			source: rawMessage(),
		});
		expect(result.labelIds).not.toContain("SEEN");
		expect(result.labelIds).toContain("STARRED");
	});
});

describe("isUnreadFromFlags", () => {
	it("is unread when \\Seen is absent", () => {
		expect(isUnreadFromFlags(new Set())).toBe(true);
		expect(isUnreadFromFlags(new Set(["\\Flagged"]))).toBe(true);
	});

	it("is read when \\Seen is present", () => {
		expect(isUnreadFromFlags(new Set(["\\Seen"]))).toBe(false);
	});
});
