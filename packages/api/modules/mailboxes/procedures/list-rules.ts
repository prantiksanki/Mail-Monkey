import { getRulesByMailboxId } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const listRules = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/rules",
		tags: ["Mailboxes"],
		summary: "List rules",
		description: "Get all rules for a mailbox",
	})
	.input(
		z.object({
			mailboxId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const rules = await getRulesByMailboxId({ mailboxId: input.mailboxId });

		return {
			rules,
		};
	});
