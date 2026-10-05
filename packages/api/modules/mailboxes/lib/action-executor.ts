import { getEmailById, updateEmailLabels } from "@repo/database";
import { logger } from "@repo/logs";
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
	provider: "GOOGLE" | "OUTLOOK",
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
				// Mirror the label name into the local DB so label-based queries work
				try {
					const dbEmail = await getEmailById(mailboxId, email.id);
					if (dbEmail) {
						const labelName = action.fields.label;
						if (!dbEmail.labelIds.includes(labelName)) {
							await updateEmailLabels(email.id, [
								...dbEmail.labelIds,
								labelName,
							]);
						}
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
	provider: "GOOGLE" | "OUTLOOK" = "GOOGLE",
	mailboxId?: string,
): Promise<ActionResult[]> {
	const results: ActionResult[] = [];
	for (const action of actions) {
		results.push(
			await executeAction(
				accountId,
				mailboxId ?? "",
				email,
				action,
				mailboxEmail,
				provider,
			),
		);
	}
	return results;
}
