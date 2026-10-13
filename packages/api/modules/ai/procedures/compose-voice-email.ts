import { ORPCError } from "@orpc/server";
import { generateWithSarvam } from "@repo/ai";
import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import { logger } from "@repo/logs";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import {
	buildVoiceEmailPrompt,
	type ComposeVoiceEmailInput,
	ComposeVoiceEmailInputSchema,
	type ComposeVoiceEmailResult,
	ComposeVoiceEmailResultSchema,
	VOICE_EMAIL_SYSTEM_PROMPT,
	VOICE_EMAIL_TONES,
} from "./compose-voice-email.schema";

// Authenticated — powers the "Speak your mind" marketing homepage widget for
// signed-in visitors. Rate-limited per user via userExpensiveLimiter.
// Signed-out visitors use composeVoiceEmailAnonymous instead (IP rate-limited)
// so they can try the feature before creating an account.
//
// Runs on the hosted Sarvam API for every plan — see email-categorizer.ts for
// why this moved off Gemini. Previously paid ("pro") users got Gemini and
// free users got Sarvam; now everyone gets the same backend.
//
// Generates all four tones in a single call so the UI can switch between
// them instantly (no re-fetch per tone click) — mirrors generateDrafts.
export const composeVoiceEmail = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/ai/compose-voice-email",
		tags: ["AI"],
		summary: "Compose an email from a rambled voice transcript",
		description:
			"Turn a rambling voice transcript into four toned subject + body drafts.",
	})
	.input(ComposeVoiceEmailInputSchema)
	.handler(async ({ input, context }) => {
		const planId = await resolveUserPlan(context.user.id);

		logger.info("[compose-voice-email] request", {
			userId: context.user.id,
			planId,
		});

		try {
			const object = await generateWithSarvamModel(input);

			// Guarantee a stable tone order so the UI's tone tabs map to drafts
			// deterministically, same rationale as generateDrafts.
			const byTone = new Map(object.drafts.map((d) => [d.tone, d]));
			const drafts = VOICE_EMAIL_TONES.map(
				(tone) =>
					byTone.get(tone) ?? {
						tone,
						subject: "",
						body: "",
					},
			);

			logger.info("[compose-voice-email] response ok", {
				userId: context.user.id,
				planId,
			});

			// GA4 engagement event: a voice transcript was turned into email
			// drafts — the step downstream of `voice_transcription`.
			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "voice_email_composed",
				userId: context.user.id,
				clientId,
				sessionId,
				params: { plan: planId, backend: "sarvam" },
			});

			return { drafts };
		} catch (error) {
			logger.error("[compose-voice-email] response failed", {
				userId: context.user.id,
				planId,
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
		temperature: 0.6,
	});
}
