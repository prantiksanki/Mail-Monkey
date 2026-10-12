"use client";

import {
	RULE_TEMPLATES,
	type RuleTemplate,
} from "@repo/api/modules/mailboxes/rule-templates";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Switch } from "@repo/ui/components/switch";
import { useQueryClient } from "@tanstack/react-query";
import {
	BellIcon,
	BellOffIcon,
	BellRingIcon,
	BriefcaseIcon,
	CalendarClockIcon,
	CalendarIcon,
	CreditCardIcon,
	DollarSignIcon,
	FileTextIcon,
	HandshakeIcon,
	InboxIcon,
	KeyRoundIcon,
	LandmarkIcon,
	LinkedinIcon,
	ListChecksIcon,
	type LucideIcon,
	MailOpenIcon,
	MicIcon,
	NewspaperIcon,
	PackageIcon,
	ReceiptIcon,
	RefreshCwIcon,
	ReplyIcon,
	RotateCcwIcon,
	SearchIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
	ShoppingCartIcon,
	SparklesIcon,
	StarIcon,
	TagIcon,
	TruckIcon,
	TwitterIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
	getConflictMessage,
	useAdvanceRuleBackfillMutation,
	useCreateRuleMutation,
	useDeleteRuleMutation,
	useRuleSuggestionsQuery,
	useStartRuleBackfillMutation,
} from "../lib/rules-api";
import type { RuleRowRule } from "./RuleRow";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
	Newspaper: NewspaperIcon,
	Tag: TagIcon,
	MailOpen: MailOpenIcon,
	Star: StarIcon,
	BellRing: BellRingIcon,
	Reply: ReplyIcon,
	Users: UsersIcon,
	Receipt: ReceiptIcon,
	Landmark: LandmarkIcon,
	CreditCard: CreditCardIcon,
	RefreshCw: RefreshCwIcon,
	FileText: FileTextIcon,
	Calendar: CalendarIcon,
	CalendarClock: CalendarClockIcon,
	ListChecks: ListChecksIcon,
	ShoppingCart: ShoppingCartIcon,
	Package: PackageIcon,
	Truck: TruckIcon,
	RotateCcw: RotateCcwIcon,
	ShieldAlert: ShieldAlertIcon,
	KeyRound: KeyRoundIcon,
	ShieldCheck: ShieldCheckIcon,
	Linkedin: LinkedinIcon,
	Twitter: TwitterIcon,
	Handshake: HandshakeIcon,
	Briefcase: BriefcaseIcon,
	DollarSign: DollarSignIcon,
	Mic: MicIcon,
	BellOff: BellOffIcon,
};

type CategoryConfig = {
	icon: LucideIcon;
	tagClass: string;
	dotClass: string;
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
	"Inbox Zero": {
		icon: InboxIcon,
		dotClass: "bg-emerald-500",
		tagClass: "text-emerald-700 dark:text-emerald-400",
	},
	"Stay Informed": {
		icon: BellIcon,
		dotClass: "bg-amber-500",
		tagClass: "text-amber-700 dark:text-amber-400",
	},
	Finance: {
		icon: LandmarkIcon,
		dotClass: "bg-blue-500",
		tagClass: "text-blue-700 dark:text-blue-400",
	},
	Meetings: {
		icon: CalendarIcon,
		dotClass: "bg-purple-500",
		tagClass: "text-purple-700 dark:text-purple-400",
	},
	Shopping: {
		icon: ShoppingCartIcon,
		dotClass: "bg-orange-500",
		tagClass: "text-orange-700 dark:text-orange-400",
	},
	Security: {
		icon: ShieldCheckIcon,
		dotClass: "bg-red-500",
		tagClass: "text-red-700 dark:text-red-400",
	},
	Social: {
		icon: UsersIcon,
		dotClass: "bg-pink-500",
		tagClass: "text-pink-700 dark:text-pink-400",
	},
	Community: {
		icon: MicIcon,
		dotClass: "bg-cyan-500",
		tagClass: "text-cyan-700 dark:text-cyan-400",
	},
};

