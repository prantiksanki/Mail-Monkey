"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	ArchiveIcon,
	ReceiptIcon,
	SparklesIcon,
	TagIcon,
	XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	getConflictMessage,
	useCreateRuleMutation,
	useRuleSuggestionsQuery,
	useStartRuleBackfillMutation,
} from "../lib/rules-api";

interface RuleSuggestionAction {
	type: string;
	fields?: Record<string, unknown>;
}

interface RuleSuggestionCondition {
	conditionalOperator?: string | null;
	aiInstructions?: string | null;
	static?: {
		from?: string | null;
		to?: string | null;
		subject?: string | null;
	} | null;
}

interface RuleSuggestion {
	id: string;
	title: string;
	description: string;
	reason: string;
	estimatedMatches: number;
	confidence: "high" | "medium";
	category: "Productivity" | "Finance" | "Social";
	rule: {
		name: string;
		enabled?: boolean;
		condition: RuleSuggestionCondition;
		actions: RuleSuggestionAction[];
	};
}

interface RuleSuggestionsPanelProps {
	mailboxId: string;
	onEditSuggestion: (suggestion: {
		name: string;
		enabled?: boolean;
		condition: RuleSuggestionCondition;
		actions: RuleSuggestionAction[];
	}) => void;
	showHeader?: boolean;
}

export function RuleSuggestionsPanel({
	mailboxId,
	onEditSuggestion,
	showHeader = true,
}: RuleSuggestionsPanelProps) {
	const t = useTranslations();
	const { data, isLoading } = useRuleSuggestionsQuery(mailboxId);
	const createRule = useCreateRuleMutation();
	const startBackfill = useStartRuleBackfillMutation();
	const [dismissedIds, setDismissedIds] = useState<string[]>([]);
	const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(
		null,
	);

	const suggestions = useMemo(
		() =>
			((data?.suggestions ?? []) as RuleSuggestion[]).filter(
				(suggestion) => !dismissedIds.includes(suggestion.id),
			),
		[data?.suggestions, dismissedIds],
	);

	const handleAccept = async (suggestion: RuleSuggestion) => {
		setActiveSuggestionId(suggestion.id);
		try {
			const created = await createRule.mutateAsync({
				mailboxId,
				data: {
					name: suggestion.rule.name,
					condition: suggestion.rule.condition,
					actions: suggestion.rule.actions,
					enabled: true,
				},
			});
			await startBackfill.mutateAsync({
				mailboxId,
				ruleId: created.rule.id,
				windowMonths: "6",
			});
			setDismissedIds((current) => [...current, suggestion.id]);
			toast.success(t("rules.suggestions.notifications.accepted"));
		} catch (error) {
			toast.error(
				getConflictMessage(error) ??
					t("rules.suggestions.notifications.error"),
			);
		} finally {
			setActiveSuggestionId(null);
		}
	};

	const handleDismiss = (id: string) => {
		setDismissedIds((current) => [...current, id]);
	};

	return (
		<section>
			{showHeader && (
				<div className="mb-4">
					<h2 className="font-serif font-normal text-2xl tracking-tight">
						{t("rules.suggestions.heading")}
					</h2>
					<p className="font-mono text-foreground text-xs uppercase tracking-wider">
						{t("rules.suggestions.subheading")}
					</p>
				</div>
			)}

			{isLoading ? (
				<div className="grid gap-3 lg:grid-cols-2">
					<Skeleton className="h-44 w-full" />
					<Skeleton className="h-44 w-full" />
				</div>
			) : suggestions.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
					<p className="text-foreground text-sm">
						{t("rules.suggestions.empty")}
					</p>
				</div>
			) : (
				<div className="grid gap-3 lg:grid-cols-2">
					{suggestions.map((suggestion) => {
						const primaryAction = suggestion.rule.actions[0]?.type;
						const Icon =
							primaryAction === "ARCHIVE"
								? ArchiveIcon
								: primaryAction === "LABEL"
									? ReceiptIcon
									: TagIcon;
						const isPending = activeSuggestionId === suggestion.id;

						return (
							<div
								key={suggestion.id}
								className="rounded-2xl border border-border bg-card p-5"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex items-start gap-3">
										<span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
											<Icon className="size-4" />
										</span>
										<div>
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium text-sm">
													{suggestion.title}
												</p>
												<span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
													{suggestion.category}
												</span>
												<span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-deep">
													{t(
														`rules.suggestions.confidence.${suggestion.confidence}`,
													)}
												</span>
											</div>
											<p className="mt-1 text-foreground text-sm">
												{suggestion.description}
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={() =>
											handleDismiss(suggestion.id)
										}
										className="text-foreground transition-colors hover:text-foreground"
										aria-label={t(
											"rules.suggestions.dismiss",
										)}
									>
										<XIcon className="size-4" />
									</button>
								</div>

								<div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm">
									<p className="text-foreground">
										{suggestion.reason}
									</p>
									<p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-foreground">
										{t("rules.suggestions.impact", {
											count: suggestion.estimatedMatches,
										})}
									</p>
								</div>

								<div className="mt-4 flex flex-wrap items-center gap-2">
									<Button
										size="sm"
										variant="primary"
										onClick={() => handleAccept(suggestion)}
										loading={isPending}
									>
										<SparklesIcon className="size-4" />
										{t("rules.suggestions.accept")}
									</Button>
									<Button
										size="sm"
										variant="secondary"
										disabled={isPending}
										onClick={() =>
											onEditSuggestion(suggestion.rule)
										}
									>
										{t("rules.suggestions.edit")}
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
