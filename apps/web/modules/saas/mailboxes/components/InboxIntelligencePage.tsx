"use client";

import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { useRuleSuggestionsQuery } from "@saas/mailboxes/lib/rules-api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useAnalytics } from "@/modules/analytics";
import { RuleFormDialog } from "./RuleFormDialog";
import type { RuleRowRule } from "./RuleRow";
import { RuleSuggestionsPanel } from "./RuleSuggestionsPanel";

function isUnauthorizedError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: unknown }).code === "UNAUTHORIZED"
	);
}

function hasSeen(key: string): boolean {
	try {
		return window.localStorage.getItem(key) !== null;
	} catch {
		return false;
	}
}

function markSeen(key: string): void {
	try {
		window.localStorage.setItem(key, "1");
	} catch {
		// localStorage unavailable (private mode / disabled) — best effort only.
	}
}

type EditingRule = {
	id?: string;
	name: string;
	enabled?: boolean;
	condition: RuleRowRule["condition"];
	actions: RuleRowRule["actions"];
};

export function InboxIntelligencePage() {
	const t = useTranslations();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: mailboxes = [] } = useMailboxesQuery();
	const { data, error } = useRuleSuggestionsQuery(selectedMailboxId);
	const { trackEvent } = useAnalytics();
	const needsReconnect = isUnauthorizedError(error);
	const [editingRule, setEditingRule] = useState<EditingRule | null>(null);
	const selectedMailbox = mailboxes.find(
		(mailbox) => mailbox.id === selectedMailboxId,
	);
	const suggestions = (data?.suggestions ?? []) as Array<{
		confidence: "high" | "medium";
		estimatedMatches: number;
		category: "Productivity" | "Finance" | "Social";
	}>;

	useEffect(() => {
		if (suggestions.length === 0 || !selectedMailboxId) {
			return;
		}
		// Track only the first time this mailbox's summary is ever seen,
		// not once per component mount.
		const storageKey = `zeromail.first-summary-viewed.${selectedMailboxId}`;
		if (hasSeen(storageKey)) {
			return;
		}
		trackEvent("first_summary_viewed", {
			mailbox_id: selectedMailboxId,
			suggestion_count: suggestions.length,
		});
		markSeen(storageKey);
	}, [suggestions, selectedMailboxId, trackEvent]);

	const summary = useMemo(() => {
		const highConfidence = suggestions.filter(
			(suggestion) => suggestion.confidence === "high",
		).length;
		const totalImpact = suggestions.reduce(
			(sum, suggestion) => sum + suggestion.estimatedMatches,
			0,
		);
		const categories = new Set(
			suggestions.map((suggestion) => suggestion.category),
		).size;
		return { highConfidence, totalImpact, categories };
	}, [suggestions]);

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

	if (needsReconnect) {
		return <ReconnectCard email={selectedMailbox.email} />;
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<p className="font-mono text-foreground text-xs uppercase tracking-wider">
						{t("intelligence.eyebrow")}
					</p>
					<h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
						{t("intelligence.title")}
					</h1>
					<p className="mt-3 max-w-2xl text-foreground text-sm">
						{t("intelligence.description", {
							email: selectedMailbox.email,
						})}
					</p>
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-3">
				<SummaryCard
					label={t("intelligence.summary.suggestions")}
					value={suggestions.length}
				/>
				<SummaryCard
					label={t("intelligence.summary.highConfidence")}
					value={summary.highConfidence}
				/>
				<SummaryCard
					label={t("intelligence.summary.impact")}
					value={summary.totalImpact}
					helper={t("intelligence.summary.categories", {
						count: summary.categories,
					})}
				/>
			</div>

			<RuleSuggestionsPanel
				mailboxId={selectedMailboxId}
				showHeader={false}
				onEditSuggestion={(suggestion) => {
					setEditingRule({
						name: suggestion.name,
						enabled: true,
						condition: suggestion.condition,
						actions: suggestion.actions,
					});
				}}
			/>

			<RuleFormDialog
				open={!!editingRule}
				onOpenChange={(open) => {
					if (!open) {
						setEditingRule(null);
					}
				}}
				mailboxId={selectedMailboxId}
				editingRule={editingRule}
			/>
		</div>
	);
}

function SummaryCard({
	label,
	value,
	helper,
}: {
	label: string;
	value: number;
	helper?: string;
}) {
	return (
		<div className="rounded-2xl border border-border bg-card p-5">
			<p className="font-mono text-[11px] uppercase tracking-wider text-foreground">
				{label}
			</p>
			<p className="mt-2 font-serif text-3xl tracking-tight">{value}</p>
			{helper ? (
				<p className="mt-1 text-foreground text-xs">{helper}</p>
			) : null}
		</div>
	);
}

function ReconnectCard({ email }: { email: string }) {
	const t = useTranslations();
	const [pending, setPending] = useState(false);

	const handleReconnect = () => {
		setPending(true);
		const callbackURL = new URL(
			authConfig.mailboxes.defaultCallbackPath,
			window.location.origin,
		).toString();
		authClient.linkSocial({ provider: "google", callbackURL });
	};

	return (
		<Card className="p-10">
			<div className="mx-auto max-w-xl text-center">
				<p className="font-mono text-foreground text-xs uppercase tracking-wider">
					{t("intelligence.reconnect.eyebrow")}
				</p>
				<h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">
					{t("intelligence.reconnect.title")}
				</h2>
				<p className="mt-3 text-foreground text-sm">
					{t("intelligence.reconnect.description", { email })}
				</p>
				<div className="mt-6 flex justify-center">
					<Button
						variant="primary"
						onClick={handleReconnect}
						loading={pending}
					>
						{pending
							? t("intelligence.reconnect.pending")
							: t("intelligence.reconnect.cta")}
					</Button>
				</div>
			</div>
		</Card>
	);
}
