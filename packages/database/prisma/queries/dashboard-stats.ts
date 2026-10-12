import { db } from "../client";
import { countInboxTotal, countPriorityInbox } from "./emails";

export interface DashboardTopSender {
	fromEmail: string;
	from: string;
	count: number;
}

export interface DashboardCategoryCount {
	category: "PRIMARY" | "NEWSLETTER" | "PROMOTION" | "SOCIAL";
	count: number;
}

export interface DashboardSummary {
	inboxZeroPercent: number;
	priorityCount: number;
	categoryBreakdown: DashboardCategoryCount[];
	categorizedTotal: number;
	uncategorizedCount: number;
	topSenders: DashboardTopSender[];
}

const INBOX_SCOPE = {
	labelIds: { has: "INBOX" as const },
	NOT: { labelIds: { hasSome: ["TRASH", "SPAM"] } },
};

export async function getDashboardSummary(
	mailboxId: string,
): Promise<DashboardSummary> {
	const [
		totalInboxCount,
		unreadInboxCount,
		priorityCount,
		categoryGroups,
		uncategorizedCount,
		topSenderGroups,
	] = await Promise.all([
		countInboxTotal(mailboxId),
		db.email.count({
			where: { mailboxId, isUnread: true, ...INBOX_SCOPE },
		}),
		countPriorityInbox(mailboxId),
		db.email.groupBy({
			by: ["category"],
			where: { mailboxId, ...INBOX_SCOPE, category: { not: null } },
			_count: true,
		}),
		db.email.count({
			where: { mailboxId, ...INBOX_SCOPE, category: null },
		}),
		db.email.groupBy({
			by: ["fromEmail"],
			where: { mailboxId, ...INBOX_SCOPE },
			_count: { _all: true },
			orderBy: { _count: { fromEmail: "desc" } },
			take: 6,
		}),
	]);

	const inboxZeroPercent =
		totalInboxCount === 0
			? 100
			: Math.round((1 - unreadInboxCount / totalInboxCount) * 100);

	const categoryBreakdown: DashboardCategoryCount[] = categoryGroups
		.filter(
			(g): g is typeof g & { category: NonNullable<typeof g.category> } =>
				g.category !== null,
		)
		.map((g) => ({ category: g.category, count: g._count }));
	const categorizedTotal = categoryBreakdown.reduce(
		(sum, c) => sum + c.count,
		0,
	);

	const topFromEmails = topSenderGroups.map((g) => g.fromEmail);
	const representativeSenders = topFromEmails.length
		? await db.email.findMany({
				where: { mailboxId, fromEmail: { in: topFromEmails } },
				distinct: ["fromEmail"],
				orderBy: [{ fromEmail: "asc" }, { internalDate: "desc" }],
				select: { fromEmail: true, from: true },
			})
		: [];
	const displayNameByEmail = new Map(
		representativeSenders.map((s) => [s.fromEmail, s.from]),
	);

	const topSenders: DashboardTopSender[] = topSenderGroups.map((g) => ({
		fromEmail: g.fromEmail,
		from: displayNameByEmail.get(g.fromEmail) ?? g.fromEmail,
		count: g._count._all,
	}));

	return {
		inboxZeroPercent,
		priorityCount,
		categoryBreakdown,
		categorizedTotal,
		uncategorizedCount,
		topSenders,
	};
}
