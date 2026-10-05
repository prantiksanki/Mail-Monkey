import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
	apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
});

export const textModel = google("gemini-3.5-flash");

// Embeddings for RAG via the Gemini REST API (the SDK path mis-handles
// gemini-embedding-001). 768-dim to match the Supabase `vector(768)` column.
export async function embedText(text: string): Promise<number[]> {
	const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
	const res = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: "models/gemini-embedding-001",
				content: { parts: [{ text: text.slice(0, 8000) }] },
				outputDimensionality: 768,
			}),
		},
	);
	if (!res.ok) {
		throw new Error(
			`embed ${res.status}: ${(await res.text()).slice(0, 200)}`,
		);
	}
	const data = (await res.json()) as { embedding?: { values?: number[] } };
	const values = data?.embedding?.values;
	if (!Array.isArray(values)) {
		throw new Error("embed: no values in response");
	}
	return values;
}

export * from "ai";
export * from "./lib";
