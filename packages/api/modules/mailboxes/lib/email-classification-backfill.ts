import {
	countUncategorizedEmails,
	getEmailClassificationRunById,
	getMailboxIdsWithUncategorizedEmails,
	getUncategorizedEmails,
	updateEmailCategory,
	updateEmailClassificationRun,
} from "@repo/database";
import { logger } from "@repo/logs";
import { classifyEmailCategory } from "./email-categorizer";

// Ongoing-classification poller tuning — deliberately much smaller than the
// client-driven backfill's chunk size (40): this runs quietly every tick with
// no visible progress UI, so it should barely register as background load.
const POLLER_MAILBOX_LIMIT = 5;
const POLLER_BATCH_SIZE_PER_MAILBOX = 10;

// Prisma P2025 — "record required but not found" (e.g. cascade-deleted mid-run)
function isPrismaNotFound(e: unknown): boolean {
	return (
		typeof e === "object" &&
		e !== null &&
		"code" in e &&
		(e as { code: string }).code === "P2025"
	);
}

// No provider-quota pacing needed here (unlike rule-backfill.ts) — this reads
// already-synced local rows, so only Gemini's own rate limit applies, already
// handled per-call by email-categorizer's retry loop. Safe to run wider and
// with concurrency.
const CLASSIFICATION_CHUNK_SIZE = 40;
const CLASSIFICATION_CONCURRENCY = 5;
const processingRuns = new Set<string>();

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

export async function processEmailClassificationRun(runId: string) {
	const run = await getEmailClassificationRunById(runId);

	if (!run) {
		throw new Error(`Classification run ${runId} not found`);
	}

	if (run.status === "completed" || run.status === "failed") {
		return run;
	}

	if (processingRuns.has(run.id)) {
		return run;
	}
	processingRuns.add(run.id);

	try {
		try {
			await updateEmailClassificationRun({
				id: run.id,
				status: "running",
				lastError: null,
			});
		} catch (e) {
			if (!isPrismaNotFound(e)) {
				throw e;
			}
			return run;
		}

		try {
			const rows = await getUncategorizedEmails(run.mailboxId, {
				cursor: run.cursor ?? undefined,
				limit: CLASSIFICATION_CHUNK_SIZE,
			});

			let processedCount = run.processedCount;
			let classifiedCount = run.classifiedCount;
			let errorCount = run.errorCount;
			let cursor = run.cursor;

			for (const batch of chunk(rows, CLASSIFICATION_CONCURRENCY)) {
				const results = await Promise.allSettled(
					batch.map(async (email) => {
						const category = await classifyEmailCategory({
							from: email.from,
							to: email.to,
							subject: email.subject,
							snippet: email.snippet,
							bodyText: email.bodyText,
							labelIds: email.labelIds,
						});
						await updateEmailCategory(email.id, category);
						return email;
					}),
				);

				for (const result of results) {
					processedCount += 1;
					if (result.status === "fulfilled") {
						classifiedCount += 1;
					} else {
						errorCount += 1;
						logger.error(
							"[email-classification-backfill] Failed to classify email",
							{
								runId: run.id,
								error:
									result.reason instanceof Error
										? result.reason.message
										: String(result.reason),
							},
						);
					}
				}

				const oldest = batch.reduce((min, e) =>
					e.internalDate < min.internalDate ? e : min,
				);
				cursor = oldest.internalDate.toISOString();
			}

			const remaining = await countUncategorizedEmails(run.mailboxId);
			const isComplete = remaining === 0;

			return await updateEmailClassificationRun({
				id: run.id,
				status: isComplete ? "completed" : "running",
				cursor: isComplete ? null : cursor,
				processedCount,
				classifiedCount,
				errorCount,
				completedAt: isComplete ? new Date() : null,
			});
		} catch (error) {
			logger.error("[email-classification-backfill] Run failed", {
				runId: run.id,
				error: error instanceof Error ? error.message : String(error),
			});

			try {
				return await updateEmailClassificationRun({
					id: run.id,
					status: "failed",
					lastError:
						error instanceof Error ? error.message : String(error),
					completedAt: new Date(),
				});
			} catch (updateError) {
				if (isPrismaNotFound(updateError)) {
					return null;
				}
				throw updateError;
			}
		}
	} finally {
		processingRuns.delete(run.id);
	}
}

/**
 * Quiet ongoing classification for newly-synced mail, called from the poller
 * (email-classification-poller.ts). Separate from the client-driven backfill
 * run above — this has no visible progress UI, so it processes a small batch
 * per mailbox per tick rather than tracking a run to completion.
 */
export async function processDueEmailClassification() {
	const mailboxIds =
		await getMailboxIdsWithUncategorizedEmails(POLLER_MAILBOX_LIMIT);

	let totalClassified = 0;
	let totalErrors = 0;

	for (const mailboxId of mailboxIds) {
		const rows = await getUncategorizedEmails(mailboxId, {
			limit: POLLER_BATCH_SIZE_PER_MAILBOX,
		});

		const results = await Promise.allSettled(
			rows.map(async (email) => {
				const category = await classifyEmailCategory({
					from: email.from,
					to: email.to,
					subject: email.subject,
					snippet: email.snippet,
					bodyText: email.bodyText,
					labelIds: email.labelIds,
				});
				await updateEmailCategory(email.id, category);
			}),
		);

		for (const result of results) {
			if (result.status === "fulfilled") {
				totalClassified += 1;
			} else {
				totalErrors += 1;
				logger.error(
					"[email-classification-poller] Failed to classify email",
					{
						mailboxId,
						error:
							result.reason instanceof Error
								? result.reason.message
								: String(result.reason),
					},
				);
			}
		}
	}

	return { classified: totalClassified, errors: totalErrors };
}
