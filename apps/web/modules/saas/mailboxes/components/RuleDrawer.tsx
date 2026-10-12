"use client";

import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useConfirmationAlert } from "@saas/shared/components/ConfirmationAlertProvider";
import { CopyIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { getActionIcon } from "../lib/action-icons";
import {
	useCreateRuleMutation,
	useDeleteRuleMutation,
	useExecutionLogsQuery,
} from "../lib/rules-api";
import { RuleBackfillPanel } from "./RuleBackfillPanel";
import type { RuleRowRule } from "./RuleRow";

interface RuleDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	rule: RuleRowRule | null;
	firesCount: number;
	onEdit: (rule: RuleRowRule) => void;
}

type ActionEntry = { type?: string; success?: boolean } | null;

export function RuleDrawer({
	open,
	onOpenChange,
	rule,
	firesCount,
	onEdit,
}: RuleDrawerProps) {
	const t = useTranslations();
	const format = useFormatter();
	const { confirm } = useConfirmationAlert();
	const deleteMutation = useDeleteRuleMutation();
	const createMutation = useCreateRuleMutation();

	const { data: logsData, isLoading: logsLoading } = useExecutionLogsQuery(
		rule?.mailboxId ?? null,
		5,
		0,
		rule?.id
			? { ruleId: rule.id, status: "matched" }
			: { status: "matched" },
	);

	if (!rule) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent
					side="right"
					className="flex flex-col gap-0 p-0 sm:max-w-md"
				/>
			</Sheet>
		);
	}

	const PrimaryIcon = getActionIcon(rule.actions[0]?.type);

	const handleEdit = () => {
		onOpenChange(false);
		onEdit(rule);
	};

	const handleDuplicate = async () => {
		try {
			await createMutation.mutateAsync({
				mailboxId: rule.mailboxId,
				data: {
					name: `${rule.name} (copy)`,
					condition: rule.condition,
					actions: rule.actions,
					enabled: false,
				},
			});
			toast.success(t("rules.ruleForm.notifications.created"));
			onOpenChange(false);
		} catch {
			toast.error(t("rules.ruleForm.notifications.error"));
		}
	};

	const handleDelete = () => {
		confirm({
			title: t("rules.confirmDelete.title"),
			message: t("rules.confirmDelete.message"),
			confirmLabel: t("rules.confirmDelete.confirm"),
			destructive: true,
			onConfirm: async () => {
				try {
					await deleteMutation.mutateAsync({
						mailboxId: rule.mailboxId,
						id: rule.id,
					});
					toast.success(t("rules.notifications.deleted"));
					onOpenChange(false);
				} catch {
					toast.error(t("rules.notifications.deleteError"));
				}
			},
		});
	};

	const conditionParts: Array<{ label: string; value: string }> = [];
	if (rule.condition.aiInstructions) {
		conditionParts.push({
			label: "AI",
			value: rule.condition.aiInstructions,
		});
	}
	if (rule.condition.static?.from) {
		conditionParts.push({
			label: "from",
			value: rule.condition.static.from,
		});
	}
	if (rule.condition.static?.to) {
		conditionParts.push({ label: "to", value: rule.condition.static.to });
	}
	if (rule.condition.static?.subject) {
		conditionParts.push({
			label: "subject",
			value: rule.condition.static.subject,
		});
	}

	const joiner =
		rule.condition.conditionalOperator === "OR"
			? t("rules.ruleRow.or")
			: t("rules.ruleRow.and");

	const logs = logsData?.logs ?? [];

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex flex-col gap-0 p-0 sm:max-w-md"
			>
				<SheetHeader className="border-border border-b p-6 pr-10 text-left">
					<p className="font-mono text-foreground text-xs uppercase tracking-wider">
						{t("rules.drawer.eyebrow")}
					</p>
					<SheetTitle className="flex items-center gap-2 font-serif font-normal text-2xl tracking-tight">
						<span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
							<PrimaryIcon className="size-4" />
						</span>
						{rule.name}
					</SheetTitle>
				</SheetHeader>

				<div className="flex-1 space-y-6 overflow-y-auto p-6">
					<section>
						<p className="font-mono text-foreground text-xs uppercase tracking-wider">
							{t("rules.drawer.definition")}
						</p>
						<div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
							<div className="space-y-2">
								<p className="font-mono text-foreground text-xs uppercase tracking-wider">
									{t("rules.ruleRow.when")}
								</p>
								{conditionParts.length === 0 ? (
									<p className="text-foreground">—</p>
								) : (
									<ul className="space-y-1.5">
										{conditionParts.map((part, index) => (
											<li
												key={part.label}
												className="leading-relaxed"
											>
												{index > 0 && (
													<span className="mr-2 font-mono font-semibold text-primary-deep text-xs">
														{joiner}
													</span>
												)}
												<span className="font-mono text-foreground text-xs">
													{part.label}:
												</span>{" "}
												<span>{part.value}</span>
											</li>
										))}
									</ul>
								)}
							</div>
							<div className="space-y-2 border-border border-t pt-3">
								<p className="font-mono text-foreground text-xs uppercase tracking-wider">
									{t("rules.drawer.actions")}
								</p>
								<div className="flex flex-wrap gap-1.5">
									{rule.actions.map((action, index) => {
										const Icon = getActionIcon(action.type);
										const labelField = action.fields
											?.label as string | undefined;
										return (
											<span
												key={`${action.type}-${index}`}
												className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-primary-deep text-xs"
											>
												<Icon className="size-3" />
												{t(
													`rules.ruleForm.actionTypes.${action.type}`,
												)}
												{action.type === "LABEL" &&
													labelField &&
													` · ${labelField}`}
											</span>
										);
									})}
								</div>
							</div>
						</div>
					</section>

					<section>
						<p className="font-mono text-foreground text-xs uppercase tracking-wider">
							{t("rules.drawer.performance")}
						</p>
						<div className="mt-3 grid grid-cols-2 gap-3">
							<div className="rounded-xl border border-border bg-card p-4">
								<p className="font-mono text-foreground text-xs uppercase tracking-wider">
									{t("rules.drawer.sevenDayFires")}
								</p>
								<p className="mt-1 font-serif font-normal text-2xl tracking-tight">
									{firesCount}
								</p>
							</div>
							<div className="rounded-xl border border-border bg-card p-4">
								<p className="font-mono text-foreground text-xs uppercase tracking-wider">
									{t("rules.drawer.status")}
								</p>
								<p className="mt-1 font-serif font-normal text-2xl tracking-tight">
									{rule.enabled
										? t("rules.drawer.statusActive")
										: t("rules.drawer.statusPaused")}
								</p>
							</div>
						</div>
					</section>

					<section>
						<RuleBackfillPanel
							mailboxId={rule.mailboxId}
							ruleId={rule.id}
						/>
					</section>

					<section>
						<p className="font-mono text-foreground text-xs uppercase tracking-wider">
							{t("rules.drawer.recentFires")}
						</p>
						<div className="mt-3">
							{logsLoading ? (
								<div className="space-y-2">
									<Skeleton className="h-8 w-full" />
									<Skeleton className="h-8 w-full" />
									<Skeleton className="h-8 w-full" />
								</div>
							) : logs.length === 0 ? (
								<p className="text-foreground text-sm">
									{t("rules.drawer.recentEmpty")}
								</p>
							) : (
								<ul className="divide-y divide-dashed divide-border">
									{logs.map((log) => {
										const actions = Array.isArray(
											log.actionsRun,
										)
											? (log.actionsRun as ActionEntry[])
											: [];
										const primary = actions.find(
											(a) =>
												a?.type && a.success !== false,
										);
										const time = format.dateTime(
											new Date(log.createdAt),
											{
												hour: "2-digit",
												minute: "2-digit",
											},
										);
										return (
											<li
												key={log.id}
												className="flex items-center justify-between gap-3 py-2 text-sm"
											>
												<span className="flex min-w-0 flex-1 items-center gap-2 text-foreground">
													<span className="shrink-0 font-mono text-foreground text-xs">
														{time}
													</span>
													<span className="truncate">
														{log.subject ||
															log.from ||
															"—"}
													</span>
												</span>
												{log.status === "error" ? (
													<span className="shrink-0 whitespace-nowrap font-mono text-destructive text-xs">
														{t(
															"dashboard.activity.statusError",
														).toLowerCase()}
													</span>
												) : primary?.type ? (
													<span className="shrink-0 whitespace-nowrap font-mono text-primary-deep text-xs">
														{t(
															`rules.ruleForm.actionTypes.${primary.type}`,
														).toLowerCase()}{" "}
														✓
													</span>
												) : (
													<span className="shrink-0 whitespace-nowrap font-mono text-foreground text-xs">
														{t(
															"dashboard.activity.statusNotMatched",
														).toLowerCase()}
													</span>
												)}
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</section>
				</div>

				<div className="flex items-center justify-between gap-2 border-border border-t p-4">
					<Button
						variant="destructive"
						size="icon"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
						loading={deleteMutation.isPending}
						aria-label={t("rules.ruleItem.delete")}
					>
						<Trash2Icon className="size-4" />
					</Button>
					<div className="flex items-center gap-2">
						<Button
							variant="primary"
							size="sm"
							onClick={handleDuplicate}
							disabled={createMutation.isPending}
							loading={createMutation.isPending}
						>
							<CopyIcon className="size-4" />
							{t("rules.drawer.duplicate")}
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={handleEdit}
						>
							<PencilIcon className="size-4" />
							{t("rules.drawer.edit")}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
