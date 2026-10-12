import { describe, expect, it } from "vitest";
import {
	buildVoiceEmailPrompt,
	ComposeVoiceEmailInputSchema,
	ComposeVoiceEmailResultSchema,
	MAX_TRANSCRIPT_CHARS,
	VOICE_EMAIL_TONES,
} from "./compose-voice-email.schema";

describe("ComposeVoiceEmailInputSchema", () => {
	it("accepts a minimal valid input", () => {
		const result = ComposeVoiceEmailInputSchema.safeParse({
			transcript: "let's sync next tuesday",
		});
		expect(result.success).toBe(true);
	});

	it("rejects an empty transcript", () => {
		const result = ComposeVoiceEmailInputSchema.safeParse({
			transcript: "",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a transcript over the length cap", () => {
		const result = ComposeVoiceEmailInputSchema.safeParse({
			transcript: "a".repeat(MAX_TRANSCRIPT_CHARS + 1),
		});
		expect(result.success).toBe(false);
	});
});

describe("ComposeVoiceEmailResultSchema", () => {
	it("requires exactly one draft per tone", () => {
		const result = ComposeVoiceEmailResultSchema.safeParse({
			drafts: VOICE_EMAIL_TONES.map((tone) => ({
				tone,
				subject: "Subject",
				body: "Body",
			})),
		});
		expect(result.success).toBe(true);
	});

	it("rejects a result with a missing tone", () => {
		const result = ComposeVoiceEmailResultSchema.safeParse({
			drafts: VOICE_EMAIL_TONES.slice(0, 3).map((tone) => ({
				tone,
				subject: "Subject",
				body: "Body",
			})),
		});
		expect(result.success).toBe(false);
	});

	it("rejects a draft with a tone outside the enum", () => {
		const result = ComposeVoiceEmailResultSchema.safeParse({
			drafts: [
				{ tone: "sarcastic", subject: "Subject", body: "Body" },
				...VOICE_EMAIL_TONES.slice(1).map((tone) => ({
					tone,
					subject: "Subject",
					body: "Body",
				})),
			],
		});
		expect(result.success).toBe(false);
	});
});

describe("buildVoiceEmailPrompt", () => {
	it("includes the transcript", () => {
		const prompt = buildVoiceEmailPrompt({
			transcript: "we need to sync on q3",
		});
		expect(prompt).toContain("we need to sync on q3");
	});

	it("truncates an over-long transcript to the cap", () => {
		const transcript = "a".repeat(MAX_TRANSCRIPT_CHARS + 500);
		const prompt = buildVoiceEmailPrompt({ transcript });
		expect(prompt).toContain("a".repeat(MAX_TRANSCRIPT_CHARS));
		expect(prompt).not.toContain("a".repeat(MAX_TRANSCRIPT_CHARS + 1));
	});
});
