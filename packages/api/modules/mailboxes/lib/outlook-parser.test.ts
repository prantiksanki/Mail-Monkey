import { describe, expect, it } from "vitest";
import type { GraphMessage } from "./outlook-client";
import { parseOutlookMessage } from "./outlook-parser";

function baseMessage(overrides: Partial<GraphMessage> = {}): GraphMessage {
	return {
		id: "msg-1",
		conversationId: "thread-1",
		subject: "Hello",
		bodyPreview: "Hello there",
		receivedDateTime: "2024-01-15T10:00:00Z",
		from: {
			emailAddress: {
				address: "Sender@Example.com",
				name: "Sender Name",
			},
		},
		toRecipients: [
			{
				emailAddress: {
					address: "Recipient@Example.com",
					name: "Recipient Name",
				},
			},
		],
		body: { content: "<p>Hello</p>", contentType: "html" },
		internetMessageHeaders: [],
		...overrides,
	};
}

describe("parseOutlookMessage", () => {
	it("maps basic fields correctly", () => {
		const result = parseOutlookMessage(baseMessage());

		expect(result.id).toBe("msg-1");
		expect(result.threadId).toBe("thread-1");
		expect(result.subject).toBe("Hello");
		expect(result.snippet).toBe("Hello there");
		expect(result.date).toEqual(new Date("2024-01-15T10:00:00Z"));
		expect(result.labelIds).toEqual([]);
	});

	it("handles missing from address gracefully", () => {
		const result = parseOutlookMessage(baseMessage({ from: undefined }));

		expect(result.from).toBe("");
		expect(result.fromEmail).toBe("");
	});

	it("sets bodyHtml when contentType is html", () => {
		const result = parseOutlookMessage(
			baseMessage({
				body: { content: "<p>Hi</p>", contentType: "html" },
			}),
		);

		expect(result.bodyHtml).toBe("<p>Hi</p>");
		expect(result.bodyText).toBe("");
	});

	it("sets bodyText when contentType is text", () => {
		const result = parseOutlookMessage(
			baseMessage({
				body: { content: "Plain text", contentType: "text" },
			}),
		);

		expect(result.bodyText).toBe("Plain text");
		expect(result.bodyHtml).toBe("");
	});

	it("lowercases fromEmail and toEmail", () => {
		const result = parseOutlookMessage(baseMessage());

		expect(result.fromEmail).toBe("sender@example.com");
		expect(result.toEmail).toBe("recipient@example.com");
	});

	it("builds from string with name when name is present", () => {
		const result = parseOutlookMessage(baseMessage());

		expect(result.from).toBe("Sender Name <Sender@Example.com>");
	});

	it("uses bare address as from when name is absent", () => {
		const result = parseOutlookMessage(
			baseMessage({
				from: {
					emailAddress: { address: "noname@example.com", name: "" },
				},
			}),
		);

		expect(result.from).toBe("noname@example.com");
	});

	it("falls back to empty subject and snippet when missing", () => {
		const result = parseOutlookMessage(
			baseMessage({ subject: undefined, bodyPreview: undefined }),
		);

		expect(result.subject).toBe("");
		expect(result.snippet).toBe("");
	});

	it("parses internet message headers into lowercase keys", () => {
		const result = parseOutlookMessage(
			baseMessage({
				internetMessageHeaders: [
					{ name: "X-Spam-Score", value: "0.1" },
					{ name: "Message-ID", value: "<abc@example.com>" },
				],
			}),
		);

		expect(result.headers["x-spam-score"]).toBe("0.1");
		expect(result.headers["message-id"]).toBe("<abc@example.com>");
	});

	it("handles missing toRecipients gracefully", () => {
		const result = parseOutlookMessage(baseMessage({ toRecipients: [] }));

		expect(result.to).toBe("");
		expect(result.toEmail).toBe("");
	});
});
