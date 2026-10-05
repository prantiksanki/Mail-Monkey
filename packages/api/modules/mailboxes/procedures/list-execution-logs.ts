import {
	countExecutionLogs,
	type ExecutionLogFilters,
	getExecutionLogs,
} from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const listExecutionLogs = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/execution-logs",
		tags: ["Mailboxes"],
		summary: "List execution logs",
		description: "Get rule execution logs for a mailbox",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			limit: z.number().min(1).max(100).default(20),
			offset: z.number().min(0).default(0),
			ruleId: z.string().optional(),
			status: z.enum(["matched", "not_matched", "error"]).optional(),
			since: z.string().datetime().optional(),
			search: z.string().trim().min(1).max(200).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const filters: ExecutionLogFilters = {
			...(input.ruleId ? { ruleId: input.ruleId } : {}),
			...(input.status ? { status: input.status } : {}),
			...(input.since ? { since: new Date(input.since) } : {}),
			...(input.search ? { search: input.search } : {}),
		};

		const [logs, total] = await Promise.all([
			getExecutionLogs(
				input.mailboxId,
				input.limit,
				input.offset,
				filters,
			),
			countExecutionLogs(input.mailboxId, filters),
		]);

		return { logs, total };
	});
