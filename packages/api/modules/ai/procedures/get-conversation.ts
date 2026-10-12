import { ORPCError } from "@orpc/client";
import type { UIMessage } from "@repo/ai";
import { getConversation } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const getAiConversation = protectedProcedure
	.route({
		method: "GET",
		path: "/ai/conversations/{id}",
		tags: ["AI"],
		summary: "Get AI conversation",
		description: "Fetch a conversation with its full message history",
	})
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const conversation = await getConversation({
			id: input.id,
			userId: context.user.id,
		});

		if (!conversation) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found.",
			});
		}

		// Rehydrate stored rows into the UIMessage shape useChat expects as
		// initial state. `parts` is stored verbatim as JSON.
		const messages: UIMessage[] = conversation.messages.map((m) => ({
			id: m.id,
			role: m.role as UIMessage["role"],
			parts: m.parts as UIMessage["parts"],
		}));

		return {
			conversation: {
				id: conversation.id,
				title: conversation.title,
				mailboxId: conversation.mailboxId,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
			},
			messages,
		};
	});