const CATEGORY_ORDER = [
	"Inbox Zero",
	"Stay Informed",
	"Finance",
	"Meetings",
	"Shopping",
	"Security",
	"Social",
	"Community",
] as const;

interface RuleSuggestion {
	id: string;
	title: string;
	description: string;
	reason: string;
	estimatedMatches: number;
	confidence: "high" | "medium";
	category: string;
	rule: {
		name: string;
		enabled?: boolean;
		condition: RuleRowRule["condition"];
		actions: RuleRowRule["actions"];
	};
}

interface RulesLibraryProps {
	mailboxId: string;
	existingRules: RuleRowRule[];
	onEditSuggestion: (suggestion: {
		name: string;
		condition: RuleRowRule["condition"];
		actions: RuleRowRule["actions"];
	}) => void;
}

export function RulesLibrary({
	mailboxId,
	existingRules,
	onEditSuggestion,
}: RulesLibraryProps) {
	const [search, setSearch] = useState("");
	const [addingId, setAddingId] = useState<string | null>(null);
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>(
		[],
	);

	const queryClient = useQueryClient();
	const createRule = useCreateRuleMutation();
	const deleteRule = useDeleteRuleMutation();
	const startBackfill = useStartRuleBackfillMutation();
	const advanceBackfill = useAdvanceRuleBackfillMutation();
	const { data: suggestionsData, isLoading: suggestionsLoading } =
		useRuleSuggestionsQuery(mailboxId);

	const existingRuleMap = useMemo(
		() => new Map(existingRules.map((r) => [r.name.toLowerCase(), r.id])),
		[existingRules],
	);

	const suggestions = useMemo(
		() =>
			((suggestionsData?.suggestions ?? []) as RuleSuggestion[]).filter(
				(s) => !dismissedSuggestions.includes(s.id),
			),
		[suggestionsData?.suggestions, dismissedSuggestions],
	);

	const filteredTemplates = useMemo(() => {
		if (!search.trim()) {
			return RULE_TEMPLATES;
		}
		const q = search.toLowerCase();
		return RULE_TEMPLATES.filter(
			(t) =>
				t.name.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q) ||
				t.category.toLowerCase().includes(q),
		);
	}, [search]);

	const categoryGroups = useMemo(() => {
		if (search.trim()) {
			const map = new Map<string, RuleTemplate[]>();
			for (const tpl of filteredTemplates) {
				if (!map.has(tpl.category)) {
					map.set(tpl.category, []);
				}
				map.get(tpl.category)?.push(tpl);
			}
			return Array.from(map.entries()).map(([category, templates]) => ({
				category,
				templates,
			}));
		}
		return CATEGORY_ORDER.map((category) => ({
			category,
			templates: RULE_TEMPLATES.filter((t) => t.category === category),
		})).filter((g) => g.templates.length > 0);
	}, [filteredTemplates, search]);

	const runBackfill = async (
		ruleId: string,
		windowMonths: "1" | "3" | "6" | "12",
	) => {
		const { run: initialRun } = await startBackfill.mutateAsync({
			mailboxId,
			ruleId,
			windowMonths,
		});
		// Drive the backfill to completion so labels are actually applied in Gmail.
		// Max 50 emails / 25 per chunk = at most 2 advance calls.
		let currentRun = initialRun;
		while (
			currentRun.status === "pending" ||
			currentRun.status === "running"
		) {
			const { run: nextRun } = await advanceBackfill.mutateAsync({
				mailboxId,
				runId: currentRun.id,
			});
			if (!nextRun) {
				break;
			}
			currentRun = nextRun;
		}
		return currentRun;
	};

	const handleAddTemplate = async (template: RuleTemplate) => {
		setAddingId(template.id);
		try {
			const created = await createRule.mutateAsync({
				mailboxId,
				data: {
					name: template.rule.name,
					condition: template.rule.condition,
					actions: template.rule.actions,
					enabled: true,
				},
			});
			const completedRun = await runBackfill(created.rule.id, "1");
			const applied = completedRun.appliedCount ?? 0;
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			toast.success(
				applied > 0
					? `"${template.name}" added — labeled ${applied} existing email${applied === 1 ? "" : "s"}`
					: `"${template.name}" added to your rules`,
			);
		} catch (error) {
			toast.error(
				getConflictMessage(error) ??
					"Failed to add rule. Please try again.",
			);
		} finally {
			setAddingId(null);
		}
	};

	const handleAcceptSuggestion = async (suggestion: RuleSuggestion) => {
		setAddingId(`suggestion-${suggestion.id}`);
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
			const completedRun = await runBackfill(created.rule.id, "6");
			const applied = completedRun.appliedCount ?? 0;
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			setDismissedSuggestions((prev) => [...prev, suggestion.id]);
			toast.success(
				applied > 0
					? `"${suggestion.title}" added — labeled ${applied} existing email${applied === 1 ? "" : "s"}`
					: `"${suggestion.title}" rule added`,
			);
		} catch (error) {
			toast.error(getConflictMessage(error) ?? "Failed to add rule");
		} finally {
			setAddingId(null);
		}
	};

	const isActive = (template: RuleTemplate) =>
		existingRuleMap.has(template.rule.name.toLowerCase());

	const handleRemoveTemplate = async (template: RuleTemplate) => {
		const ruleId = existingRuleMap.get(template.rule.name.toLowerCase());
		if (!ruleId) {
			return;
		}
		setRemovingId(template.id);
		try {
			await deleteRule.mutateAsync({ mailboxId, id: ruleId });
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			toast.success(`"${template.name}" removed`);
		} catch {
			toast.error("Failed to remove rule. Please try again.");
		} finally {
			setRemovingId(null);
		}
	};

	return (
		<div className="space-y-10">
			{/* Search */}
			<div className="relative">
				<SearchIcon className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-foreground" />
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="What do you want to automate?"
					className="h-11 rounded-xl pl-10 text-sm"
				/>
				{search && (
					<button
						type="button"
						onClick={() => setSearch("")}
						className="absolute top-1/2 right-3.5 -translate-y-1/2 text-foreground transition-colors hover:text-foreground"
						aria-label="Clear search"
					>
						<XIcon className="size-4" />
					</button>
				)}
			</div>

			{/* Suggested for you — hidden while searching */}
			{!search && (
				<SuggestionsSection
					suggestions={suggestions}
					isLoading={suggestionsLoading}
					addingId={addingId}
					onAccept={handleAcceptSuggestion}
					onEdit={onEditSuggestion}
					onDismiss={(id) =>
						setDismissedSuggestions((prev) => [...prev, id])
					}
				/>
			)}

			{/* Empty search state */}
			{search && filteredTemplates.length === 0 && (
				<div className="py-16 text-center">
					<p className="text-foreground text-sm">
						No templates match &ldquo;{search}&rdquo;
					</p>
				</div>
			)}

			{/* Category sections */}
			{categoryGroups.map(({ category, templates }) => {
				const config = CATEGORY_CONFIG[category];
				const CategoryIcon = config?.icon ?? TagIcon;
				return (
					<section key={category}>
						<div className="mb-4 flex items-center gap-3">
							<CategoryIcon
								className="size-5 text-foreground"
								aria-hidden
							/>
							<h2 className="font-serif font-bold text-2xl tracking-normal text-foreground">
								{category}
							</h2>
						</div>

						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{templates.map((template) => (
								<TemplateCard
									key={template.id}
									template={template}
									config={config}
									active={isActive(template)}
									adding={addingId === template.id}
									removing={removingId === template.id}
									disabled={
										(!!addingId &&
											addingId !== template.id) ||
										(!!removingId &&
											removingId !== template.id)
									}
									onAdd={() => handleAddTemplate(template)}
									onRemove={() =>
										handleRemoveTemplate(template)
									}
								/>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}

interface TemplateCardProps {
	template: RuleTemplate;
	config: CategoryConfig | undefined;
	active: boolean;
	adding: boolean;
	removing: boolean;
	disabled: boolean;
	onAdd: () => void;
	onRemove: () => void;
}

function TemplateCard({
	template,
	config,
	active,
	adding,
	removing,
	disabled,
	onAdd,
	onRemove,
}: TemplateCardProps) {
	const Icon = TEMPLATE_ICONS[template.icon] ?? TagIcon;
	const isPending = adding || removing;

	return (
		<div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
			{/* Header row: icon + name + category tag */}
			<div className="flex items-center gap-3">
				<Icon className="size-5 shrink-0 text-foreground" />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center justify-between gap-1.5">
						<p className="font-semibold text-lg text-foreground">
							{template.name}
						</p>
						{config && (
							<span
								className={`flex shrink-0 items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider ${config.tagClass}`}
							>
								<span
									className={`size-3 rounded-full ${config.dotClass}`}
								/>
								{template.category}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Description */}
			<p className="flex-1 text-foreground text-sm leading-relaxed">
				{template.description}
			</p>

			{/* Toggle */}
			<div className="flex items-center gap-2">
				<Switch
					checked={active}
					disabled={disabled || isPending}
					onCheckedChange={(checked) => {
						if (checked) {
							onAdd();
						} else {
							onRemove();
						}
					}}
				/>
				<span className="text-sm text-foreground">
					{isPending
						? adding
							? "Adding…"
							: "Removing…"
						: active
							? "Active"
							: "Inactive"}
				</span>
			</div>
		</div>
	);
}

interface SuggestionsSectionProps {
	suggestions: RuleSuggestion[];
	isLoading: boolean;
	addingId: string | null;
	onAccept: (suggestion: RuleSuggestion) => void;
	onEdit: (rule: {
		name: string;
		condition: RuleRowRule["condition"];
		actions: RuleRowRule["actions"];
	}) => void;
	onDismiss: (id: string) => void;
}

function SuggestionsSection({
	suggestions,
	isLoading,
	addingId,
	onAccept,
	onEdit,
	onDismiss,
}: SuggestionsSectionProps) {
	if (!isLoading && suggestions.length === 0) {
		return null;
	}

	return (
		<section>
			<div className="mb-4 flex items-center gap-3">
				<SparklesIcon className="size-5 text-primary" />
				<h2 className="font-serif font-bold text-2xl tracking-normal text-foreground">
					Suggested for you
				</h2>
				<span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-deep">
					AI
				</span>
			</div>

			{isLoading ? (
				<div className="grid gap-3 lg:grid-cols-2">
					<Skeleton className="h-36 w-full rounded-2xl" />
					<Skeleton className="h-36 w-full rounded-2xl" />
				</div>
			) : (
				<div className="grid gap-3 lg:grid-cols-2">
					{suggestions.slice(0, 4).map((suggestion) => {
						const suggestionAddingId = `suggestion-${suggestion.id}`;
						const adding = addingId === suggestionAddingId;
						const disabled = !!addingId && !adding;

						return (
							<div
								key={suggestion.id}
								className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="font-semibold text-sm text-foreground">
											{suggestion.title}
										</p>
										<p className="mt-0.5 text-foreground text-sm">
											{suggestion.description}
										</p>
									</div>
									<button
										type="button"
										onClick={() => onDismiss(suggestion.id)}
										className="shrink-0 text-foreground transition-colors hover:text-foreground"
										aria-label="Dismiss"
									>
										<XIcon className="size-4" />
									</button>
								</div>

								<p className="rounded-xl bg-muted/50 px-3 py-2 text-foreground text-xs leading-relaxed">
									{suggestion.reason}
									{suggestion.estimatedMatches > 0 && (
										<span className="ml-1 text-foreground">
											·{" "}
											{suggestion.estimatedMatches === 1
												? "~1 existing email"
												: `~${suggestion.estimatedMatches} existing emails`}
										</span>
									)}
								</p>

								<div className="flex items-center gap-2">
									<Button
										size="sm"
										variant="primary"
										onClick={() => onAccept(suggestion)}
										loading={adding}
										disabled={disabled}
									>
										{!adding && (
											<SparklesIcon className="size-4" />
										)}
										Accept
									</Button>
									<Button
										size="sm"
										variant="primary"
										disabled={disabled || adding}
										onClick={() => onEdit(suggestion.rule)}
									>
										Edit first
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
