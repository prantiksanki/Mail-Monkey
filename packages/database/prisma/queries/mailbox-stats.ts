import { db } from "../client";

type ActionEntry = { type?: string; success?: boolean } | null;

export interface MailboxStats {
	processedToday: number;
	processedYesterday: number;
	firedToday: number;
	firedYesterday: number;
	errorsToday: number;
	processed7d: number;
	fired7d: number;
	rulesActive: number;
	rulesTotal: number;
	sparkline7d: Array<{ day: string; processed: number; fired: number }>;
	topRules7d: Array<{ id: string; name: string; count: number }>;
	/**
	 * All rules in the mailbox with their enabled status and number of fires
	 * in the last 7 days. Unlike `topRules7d`, this includes rules that have
	 * not fired yet, so the "rules active" breakdown is never empty when rules
	 * exist. Enabled rules first, then by fire count desc, then by name.
	 */
	rulesList: Array<{
		id: string;
		name: string;
		enabled: boolean;
		count: number;
	}>;
	firesByRule7d: Array<{ ruleId: string; count: number }>;
	breakdownByRule24h: Array<{ id: string; name: string; count: number }>;
	actionsBreakdown24h: Array<{ type: string; count: number }>;
}

export async function getMailboxStats(
	mailboxId: string,
): Promise<MailboxStats> {
	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const startOfYesterday = new Date(
		startOfToday.getTime() - 24 * 60 * 60 * 1000,
	);
	const start7d = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
	const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	const [
		processedToday,
		processedYesterday,
		firedToday,
		firedYesterday,
		errorsToday,
		processed7d,
		fired7d,
		rulesActive,
		rulesTotal,
		topRules7dRaw,
		breakdownByRuleRaw,
		sparkBuckets,
		logsLast24h,
		allRules,
	] = await Promise.all([
		db.ruleExecutionLog.count({
			where: { mailboxId, createdAt: { gte: startOfToday } },
		}),
		db.ruleExecutionLog.count({
			where: {
				mailboxId,
				createdAt: { gte: startOfYesterday, lt: startOfToday },
			},
		}),
		db.ruleExecutionLog.count({
			where: {
				mailboxId,
				status: "matched",
				createdAt: { gte: startOfToday },
			},
		}),
		db.ruleExecutionLog.count({
			where: {
				mailboxId,
				status: "matched",
				createdAt: { gte: startOfYesterday, lt: startOfToday },
			},
		}),
		db.ruleExecutionLog.count({
			where: {
				mailboxId,
				status: "error",
				createdAt: { gte: startOfToday },
			},
		}),
		db.ruleExecutionLog.count({
			where: { mailboxId, createdAt: { gte: start7d } },
		}),
		db.ruleExecutionLog.count({
			where: {
				mailboxId,
				status: "matched",
				createdAt: { gte: start7d },
			},
		}),
		db.rule.count({ where: { mailboxId, enabled: true } }),
		db.rule.count({ where: { mailboxId } }),
		db.ruleExecutionLog.groupBy({
			by: ["ruleId"],
			where: {
				mailboxId,
				status: "matched",
				createdAt: { gte: start7d },
			},
			_count: { _all: true },
			orderBy: { _count: { ruleId: "desc" } },
		}),
		db.ruleExecutionLog.groupBy({
			by: ["ruleId"],
			where: {
				mailboxId,
				status: "matched",
				createdAt: { gte: start24h },
			},
			_count: { _all: true },
			orderBy: { _count: { ruleId: "desc" } },
		}),
		db.$queryRaw<
			Array<{ bucket: Date; status: string; count: bigint }>
		>`SELECT date_trunc('day', "createdAt") AS bucket, status, COUNT(*)::bigint AS count FROM rule_execution_log WHERE "mailboxId" = ${mailboxId} AND "createdAt" >= ${start7d} GROUP BY bucket, status ORDER BY bucket ASC`,
		db.ruleExecutionLog.findMany({
			where: {
				mailboxId,
				status: "matched",
				createdAt: { gte: start24h },
			},
			select: { actionsRun: true },
		}),
		db.rule.findMany({
			where: { mailboxId },
			select: { id: true, name: true, enabled: true },
		}),
	]);

	const ruleIds = Array.from(
		new Set([
			...topRules7dRaw.map((r) => r.ruleId),
			...breakdownByRuleRaw.map((r) => r.ruleId),
		]),
	);
	const rules = ruleIds.length
		? await db.rule.findMany({
				where: { id: { in: ruleIds } },
				select: { id: true, name: true },
			})
		: [];
	const ruleMap = new Map(rules.map((r) => [r.id, r.name]));

	const topRules7d = topRules7dRaw.slice(0, 5).map((r) => ({
		id: r.ruleId,
		name: ruleMap.get(r.ruleId) ?? "Deleted rule",
		count: r._count._all,
	}));

	const firesByRule7d = topRules7dRaw.map((r) => ({
		ruleId: r.ruleId,
		count: r._count._all,
	}));

	const breakdownByRule24h = breakdownByRuleRaw.map((r) => ({
		id: r.ruleId,
		name: ruleMap.get(r.ruleId) ?? "Deleted rule",
		count: r._count._all,
	}));

	// Fires per rule over the last 7 days (covers all fired rules, not just
	// the top 5) so we can annotate the full rules list below.
	const fires7dByRuleId = new Map(
		topRules7dRaw.map((r) => [r.ruleId, r._count._all]),
	);
	const rulesList = allRules
		.map((r) => ({
			id: r.id,
			name: r.name,
			enabled: r.enabled,
			count: fires7dByRuleId.get(r.id) ?? 0,
		}))
		.sort(
			(a, b) =>
				Number(b.enabled) - Number(a.enabled) ||
				b.count - a.count ||
				a.name.localeCompare(b.name),
		);

	const sparkline7d: Array<{
		day: string;
		processed: number;
		fired: number;
	}> = [];
	for (let i = 6; i >= 0; i--) {
		const day = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
		const dayKey = day.toISOString().slice(0, 10);
		const matching = sparkBuckets.filter(
			(b) => b.bucket.toISOString().slice(0, 10) === dayKey,
		);
		const processed = matching.reduce((sum, b) => sum + Number(b.count), 0);
		const fired = matching
			.filter((b) => b.status === "matched")
			.reduce((sum, b) => sum + Number(b.count), 0);
		sparkline7d.push({ day: dayKey, processed, fired });
	}

	const actionCounts = new Map<string, number>();
	for (const log of logsLast24h) {
		const actions = Array.isArray(log.actionsRun)
			? (log.actionsRun as ActionEntry[])
			: [];
		for (const action of actions) {
			if (action?.type && action.success !== false) {
				actionCounts.set(
					action.type,
					(actionCounts.get(action.type) ?? 0) + 1,
				);
			}
		}
	}
	const actionsBreakdown24h = Array.from(actionCounts.entries())
		.map(([type, count]) => ({ type, count }))
		.sort((a, b) => b.count - a.count);

	return {
		processedToday,
		processedYesterday,
		firedToday,
		firedYesterday,
		errorsToday,
		processed7d,
		fired7d,
		rulesActive,
		rulesTotal,
		sparkline7d,
		topRules7d,
		rulesList,
		firesByRule7d,
		breakdownByRule24h,
		actionsBreakdown24h,
	};
}
