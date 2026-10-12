import { ORPCError } from "@orpc/server";
import { SARVAM_STT_MODEL_ID, transcribeWithSarvam } from "@repo/ai";
import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import { logger } from "@repo/logs";
import { anonymousVoiceLimiter } from "../../../orpc/middleware/rate-limit-ip";
import { publicProcedure } from "../../../orpc/procedures";
import {
	isEffectivelySilent,
	TranscribeVoiceInputSchema,
} from "./transcribe-voice.schema";

// Anonymous twin of transcribeVoiceDemo, for signed-out visitors on the
// marketing homepage's "Speak your mind" widget. No session required —
// rate-limited per IP via anonymousVoiceLimiter instead of per user. Always
// Sarvam (never Gemini), same as the free-tier demo.
export const transcribeVoiceAnonymous = publicProcedure
	.use(anonymousVoiceLimiter)
	.route({
		method: "POST",
		path: "/ai/transcribe-voice-anonymous",
		tags: ["AI"],
		summary: "Transcribe voice input (anonymous)",
		description:
			"Transcribe a short voice recording into text using the Sarvam API, for signed-out visitors on the marketing homepage voice demo.",
	})
	.input(TranscribeVoiceInputSchema)
	.handler(async ({ input, context }) => {
		try {
			const buffer = Buffer.from(input.audio, "base64");
			const { transcript } = await transcribeWithSarvam(
				buffer,
				input.mediaType,
			);
			logger.info("[transcribe-voice-anonymous] raw transcript", {
				modelId: SARVAM_STT_MODEL_ID,
				mediaType: input.mediaType,
				bufferBytes: buffer.length,
				transcript,
			});

			if (isEffectivelySilent(transcript)) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"No speech was detected in the recording. Please try again.",
				});
			}

			// GA4 engagement event: top-of-funnel interest in the voice feature
			// from a signed-out visitor.
			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "voice_demo_used",
				clientId,
				sessionId,
				params: { anonymous: true },
			});

			return { text: transcript };
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to transcribe voice input (anonymous):", {
				error,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Could not transcribe the recording",
			});
		}
	});
