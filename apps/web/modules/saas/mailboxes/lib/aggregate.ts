import type { orpcClient } from "@shared/lib/orpc-client";

/**
 * Pure helpers for combining per-mailbox dashboard/stats responses into a
 * single "All mailboxes" view. Kept separate from the query hooks so the
 * merge logic is easy to unit test and reason about without React Query in
 * the way.
 */

type DashboardSummaryResult = Awaited<
	ReturnType<typeof orpcClient.mailboxes.dashboard.summary>
>;
type MailboxStatsResult = Awaited<
	ReturnType<typeof orpcClient.mailboxes.stats>
>;

export function mergeDashboardSummaries(
	summaries: DashboardSummaryResult[],
): DashboardSummaryResult | null {
	if (summaries.length === 0) {
		return null;
	}

	const categoryTotals = new Map<string, number>();
	const senderTotals = new Map<string, { from: string; count: number }>();
	let categorizedTotal = 0;
	let uncategorizedCount = 0;
	let priorityCount = 0;
	let weightedZeroSum = 0;
	let weightTotal = 0;

	for (const s of summaries) {
		categorizedTotal += s.categorizedTotal;
		uncategorizedCount += s.uncategorizedCount;
		priorityCount += s.priorityCount;

		const weight = s.categorizedTotal + s.uncategorizedCount;
		weightedZeroSum += s.inboxZeroPercent * weight;
		weightTotal += weight;

		for (const c of s.categoryBreakdown) {
			categoryTotals.set(
				c.category,
				(categoryTotals.get(c.category) ?? 0) + c.count,
			);
		}
		for (const sender of s.topSenders) {
			const existing = senderTotals.get(sender.fromEmail);
			senderTotals.set(sender.fromEmail, {
				from: existing?.from ?? sender.from,
				count: (existing?.count ?? 0) + sender.count,
			});
		}
	}

	const inboxZeroPercent =
		weightTotal > 0
			? Math.round(weightedZeroSum / weightTotal)
			: Math.round(
					summaries.reduce((sum, s) => sum + s.inboxZeroPercent, 0) /
						summaries.length,
				);

	return {
		inboxZeroPercent,
		priorityCount,
		categorizedTotal,
		uncategorizedCount,
		categoryBreakdown: Array.from(categoryTotals.entries()).map(
			([category, count]) => ({
				category,
				count,
			}),
		) as DashboardSummaryResult["categoryBreakdown"],
		topSenders: Array.from(senderTotals.entries())
			.map(([fromEmail, v]) => ({
				fromEmail,
				from: v.from,
				count: v.count,
			}))
			.sort((a, b) => b.count - a.count)
			.slice(0, 6),
		aiInsight:
			summaries.length > 1
				? `Combined activity across ${summaries.length} connected mailboxes.`
				: (summaries[0]?.aiInsight ?? ""),
	};
}

export function mergeMailboxStats(
	statsList: MailboxStatsResult[],
): MailboxStatsResult | null {
	if (statsList.length === 0) {
		return null;
	}

	const sparklineByDay = new Map<
		string,
		{ processed: number; fired: number }
	>();
	const actionTotals = new Map<string, number>();

	for (const s of statsList) {
		for (const day of s.sparkline7d) {
			const existing = sparklineByDay.get(day.day);
			sparklineByDay.set(day.day, {
				processed: (existing?.processed ?? 0) + day.processed,
				fired: (existing?.fired ?? 0) + day.fired,
			});
		}
		for (const a of s.actionsBreakdown24h) {
			actionTotals.set(a.type, (actionTotals.get(a.type) ?? 0) + a.count);
		}
	}

	const sum = (pick: (s: MailboxStatsResult) => number) =>
		statsList.reduce((total, s) => total + pick(s), 0);

	return {
		processedToday: sum((s) => s.processedToday),
		processedYesterday: sum((s) => s.processedYesterday),
		firedToday: sum((s) => s.firedToday),
		firedYesterday: sum((s) => s.firedYesterday),
		errorsToday: sum((s) => s.errorsToday),
		processed7d: sum((s) => s.processed7d),
		fired7d: sum((s) => s.fired7d),
		rulesActive: sum((s) => s.rulesActive),
		rulesTotal: sum((s) => s.rulesTotal),
		sparkline7d: Array.from(sparklineByDay.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, v]) => ({ day, ...v })),
		topRules7d: statsList
			.flatMap((s) => s.topRules7d)
			.sort((a, b) => b.count - a.count)
			.slice(0, 5),
		rulesList: statsList.flatMap((s) => s.rulesList),
		firesByRule7d: statsList.flatMap((s) => s.firesByRule7d),
		breakdownByRule24h: statsList
			.flatMap((s) => s.breakdownByRule24h)
			.sort((a, b) => b.count - a.count),
		actionsBreakdown24h: Array.from(actionTotals.entries()).map(
			([type, count]) => ({ type, count }),
		),
	};
}
