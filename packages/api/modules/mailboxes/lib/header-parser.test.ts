import { describe, expect, it } from "vitest";
import { parseEmailHeaders } from "./header-parser";

describe("parseEmailHeaders", () => {
	const fullHeaders = {
		From: "ChatGPT <noreply@email.openai.com>",
		To: "user@gmail.com",
		Cc: "team@company.com",
		Bcc: "audit@company.com",
		"Reply-To": "support@company.com",
		Subject: "Welcome",
		Date: "Tue, 10 Dec 2025 12:43:00 +0000",
		"Return-Path": "<bounce@email.openai.com>",
		"DKIM-Signature":
			"v=1; a=rsa-sha256; d=openai.com; s=selector1; h=from:to",
		"Authentication-Results":
			"mx.google.com; spf=pass smtp.mailfrom=email.openai.com; dkim=pass header.i=@openai.com; dmarc=pass",
		Received:
			"from mail.openai.com by mx.google.com with ESMTPS id abc123 (using TLSv1.3)",
	};

	it("extracts the core address fields", () => {
		const parsed = parseEmailHeaders(fullHeaders);
		expect(parsed.from).toBe("ChatGPT <noreply@email.openai.com>");
		expect(parsed.fromEmail).toBe("noreply@email.openai.com");
		expect(parsed.to).toBe("user@gmail.com");
		expect(parsed.cc).toBe("team@company.com");
		expect(parsed.bcc).toBe("audit@company.com");
		expect(parsed.replyTo).toBe("support@company.com");
		expect(parsed.subject).toBe("Welcome");
	});

	it("parses the Date header into an ISO string", () => {
		const parsed = parseEmailHeaders(fullHeaders);
		expect(parsed.date).toBe(
			new Date("2025-12-10T12:43:00Z").toISOString(),
		);
	});

	it("derives mailed-by from Return-Path and signed-by from DKIM d=", () => {
		const parsed = parseEmailHeaders(fullHeaders);
		expect(parsed.mailedBy).toBe("email.openai.com");
		expect(parsed.signedBy).toBe("openai.com");
	});

	it("parses SPF / DKIM / DMARC from Authentication-Results", () => {
		const parsed = parseEmailHeaders(fullHeaders);
		expect(parsed.authentication.spf).toBe("pass");
		expect(parsed.authentication.dkim).toBe("pass");
		expect(parsed.authentication.dmarc).toBe("pass");
	});

	it("detects TLS encryption from the Received header", () => {
		const parsed = parseEmailHeaders(fullHeaders);
		expect(parsed.security.encrypted).toBe(true);
		expect(parsed.security.label).toBe("Standard encryption (TLS)");
		expect(parsed.security.tls).toBe("TLSv1.3");
	});

	it("is case-insensitive about header names", () => {
		const parsed = parseEmailHeaders({
			FROM: "a@b.com",
			SUBJECT: "Hi",
		});
		expect(parsed.fromEmail).toBe("a@b.com");
		expect(parsed.subject).toBe("Hi");
	});

	it("handles missing optional headers gracefully", () => {
		const parsed = parseEmailHeaders({
			From: "a@b.com",
			To: "c@d.com",
			Subject: "No auth",
		});
		expect(parsed.cc).toBeUndefined();
		expect(parsed.bcc).toBeUndefined();
		expect(parsed.replyTo).toBeUndefined();
		expect(parsed.date).toBe("");
		expect(parsed.authentication.spf).toBeUndefined();
		expect(parsed.security.encrypted).toBe(false);
		// mailed-by falls back to the From domain when no Return-Path exists.
		expect(parsed.mailedBy).toBe("b.com");
	});

	it("falls back to From domain for signed-by when DKIM passed without a signature header", () => {
		const parsed = parseEmailHeaders({
			From: "Sender <sender@example.com>",
			"Authentication-Results": "mx; dkim=pass",
		});
		expect(parsed.signedBy).toBe("example.com");
	});

	it("treats a non-TLS Received header as unencrypted", () => {
		const parsed = parseEmailHeaders({
			From: "a@b.com",
			Received: "from local by mx with SMTP id xyz",
		});
		expect(parsed.security.encrypted).toBe(false);
	});

	it("ignores an unparseable Date header", () => {
		const parsed = parseEmailHeaders({
			From: "a@b.com",
			Date: "not-a-date",
		});
		expect(parsed.date).toBe("");
	});
});
