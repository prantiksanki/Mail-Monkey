import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Silences the AI SDK's per-call "specificationVersion ... compatibility
// mode" notice — expected/harmless with @ai-sdk/google's current version,
// but it fires on every single Gemini call and floods production logs.
globalThis.AI_SDK_LOG_WARNINGS = false;

const google = createGoogleGenerativeAI({
	apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
});

// Single source of truth for the text model. `gemini-flash-latest` is the moving
// alias for the newest stable Flash; pinned ids like gemini-2.5-flash are refused
// for API keys created after that version's retirement ("no longer available to
// new users"). Override with GEMINI_MODEL (e.g. gemini-flash-lite-latest) if a
// different or cheaper model is wanted.
export const TEXT_MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export const textModel = google(TEXT_MODEL_ID);

export * from "ai";
export * from "./lib";
