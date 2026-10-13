import { generateWithSarvam, transcribeWithSarvam } from "@repo/ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const schema = z.object({ greeting: z.string() });

describe("generateWithSarvam", () => {
	beforeEach(() => {
		vi.stubEnv("SARVAM_API_KEY", "test-key");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("parses and validates the model's JSON response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: JSON.stringify({
										greeting: "hello",
									}),
								},
							},
						],
					}),
					{ status: 200 },
				),
			),
		);

		const result = await generateWithSarvam({
			system: "sys",
			prompt: "prompt",
			schema,
		});
		expect(result).toEqual({ greeting: "hello" });
	});

	it("strips explicit nulls so optional fields validate as absent, not invalid", async () => {
		// Sarvam emits `null` for fields it considers inapplicable rather than
		// omitting the key (unlike Gemini's generateObject) — observed in prod
		// on payment-classifier's optional fields (merchant, amount, ...),
		// which z.optional() rejects since it only accepts `undefined`.
		const optionalSchema = z.object({
			greeting: z.string(),
			nickname: z.string().optional(),
		});

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: JSON.stringify({
										greeting: "hello",
										nickname: null,
									}),
								},
							},
						],
					}),
					{ status: 200 },
				),
			),
		);

		const result = await generateWithSarvam({
			system: "sys",
			prompt: "prompt",
			schema: optionalSchema,
		});
		expect(result).toEqual({ greeting: "hello" });
	});

	it("throws when the model output is not valid JSON", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						choices: [{ message: { content: "not json" } }],
					}),
					{ status: 200 },
				),
			),
		);

		await expect(
			generateWithSarvam({ system: "sys", prompt: "prompt", schema }),
		).rejects.toThrow(/invalid JSON/);
	});

	it("throws when the parsed JSON does not match the schema", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: JSON.stringify({ wrongField: 1 }),
								},
							},
						],
					}),
					{ status: 200 },
				),
			),
		);

		await expect(
			generateWithSarvam({ system: "sys", prompt: "prompt", schema }),
		).rejects.toThrow(/did not match the expected schema/);
	});

	it("throws when the API responds with a non-OK status", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response("server error", { status: 500 }),
				),
		);

		await expect(
			generateWithSarvam({ system: "sys", prompt: "prompt", schema }),
		).rejects.toThrow(/Sarvam chat completion failed/);
	});
});

describe("transcribeWithSarvam", () => {
	beforeEach(() => {
		vi.stubEnv("SARVAM_API_KEY", "test-key");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("returns the transcript and derived duration", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						request_id: "abc",
						transcript: " hello there ",
						timestamps: { end_time_seconds: [0.5, 1.2, 2.4] },
					}),
					{ status: 200 },
				),
			),
		);

		const result = await transcribeWithSarvam(
			Buffer.from("fake-audio"),
			"audio/webm",
		);
		expect(result).toEqual({
			transcript: "hello there",
			durationSeconds: 2.4,
		});
	});

	it("returns a null duration when no timestamps are present", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ transcript: "hi" }), {
					status: 200,
				}),
			),
		);

		const result = await transcribeWithSarvam(
			Buffer.from("fake-audio"),
			"audio/webm",
		);
		expect(result).toEqual({ transcript: "hi", durationSeconds: null });
	});

	it("throws when the API responds with a non-OK status", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response("bad request", { status: 400 }),
				),
		);

		await expect(
			transcribeWithSarvam(Buffer.from("fake-audio"), "audio/webm"),
		).rejects.toThrow(/Sarvam transcription failed/);
	});
});
