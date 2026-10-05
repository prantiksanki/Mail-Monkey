import { db } from "../client";

export async function createExecutionLog(data: {
	ruleId: string;
	mailboxId: string;
	messageId: string;
	threadId?: string;
	subject?: string;
	from?: string;
	status: "matched" | "not_matched" | "error";
	actionsRun?: unknown;
	error?: string;
}) {
	return db.ruleExecutionLog.create({
		data: { ...data, actionsRun: data.actionsRun ?? [] },
	});
}

export async function wasMessageAlreadyProcessed(
	mailboxId: string,
	messageId: string,
) {
	const existing = await db.ruleExecutionLog.findFirst({
		where: { mailboxId, messageId },
		select: { id: true },
	});
	return !!existing;
}

export type ExecutionLogStatus = "matched" | "not_matched" | "error";

export interface ExecutionLogFilters {
	ruleId?: string;
	status?: ExecutionLogStatus;
	since?: Date;
	search?: string;
}

function buildExecutionLogWhere(
	mailboxId: string,
	filters: ExecutionLogFilters = {},
) {
	const { ruleId, status, since, search } = filters;
	return {
		mailboxId,
		...(ruleId ? { ruleId } : {}),
		...(status ? { status } : {}),
		...(since ? { createdAt: { gte: since } } : {}),
		...(search
			? {
					OR: [
						{
							subject: {
								contains: search,
								mode: "insensitive" as const,
							},
						},
						{
							from: {
								contains: search,
								mode: "insensitive" as const,
							},
						},
					],
				}
			: {}),
	};
}

export async function getExecutionLogs(
	mailboxId: string,
	limit = 50,
	offset = 0,
	filters: ExecutionLogFilters = {},
) {
	return db.ruleExecutionLog.findMany({
		where: buildExecutionLogWhere(mailboxId, filters),
		orderBy: { createdAt: "desc" },
		take: limit,
		skip: offset,
		include: { rule: { select: { name: true } } },
	});
}

export async function countExecutionLogs(
	mailboxId: string,
	filters: ExecutionLogFilters = {},
) {
	return db.ruleExecutionLog.count({
		where: buildExecutionLogWhere(mailboxId, filters),
	});
}
