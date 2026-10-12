import { ORPCError } from "@orpc/client";
import {
	findRuleByNameInMailbox,
	getRulesByMailboxId,
	updateRule as updateRuleQuery,
} from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership, verifyRuleOwnership } from "../lib/ownership";
import { labelNamesFromActions } from "../lib/rule-labels";
import { invalidateRuleSuggestionsCache } from "../lib/rule-suggestions";
import { UpdateRuleSchema } from "../types";

export const updateRule = protectedProcedure
	.route({
		method: "PUT",
		path: "/mailboxes/{mailboxId}/rules/{id}",
		tags: ["Mailboxes"],
		summary: "Update rule",
		description: "Update an existing rule",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			id: z.string(),
			data: UpdateRuleSchema,
		}),
	)
	.handler(async ({ input, context }) => {
		const previousRule = await verifyRuleOwnership(
			input.id,
			input.mailboxId,
			context.user.id,
		);

		// Enforce unique rule names per mailbox (case-insensitive), ignoring
		// the rule being updated so it can keep its own name.
		if (input.data.name !== undefined) {
			const existingRule = await findRuleByNameInMailbox({
				mailboxId: input.mailboxId,
				name: input.data.name,
				excludeId: input.id,
			});
			if (existingRule) {
				throw new ORPCError("CONFLICT", {
					message: "This rule is already exists.",
				});
			}
		}

		// Note: multiple rules may intentionally share the same label, so label
		// uniqueness is not enforced here (see create-rule.ts for rationale).

		const updatedRule = await updateRuleQuery({
			id: input.id,
			name: input.data.name,
			condition: input.data.condition,
			actions: input.data.actions,
			enabled: input.data.enabled,
		});
		invalidateRuleSuggestionsCache(input.mailboxId);

		// If this edit dropped/renamed a LABEL action, remove the now-orphaned
		// provider label so Gmail/Outlook stays in sync — but only if no other
		// rule still uses that label name.
		if (input.data.actions !== undefined) {
			const previousLabels = labelNamesFromActions(previousRule.actions);
			const currentLabels = new Set(
				labelNamesFromActions(input.data.actions).map((l) =>
					l.toLowerCase(),
				),
			);
			const droppedLabels = previousLabels.filter(
				(l) => !currentLabels.has(l.toLowerCase()),
			);

			if (droppedLabels.length > 0) {
				const mailbox = await verifyMailboxOwnership(
					input.mailboxId,
					context.user.id,
				);
				const remaining = await getRulesByMailboxId({
					mailboxId: input.mailboxId,
				});
				const stillUsed = new Set(
					remaining
						.flatMap((r) => labelNamesFromActions(r.actions))
						.map((l) => l.toLowerCase()),
				);
				const provider = getMailProvider(mailbox.provider);
				for (const label of droppedLabels) {
					if (stillUsed.has(label.toLowerCase())) {
						continue;
					}
					try {
						await provider.deleteLabel(mailbox.accountId, label);
					} catch (error) {
						logger.warn(
							"[update-rule] Failed to delete orphaned provider label",
							{
								mailboxId: input.mailboxId,
								label,
								error:
									error instanceof Error
										? error.message
										: String(error),
							},
						);
					}
				}
			}
		}

		return {
			rule: updatedRule,
		};
	});
