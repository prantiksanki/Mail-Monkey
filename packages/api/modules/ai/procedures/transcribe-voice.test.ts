import { describe, expect, it } from "vitest";
import {
	isEffectivelySilent,
	MAX_BASE64_LENGTH,
	TranscribeVoiceInputSchema,
} from "./transcribe-voice.schema";

describe("TranscribeVoiceInputSchema", () => {
	it("accepts a minimal valid input", () => {
		const result = TranscribeVoiceInputSchema.safeParse({
			audio: "aGVsbG8=",
			mediaType: "audio/webm",
		});
		expect(result.success).toBe(true);
	});

	it("rejects an empty audio string", () => {
		const result = TranscribeVoiceInputSchema.safeParse({
			audio: "",
			mediaType: "audio/webm",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a missing mediaType", () => {
		const result = TranscribeVoiceInputSchema.safeParse({
			audio: "aGVsbG8=",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a mediaType outside the supported enum", () => {
		const result = TranscribeVoiceInputSchema.safeParse({
			audio: "aGVsbG8=",
			mediaType: "audio/aac",
		});
		expect(result.success).toBe(false);
	});

	it("accepts every supported mediaType", () => {
		for (const mediaType of [
			"audio/webm",
			"audio/mp4",
			"audio/wav",
			"audio/ogg",
		]) {
			const result = TranscribeVoiceInputSchema.safeParse({
				audio: "aGVsbG8=",
				mediaType,
			});
			expect(result.success).toBe(true);
		}
	});

	it("accepts an audio string right at the length cap", () => {
		const audio = "a".repeat(MAX_BASE64_LENGTH);
		const result = TranscribeVoiceInputSchema.safeParse({
			audio,
			mediaType: "audio/webm",
		});
		expect(result.success).toBe(true);
	});

	it("rejects an audio string one character over the length cap", () => {
		const audio = "a".repeat(MAX_BASE64_LENGTH + 1);
		const result = TranscribeVoiceInputSchema.safeParse({
			audio,
			mediaType: "audio/webm",
		});
		expect(result.success).toBe(false);
	});
});

describe("isEffectivelySilent", () => {
	it("flags an empty string", () => {
		expect(isEffectivelySilent("")).toBe(true);
	});

	it("flags a whitespace-only string", () => {
		expect(isEffectivelySilent("   \n\t")).toBe(true);
	});

	it("does not flag genuine speech", () => {
		expect(isEffectivelySilent("Let's meet at noon tomorrow.")).toBe(false);
	});

	it("does not flag a short transcript", () => {
		expect(isEffectivelySilent("you")).toBe(false);
	});
});
