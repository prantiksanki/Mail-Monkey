"use client";

import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { useSession } from "@saas/auth/hooks/use-session";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { usePurchases } from "@saas/payments/hooks/purchases";
import {
	formatElapsed,
	type RecordingState,
	useVoiceRecording,
} from "@shared/hooks/use-voice-recording";
import {
	ArrowUpIcon,
	CheckIcon,
	Loader2Icon,
	MicIcon,
	PencilIcon,
	SparklesIcon,
	SquareIcon,
	ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getActionIcon } from "../lib/action-icons";
import {
	useCompileRulesMutation,
	useCreateRuleMutation,
} from "../lib/rules-api";
import { RuleFormDialog } from "./RuleFormDialog";
import type { RuleRowRule } from "./RuleRow";

const PLAN_HIERARCHY: Record<string, number> = {
	free: 0,
	pro: 1,
};

const SEED_KEYS = ["github", "notion", "ooo", "digest"] as const;
const TEMPLATE_KEYS = ["newsletters", "receipts", "notion", "ooo"] as const;

interface CompiledRule {
	name: string;
	condition: {
		conditionalOperator?: string | null;
		aiInstructions?: string | null;
		static?: {
			from?: string | null;
			to?: string | null;
			subject?: string | null;
		} | null;
	};
	actions: Array<{
		type: string;
		fields?: Record<string, unknown>;
	}>;
}

type CardState = "draft" | "creating" | "enabled";

interface RuleCardData extends CompiledRule {
	state: CardState;
}

type Message =
	| { id: string; role: "user"; content: string }
	| {
			id: string;
			role: "assistant";
			content: string;
			rules?: RuleCardData[];
			loading?: boolean;
			error?: boolean;
	  };

interface EditingRule {
	id?: string;
	name: string;
	enabled?: boolean;
	condition: RuleRowRule["condition"];
	actions: RuleRowRule["actions"];
}

