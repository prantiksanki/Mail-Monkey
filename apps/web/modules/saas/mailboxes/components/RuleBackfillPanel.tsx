"use client";

import { Button } from "@repo/ui/components/button";
import { Progress } from "@repo/ui/components/progress";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
	useAdvanceRuleBackfillMutation,
	useRuleBackfillStatusQuery,
	useStartRuleBackfillMutation,
} from "../lib/rules-api";

interface RuleBackfillPanelProps {
	mailboxId: string;
	ruleId: string;
}

export function RuleBackfillPanel({
	mailboxId,
	ruleId,
}: RuleBackfillPanelProps) {
	const t = useTranslations();
	const { data } = useRuleBackfillStatusQuery(mailboxId, ruleId);
	const startMutation = useStartRuleBackfillMutation();
	const advanceMutation = useAdvanceRuleBackfillMutation();
	const run = data?.run ?? null;
	const isRunning = run?.status === "pending" || run?.status === "running";
	const lastAdvanceKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (!run || !isRunning || advanceMutation.isPending) {
			return;
		}

		const advanceKey = `${run.id}:${run.processedCount}:${run.status}`;
		if (lastAdvanceKeyRef.current === advanceKey) {
			return;
		}

		lastAdvanceKeyRef.current = advanceKey;
		advanceMutation.mutate({ mailboxId, runId: run.id });
	}, [run, isRunning, mailboxId, advanceMutation]);

	const handleStart = async () => {
		try {
			await startMutation.mutateAsync({
				mailboxId,
				ruleId,
				windowMonths: "1",
			});
			toast.success(t("rules.backfill.notifications.started"));
		} catch {
			toast.error(t("rules.backfill.notifications.startError"));
		}
	};

	const estimatedTotal = Math.max(
		run?.estimatedTotal ?? run?.processedCount ?? 0,
		run?.processedCount ?? 0,
		1,
	);
	const progressValue = run
		? Math.min((run.processedCount / estimatedTotal) * 100, 100)
		: 0;

	return (
		<section>
			<p className="font-mono text-foreground text-xs uppercase tracking-wider">
				{t("rules.backfill.eyebrow")}
			</p>
			<div className="mt-3 rounded-xl border border-border bg-card p-4">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="font-medium text-sm text-foreground">
							{t("rules.backfill.title")}
						</p>
						<p className="mt-1 text-foreground text-sm">
							{t("rules.backfill.description")}
						</p>
					</div>
					<Button
						size="sm"
						variant="primary"
						onClick={handleStart}
						loading={startMutation.isPending}
						disabled={isRunning}
					>
						{run
							? t("rules.backfill.rerun")
							: t("rules.backfill.start")}
					</Button>
				</div>

				{run && (
					<div className="mt-4 space-y-4">
						<div className="flex items-center justify-between text-xs">
							<span className="font-mono uppercase tracking-wider text-foreground">
								{t(`rules.backfill.status.${run.status}`)}
							</span>
							<span className="font-mono text-foreground">
								{t("rules.backfill.progress", {
									done: run.processedCount,
									total: estimatedTotal,
								})}
							</span>
						</div>

						<Progress value={progressValue} className="h-2" />

						<div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
							<Stat
								label={t("rules.backfill.stats.applied")}
								value={run.appliedCount}
							/>
							<Stat
								label={t("rules.backfill.stats.matched")}
								value={run.matchedCount}
							/>
							<Stat
								label={t("rules.backfill.stats.skipped")}
								value={run.skippedCount}
							/>
							<Stat
								label={t("rules.backfill.stats.errors")}
								value={run.errorCount}
							/>
						</div>

						{run.status === "completed" && (
							<p className="rounded-lg bg-primary-soft px-3 py-2 text-primary-deep text-sm">
								{t("rules.backfill.summary", {
									applied: run.appliedCount,
								})}
							</p>
						)}

						{run.status === "failed" && (
							<p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
								{run.lastError ||
									t(
										"rules.backfill.notifications.startError",
									)}
							</p>
						)}
					</div>
				)}
			</div>
		</section>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg bg-muted/50 px-3 py-2">
			<p className="font-mono text-[11px] uppercase tracking-wider text-foreground">
				{label}
			</p>
			<p className="mt-1 font-serif text-xl text-foreground">{value}</p>
		</div>
	);
}
