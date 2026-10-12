import { listConversations } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";

export const listAiConversations = protectedProcedure
	.route({
		method: "GET",
		path: "/ai/conversations",
		tags: ["AI"],
		summary: "List AI conversations",
		description:
			"List the user's inbox-assistant conversations for a mailbox",
	})
	.input(
		z.object({
			mailboxId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const conversations = await listConversations({
			userId: context.user.id,
			mailboxId: input.mailboxId,
		});

		return { conversations };
	});
