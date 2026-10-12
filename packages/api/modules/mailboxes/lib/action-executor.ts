import { getEmailById, updateEmailLabels, upsertEmail } from "@repo/database";
import { logger } from "@repo/logs";
import { ruleExecutionTotal, toMetricsProvider } from "@repo/metrics";
import type { RuleAction } from "../types";
import type { ParsedEmail } from "./email-parser";
import { getMailProvider } from "./mail-provider";

export interface ActionResult {
	type: string;
	success: boolean;
	error?: string;
}

async function executeAction(
	accountId: string,
	mailboxId: string,
	email: ParsedEmail,
	action: RuleAction,
	mailboxEmail: string,
	provider: "GOOGLE" | "OUTLOOK" | "IMAP",
): Promise<ActionResult> {
	const mailProvider = getMailProvider(provider);
	try {
		switch (action.type) {
			case "LABEL": {
				if (!action.fields?.label) {
					return {
						type: action.type,
						success: false,
						error: "No label",
					};
				}
				await mailProvider.applyLabel(
					accountId,
					email.id,
					action.fields.label,
				);
				// Mirror the label name into the local DB so label-based queries
				// work. If the email hasn't been synced into the local DB yet
				// (common for older messages a backfill reaches directly via the
				// mail provider, bypassing the regular inbox sync), upsert a full
				// row instead of silently skipping — otherwise the Gmail label
				// sticks but the email never appears in this app's own
				// label-filtered views, which read from the local DB only.
				try {
					const labelName = action.fields.label;
					const dbEmail = await getEmailById(mailboxId, email.id);
					if (dbEmail) {
						if (!dbEmail.labelIds.includes(labelName)) {
							await updateEmailLabels(email.id, [
								...dbEmail.labelIds,
								labelName,
							]);
						}
					} else {
						await upsertEmail({
							id: email.id,
							mailboxId,
							threadId: email.threadId,
							from: email.from,
							fromEmail: email.fromEmail,
							to: email.to,
							subject: email.subject,
							snippet: email.snippet,
							bodyText: email.bodyText,
							bodyHtml: email.bodyHtml,
							labelIds: email.labelIds.includes(labelName)
								? email.labelIds
								: [...email.labelIds, labelName],
							isUnread: email.labelIds.includes("UNREAD"),
							internalDate: email.date,
						});
					}
				} catch (dbErr) {
					logger.warn(
						"[action-executor] Failed to mirror label to local DB",
						{
							messageId: email.id,
							label: action.fields.label,
							error:
								dbErr instanceof Error
									? dbErr.message
									: String(dbErr),
						},
					);
				}
				return { type: action.type, success: true };
			}

			case "ARCHIVE":
				await mailProvider.archive(accountId, email.id);
				return { type: action.type, success: true };

			case "MARK_READ":
				await mailProvider.markRead(accountId, email.id);
				return { type: action.type, success: true };

			case "MARK_SPAM":
				await mailProvider.markSpam(accountId, email.id);
				return { type: action.type, success: true };

			case "FORWARD": {
				if (!action.fields?.to) {
					return {
						type: action.type,
						success: false,
						error: "No recipient",
					};
				}
				await mailProvider.forward(
					accountId,
					email,
					action.fields.to,
					action.fields.content ?? undefined,
					action.fields.cc ?? undefined,
					mailboxEmail,
				);
				return { type: action.type, success: true };
			}

			case "REPLY": {
				await mailProvider.reply(
					accountId,
					email,
					action.fields?.content || "",
					mailboxEmail,
				);
				return { type: action.type, success: true };
			}

			case "DRAFT_EMAIL": {
				await mailProvider.createDraft(
					accountId,
					email,
					action.fields?.to ?? undefined,
					action.fields?.subject ?? undefined,
					action.fields?.content ?? undefined,
					mailboxEmail,
				);
				return { type: action.type, success: true };
			}

			default:
				return {
					type: action.type,
					success: false,
					error: `Action type no longer supported, skipping: ${action.type}`,
				};
		}
	} catch (error) {
		return {
			type: action.type,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function executeActions(
	accountId: string,
	email: ParsedEmail,
	actions: RuleAction[],
	mailboxEmail: string,
	provider: "GOOGLE" | "OUTLOOK" | "IMAP" = "GOOGLE",
	mailboxId?: string,
): Promise<ActionResult[]> {
	const metricsProvider = toMetricsProvider(provider);
	const results: ActionResult[] = [];
	// Actions that move the message (archive, spam) change its id on IMAP and
	// Outlook, so every other action — notably LABEL, which copies the message
	// into a label folder — must run first while the original id is still valid.
	// `sort` is stable, so relative order within each group is preserved.
	const MOVING_ACTIONS = new Set(["ARCHIVE", "MARK_SPAM"]);
	const ordered = [...actions].sort(
		(a, b) =>
			Number(MOVING_ACTIONS.has(a.type)) -
			Number(MOVING_ACTIONS.has(b.type)),
	);
	for (const action of ordered) {
		const result = await executeAction(
			accountId,
			mailboxId ?? "",
			email,
			action,
			mailboxEmail,
			provider,
		);
		ruleExecutionTotal.inc({
			action_type: result.type,
			status: result.success ? "success" : "error",
			provider: metricsProvider,
		});
		results.push(result);
	}
	return results;
}
