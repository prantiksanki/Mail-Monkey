import { logger } from "@repo/logs";
import type { z } from "zod";

// Hosted free-tier backend for both text generation and speech-to-text —
// replaces the previous in-process TinyLlama (node-llama-cpp) and Whisper
// (@xenova/transformers) models. Sarvam is a plain HTTPS API, so unlike its
// predecessors there's no model download, no native binary, and no
// in-process warm state to manage.

const SARVAM_API_BASE = "https://api.sarvam.ai";
export const SARVAM_CHAT_MODEL_ID = "sarvam-105b";
export const SARVAM_STT_MODEL_ID = "saaras:v3";

function apiKey(): string {
	const key = process.env.SARVAM_API_KEY;
	if (!key) {
		throw new Error("SARVAM_API_KEY is not configured");
	}
	return key;
}

export interface GenerateWithSarvamParams<T> {
	system: string;
	prompt: string;
	schema: z.ZodType<T>;
	/** Passed through to Sarvam as-is; omit to use the API's default. */
	temperature?: number;
}

/**
 * Generate JSON output from Sarvam's chat completions API and validate it
 * against `schema`. Throws on a generation failure or a schema mismatch —
 * callers are expected to catch and translate into a clean user-facing
 * error.
 */
export async function generateWithSarvam<T>({
	system,
	prompt,
	schema,
	temperature,
}: GenerateWithSarvamParams<T>): Promise<T> {
	logger.info(
		`[sarvam] request model=${SARVAM_CHAT_MODEL_ID} op=chat-completion`,
	);

	const response = await fetch(`${SARVAM_API_BASE}/v1/chat/completions`, {
		method: "POST",
		headers: {
			"api-subscription-key": apiKey(),
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: SARVAM_CHAT_MODEL_ID,
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: prompt },
			],
			response_format: { type: "json_object" },
			...(temperature === undefined ? {} : { temperature }),
			// Disable thinking mode — reasoning tokens count against max_tokens
			// and can consume the whole budget before any content is written,
			// leaving `message.content` empty.
			reasoning_effort: null,
			max_tokens: 2048,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		logger.error(
			`[sarvam] response model=${SARVAM_CHAT_MODEL_ID} op=chat-completion status=${response.status} failed`,
		);
		throw new Error(
			`Sarvam chat completion failed: ${response.status} ${errorText}`,
		);
	}

	const data = await response.json();
	const message = data?.choices?.[0]?.message;
	let raw = message?.content;
	// Some Sarvam responses (thinking mode / certain finish_reasons) put the
	// answer in reasoning_content and leave content empty — fall back to it
	// rather than failing outright.
	if (typeof raw !== "string" || raw.trim().length === 0) {
		if (typeof message?.reasoning_content === "string") {
			raw = message.reasoning_content;
		}
	}
	if (typeof raw !== "string" || raw.trim().length === 0) {
		logger.error(
			`[sarvam] response model=${SARVAM_CHAT_MODEL_ID} op=chat-completion status=${response.status} empty-content raw=${JSON.stringify(data).slice(0, 2000)}`,
		);
		throw new Error("Sarvam returned no completion content");
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		logger.error(
			`[sarvam] response model=${SARVAM_CHAT_MODEL_ID} op=chat-completion status=${response.status} invalid-json`,
		);
		throw new Error("Sarvam returned invalid JSON");
	}

	// Sarvam emits explicit `null` for fields it considers inapplicable
	// rather than omitting the key (unlike Gemini's generateObject) — strip
	// those so z.optional() schemas (which accept `undefined`, not `null`)
	// validate the way every caller already expects.
	if (
		parsed !== null &&
		typeof parsed === "object" &&
		!Array.isArray(parsed)
	) {
		for (const [key, value] of Object.entries(
			parsed as Record<string, unknown>,
		)) {
			if (value === null) {
				delete (parsed as Record<string, unknown>)[key];
			}
		}
	}

	const result = schema.safeParse(parsed);
	if (!result.success) {
		logger.error(
			`[sarvam] response model=${SARVAM_CHAT_MODEL_ID} op=chat-completion status=${response.status} schema-mismatch`,
		);
		throw new Error(
			`Sarvam output did not match the expected schema: ${result.error.message}`,
		);
	}

	logger.info(
		`[sarvam] response model=${SARVAM_CHAT_MODEL_ID} op=chat-completion status=${response.status} ok`,
	);
	return result.data;
}

/**
 * Transcribe an audio buffer via Sarvam's Speech-to-Text API. Sarvam accepts
 * compressed audio directly (webm, mp4, wav, ogg, ...), so no local decode
 * or resample step is needed before sending it.
 */
export async function transcribeWithSarvam(
	buffer: Buffer,
	mediaType: string,
): Promise<{ transcript: string; durationSeconds: number | null }> {
	logger.info(
		`[sarvam] request model=${SARVAM_STT_MODEL_ID} op=speech-to-text`,
	);

	const form = new FormData();
	const extension = mediaType.split("/")[1] ?? "webm";
	const bytes = Uint8Array.from(buffer);
	form.append(
		"file",
		new Blob([bytes], { type: mediaType }),
		`audio.${extension}`,
	);
	form.append("model", SARVAM_STT_MODEL_ID);
	form.append("language_code", "unknown");
	form.append("mode", "transcribe");
	form.append("with_timestamps", "true");

	const response = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
		method: "POST",
		headers: {
			"api-subscription-key": apiKey(),
		},
		body: form,
	});

	if (!response.ok) {
		const errorText = await response.text();
		logger.error(
			`[sarvam] response model=${SARVAM_STT_MODEL_ID} op=speech-to-text status=${response.status} failed`,
		);
		throw new Error(
			`Sarvam transcription failed: ${response.status} ${errorText}`,
		);
	}

	const data = await response.json();
	const transcript =
		typeof data?.transcript === "string" ? data.transcript : "";
	const endTimes: number[] | undefined = data?.timestamps?.end_time_seconds;
	const durationSeconds =
		Array.isArray(endTimes) && endTimes.length > 0
			? endTimes[endTimes.length - 1]
			: null;

	logger.info(
		`[sarvam] response model=${SARVAM_STT_MODEL_ID} op=speech-to-text status=${response.status} ok durationSeconds=${durationSeconds ?? "unknown"}`,
	);
	return { transcript: transcript.trim(), durationSeconds };
}
