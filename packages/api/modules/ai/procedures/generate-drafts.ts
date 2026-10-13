import { ORPCError } from "@orpc/server";
import { generateWithSarvam } from "@repo/ai";
import { logger } from "@repo/logs";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";
import {
	buildDraftPrompt,
	DRAFT_SYSTEM_PROMPT,
	DRAFT_TONES,
	GenerateDraftsInputSchema,
	GenerateDraftsResultSchema,
} from "./generate-drafts.prompt";

export const generateDrafts = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/ai/generate-drafts",
		tags: ["AI"],
		summary: "Generate AI reply drafts",
		description:
			"Generate three reply drafts (professional, friendly, formal) and the detected intent for an email.",
	})
	.input(GenerateDraftsInputSchema)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		if (!process.env.SARVAM_API_KEY) {
			logger.error("SARVAM_API_KEY is not configured");
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "AI draft generation is not available",
			});
		}

		try {
			const object = await generateWithSarvam({
				schema: GenerateDraftsResultSchema,
				// Some variation so "Regenerate" produces fresh drafts.
				temperature: 0.7,
				system: DRAFT_SYSTEM_PROMPT,
				prompt: buildDraftPrompt(input),
			});

			// Guarantee a stable tone order (professional, friendly, formal) so
			// the UI tabs map to drafts deterministically.
			const byTone = new Map(object.drafts.map((d) => [d.tone, d]));
			const drafts = DRAFT_TONES.map(
				(tone) =>
					byTone.get(tone) ?? {
						tone,
						confidence: "low" as const,
						body: "",
					},
			);

			return { intent: object.intent, drafts };
		} catch (error) {
			logger.error("Failed to generate drafts:", { error });
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Could not generate reply drafts",
			});
		}
	});
