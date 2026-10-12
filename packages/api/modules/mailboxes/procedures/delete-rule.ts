import {
	deleteRule as deleteRuleQuery,
	getRulesByMailboxId,
} from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership, verifyRuleOwnership } from "../lib/ownership";
import { labelNamesFromActions } from "../lib/rule-labels";
import { invalidateRuleSuggestionsCache } from "../lib/rule-suggestions";

export const deleteRule = protectedProcedure
	.route({
		method: "DELETE",
		path: "/mailboxes/{mailboxId}/rules/{id}",
		tags: ["Mailboxes"],
		summary: "Delete rule",
		description: "Delete a rule",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			id: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const rule = await verifyRuleOwnership(
			input.id,
			input.mailboxId,
			context.user.id,
		);
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		// Label names this rule applies. We only remove a provider label when NO
		// other rule still applies the same name — labels can be shared (e.g. the
		// suggestion engine groups many senders under one "Newsletter" label).
		const ruleLabels = labelNamesFromActions(rule.actions);

		await deleteRuleQuery(input.id);
		invalidateRuleSuggestionsCache(input.mailboxId);

		if (ruleLabels.length > 0) {
			// Compute the labels still in use by the *remaining* rules.
			const remaining = await getRulesByMailboxId({
				mailboxId: input.mailboxId,
			});
			const stillUsed = new Set(
				remaining
					.flatMap((r) => labelNamesFromActions(r.actions))
					.map((l) => l.toLowerCase()),
			);

			const provider = getMailProvider(mailbox.provider);
			for (const label of ruleLabels) {
				if (stillUsed.has(label.toLowerCase())) {
					continue;
				}
				// Best-effort: failing to delete the provider label must not fail
				// the rule deletion the user already asked for.
				try {
					await provider.deleteLabel(mailbox.accountId, label);
				} catch (error) {
					logger.warn(
						"[delete-rule] Failed to delete provider label",
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

		return {
			success: true,
		};
	});
