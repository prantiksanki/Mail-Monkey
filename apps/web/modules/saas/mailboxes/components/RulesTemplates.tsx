"use client";

import { Button } from "@repo/ui/components/button";
import {
	ArchiveIcon,
	type LucideIcon,
	PlusIcon,
	ReceiptIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RuleRowRule } from "./RuleRow";

type TemplateRule = Omit<RuleRowRule, "id" | "mailboxId" | "enabled"> & {
	enabled?: boolean;
};

interface TemplateDef {
	id: string;
	Icon: LucideIcon;
	titleKey: string;
	descriptionKey: string;
	mode: "form" | "ai";
	rule?: TemplateRule;
}

const TEMPLATES: TemplateDef[] = [
	{
		id: "newsletters",
		Icon: ArchiveIcon,
		titleKey: "rules.templates.newsletters.title",
		descriptionKey: "rules.templates.newsletters.description",
		mode: "form",
		rule: {
			name: "Archive newsletters",
			condition: {
				aiInstructions: "newsletter or marketing email",
			},
			actions: [
				{ type: "ARCHIVE" },
				{ type: "LABEL", fields: { label: "Newsletter" } },
			],
		},
	},
	{
		id: "receipts",
		Icon: ReceiptIcon,
		titleKey: "rules.templates.receipts.title",
		descriptionKey: "rules.templates.receipts.description",
		mode: "form",
		rule: {
			name: "Label receipts",
			condition: {
				aiInstructions: "receipt, invoice, or order confirmation",
			},
			actions: [{ type: "LABEL", fields: { label: "Finance" } }],
		},
	},
	{
		id: "assistant",
		Icon: SparklesIcon,
		titleKey: "rules.templates.assistant.title",
		descriptionKey: "rules.templates.assistant.description",
		mode: "ai",
	},
];

interface RulesTemplatesProps {
	onAddTemplate: (rule: TemplateRule) => void;
}

export function RulesTemplates({ onAddTemplate }: RulesTemplatesProps) {
	const t = useTranslations();

	return (
		<section>
			<div className="mb-4">
				<h2 className="font-serif font-normal text-2xl tracking-tight">
					{t("rules.templates.heading")}
				</h2>
				<p className="font-mono text-foreground text-xs uppercase tracking-wider">
					{t("rules.templates.subheading")}
				</p>
			</div>

			<div className="grid gap-3 md:grid-cols-3">
				{TEMPLATES.map((template) => (
					<div
						key={template.id}
						className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
					>
						<div className="flex items-center gap-2">
							<span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
								<template.Icon className="size-4" />
							</span>
							<p className="font-medium text-sm">
								{t(template.titleKey)}
							</p>
						</div>
						<p className="flex-1 text-foreground text-sm">
							{t(template.descriptionKey)}
						</p>
						{template.mode === "ai" ? (
							<Button asChild variant="primary" size="sm">
								<Link href="/app/rules/assistant">
									<SparklesIcon className="size-4" />
									{t("rules.templates.openAssistant")}
								</Link>
							</Button>
						) : (
							<Button
								variant="secondary"
								size="sm"
								onClick={() => {
									if (template.rule) {
										onAddTemplate(template.rule);
									}
								}}
							>
								<PlusIcon className="size-4" />
								{t("rules.templates.add")}
							</Button>
						)}
					</div>
				))}
			</div>
		</section>
	);
}
