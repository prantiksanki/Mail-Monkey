"use client";

import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/tabs";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	useDisableWatchMutation,
	useEnableWatchMutation,
	useMailboxStatsQuery,
	useRulesQuery,
	useWatchStatusQuery,
} from "../lib/rules-api";
import { RuleDrawer } from "./RuleDrawer";
import { RuleFormDialog } from "./RuleFormDialog";
import { RuleRow, type RuleRowRule } from "./RuleRow";
import { RulesLibrary } from "./RulesLibrary";
import { RulesPageHeader } from "./RulesPageHeader";

const PLAN_HIERARCHY: Record<string, number> = {
	free: 0,
	pro: 1,
};

type EditingRule = {
	id?: string;
	name: string;
	enabled?: boolean;
	condition: RuleRowRule["condition"];
	actions: RuleRowRule["actions"];
};

export function RulesDashboard() {
	const t = useTranslations();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: mailboxes = [] } = useMailboxesQuery();
	const { data, isLoading } = useRulesQuery(selectedMailboxId);
	const { data: watchStatus } = useWatchStatusQuery(selectedMailboxId);
	const { data: stats } = useMailboxStatsQuery(selectedMailboxId);
	const enableWatch = useEnableWatchMutation();
	const disableWatch = useDisableWatchMutation();

	const { activePlan } = usePurchases();
	const canWatch =
		(PLAN_HIERARCHY[activePlan?.id ?? "free"] ?? 0) >=
		(PLAN_HIERARCHY.pro ?? 1);

	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<EditingRule | null>(null);
	const [drawerRuleId, setDrawerRuleId] = useState<string | null>(null);

	const rules = (data?.rules ?? []) as unknown as RuleRowRule[];
	const selectedMailbox = mailboxes.find((m) => m.id === selectedMailboxId);

	const firesMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const entry of stats?.firesByRule7d ?? []) {
			map.set(entry.ruleId, entry.count);
		}
		return map;
	}, [stats?.firesByRule7d]);

	const activeCount = rules.filter((r) => r.enabled).length;
	const pausedCount = rules.length - activeCount;

	const drawerRule = drawerRuleId
		? (rules.find((r) => r.id === drawerRuleId) ?? null)
		: null;

	const handleCreate = () => {
		setEditingRule(null);
		setIsCreateDialogOpen(true);
	};

	const handleEdit = (rule: RuleRowRule) => {
		setEditingRule({
			id: rule.id,
			name: rule.name,
			enabled: rule.enabled,
			condition: rule.condition,
			actions: rule.actions,
		});
		setIsCreateDialogOpen(true);
	};

	const handleCloseForm = () => {
		setIsCreateDialogOpen(false);
		setEditingRule(null);
	};

	const handleEditSuggestion = (suggestion: {
		name: string;
		condition: RuleRowRule["condition"];
		actions: RuleRowRule["actions"];
	}) => {
		setEditingRule({
			name: suggestion.name,
			enabled: true,
			condition: suggestion.condition,
			actions: suggestion.actions,
		});
		setIsCreateDialogOpen(true);
	};

	const handleWatchToggle = async (enabled: boolean) => {
		if (!selectedMailboxId) {
			return;
		}
		try {
			if (enabled) {
				await enableWatch.mutateAsync({ mailboxId: selectedMailboxId });
				toast.success(t("rules.engine.notifications.activated"));
			} else {
				await disableWatch.mutateAsync({
					mailboxId: selectedMailboxId,
				});
				toast.success(t("rules.engine.notifications.deactivated"));
			}
		} catch {
			toast.error(
				enabled
					? t("rules.engine.notifications.activationError")
					: t("rules.engine.notifications.deactivationError"),
			);
		}
	};

	if (!selectedMailboxId || !selectedMailbox) {
		return (
			<Card className="p-12">
				<div className="text-center">
					<p className="text-muted-foreground">
						{t("rules.noMailboxSelected")}
					</p>
				</div>
			</Card>
		);
	}

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-72 w-full" />
				<Skeleton className="h-40 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<RulesPageHeader
				mailboxEmail={selectedMailbox.email}
				activeCount={activeCount}
				pausedCount={pausedCount}
				watchEnabled={watchStatus?.watchEnabled ?? false}
				canWatch={canWatch}
				onWatchToggle={handleWatchToggle}
				watchPending={enableWatch.isPending || disableWatch.isPending}
				onCreate={handleCreate}
			/>

			<Tabs defaultValue="discover">
				<TabsList className="mb-6">
					<TabsTrigger value="discover">Discover</TabsTrigger>
					<TabsTrigger value="my-rules">
						My Rules
						{rules.length > 0 && (
							<span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
								{rules.length}
							</span>
						)}
					</TabsTrigger>
				</TabsList>

				{/* ── Discover tab ─────────────────────────────────────── */}
				<TabsContent value="discover">
					<RulesLibrary
						mailboxId={selectedMailboxId}
						existingRules={rules}
						onEditSuggestion={handleEditSuggestion}
					/>
				</TabsContent>

				{/* ── My Rules tab ─────────────────────────────────────── */}
				<TabsContent value="my-rules">
					{rules.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-16 text-center">
							<p className="text-foreground text-sm">
								No rules yet. Go to{" "}
								<strong className="text-foreground">
									Discover
								</strong>{" "}
								to add your first automation.
							</p>
						</div>
					) : (
						<div className="space-y-6">
							{/* Active rules */}
							{activeCount > 0 && (
								<div>
									<p className="mb-2 font-mono text-foreground text-xs uppercase tracking-wider">
										Active · {activeCount}
									</p>
									<div className="overflow-hidden rounded-2xl border border-border bg-card">
										<div className="divide-y divide-border">
											{rules
												.filter((r) => r.enabled)
												.map((rule) => (
													<RuleRow
														key={rule.id}
														rule={rule}
														firesCount={
															firesMap.get(
																rule.id,
															) ?? 0
														}
														onOpen={() =>
															setDrawerRuleId(
																rule.id,
															)
														}
													/>
												))}
										</div>
									</div>
								</div>
							)}

							{/* Paused rules */}
							{pausedCount > 0 && (
								<div>
									<p className="mb-2 font-mono text-foreground text-xs uppercase tracking-wider">
										Paused · {pausedCount}
									</p>
									<div className="overflow-hidden rounded-2xl border border-border bg-card">
										<div className="divide-y divide-border">
											{rules
												.filter((r) => !r.enabled)
												.map((rule) => (
													<RuleRow
														key={rule.id}
														rule={rule}
														firesCount={
															firesMap.get(
																rule.id,
															) ?? 0
														}
														onOpen={() =>
															setDrawerRuleId(
																rule.id,
															)
														}
													/>
												))}
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</TabsContent>
			</Tabs>

			<RuleFormDialog
				open={isCreateDialogOpen}
				onOpenChange={handleCloseForm}
				mailboxId={selectedMailboxId}
				editingRule={editingRule}
			/>

			<RuleDrawer
				open={!!drawerRuleId}
				onOpenChange={(open) => {
					if (!open) {
						setDrawerRuleId(null);
					}
				}}
				rule={drawerRule}
				firesCount={drawerRule ? (firesMap.get(drawerRule.id) ?? 0) : 0}
				onEdit={handleEdit}
			/>
		</div>
	);
}
