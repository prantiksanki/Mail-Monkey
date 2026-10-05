"use client";

import { authClient } from "@repo/auth/client";
import { cn } from "@repo/ui";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { useApplyRulesToRecentMutation } from "@saas/mailboxes/lib/rules-api";
import { useRouter } from "@shared/hooks/router";
import { clearCache } from "@shared/lib/cache";
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	CheckIcon,
	MinusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { config } from "@/config";

type AppliedResult = {
	messageId: string;
	subject: string;
	from: string;
	matchedRuleId: string | null;
	matchedRuleName: string | null;
	actions: string[];
	status: "applied" | "skipped" | "error";
	error?: string;
};

const REVEAL_INTERVAL_MS = 260;

interface OnboardingStepApplyProps {
	mailboxId: string | null;
	onBack: () => void;
}

export function OnboardingStepApply({
	mailboxId,
	onBack,
}: OnboardingStepApplyProps) {
	const t = useTranslations();
	const router = useRouter();
	const apply = useApplyRulesToRecentMutation();
	const [results, setResults] = useState<AppliedResult[]>([]);
	const [revealed, setRevealed] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [finishing, setFinishing] = useState(false);
	const [started, setStarted] = useState(false);

	useEffect(() => {
		if (!mailboxId || started) {
			return;
		}
		setStarted(true);
		apply
			.mutateAsync({ mailboxId })
			.then((data) => {
				setResults((data.results ?? []) as AppliedResult[]);
			})
			.catch(() => {
				setError(t("onboarding.notifications.applyFailed"));
			});
	}, [mailboxId, started]);

	useEffect(() => {
		if (results.length === 0 || revealed >= results.length) {
			return;
		}
		const timer = setTimeout(() => {
			setRevealed((n) => n + 1);
		}, REVEAL_INTERVAL_MS);
		return () => clearTimeout(timer);
	}, [results, revealed]);

	const total = results.length;
	const isComplete = total > 0 && revealed >= total;
	const actionsTaken = results
		.slice(0, revealed)
		.filter((r) => r.status === "applied").length;
	const skipped = revealed - actionsTaken;

	const handleFinish = async () => {
		setFinishing(true);
		try {
			await authClient.updateUser({ onboardingComplete: true });
			await clearCache();
			router.replace(config.saas.redirectAfterSignIn);
		} catch {
			setFinishing(false);
			setError(t("onboarding.notifications.applyFailed"));
		}
	};

	return (
		<div>
			<p className="font-mono text-foreground/50 text-xs uppercase tracking-wider">
				{t("onboarding.apply.eyebrow")}
			</p>
			<h1 className="mt-3 text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{t.rich("onboarding.apply.heading", {
					accent: (chunks) => (
						<em className="italic text-primary">{chunks}</em>
					),
				})}
			</h1>
			<p className="mt-4 max-w-lg text-foreground/60">
				{t("onboarding.apply.description")}
			</p>

			<div className="mt-8 overflow-hidden rounded-2xl border bg-card">
				<div className="flex items-center justify-between border-b px-5 py-3 text-sm">
					<span className="inline-flex items-center gap-2">
						{isComplete ? (
							<>
								<CheckIcon className="size-3.5 text-primary-deep" />
								{t("onboarding.apply.done")}
							</>
						) : (
							<>
								<span className="relative flex size-2">
									<span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
									<span className="relative inline-flex size-2 rounded-full bg-primary" />
								</span>
								{t("onboarding.apply.processing")}
							</>
						)}
					</span>
					<span className="font-mono text-foreground/50 text-xs">
						{t("onboarding.apply.progress", {
							done: revealed,
							total: Math.max(total, 1),
						})}
					</span>
				</div>

				{apply.isPending && total === 0 && !error && (
					<div className="px-5 py-6 text-foreground/60 text-sm">
						{t("onboarding.apply.processing")}
					</div>
				)}

				{!apply.isPending && total === 0 && !error && (
					<div className="px-5 py-6 text-foreground/60 text-sm">
						{t("onboarding.apply.noMessages")}
					</div>
				)}

				<div>
					{results.slice(0, revealed).map((row) => (
						<ResultRow key={row.messageId} row={row} />
					))}
				</div>

				{isComplete && (
					<div className="flex items-center justify-between bg-muted px-5 py-4 text-foreground/70 text-sm">
						<span className="font-serif text-foreground text-lg">
							{t("onboarding.apply.summary", {
								actions: actionsTaken,
								skipped,
							})}
						</span>
						<Button
							variant="primary"
							size="sm"
							onClick={handleFinish}
							loading={finishing}
						>
							{t("onboarding.apply.finish")}
						</Button>
					</div>
				)}
			</div>

			{error && (
				<Alert variant="error" className="mt-4">
					<AlertTriangleIcon />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{total === 0 && !apply.isPending && (
				<div className="mt-6 flex items-center justify-between">
					<Button variant="ghost" onClick={onBack}>
						<ArrowLeftIcon className="mr-2 size-4" />
						{t("onboarding.back")}
					</Button>
					<Button onClick={handleFinish} loading={finishing}>
						{t("onboarding.apply.finish")}
					</Button>
				</div>
			)}
		</div>
	);
}

function ResultRow({ row }: { row: AppliedResult }) {
	const t = useTranslations();
	const isApplied = row.status === "applied";
	const isSkipped = row.status === "skipped";

	return (
		<div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t px-5 py-3 text-xs">
			<span
				className={cn(
					"flex size-5 shrink-0 items-center justify-center rounded-full",
					isApplied
						? "bg-primary-soft text-primary-deep"
						: "bg-muted text-foreground/40",
				)}
			>
				{isApplied ? (
					<CheckIcon className="size-3" strokeWidth={3} />
				) : (
					<MinusIcon className="size-3" strokeWidth={3} />
				)}
			</span>
			<div className="min-w-0">
				<p className="truncate text-foreground text-sm">
					{row.subject}
				</p>
				<p className="truncate text-foreground/50">
					{row.from}
					{isApplied && row.matchedRuleName && (
						<span className="text-primary-deep">
							{" · "}
							{row.matchedRuleName}
						</span>
					)}
				</p>
			</div>
			<span
				className={cn(
					"font-mono text-[11px]",
					isApplied && "text-primary-deep",
					isSkipped && "text-foreground/40",
					!isApplied && !isSkipped && "text-destructive",
				)}
			>
				{isApplied && row.actions.length > 0
					? row.actions.join(", ").toLowerCase()
					: t(`onboarding.apply.status.${row.status}`)}
			</span>
		</div>
	);
}