export function RuleAssistant() {
	const t = useTranslations();
	const { user } = useSession();
	const { selectedMailboxId } = useSelectedMailbox();
	const { activePlan } = usePurchases();
	const searchParams = useSearchParams();

	const firstName = user?.name?.split(" ")[0] ?? "";
	const canUseAi =
		(PLAN_HIERARCHY[activePlan?.id ?? "free"] ?? 0) >=
		(PLAN_HIERARCHY.pro ?? 1);

	const [messages, setMessages] = useState<Message[]>(() => [
		{
			id: "greeting",
			role: "assistant",
			content: t("rules.assistant.greeting", {
				name: firstName || "there",
			}),
		},
	]);
	const [prompt, setPrompt] = useState("");
	const [seedVisible, setSeedVisible] = useState(true);
	const { recordingState, elapsedSeconds, startRecording, stopRecording } =
		useVoiceRecording((text) => {
			setPrompt((prev) =>
				prev.trim() ? `${prev.trim()} ${text}` : text,
			);
		});
	const [editingRule, setEditingRule] = useState<EditingRule | null>(null);
	const [formOpen, setFormOpen] = useState(false);

	const compileMutation = useCompileRulesMutation();
	const createMutation = useCreateRuleMutation();

	const scrollRef = useRef<HTMLDivElement>(null);
	const composerRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		const node = scrollRef.current;
		if (node) {
			node.scrollTop = node.scrollHeight;
		}
	}, [messages]);

	useEffect(() => {
		const seed = searchParams.get("seed");
		const from = searchParams.get("from");
		if (!seed && !from) {
			return;
		}
		const parts: string[] = [];
		if (seed) {
			parts.push(`emails like "${seed}"`);
		}
		if (from) {
			parts.push(`from ${from}`);
		}
		setPrompt(`Build a rule for ${parts.join(" ")}`);
		setSeedVisible(false);
		composerRef.current?.focus();
	}, [searchParams]);

	const submitPrompt = async (text: string) => {
		const content = text.trim();
		if (!content || !selectedMailboxId) {
			return;
		}
		const timestamp = Date.now();
		const userId = `u-${timestamp}`;
		const aiId = `a-${timestamp}`;

		setSeedVisible(false);
		setPrompt("");

		setMessages((prev) => [
			...prev,
			{ id: userId, role: "user", content },
			{
				id: aiId,
				role: "assistant",
				content: t("rules.assistant.drafting"),
				loading: true,
			},
		]);

		try {
			const result = await compileMutation.mutateAsync({
				mailboxId: selectedMailboxId,
				prompt: content,
			});
			const rules: RuleCardData[] = (result.rules as CompiledRule[]).map(
				(r) => ({ ...r, state: "draft" }),
			);
			setMessages((prev) =>
				prev.map((m) =>
					m.id === aiId
						? {
								id: aiId,
								role: "assistant",
								content:
									rules.length === 0
										? t("rules.assistant.draftedEmpty")
										: t("rules.assistant.drafted", {
												count: rules.length,
											}),
								rules: rules.length > 0 ? rules : undefined,
							}
						: m,
				),
			);
		} catch {
			setMessages((prev) =>
				prev.map((m) =>
					m.id === aiId
						? {
								id: aiId,
								role: "assistant",
								content: t("rules.assistant.error"),
								error: true,
							}
						: m,
				),
			);
		}
	};

	const updateRuleState = (
		msgId: string,
		ruleIndex: number,
		state: CardState,
	) => {
		setMessages((prev) =>
			prev.map((m) => {
				if (m.role !== "assistant" || m.id !== msgId || !m.rules) {
					return m;
				}
				return {
					...m,
					rules: m.rules.map((r, i) =>
						i === ruleIndex ? { ...r, state } : r,
					),
				};
			}),
		);
	};

	const handleTurnOn = async (
		msgId: string,
		ruleIndex: number,
		rule: CompiledRule,
	) => {
		if (!selectedMailboxId) {
			return;
		}
		updateRuleState(msgId, ruleIndex, "creating");
		try {
			await createMutation.mutateAsync({
				mailboxId: selectedMailboxId,
				data: {
					name: rule.name,
					condition: rule.condition,
					actions: rule.actions,
					enabled: true,
				},
			});
			toast.success(t("rules.assistant.enabled"));
			updateRuleState(msgId, ruleIndex, "enabled");
		} catch {
			toast.error(t("rules.ruleForm.notifications.error"));
			updateRuleState(msgId, ruleIndex, "draft");
		}
	};

	const handleEditConditions = (rule: CompiledRule) => {
		setEditingRule({
			name: rule.name,
			condition: rule.condition as RuleRowRule["condition"],
			actions: rule.actions as RuleRowRule["actions"],
		});
		setFormOpen(true);
	};

	const handleTryAnother = () => {
		composerRef.current?.focus();
	};

	const handleSeed = (key: (typeof SEED_KEYS)[number]) => {
		const seedText = t(`rules.assistant.seeds.${key}`);
		setPrompt(seedText);
		composerRef.current?.focus();
	};

	const handleTemplate = (key: (typeof TEMPLATE_KEYS)[number]) => {
		submitPrompt(t(`rules.assistant.templates.${key}.prompt`));
	};

	const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submitPrompt(prompt);
		}
	};

	return (
		<div className="flex flex-col gap-8">
			<PageTitle />

			{canUseAi ? (
				<div className="grid min-h-[72vh] gap-6 lg:grid-cols-[1fr_360px]">
					<ChatPanel
						scrollRef={scrollRef}
						composerRef={composerRef}
						messages={messages}
						prompt={prompt}
						setPrompt={setPrompt}
						seedVisible={seedVisible}
						onSeed={handleSeed}
						onSend={() => submitPrompt(prompt)}
						onKeyDown={handleComposerKeyDown}
						onTurnOn={handleTurnOn}
						onEditConditions={handleEditConditions}
						onTryAnother={handleTryAnother}
						recordingState={recordingState}
						elapsedSeconds={elapsedSeconds}
						onStartRecording={startRecording}
						onStopRecording={stopRecording}
						pending={compileMutation.isPending}
						disabled={!selectedMailboxId}
					/>
					<Sidebar onTemplate={handleTemplate} />
				</div>
			) : (
				<UpsellState />
			)}

			<RuleFormDialog
				open={formOpen}
				onOpenChange={(open) => {
					setFormOpen(open);
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

function PageTitle() {
	const t = useTranslations();
	return (
		<div>
			<p className="font-mono text-foreground text-xs uppercase tracking-wider">
				{t("rules.assistant.eyebrow")}
			</p>
			<h1 className="mt-2 whitespace-pre-line text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{t("rules.assistant.title")}
			</h1>
		</div>
	);
}

interface ChatPanelProps {
	scrollRef: React.RefObject<HTMLDivElement | null>;
	composerRef: React.RefObject<HTMLTextAreaElement | null>;
	messages: Message[];
	prompt: string;
	setPrompt: (value: string) => void;
	seedVisible: boolean;
	onSeed: (key: (typeof SEED_KEYS)[number]) => void;
	onSend: () => void;
	onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
	onTurnOn: (
		msgId: string,
		ruleIndex: number,
		rule: CompiledRule,
	) => Promise<void>;
	onEditConditions: (rule: CompiledRule) => void;
	onTryAnother: () => void;
	recordingState: RecordingState;
	elapsedSeconds: number;
	onStartRecording: () => void;
	onStopRecording: () => void;
	pending: boolean;
	disabled: boolean;
}

function ChatPanel({
	scrollRef,
	composerRef,
	messages,
	prompt,
	setPrompt,
	seedVisible,
	onSeed,
	onSend,
	onKeyDown,
	onTurnOn,
	onEditConditions,
	onTryAnother,
	recordingState,
	elapsedSeconds,
	onStartRecording,
	onStopRecording,
	pending,
	disabled,
}: ChatPanelProps) {
	const t = useTranslations();
	const canSend = prompt.trim().length > 0 && !pending && !disabled;
	const isRecordingBusy = recordingState !== "idle";

	return (
		<div className="flex min-h-[600px] flex-col rounded-2xl border border-border bg-card">
			<div className="flex items-center justify-between border-border border-b px-5 py-4">
				<p className="font-mono text-foreground text-sm">
					{t("rules.assistant.panelTitle")}
				</p>
				<span className="flex items-center gap-2 text-foreground text-xs">
					<span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
						<SparklesIcon className="size-3" />
					</span>
					{t("rules.assistant.assistantName")}
				</span>
			</div>

			<div
				ref={scrollRef}
				className="flex-1 space-y-5 overflow-y-auto px-6 py-6"
			>
				{messages.map((m) => (
					<MessageBubble
						key={m.id}
						message={m}
						onTurnOn={onTurnOn}
						onEditConditions={onEditConditions}
						onTryAnother={onTryAnother}
					/>
				))}
			</div>

			{seedVisible && (
				<div className="flex flex-col gap-2 border-border border-t px-5 py-4">
					<p className="font-mono text-foreground text-xs uppercase tracking-wider">
						{t("rules.assistant.seedHeading")}
					</p>
					<div className="flex flex-wrap gap-2">
						{SEED_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => onSeed(key)}
								className="rounded-full border border-border bg-background px-3 py-1.5 text-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
							>
								↪ {t(`rules.assistant.seeds.${key}`)}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="flex flex-col gap-1 border-border border-t px-4 py-3">
				{recordingState !== "idle" && (
					<div className="flex items-center gap-1.5 px-2 text-muted-foreground text-xs">
						{recordingState === "recording" && (
							<>
								<span className="size-2 animate-pulse rounded-full bg-destructive" />
								<span>{formatElapsed(elapsedSeconds)}</span>
							</>
						)}
						{recordingState === "transcribing" && (
							<span>Transcribing…</span>
						)}
					</div>
				)}
				<div className="flex items-end gap-2">
					<textarea
						ref={composerRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder={t("rules.assistant.composerPlaceholder")}
						rows={1}
						disabled={disabled || isRecordingBusy}
						className="flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					/>
					<Button
						type="button"
						variant={
							recordingState === "recording"
								? "destructive"
								: "ghost"
						}
						size="icon"
						onClick={
							recordingState === "recording"
								? onStopRecording
								: onStartRecording
						}
						disabled={disabled || recordingState === "transcribing"}
						aria-label={
							recordingState === "recording"
								? "Stop recording"
								: "Record voice message"
						}
					>
						{recordingState === "transcribing" ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : recordingState === "recording" ? (
							<SquareIcon className="size-4" />
						) : (
							<MicIcon className="size-4" />
						)}
					</Button>
					<Button
						variant="primary"
						size="icon"
						onClick={onSend}
						disabled={!canSend || isRecordingBusy}
						loading={pending}
						aria-label={t("rules.assistant.send")}
					>
						<ArrowUpIcon className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

interface MessageBubbleProps {
	message: Message;
	onTurnOn: (
		msgId: string,
		ruleIndex: number,
		rule: CompiledRule,
	) => Promise<void>;
	onEditConditions: (rule: CompiledRule) => void;
	onTryAnother: () => void;
}

function MessageBubble({
	message,
	onTurnOn,
	onEditConditions,
	onTryAnother,
}: MessageBubbleProps) {
	const t = useTranslations();
	const isUser = message.role === "user";

	if (isUser) {
		return (
			<div className="flex justify-end">
				<div className="max-w-[82%]">
					<p className="mb-1.5 text-right font-mono text-foreground text-[10px] uppercase tracking-wider">
						{t("rules.assistant.you")}
					</p>
					<div className="rounded-xl rounded-tr-sm bg-foreground px-4 py-3 text-background text-sm leading-relaxed">
						{message.content}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex justify-start">
			<div className="max-w-[90%]">
				<p className="mb-1.5 font-mono text-foreground text-[10px] uppercase tracking-wider">
					{t("rules.assistant.assistantName")}
				</p>
				<div
					className={cn(
						"rounded-xl rounded-tl-sm bg-muted px-4 py-3 text-foreground text-sm leading-relaxed",
						message.role === "assistant" &&
							message.error &&
							"bg-destructive/10 text-destructive",
					)}
				>
					{message.role === "assistant" && message.loading ? (
						<TypingIndicator />
					) : (
						message.content
					)}
				</div>
				{message.role === "assistant" && message.rules && (
					<div className="mt-3 space-y-3">
						{message.rules.map((rule, index) => (
							<RulePreviewCard
								key={`${message.id}-${index}`}
								rule={rule}
								onTurnOn={() =>
									onTurnOn(message.id, index, rule)
								}
								onEdit={() => onEditConditions(rule)}
								onTryAnother={onTryAnother}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function TypingIndicator() {
	return (
		<output
			aria-label="typing"
			className="inline-flex h-5 items-center gap-1"
		>
			<span className="size-1.5 animate-pulse rounded-full bg-foreground/40 [animation-delay:0ms]" />
			<span className="size-1.5 animate-pulse rounded-full bg-foreground/40 [animation-delay:150ms]" />
			<span className="size-1.5 animate-pulse rounded-full bg-foreground/40 [animation-delay:300ms]" />
		</output>
	);
}

interface RulePreviewCardProps {
	rule: RuleCardData;
	onTurnOn: () => void;
	onEdit: () => void;
	onTryAnother: () => void;
}

function RulePreviewCard({
	rule,
	onTurnOn,
	onEdit,
	onTryAnother,
}: RulePreviewCardProps) {
	const t = useTranslations();

	const branches: Array<{ key: string; value: string }> = [];
	if (rule.condition.aiInstructions) {
		branches.push({ key: "AI", value: rule.condition.aiInstructions });
	}
	if (rule.condition.static?.from) {
		branches.push({ key: "from", value: rule.condition.static.from });
	}
	if (rule.condition.static?.to) {
		branches.push({ key: "to", value: rule.condition.static.to });
	}
	if (rule.condition.static?.subject) {
		branches.push({
			key: "subject",
			value: rule.condition.static.subject,
		});
	}

	const joiner =
		rule.condition.conditionalOperator === "OR"
			? t("rules.ruleRow.or")
			: t("rules.ruleRow.and");

	const isEnabled = rule.state === "enabled";
	const isCreating = rule.state === "creating";

	return (
		<div className="rounded-xl border border-border bg-background px-5 py-4">
			<p className="font-serif font-normal text-xl tracking-tight">
				{rule.name}
			</p>

			{branches.length > 0 && (
				<div className="mt-3 space-y-2 border-border border-t pt-3">
					{branches.map((branch, i) => (
						<div
							key={`${branch.key}-${i}`}
							className="grid grid-cols-[56px_1fr] gap-3 text-sm"
						>
							<span className="pt-0.5 font-mono text-primary-deep text-[11px] uppercase tracking-wider">
								{i === 0 ? t("rules.ruleRow.when") : joiner}
							</span>
							<span className="break-words text-foreground">
								{branch.value}
							</span>
						</div>
					))}
				</div>
			)}

			<div className="mt-2 grid grid-cols-[56px_1fr] gap-3 border-border border-t pt-3 text-sm">
				<span className="pt-0.5 font-mono text-primary-deep text-[11px] uppercase tracking-wider">
					then
				</span>
				<div className="flex flex-wrap gap-1.5">
					{rule.actions.map((action, index) => {
						const Icon = getActionIcon(action.type);
						const labelField = action.fields?.label as
							| string
							| undefined;
						return (
							<span
								key={`${action.type}-${index}`}
								className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-primary-deep text-xs"
							>
								<Icon className="size-3" />
								{t(`rules.ruleForm.actionTypes.${action.type}`)}
								{action.type === "LABEL" &&
									labelField &&
									` · ${labelField}`}
							</span>
						);
					})}
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-2">
				{isEnabled ? (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 font-mono text-primary-deep text-xs uppercase tracking-wider">
						<CheckIcon className="size-3" />
						{t("rules.assistant.enabledState")}
					</span>
				) : (
					<>
						<Button
							variant="primary"
							size="sm"
							onClick={onTurnOn}
							loading={isCreating}
							disabled={isCreating}
						>
							<ZapIcon className="size-4" />
							{t("rules.assistant.turnOn")}
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={onEdit}
							disabled={isCreating}
						>
							<PencilIcon className="size-4" />
							{t("rules.assistant.editConditions")}
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={onTryAnother}
							disabled={isCreating}
						>
							{t("rules.assistant.tryAnother")}
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

interface SidebarProps {
	onTemplate: (key: (typeof TEMPLATE_KEYS)[number]) => void;
}

function Sidebar({ onTemplate }: SidebarProps) {
	const t = useTranslations();
	return (
		<aside className="flex flex-col gap-4">
			<div className="rounded-2xl border border-border bg-card p-5">
				<h3 className="mb-3 font-medium text-sm">
					{t("rules.assistant.sidebar.templatesHeading")}
				</h3>
				<ul className="divide-y divide-border">
					{TEMPLATE_KEYS.map((key) => (
						<li
							key={key}
							className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
						>
							<div className="min-w-0">
								<p className="truncate text-sm">
									{t(
										`rules.assistant.templates.${key}.title`,
									)}
								</p>
								<p className="mt-0.5 truncate text-foreground text-xs">
									{t(
										`rules.assistant.templates.${key}.description`,
									)}
								</p>
							</div>
							<Button
								variant="primary"
								size="sm"
								onClick={() => onTemplate(key)}
							>
								{t("rules.assistant.templates.use")}
							</Button>
						</li>
					))}
				</ul>
			</div>

			<div className="rounded-2xl border border-border bg-card p-5">
				<h3 className="mb-2 font-medium text-sm">
					{t("rules.assistant.sidebar.howItWorksHeading")}
				</h3>
				<p className="mb-4 text-foreground text-xs leading-relaxed">
					{t("rules.assistant.sidebar.howItWorksBody")}
				</p>
				<dl className="grid gap-2 text-xs">
					<SidebarBadge
						label={t("rules.assistant.sidebar.gmailBadge")}
						description={t(
							"rules.assistant.sidebar.gmailBadgeDesc",
						)}
					/>
					<SidebarBadge
						label={t("rules.assistant.sidebar.modelBadge")}
						description={t(
							"rules.assistant.sidebar.modelBadgeDesc",
						)}
					/>
					<SidebarBadge
						label={t("rules.assistant.sidebar.latencyBadge")}
						description={t(
							"rules.assistant.sidebar.latencyBadgeDesc",
						)}
					/>
				</dl>
			</div>
		</aside>
	);
}

function SidebarBadge({
	label,
	description,
}: {
	label: string;
	description: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<dt className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-primary-deep text-[11px] uppercase tracking-wider">
				{label}
			</dt>
			<dd className="text-foreground">{description}</dd>
		</div>
	);
}

function UpsellState() {
	const t = useTranslations();
	return (
		<div className="mx-auto flex w-full max-w-xl flex-col items-center rounded-2xl border border-dashed border-border/70 bg-muted/30 p-10 text-center">
			<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
				<SparklesIcon className="size-6" />
			</div>
			<p className="font-mono text-foreground text-xs uppercase tracking-wider">
				{t("rules.assistant.upsell.eyebrow")}
			</p>
			<h2 className="mt-2 font-serif font-normal text-2xl tracking-tight">
				{t("rules.assistant.upsell.title")}
			</h2>
			<p className="mt-2 max-w-md text-foreground text-sm">
				{t("rules.assistant.upsell.description")}
			</p>
			<Button asChild variant="primary" size="sm" className="mt-5">
				<Link href="/app/settings/billing">
					{t("rules.assistant.upsell.cta")}
				</Link>
			</Button>
		</div>
	);
}
