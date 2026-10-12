import { ORPCError } from "@orpc/client";
import { deleteConversation } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const deleteAiConversation = protectedProcedure
	.route({
		method: "DELETE",
		path: "/ai/conversations/{id}",
		tags: ["AI"],
		summary: "Delete AI conversation",
		description: "Delete an inbox-assistant conversation and its messages",
	})
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const ok = await deleteConversation({
			id: input.id,
			userId: context.user.id,
		});

		if (!ok) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found.",
			});
		}

		return { success: true };
	});
