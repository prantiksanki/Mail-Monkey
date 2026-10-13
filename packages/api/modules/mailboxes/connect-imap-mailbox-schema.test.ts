import { describe, expect, it } from "vitest";
import { ConnectImapMailboxSchema } from "./types";

const valid = {
	email: "support@mailmonkey.app",
	password: "an-app-specific-password",
	imapHost: "imap.example.com",
	smtpHost: "smtp.example.com",
};

describe("ConnectImapMailboxSchema", () => {
	it("accepts a valid input and applies default ports/secure flags", () => {
		const result = ConnectImapMailboxSchema.parse(valid);
		expect(result.imapPort).toBe(993);
		expect(result.smtpPort).toBe(465);
		expect(result.imapSecure).toBe(true);
		expect(result.smtpSecure).toBe(true);
	});

	it("rejects an invalid email", () => {
		const result = ConnectImapMailboxSchema.safeParse({
			...valid,
			email: "not-an-email",
		});
		expect(result.success).toBe(false);
	});

	it("rejects an empty password", () => {
		const result = ConnectImapMailboxSchema.safeParse({
			...valid,
			password: "",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a missing IMAP host", () => {
		const { imapHost, ...withoutHost } = valid;
		const result = ConnectImapMailboxSchema.safeParse(withoutHost);
		expect(result.success).toBe(false);
	});

	it("rejects a port outside the valid range", () => {
		const result = ConnectImapMailboxSchema.safeParse({
			...valid,
			imapPort: 70000,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a non-positive port", () => {
		const result = ConnectImapMailboxSchema.safeParse({
			...valid,
			smtpPort: 0,
		});
		expect(result.success).toBe(false);
	});
});
