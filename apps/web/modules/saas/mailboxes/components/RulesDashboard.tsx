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
import {
	ALL_MAILBOXES_SCOPE,
	useSelectedMailbox,
} from "@saas/mailboxes/lib/selected-mailbox-context";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	useAllMailboxesRulesQuery,
	useAllMailboxesStatsQuery,
	useAllMailboxesWatchStatusQuery,
	useDisableWatchMutation,
	useEnableWatchMutation,
	useMailboxStatsQuery,
	useRulesQuery,
	useWatchStatusQuery,
} from "../lib/rules-api";
import { MailboxScopeSwitcher } from "./MailboxScopeSwitcher";
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

	const isAllScope = selectedMailboxId === ALL_MAILBOXES_SCOPE;
	const singleMailboxId = isAllScope ? null : selectedMailboxId;

	// Single-mailbox data (used when a specific inbox is selected).
	const { data, isLoading } = useRulesQuery(singleMailboxId);
	const { data: watchStatus } = useWatchStatusQuery(singleMailboxId);
	const { data: stats } = useMailboxStatsQuery(singleMailboxId);

	// "All mailboxes" data (used in combined scope). Disabled by passing an
	// empty array, so these are no-ops outside of "all" scope.
	const combinedRules = useAllMailboxesRulesQuery(
		isAllScope ? mailboxes : [],
	);
	const combinedWatch = useAllMailboxesWatchStatusQuery(
		isAllScope ? mailboxes.map((m) => m.id) : [],
	);
	const combinedStats = useAllMailboxesStatsQuery(
		isAllScope ? mailboxes.map((m) => m.id) : [],
	);

	const enableWatch = useEnableWatchMutation();
	const disableWatch = useDisableWatchMutation();

	const { activePlan } = usePurchases();
	const canWatch =
		(PLAN_HIERARCHY[activePlan?.id ?? "free"] ?? 0) >=
		(PLAN_HIERARCHY.pro ?? 1);

	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [createTargetMailboxId, setCreateTargetMailboxId] = useState<
		string | null
	>(null);
	const [editingRule, setEditingRule] = useState<EditingRule | null>(null);
	const [drawerRuleId, setDrawerRuleId] = useState<string | null>(null);

	const rules = (data?.rules ?? []) as unknown as RuleRowRule[];
	const selectedMailbox = mailboxes.find((m) => m.id === selectedMailboxId);

	const effectiveStats = isAllScope ? combinedStats.data : stats;
	const effectiveWatchEnabled = isAllScope
		? combinedWatch.isWatching
		: (watchStatus?.watchEnabled ?? false);
	const effectiveIsLoading = isAllScope ? combinedRules.isLoading : isLoading;

	const firesMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const entry of effectiveStats?.firesByRule7d ?? []) {
			map.set(entry.ruleId, entry.count);
		}
		return map;
	}, [effectiveStats?.firesByRule7d]);

	const activeCount = isAllScope
		? combinedRules.rules.filter((r) => r.rule.enabled).length
		: rules.filter((r) => r.enabled).length;
	const pausedCount = isAllScope
		? combinedRules.rules.length - activeCount
		: rules.length - activeCount;

	const drawerRule = drawerRuleId
		? isAllScope
			? ((combinedRules.rules.find((r) => r.rule.id === drawerRuleId)
					?.rule as unknown as RuleRowRule) ?? null)
			: (rules.find((r) => r.id === drawerRuleId) ?? null)
		: null;

	const handleCreate = (mailboxId?: string) => {
		setEditingRule(null);
		setCreateTargetMailboxId(mailboxId ?? singleMailboxId);
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
		setCreateTargetMailboxId(rule.mailboxId);
		setIsCreateDialogOpen(true);
	};

	const handleCloseForm = () => {
		setIsCreateDialogOpen(false);
		setEditingRule(null);
		setCreateTargetMailboxId(null);
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
		setCreateTargetMailboxId(singleMailboxId);
		setIsCreateDialogOpen(true);
	};

	const handleWatchToggle = async (enabled: boolean) => {
		if (!singleMailboxId) {
			return;
		}
		try {
			if (enabled) {
				await enableWatch.mutateAsync({ mailboxId: singleMailboxId });
				toast.success(t("rules.engine.notifications.activated"));
			} else {
				await disableWatch.mutateAsync({
					mailboxId: singleMailboxId,
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

	if (!isAllScope && (!selectedMailboxId || !selectedMailbox)) {
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

	if (effectiveIsLoading) {
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
			<div className="flex justify-end">
				<MailboxScopeSwitcher />
			</div>

			<RulesPageHeader
				mailboxEmail={
					isAllScope
						? "All mailboxes"
						: (selectedMailbox?.email ?? "")
				}
				activeCount={activeCount}
				pausedCount={pausedCount}
				watchEnabled={effectiveWatchEnabled}
				canWatch={canWatch}
				onWatchToggle={handleWatchToggle}
				watchPending={enableWatch.isPending || disableWatch.isPending}
				onCreate={handleCreate}
				isAllScope={isAllScope}
				mailboxes={mailboxes}
			/>

			{isAllScope ? (
				<div className="space-y-6">
					<p className="-mt-4 text-muted-foreground text-xs">
						Rules from every connected mailbox. Each rule still only
						runs against the one inbox it was created for.
					</p>
					{combinedRules.rules.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-16 text-center">
							<p className="text-foreground text-sm">
								No rules yet on any mailbox. Click{" "}
								<strong className="text-foreground">
									New rule
								</strong>{" "}
								and pick an inbox to get started.
							</p>
						</div>
					) : (
						<div className="overflow-hidden rounded-2xl border border-border bg-card">
							<div className="divide-y divide-border">
								{combinedRules.rules.map(
									({
										rule,
										mailboxId,
										mailboxEmail,
										mailboxProvider,
									}) => (
										<RuleRow
											key={`${mailboxId}:${rule.id}`}
											rule={
												rule as unknown as RuleRowRule
											}
											firesCount={
												firesMap.get(rule.id) ?? 0
											}
											mailboxTag={{
												email: mailboxEmail,
												provider: mailboxProvider,
											}}
											onOpen={() =>
												setDrawerRuleId(rule.id)
											}
										/>
									),
								)}
							</div>
						</div>
					)}
				</div>
			) : (
				<Tabs defaultValue="discover">
					<TabsList variant="pill" className="mb-6">
						<TabsTrigger variant="pill" value="discover">
							Discover
						</TabsTrigger>
						<TabsTrigger variant="pill" value="my-rules">
							My Rules
							{rules.length > 0 && (
								<span className="ml-1.5 flex h-4 items-center justify-center rounded-full bg-muted px-1.5 font-mono text-[11px] text-foreground">
									{rules.length}
								</span>
							)}
						</TabsTrigger>
					</TabsList>

					{/* ── Discover tab ─────────────────────────────────────── */}
					<TabsContent value="discover">
						<RulesLibrary
							mailboxId={selectedMailboxId as string}
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
			)}

			<RuleFormDialog
				open={isCreateDialogOpen}
				onOpenChange={handleCloseForm}
				mailboxId={createTargetMailboxId}
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
