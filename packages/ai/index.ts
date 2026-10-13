import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Silences the AI SDK's per-call "specificationVersion ... compatibility
// mode" notice — expected/harmless with the pinned @ai-sdk/openai-compatible
// version below, but it fires on every single call and floods production
// logs.
globalThis.AI_SDK_LOG_WARNINGS = false;

// Sarvam's thinking/reasoning mode can consume the whole token budget before
// any content is emitted, which silently empties streamText's output (same
// issue lib/sarvam.ts already works around for non-streaming calls via
// reasoning_effort: null). The AI SDK's own reasoningEffort option only
// accepts a string, not a literal null, so force it via a fetch wrapper that
// patches every outgoing request body instead.
async function disableSarvamReasoning(
	input: Parameters<typeof fetch>[0],
	init: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
	let patchedInit = init;
	if (init?.body && typeof init.body === "string") {
		try {
			const body = JSON.parse(init.body);
			body.reasoning_effort = null;
			patchedInit = { ...init, body: JSON.stringify(body) };
		} catch {
			// Not a JSON body — leave it as-is.
		}
	}
	return fetch(input, patchedInit);
}

const sarvam = createOpenAICompatible({
	name: "sarvam",
	baseURL: "https://api.sarvam.ai/v1",
	headers: { "api-subscription-key": process.env.SARVAM_API_KEY ?? "" },
	fetch: disableSarvamReasoning,
});

// Single source of truth for the text model, used anywhere that needs
// streaming and/or tool-calling (streamText, generateText with tools) rather
// than a single structured JSON call (which should use generateWithSarvam
// from ./lib/sarvam instead — no AI-SDK provider-version coupling, and
// already proven reliable). Pinned to 1.0.20: the latest major
// (@ai-sdk/openai-compatible@3.x) implements a model spec version the `ai`
// package here doesn't support at all ("Unsupported model version v4 ...
// AI SDK 5 only supports models that implement specification version v2") —
// confirmed by testing against the real API, not assumed from version
// numbers. Bump only after re-verifying generateText/streamText/tool-calling
// still work.
export const TEXT_MODEL_ID = "sarvam-105b";

export const textModel = sarvam(TEXT_MODEL_ID);

export * from "ai";
export * from "./lib";
