"use client";

import { STARTER_RULE_TEMPLATES } from "@repo/api/modules/mailboxes/rule-templates";
import { cn } from "@repo/ui";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	useCreateRuleMutation,
	useRuleSuggestionsQuery,
	useStartRuleBackfillMutation,
} from "@saas/mailboxes/lib/rules-api";
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	CheckIcon,
	type LucideIcon,
	NewspaperIcon,
	ReceiptIcon,
	ShoppingCartIcon,
	TagIcon,
	UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const TEMPLATE_ICON: Record<string, LucideIcon> = {
	Newspaper: NewspaperIcon,
	Tag: TagIcon,
	Receipt: ReceiptIcon,
	ShoppingCart: ShoppingCartIcon,
	Users: UsersIcon,
};

interface OnboardingStepRulesProps {
	mailboxId: string | null;
	onBack: () => void;
	onCompleted: () => void;
}

export function OnboardingStepRules({
	mailboxId,
	onBack,
	onCompleted,
}: OnboardingStepRulesProps) {
	const t = useTranslations();
	const createRule = useCreateRuleMutation();
	const startBackfill = useStartRuleBackfillMutation();
	const { data: suggestionsData, isLoading: suggestionsLoading } =
		useRuleSuggestionsQuery(mailboxId);
	const suggestions = (suggestionsData?.suggestions ?? []) as Array<{
		id: string;
		title: string;
		description: string;
		reason: string;
		estimatedMatches: number;
		confidence: "high" | "medium";
		rule: (typeof STARTER_RULE_TEMPLATES)[number]["rule"];
		category: "Productivity" | "Finance" | "Social";
	}>;
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [selectionInitialized, setSelectionInitialized] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (selectionInitialized) {
			return;
		}

		if (suggestions.length > 0) {
			setSelected(
				new Set(suggestions.map((suggestion) => suggestion.id)),
			);
			setSelectionInitialized(true);
			return;
		}

		if (!suggestionsLoading) {
			setSelected(new Set(STARTER_RULE_TEMPLATES.map((tpl) => tpl.id)));
			setSelectionInitialized(true);
		}
	}, [suggestions, suggestionsLoading, selectionInitialized]);

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const onContinue = async () => {
		if (!mailboxId || selected.size === 0 || submitting) {
			return;
		}
		setSubmitting(true);
		setSubmitError(null);
		try {
			const isSuggestionFlow = suggestions.length > 0;
			const picks = isSuggestionFlow
				? suggestions
						.filter((suggestion) => selected.has(suggestion.id))
						.map((suggestion) => ({
							id: suggestion.id,
							rule: suggestion.rule,
						}))
				: STARTER_RULE_TEMPLATES.filter((tpl) => selected.has(tpl.id));
			for (const tpl of picks) {
				const created = await createRule.mutateAsync({
					mailboxId,
					data: tpl.rule,
				});
				await startBackfill.mutateAsync({
					mailboxId,
					ruleId: created.rule.id,
					windowMonths: isSuggestionFlow ? "6" : "1",
				});
			}
			onCompleted();
		} catch {
			setSubmitError(t("onboarding.notifications.rulesSetupFailed"));
		} finally {
			setSubmitting(false);
		}
	};

	const count = selected.size;
	const hasSuggestions = suggestions.length > 0;

	return (
		<div>
			<p className="font-mono text-foreground/50 text-xs uppercase tracking-wider">
				{t("onboarding.rules.eyebrow")}
			</p>
			<h1 className="mt-3 text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{hasSuggestions
					? t.rich("onboarding.rules.suggestionsHeading", {
							count: suggestions.length,
							accent: (chunks) => (
								<em className="italic text-primary">
									{chunks}
								</em>
							),
						})
					: t.rich("onboarding.rules.heading", {
							accent: (chunks) => (
								<em className="italic text-primary">
									{chunks}
								</em>
							),
						})}
			</h1>
			<p className="mt-4 max-w-lg text-foreground/60">
				{hasSuggestions
					? t("onboarding.rules.suggestionsDescription")
					: t("onboarding.rules.description")}
			</p>

			<div className="mt-8 grid gap-2.5">
				{hasSuggestions
					? suggestions.map((suggestion) => {
							const isSelected = selected.has(suggestion.id);
							return (
								<button
									key={suggestion.id}
									type="button"
									onClick={() => toggle(suggestion.id)}
									className={cn(
										"rounded-xl border p-4 text-left transition-colors",
										isSelected
											? "border-primary bg-primary-soft"
											: "border-border bg-card hover:bg-muted",
									)}
								>
									<div className="flex items-start gap-3">
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<p className="font-medium text-sm">
													{suggestion.title}
												</p>
												<span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-deep">
													{t(
														`rules.suggestions.confidence.${suggestion.confidence}`,
													)}
												</span>
											</div>
											<p className="mt-1 text-foreground/60 text-xs">
												{suggestion.description}
											</p>
											<p className="mt-2 text-foreground/70 text-xs">
												{suggestion.reason}
											</p>
											<p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-foreground/50">
												{t(
													"onboarding.rules.suggestionImpact",
													{
														count: suggestion.estimatedMatches,
													},
												)}
											</p>
										</div>
										<span
											className={cn(
												"flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
												isSelected
													? "border-primary bg-primary text-primary-foreground"
													: "border-border",
											)}
										>
											{isSelected && (
												<CheckIcon
													className="size-3.5"
													strokeWidth={3}
												/>
											)}
										</span>
									</div>
								</button>
							);
						})
					: STARTER_RULE_TEMPLATES.map((tpl) => {
							const isSelected = selected.has(tpl.id);
							const Icon = TEMPLATE_ICON[tpl.icon];
							return (
								<button
									key={tpl.id}
									type="button"
									onClick={() => toggle(tpl.id)}
									className={cn(
										"flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
										isSelected
											? "border-primary bg-primary-soft"
											: "border-border bg-card hover:bg-muted",
									)}
								>
									<span
										className={cn(
											"flex size-10 shrink-0 items-center justify-center rounded-lg",
											isSelected
												? "bg-background text-primary-deep"
												: "bg-muted text-foreground/60",
										)}
									>
										{Icon && <Icon className="size-5" />}
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-medium text-sm">
											{t(
												`onboarding.rules.templates.${tpl.id}.name`,
											)}
										</p>
										<p className="mt-0.5 text-foreground/60 text-xs">
											{t(
												`onboarding.rules.templates.${tpl.id}.description`,
											)}
										</p>
									</div>
									<span
										className={cn(
											"flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
											isSelected
												? "border-primary bg-primary text-primary-foreground"
												: "border-border",
										)}
									>
										{isSelected && (
											<CheckIcon
												className="size-3.5"
												strokeWidth={3}
											/>
										)}
									</span>
								</button>
							);
						})}
			</div>

			{submitError && (
				<Alert variant="error" className="mt-4">
					<AlertTriangleIcon />
					<AlertDescription>{submitError}</AlertDescription>
				</Alert>
			)}

			<div className="mt-8 flex items-center justify-between">
				<Button variant="ghost" onClick={onBack} disabled={submitting}>
					<ArrowLeftIcon className="mr-2 size-4" />
					{t("onboarding.back")}
				</Button>
				<Button
					onClick={onContinue}
					disabled={count === 0 || !mailboxId}
					loading={submitting}
				>
					{t("onboarding.rules.selectedCount", { count })}
					<ArrowRightIcon className="ml-2 size-4" />
				</Button>
			</div>
		</div>
	);
}
