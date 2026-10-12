"use client";

import {
	RULE_TEMPLATE_CATEGORIES,
	RULE_TEMPLATES,
	type RuleTemplate,
	type RuleTemplateCategory,
} from "@repo/api/modules/mailboxes/rule-templates";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { useCreateRuleMutation } from "@saas/mailboxes/lib/rules-api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import {
	BellOff,
	BellRing,
	Briefcase,
	Calendar,
	CalendarClock,
	CreditCard,
	DollarSign,
	FileText,
	Handshake,
	KeyRound,
	Landmark,
	Linkedin,
	ListChecks,
	type LucideIcon,
	MailOpen,
	Mic,
	Newspaper,
	Package,
	PlusIcon,
	Receipt,
	RefreshCw,
	Reply,
	RotateCcw,
	ShieldAlert,
	ShieldCheck,
	ShoppingCart,
	Star,
	Tag,
	Truck,
	Twitter,
	Users,
} from "lucide-react";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
	Newspaper,
	Tag,
	MailOpen,
	Star,
	BellRing,
	Reply,
	Users,
	Receipt,
	Landmark,
	CreditCard,
	RefreshCw,
	FileText,
	Calendar,
	CalendarClock,
	ListChecks,
	ShoppingCart,
	Package,
	Truck,
	RotateCcw,
	ShieldAlert,
	KeyRound,
	ShieldCheck,
	Linkedin,
	Twitter,
	Handshake,
	Briefcase,
	DollarSign,
	Mic,
	BellOff,
};

import { useState } from "react";
import { toast } from "sonner";

function TemplateCard({
	template,
	mailboxId,
	isLoading,
	onAdd,
}: {
	template: RuleTemplate;
	mailboxId: string | null;
	isLoading: boolean;
	onAdd: () => void;
}) {
	const Icon = TEMPLATE_ICONS[template.icon];

	return (
		<Card>
			<CardContent className="flex flex-col gap-2 p-4">
				<div className="flex items-start justify-between gap-2">
					{Icon && <Icon className="size-5 text-muted-foreground" />}
					<span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
						{template.category}
					</span>
				</div>
				<p className="text-sm font-medium">{template.name}</p>
				<p className="text-xs text-muted-foreground">
					{template.description}
				</p>
				<Button
					size="sm"
					variant="secondary"
					className="mt-1 w-full"
					disabled={!mailboxId || isLoading}
					onClick={onAdd}
				>
					<PlusIcon className="mr-1 size-3.5" />
					{isLoading ? "Adding..." : "Add"}
				</Button>
			</CardContent>
		</Card>
	);
}

export function RuleTemplates() {
	const { selectedMailboxId } = useSelectedMailbox();
	const [activeCategory, setActiveCategory] =
		useState<RuleTemplateCategory>("All");
	const [loadingId, setLoadingId] = useState<string | null>(null);
	const createRule = useCreateRuleMutation();

	const filtered =
		activeCategory === "All"
			? RULE_TEMPLATES
			: RULE_TEMPLATES.filter((t) => t.category === activeCategory);

	async function handleAdd(template: RuleTemplate) {
		if (!selectedMailboxId) {
			return;
		}
		setLoadingId(template.id);
		try {
			await createRule.mutateAsync({
				mailboxId: selectedMailboxId,
				data: template.rule,
			});
			toast.success(`Rule "${template.name}" created!`);
		} catch {
			toast.error("Failed to create rule");
		} finally {
			setLoadingId(null);
		}
	}

	return (
		<section className="mt-6">
			<h2 className="mb-3 text-lg font-semibold">Quick Templates</h2>
			<Tabs
				value={activeCategory}
				onValueChange={(v) =>
					setActiveCategory(v as RuleTemplateCategory)
				}
			>
				<TabsList className="flex-wrap">
					{RULE_TEMPLATE_CATEGORIES.map((cat) => (
						<TabsTrigger key={cat} value={cat}>
							{cat}
						</TabsTrigger>
					))}
				</TabsList>

				<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((template) => (
						<TemplateCard
							key={template.id}
							template={template}
							mailboxId={selectedMailboxId}
							isLoading={loadingId === template.id}
							onAdd={() => handleAdd(template)}
						/>
					))}
				</div>
			</Tabs>
		</section>
	);
}
