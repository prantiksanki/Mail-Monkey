"use client";

import { cn } from "@repo/ui";
import { Switch } from "@repo/ui/components/switch";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getActionIcon } from "../lib/action-icons";
import { useToggleRuleMutation } from "../lib/rules-api";

export interface RuleRowRule {
	id: string;
	name: string;
	enabled: boolean;
	mailboxId: string;
	condition: {
		conditionalOperator?: string | null;
		aiInstructions?: string | null;
		static?: {
			from?: string | null;
			to?: string | null;
			subject?: string | null;
		} | null;
	};
	actions: Array<{
		type: string;
		fields?: Record<string, unknown>;
	}>;
}

interface RuleRowProps {
	rule: RuleRowRule;
	firesCount: number;
	onOpen: () => void;
	/**
	 * Set only in the "All mailboxes" combined view, where rows from
	 * different inboxes are mixed together and need a tag to say which
	 * mailbox each rule actually runs on.
	 */
	mailboxTag?: { email: string; provider: string };
}

export function RuleRow({
	rule,
	firesCount,
	onOpen,
	mailboxTag,
}: RuleRowProps) {
	const t = useTranslations();
	const toggleMutation = useToggleRuleMutation();
	const primaryAction = rule.actions[0];
	const Icon = getActionIcon(primaryAction?.type);

	const handleToggle = async (enabled: boolean) => {
		try {
			await toggleMutation.mutateAsync({
				mailboxId: rule.mailboxId,
				id: rule.id,
				enabled,
			});
			toast.success(
				t("rules.notifications.toggled", {
					status: enabled
						? t("rules.ruleItem.enabled").toLowerCase()
						: t("rules.ruleItem.disabled").toLowerCase(),
				}),
			);
		} catch {
			toast.error(t("rules.notifications.toggleError"));
		}
	};

	const conditionText = buildConditionText(rule.condition, t);
	const actionsText = buildActionsText(rule.actions, t);

	return (
		<div
			className={cn(
				"grid items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40",
				mailboxTag
					? "grid-cols-[1fr_auto_auto_auto]"
					: "grid-cols-[1fr_auto_auto]",
				!rule.enabled && "opacity-60",
			)}
		>
			<button
				type="button"
				onClick={onOpen}
				className="flex min-w-0 items-center gap-4 text-left"
			>
				<span
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-full",
						rule.enabled
							? "bg-primary-soft text-primary-deep"
							: "bg-muted text-foreground",
					)}
				>
					<Icon className="size-4" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium text-foreground text-sm">
						{rule.name}
					</span>
					<span className="block truncate text-foreground text-xs">
						<span className="font-mono">
							{t("rules.ruleRow.when")}
						</span>{" "}
						{conditionText}{" "}
						<span className="font-mono">
							{t("rules.ruleRow.then")}
						</span>{" "}
						{actionsText}
					</span>
				</span>
			</button>

			{mailboxTag && (
				<span className="hidden items-center gap-1.5 truncate rounded-full border border-border bg-muted px-2.5 py-1 text-foreground text-xs sm:inline-flex">
					<span
						className={cn(
							"size-1.5 shrink-0 rounded-full",
							mailboxTag.provider === "GOOGLE"
								? "bg-[#ea4335]"
								: "bg-[#0a63d1]",
						)}
					/>
					<span className="max-w-[160px] truncate">
						{mailboxTag.email}
					</span>
				</span>
			)}

			<span className="hidden font-mono text-foreground text-xs md:inline">
				{rule.enabled
					? t("rules.ruleRow.fires", { count: firesCount })
					: t("rules.ruleRow.paused")}
			</span>

			<Switch
				checked={rule.enabled}
				onCheckedChange={handleToggle}
				disabled={toggleMutation.isPending}
				aria-label={rule.name}
			/>
		</div>
	);
}

function buildConditionText(
	condition: RuleRowRule["condition"],
	t: ReturnType<typeof useTranslations>,
): string {
	const parts: string[] = [];
	if (condition.aiInstructions) {
		parts.push(`AI: ${condition.aiInstructions}`);
	}
	if (condition.static?.from) {
		parts.push(`from: ${condition.static.from}`);
	}
	if (condition.static?.to) {
		parts.push(`to: ${condition.static.to}`);
	}
	if (condition.static?.subject) {
		parts.push(`subject: ${condition.static.subject}`);
	}
	if (parts.length === 0) {
		return "—";
	}
	const joiner =
		condition.conditionalOperator === "OR"
			? ` ${t("rules.ruleRow.or")} `
			: ` ${t("rules.ruleRow.and")} `;
	return parts.join(parts.length > 1 ? joiner : "");
}

function buildActionsText(
	actions: RuleRowRule["actions"],
	t: ReturnType<typeof useTranslations>,
): string {
	if (actions.length === 0) {
		return "—";
	}
	return actions
		.map((action) => {
			const label = t(`rules.ruleForm.actionTypes.${action.type}`);
			const labelField = action.fields?.label as string | undefined;
			if (action.type === "LABEL" && labelField) {
				return `${label} "${labelField}"`;
			}
			return label.toLowerCase();
		})
		.join(" · ");
}
