import { ORPCError } from "@orpc/client";
import { renameConversation } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const renameAiConversation = protectedProcedure
	.route({
		method: "PATCH",
		path: "/ai/conversations/{id}",
		tags: ["AI"],
		summary: "Rename AI conversation",
		description: "Rename an inbox-assistant conversation",
	})
	.input(
		z.object({
			id: z.string(),
			title: z.string().min(1).max(120),
		}),
	)
	.handler(async ({ input, context }) => {
		const ok = await renameConversation({
			id: input.id,
			userId: context.user.id,
			title: input.title,
		});

		if (!ok) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found.",
			});
		}

		return { success: true };
	});
