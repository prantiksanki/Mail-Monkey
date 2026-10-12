import { createConversation } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";

export const createAiConversation = protectedProcedure
	.route({
		method: "POST",
		path: "/ai/conversations",
		tags: ["AI"],
		summary: "Create AI conversation",
		description: "Start a new inbox-assistant conversation",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			title: z.string().max(120).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const conversation = await createConversation({
			userId: context.user.id,
			mailboxId: input.mailboxId,
			title: input.title?.trim() || undefined,
		});

		return { conversation };
	});
