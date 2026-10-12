import { ORPCError } from "@orpc/server";
import { SARVAM_STT_MODEL_ID, transcribeWithSarvam } from "@repo/ai";
import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import {
	getCurrentVoiceMinutesUsed,
	incrementVoiceSecondsUsed,
} from "@repo/database";
import { logger } from "@repo/logs";
import { canUseVoiceAgent } from "@repo/payments/lib/plan-limits";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import {
	isEffectivelySilent,
	TranscribeVoiceInputSchema,
} from "./transcribe-voice.schema";

export const transcribeVoice = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/ai/transcribe-voice",
		tags: ["AI"],
		summary: "Transcribe voice input",
		description:
			"Transcribe a short voice recording into text using the Sarvam API, for the inbox assistant composer.",
	})
	.input(TranscribeVoiceInputSchema)
	.handler(async ({ input, context }) => {
		const planId = await resolveUserPlan(context.user.id);
		const minutesUsed = await getCurrentVoiceMinutesUsed(context.user.id);
		if (!canUseVoiceAgent(planId, minutesUsed)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"You've used all your voice minutes for this month. Upgrade or wait for your next billing cycle.",
			});
		}

		try {
			const buffer = Buffer.from(input.audio, "base64");
			const { transcript, durationSeconds } = await transcribeWithSarvam(
				buffer,
				input.mediaType,
			);
			logger.info("[transcribe-voice] raw transcript", {
				modelId: SARVAM_STT_MODEL_ID,
				mediaType: input.mediaType,
				bufferBytes: buffer.length,
				durationSeconds,
				transcript,
			});

			if (isEffectivelySilent(transcript)) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"No speech was detected in the recording. Please try again.",
				});
			}

			await incrementVoiceSecondsUsed(
				context.user.id,
				durationSeconds ?? 0,
			);

			// GA4 engagement event: a real, non-silent transcription completed
			// for a signed-in user in the inbox-assistant composer.
			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "voice_transcription",
				userId: context.user.id,
				clientId,
				sessionId,
				params: {
					duration_sec: Math.round(durationSeconds ?? 0),
					plan: planId,
				},
			});

			return { text: transcript };
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to transcribe voice input:", { error });
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Could not transcribe the recording",
			});
		}
	});
