import { ORPCError } from "@orpc/server";
import { SARVAM_STT_MODEL_ID, transcribeWithSarvam } from "@repo/ai";
import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import { logger } from "@repo/logs";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import {
	isEffectivelySilent,
	TranscribeVoiceInputSchema,
} from "./transcribe-voice.schema";

// Free-tier twin of transcribeVoice, for the marketing homepage's "Speak
// your mind" voice demo. Requires login (unlike the pro inbox-assistant
// composer's transcribeVoice) but is not subject to the paid voice-minutes
// cap in canUseVoiceAgent, so free users can use it without limit.
export const transcribeVoiceDemo = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/ai/transcribe-voice-demo",
		tags: ["AI"],
		summary: "Transcribe voice input (free tier)",
		description:
			"Transcribe a short voice recording into text using the Sarvam API, for the marketing homepage voice demo. Requires a signed-in session.",
	})
	.input(TranscribeVoiceInputSchema)
	.handler(async ({ input, context }) => {
		try {
			const buffer = Buffer.from(input.audio, "base64");
			const { transcript } = await transcribeWithSarvam(
				buffer,
				input.mediaType,
			);
			logger.info("[transcribe-voice-demo] raw transcript", {
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
			// via the marketing homepage demo (distinct from the in-app
			// `voice_transcription`).
			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "voice_demo_used",
				userId: context.user.id,
				clientId,
				sessionId,
			});

			return { text: transcript };
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to transcribe voice input (demo):", { error });
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Could not transcribe the recording",
			});
		}
	});
