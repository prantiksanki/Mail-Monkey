import { db } from "../client";

/** Total emails processed across all of a user's mailboxes */
export async function getTotalEmailsProcessed(userId: string) {
	const mailboxIds = await db.mailbox
		.findMany({ where: { userId }, select: { id: true } })
		.then((m) => m.map((x) => x.id));

	if (mailboxIds.length === 0) {
		return 0;
	}

	return db.ruleExecutionLog.count({
		where: { mailboxId: { in: mailboxIds } },
	});
}

/** Automation success rate: matched / (matched + error) across user mailboxes */
export async function getAutomationSuccessRate(userId: string) {
	const mailboxIds = await db.mailbox
		.findMany({ where: { userId }, select: { id: true } })
		.then((m) => m.map((x) => x.id));

	if (mailboxIds.length === 0) {
		return { rate: 0, matched: 0, errors: 0, total: 0 };
	}

	const [matched, errors, total] = await Promise.all([
		db.ruleExecutionLog.count({
			where: { mailboxId: { in: mailboxIds }, status: "matched" },
		}),
		db.ruleExecutionLog.count({
			where: { mailboxId: { in: mailboxIds }, status: "error" },
		}),
		db.ruleExecutionLog.count({
			where: { mailboxId: { in: mailboxIds } },
		}),
	]);

	const rate = total > 0 ? matched / total : 0;
	return { rate, matched, errors, total };
}

/** Top email senders by volume across user mailboxes */
export async function getTopEmailSenders(userId: string, limit = 10) {
	const mailboxIds = await db.mailbox
		.findMany({ where: { userId }, select: { id: true } })
		.then((m) => m.map((x) => x.id));

	if (mailboxIds.length === 0) {
		return [];
	}

	const logs = await db.ruleExecutionLog.groupBy({
		by: ["from"],
		where: {
			mailboxId: { in: mailboxIds },
			from: { not: null },
		},
		_count: { id: true },
		orderBy: { _count: { id: "desc" } },
		take: limit,
	});

	return logs.map((row) => ({
		sender: row.from ?? "Unknown",
		count: row._count.id,
	}));
}

/** Daily email processing counts for the last N days */
export async function getEmailsProcessedOverTime(userId: string, days = 30) {
	const mailboxIds = await db.mailbox
		.findMany({ where: { userId }, select: { id: true } })
		.then((m) => m.map((x) => x.id));

	if (mailboxIds.length === 0) {
		return [];
	}

	const since = new Date();
	since.setDate(since.getDate() - days);
	since.setHours(0, 0, 0, 0);

	const logs = await db.ruleExecutionLog.findMany({
		where: {
			mailboxId: { in: mailboxIds },
			createdAt: { gte: since },
		},
		select: { createdAt: true, status: true },
		orderBy: { createdAt: "asc" },
	});

	// Bucket into days
	const buckets: Record<
		string,
		{ total: number; matched: number; errors: number }
	> = {};
	for (let d = 0; d < days; d++) {
		const date = new Date(since);
		date.setDate(date.getDate() + d);
		const key = date.toISOString().slice(0, 10);
		buckets[key] = { total: 0, matched: 0, errors: 0 };
	}

	for (const log of logs) {
		const key = log.createdAt.toISOString().slice(0, 10);
		if (buckets[key]) {
			buckets[key].total++;
			if (log.status === "matched") {
				buckets[key].matched++;
			}
			if (log.status === "error") {
				buckets[key].errors++;
			}
		}
	}

	return Object.entries(buckets).map(([date, counts]) => ({
		date,
		...counts,
	}));
}

/** Count of active (enabled) rules across user mailboxes */
export async function getActiveRulesCount(userId: string) {
	const mailboxIds = await db.mailbox
		.findMany({ where: { userId }, select: { id: true } })
		.then((m) => m.map((x) => x.id));

	if (mailboxIds.length === 0) {
		return { active: 0, total: 0 };
	}

	const [active, total] = await Promise.all([
		db.rule.count({
			where: { mailboxId: { in: mailboxIds }, enabled: true },
		}),
		db.rule.count({ where: { mailboxId: { in: mailboxIds } } }),
	]);

	return { active, total };
}
