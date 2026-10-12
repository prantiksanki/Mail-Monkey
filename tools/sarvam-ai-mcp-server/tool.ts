import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosError } from "axios";

export const SARVAM_TRANSLATE_TOOL = {
	name: "sarvam_translate",
	description:
		"Translate text between English and Indian regional languages (Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi, Odia) using Sarvam AI.",
	annotations: {
		readOnlyHint: true,
		destructiveHint: false,
		openWorldHint: true,
	},
	inputSchema: {
		type: "object",
		properties: {
			input_text: {
				type: "string",
				description: "The text to translate.",
			},
			source_language_code: {
				type: "string",
				description:
					'Source language code, e.g. "en-IN", "hi-IN", "kn-IN", "ta-IN".',
			},
			target_language_code: {
				type: "string",
				description:
					'Target language code, e.g. "hi-IN", "ta-IN", "en-IN".',
			},
		},
		required: [
			"input_text",
			"source_language_code",
			"target_language_code",
		],
	},
} as const;

const SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate";

export async function callSarvamTranslate(
	args: Record<string, unknown> | undefined,
	sarvamApiKey: string,
): Promise<CallToolResult> {
	const input_text = args?.input_text;
	const source_language_code = args?.source_language_code;
	const target_language_code = args?.target_language_code;

	if (
		typeof input_text !== "string" ||
		typeof source_language_code !== "string" ||
		typeof target_language_code !== "string"
	) {
		return {
			content: [
				{
					type: "text",
					text: "Invalid arguments: input_text, source_language_code, and target_language_code are all required strings.",
				},
			],
			isError: true,
		};
	}

	try {
		const response = await axios.post(
			SARVAM_TRANSLATE_URL,
			{
				input: input_text,
				source_language_code,
				target_language_code,
				mode: "formal",
			},
			{
				headers: {
					"api-subscription-key": sarvamApiKey,
					"Content-Type": "application/json",
				},
			},
		);

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(response.data),
				},
			],
		};
	} catch (error) {
		let message = "Unknown error while calling Sarvam AI translate API.";

		if (error instanceof AxiosError) {
			const status = error.response?.status;
			const data = error.response?.data;
			message = `Sarvam AI translate API request failed${
				status ? ` (status ${status})` : ""
			}: ${data ? JSON.stringify(data) : error.message}`;
		} else if (error instanceof Error) {
			message = error.message;
		}

		return {
			content: [
				{
					type: "text",
					text: message,
				},
			],
			isError: true,
		};
	}
}
