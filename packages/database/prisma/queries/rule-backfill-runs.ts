import { db } from "../client";

const ACTIVE_BACKFILL_STATUSES = ["pending", "running"] as const;

interface CreateRuleBackfillRunInput {
	mailboxId: string;
	ruleId: string;
	status: string;
	windowMonths: number;
	windowStart: Date;
	windowEnd: Date;
	query?: string;
}

interface UpdateRuleBackfillRunCountsInput {
	id: string;
	status?: string;
	nextPageToken?: string | null;
	estimatedTotal?: number;
	processedCount?: number;
	matchedCount?: number;
	appliedCount?: number;
	skippedCount?: number;
	errorCount?: number;
	lastError?: string | null;
	completedAt?: Date | null;
}

export async function createRuleBackfillRun(input: CreateRuleBackfillRunInput) {
	return db.ruleBackfillRun.create({
		data: input,
	});
}

export async function getRuleBackfillRunById(id: string) {
	return db.ruleBackfillRun.findUnique({
		where: { id },
		include: {
			mailbox: true,
			rule: true,
		},
	});
}

export async function getLatestRuleBackfillRun(
	mailboxId: string,
	ruleId: string,
) {
	return db.ruleBackfillRun.findFirst({
		where: {
			mailboxId,
			ruleId,
		},
		orderBy: {
			createdAt: "desc",
		},
	});
}

export async function getActiveRuleBackfillRun(
	mailboxId: string,
	ruleId: string,
) {
	return db.ruleBackfillRun.findFirst({
		where: {
			mailboxId,
			ruleId,
			status: {
				in: [...ACTIVE_BACKFILL_STATUSES],
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});
}

export async function updateRuleBackfillRun(
	input: UpdateRuleBackfillRunCountsInput,
) {
	const { id, ...data } = input;
	return db.ruleBackfillRun.update({
		where: { id },
		data,
	});
}

export async function wasMessageProcessedByRule(
	ruleId: string,
	messageId: string,
	runId: string,
) {
	// Only skip if this specific run already logged the message — so "Run again"
	// (a new run) always re-processes every email even if a prior run matched it.
	const existing = await db.ruleExecutionLog.findFirst({
		where: { ruleId, messageId, status: "matched" },
		select: { id: true, createdAt: true },
	});
	if (!existing) {
		return false;
	}

	// Check whether the log belongs to the current run by comparing timestamps.
	// The run's createdAt is always before any log it creates, so if the log
	// predates this run it belongs to a previous run — don't skip.
	const run = await db.ruleBackfillRun.findUnique({
		where: { id: runId },
		select: { createdAt: true },
	});
	if (!run) {
		return false;
	}

	// Log was created after this run started → this run already processed it
	return existing.createdAt >= run.createdAt;
}
