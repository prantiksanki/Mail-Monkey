import { describe, expect, it } from "vitest";
import {
	buildDraftPrompt,
	DRAFT_TONES,
	GenerateDraftsInputSchema,
	GenerateDraftsResultSchema,
} from "./generate-drafts.prompt";

describe("GenerateDraftsInputSchema", () => {
	it("accepts a minimal valid input", () => {
		const result = GenerateDraftsInputSchema.safeParse({
			mailboxId: "mb_1",
			body: "Can we meet Thursday?",
		});
		expect(result.success).toBe(true);
	});

	it("rejects an empty body", () => {
		const result = GenerateDraftsInputSchema.safeParse({
			mailboxId: "mb_1",
			body: "",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a missing mailboxId", () => {
		const result = GenerateDraftsInputSchema.safeParse({
			body: "Hello there",
		});
		expect(result.success).toBe(false);
	});
});

describe("buildDraftPrompt", () => {
	it("includes the subject, body and signature", () => {
		const prompt = buildDraftPrompt({
			mailboxId: "mb_1",
			subject: "Project proposal review",
			body: "Please bring the budget breakdown.",
			fromName: "Sarah Mitchell",
			fromEmail: "sarah@acme.com",
			senderName: "Nayan",
		});
		expect(prompt).toContain("Project proposal review");
		expect(prompt).toContain("Please bring the budget breakdown.");
		expect(prompt).toContain("Sarah Mitchell");
		expect(prompt).toContain("Nayan");
	});

	it("falls back gracefully when optional fields are missing", () => {
		const prompt = buildDraftPrompt({
			mailboxId: "mb_1",
			body: "Hi there",
		});
		expect(prompt).toContain("(no subject)");
		expect(prompt).toContain("the sender");
		expect(prompt).toContain("omit the name line");
	});

	it("truncates very long bodies", () => {
		const longBody = "a".repeat(10_000);
		const prompt = buildDraftPrompt({ mailboxId: "mb_1", body: longBody });
		expect(prompt).not.toContain("a".repeat(6_001));
	});
});

describe("GenerateDraftsResultSchema", () => {
	it("requires exactly three drafts across the known tones", () => {
		const result = GenerateDraftsResultSchema.safeParse({
			intent: "The sender wants to schedule a call.",
			drafts: DRAFT_TONES.map((tone) => ({
				tone,
				confidence: "high",
				body: "Sounds good.",
			})),
		});
		expect(result.success).toBe(true);
	});

	it("rejects a result with fewer than three drafts", () => {
		const result = GenerateDraftsResultSchema.safeParse({
			intent: "x",
			drafts: [{ tone: "professional", confidence: "high", body: "Hi" }],
		});
		expect(result.success).toBe(false);
	});
});
