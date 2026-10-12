import { ORPCError } from "@orpc/server";
import { generateWithSarvam, SARVAM_CHAT_MODEL_ID } from "@repo/ai";
import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import { logger } from "@repo/logs";
import { anonymousVoiceLimiter } from "../../../orpc/middleware/rate-limit-ip";
import { publicProcedure } from "../../../orpc/procedures";
import {
	buildVoiceEmailPrompt,
	type ComposeVoiceEmailInput,
	ComposeVoiceEmailInputSchema,
	type ComposeVoiceEmailResult,
	ComposeVoiceEmailResultSchema,
	VOICE_EMAIL_SYSTEM_PROMPT,
	VOICE_EMAIL_TONES,
} from "./compose-voice-email.schema";

// Anonymous twin of composeVoiceEmail, for signed-out visitors on the
// marketing homepage's "Speak your mind" widget. No session required —
// rate-limited per IP via anonymousVoiceLimiter instead of per user.
//
// Always Sarvam, never Gemini — the paid backend stays gated behind a real
// account (composeVoiceEmail still checks the user's plan once they sign
// up). The client blocks copying the generated draft until the visitor signs
// up; this endpoint only produces the preview text.
export const composeVoiceEmailAnonymous = publicProcedure
	.use(anonymousVoiceLimiter)
	.route({
		method: "POST",
		path: "/ai/compose-voice-email-anonymous",
		tags: ["AI"],
		summary: "Compose an email from a rambled voice transcript (anonymous)",
		description:
			"Turn a rambling voice transcript into four toned subject + body drafts using the Sarvam API, for signed-out visitors on the marketing homepage.",
	})
	.input(ComposeVoiceEmailInputSchema)
	.handler(async ({ input, context }) => {
		logger.info("[compose-voice-email-anonymous] request", {
			backend: "sarvam",
			modelId: SARVAM_CHAT_MODEL_ID,
		});

		try {
			const object = await generateWithSarvamModel(input);

			// Guarantee a stable tone order so the UI's tone tabs map to drafts
			// deterministically, same rationale as composeVoiceEmail.
			const byTone = new Map(object.drafts.map((d) => [d.tone, d]));
			const drafts = VOICE_EMAIL_TONES.map(
				(tone) =>
					byTone.get(tone) ?? {
						tone,
						subject: "",
						body: "",
					},
			);

			logger.info("[compose-voice-email-anonymous] response ok", {
				backend: "sarvam",
				modelId: SARVAM_CHAT_MODEL_ID,
			});

			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "voice_email_composed",
				clientId,
				sessionId,
				params: { plan: "anonymous", backend: "sarvam" },
			});

			return { drafts };
		} catch (error) {
			logger.error("[compose-voice-email-anonymous] response failed", {
				backend: "sarvam",
				modelId: SARVAM_CHAT_MODEL_ID,
				error,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "The email assistant is temporarily unavailable",
			});
		}
	});

async function generateWithSarvamModel(
	input: ComposeVoiceEmailInput,
): Promise<ComposeVoiceEmailResult> {
	return generateWithSarvam({
		system: VOICE_EMAIL_SYSTEM_PROMPT,
		prompt: `${buildVoiceEmailPrompt(input)}\n\n<output_format>\nRespond with a single JSON object of the shape {"drafts": [{"tone": string, "subject": string, "body": string}, ...]}, one entry per tone, in the order listed above. No extra text outside the JSON object.\n</output_format>`,
		schema: ComposeVoiceEmailResultSchema,
	});
}
