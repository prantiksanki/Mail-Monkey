import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ORPCError } from "@orpc/server";
import {
	generateObject,
	generateWithSarvam,
	SARVAM_CHAT_MODEL_ID,
	TEXT_MODEL_ID,
} from "@repo/ai";
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
// Signed-out visitors use composeVoiceEmailAnonymous instead (always Sarvam,
// IP rate-limited) so they can try the feature before creating an account.
//
// Generation backend is chosen by plan: paid ("pro") users get Gemini, free
// users get the hosted Sarvam API, so the free tier costs us near-zero.
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
			"Turn a rambling voice transcript into four toned subject + body drafts. Uses Gemini for paid plans and the Sarvam API for free plans.",
	})
	.input(ComposeVoiceEmailInputSchema)
	.handler(async ({ input, context }) => {
		const planId = await resolveUserPlan(context.user.id);
		const backend = planId === "pro" ? "gemini" : "sarvam";
		const modelId =
			backend === "gemini" ? TEXT_MODEL_ID : SARVAM_CHAT_MODEL_ID;

		logger.info("[compose-voice-email] request", {
			userId: context.user.id,
			planId,
			backend,
			modelId,
		});

		try {
			const object =
				backend === "gemini"
					? await generateWithGemini(input)
					: await generateWithSarvamModel(input);

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
				backend,
				modelId,
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
				params: { plan: planId, backend },
			});

			return { drafts };
		} catch (error) {
			logger.error("[compose-voice-email] response failed", {
				userId: context.user.id,
				planId,
				backend,
				modelId,
				error,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					backend === "sarvam"
						? "The email assistant is temporarily unavailable"
						: error instanceof Error
							? error.message
							: "Could not generate the email",
			});
		}
	});

async function generateWithGemini(
	input: ComposeVoiceEmailInput,
): Promise<ComposeVoiceEmailResult> {
	const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) {
		logger.error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "AI email generation is not available",
		});
	}

	const google = createGoogleGenerativeAI({ apiKey });
	const { object } = await generateObject({
		model: google(TEXT_MODEL_ID),
		schema: ComposeVoiceEmailResultSchema,
		temperature: 0.6,
		system: VOICE_EMAIL_SYSTEM_PROMPT,
		prompt: buildVoiceEmailPrompt(input),
	});
	return object;
}

async function generateWithSarvamModel(
	input: ComposeVoiceEmailInput,
): Promise<ComposeVoiceEmailResult> {
	return generateWithSarvam({
		system: VOICE_EMAIL_SYSTEM_PROMPT,
		prompt: `${buildVoiceEmailPrompt(input)}\n\n<output_format>\nRespond with a single JSON object of the shape {"drafts": [{"tone": string, "subject": string, "body": string}, ...]}, one entry per tone, in the order listed above. No extra text outside the JSON object.\n</output_format>`,
		schema: ComposeVoiceEmailResultSchema,
	});
}
