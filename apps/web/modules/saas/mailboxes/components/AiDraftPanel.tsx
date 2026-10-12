"use client";

import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { useSession } from "@saas/auth/hooks/use-session";
import {
	CheckIcon,
	Loader2Icon,
	RefreshCwIcon,
	SparklesIcon,
	VideoIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	useCreateMeetingMutation,
	useGenerateDraftsMutation,
	useInboxMessageQuery,
} from "../lib/inbox-api";

type Tone = "professional" | "friendly" | "formal";

const TONES: Tone[] = ["professional", "friendly", "formal"];

const TONE_LABEL: Record<Tone, string> = {
	professional: "Professional",
	friendly: "Friendly",
	formal: "Formal",
};

interface Draft {
	tone: Tone;
	confidence: "high" | "medium" | "low";
	body: string;
}

const CONFIDENCE_LABEL: Record<Draft["confidence"], string> = {
	high: "High confidence",
	medium: "Medium confidence",
	low: "Low confidence",
};

type MeetingProvider = "google" | "zoom" | "zoho" | "outlook";

const MEETING_PROVIDERS: MeetingProvider[] = [
	"google",
	"zoom",
	"zoho",
	"outlook",
];

const MEETING_PROVIDER_LABEL: Record<MeetingProvider, string> = {
	google: "Google Meet",
	zoom: "Zoom",
	zoho: "Zoho Meeting",
	outlook: "Teams",
};

/** Short labels for the provider toggle, where space is tight. */
const MEETING_PROVIDER_SHORT: Record<MeetingProvider, string> = {
	google: "Meet",
	zoom: "Zoom",
	zoho: "Zoho",
	outlook: "Teams",
};

const MEETING_RECONNECT_HINT: Record<MeetingProvider, string> = {
	google: "Reconnect Google (with calendar access) to create Meet links.",
	zoom: "Connect Zoom in Settings → Integrations to create Zoom links.",
	zoho: "Connect Zoho in Settings → Integrations to create Zoho Meeting links.",
	outlook: "Connect an Outlook mailbox to create Teams links.",
};

/** Steps shown in the loading animation, echoing the analysis pipeline. */
const LOADING_STEPS = [
	"Reading email subject & body",
	"Loading thread context",
	"Detecting intent",
	"Generating 3 draft variants",
];

/** Best-effort HTML → plain text for feeding the model a clean body. */
function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns the first candidate that is (or contains) a valid email address.
 * Handles both bare `a@b.com` and RFC822 `Name <a@b.com>` forms, and falls
 * back to "" so we never put a display name in the To header (which Gmail
 * rejects as an "Invalid To header").
 */
function pickEmail(...candidates: Array<string | undefined | null>): string {
	for (const raw of candidates) {
		const value = raw?.trim();
		if (!value) {
			continue;
		}
		const angle = value.match(/<([^>]+)>/);
		if (angle && EMAIL_RE.test(angle[1].trim())) {
			return angle[1].trim();
		}
		if (EMAIL_RE.test(value)) {
			return value;
		}
	}
	return "";
}

function wordCount(text: string): number {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Formats a Date for a `datetime-local` input value (local time, no seconds). */
function toDatetimeLocalValue(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MEETING_DURATIONS = [15, 30, 45, 60] as const;

export interface UseDraftPayload {
	to: string;
	subject: string;
	body: string;
}

interface AiDraftPanelProps {
	mailboxId: string;
	messageId: string;
	/** Loads the chosen draft into the reply composer. */
	onUseDraft: (payload: UseDraftPayload) => void;
}

export function AiDraftPanel({
	mailboxId,
	messageId,
	onUseDraft,
}: AiDraftPanelProps) {
	const { user } = useSession();
	// Reuses the same cache entry MessageDetail populated — no extra request.
	const { data: message } = useInboxMessageQuery(mailboxId, messageId);
	const generate = useGenerateDraftsMutation(mailboxId);
	const createMeeting = useCreateMeetingMutation(mailboxId);

	const [drafts, setDrafts] = useState<Draft[] | null>(null);
	const [intent, setIntent] = useState<string | null>(null);
	const [activeTone, setActiveTone] = useState<Tone>("professional");
	const [meetLink, setMeetLink] = useState<string | null>(null);

	// Reset when the user switches to a different email.
	useEffect(() => {
		setIntent(null);
		setDrafts(null);
		setActiveTone("professional");
		setMeetLink(null);
		generate.reset();
		createMeeting.reset();
	}, [messageId]);

	const runGenerate = () => {
		if (!message) {
			return;
		}
		const body = message.bodyText?.trim()
			? message.bodyText
			: htmlToText(message.bodyHtml ?? "");
		if (!body) {
			toast.error("This email has no readable text to reply to.");
			return;
		}
		generate.mutate(
			{
				subject: message.subject || undefined,
				body,
				fromName: message.from || undefined,
				fromEmail: message.fromEmail || undefined,
				senderName: user?.name || undefined,
			},
			{
				onSuccess: (result) => {
					setIntent(result.intent);
					setDrafts(result.drafts as Draft[]);
					setActiveTone("professional");
				},
				onError: (err) => {
					toast.error(
						err instanceof Error
							? err.message
							: "Could not generate drafts",
					);
				},
			},
		);
	};

	const activeDraft = drafts?.find((d) => d.tone === activeTone) ?? null;
	const replyTo = message ? pickEmail(message.fromEmail, message.from) : "";

	const addMeetLink = (
		start: Date,
		durationMinutes: number,
		provider: MeetingProvider,
	) => {
		if (!message) {
			return;
		}
		if (start.getTime() <= Date.now()) {
			toast.error("Pick a meeting time in the future.");
			return;
		}
		const providerLabel = MEETING_PROVIDER_LABEL[provider];
		const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
		createMeeting.mutate(
			{
				provider,
				summary: message.subject
					? `Meeting: ${message.subject}`
					: "Meeting",
				startIso: start.toISOString(),
				endIso: end.toISOString(),
				attendees: replyTo ? [replyTo] : undefined,
			},
			{
				onSuccess: (result) => {
					if (result.status === "ok") {
						setMeetLink(result.meeting.meetLink);
						toast.success(`${providerLabel} link created`);
					} else if (result.status === "needsReconnect") {
						toast.error(MEETING_RECONNECT_HINT[provider]);
					} else if (result.status === "serviceDisabled") {
						toast.error(
							"Google Calendar API is disabled for this project.",
						);
					} else {
						toast.error(
							`Could not create a ${providerLabel} link.`,
						);
					}
				},
				onError: () =>
					toast.error(`Could not create a ${providerLabel} link.`),
			},
		);
	};

	const handleUse = () => {
		if (!activeDraft || !message) {
			return;
		}
		const subject = message.subject?.toLowerCase().startsWith("re:")
			? message.subject
			: `Re: ${message.subject ?? ""}`.trim();
		const body = meetLink
			? `${activeDraft.body}\n\nJoin the meeting: ${meetLink}`
			: activeDraft.body;
		onUseDraft({ to: replyTo, subject, body });
	};

	return (
		<aside className="hidden w-96 shrink-0 flex-col border-l border-border bg-card lg:flex">
			<div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
				<span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-sm">
					<SparklesIcon className="size-3.5" />
				</span>
				<h2 className="text-sm font-semibold text-foreground">
					AI draft
				</h2>
				{drafts && (
					<span className="ml-auto rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-deep">
						3 drafts ready
					</span>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{generate.isPending ? (
					<LoadingState />
				) : drafts && activeDraft ? (
					<Results
						intent={intent}
						activeDraft={activeDraft}
						activeTone={activeTone}
						replyTo={replyTo}
						meetLink={meetLink}
						isCreatingMeet={createMeeting.isPending}
						onAddMeet={addMeetLink}
						onToneChange={setActiveTone}
						onRegenerate={runGenerate}
						onUse={handleUse}
					/>
				) : (
					<EmptyState disabled={!message} onGenerate={runGenerate} />
				)}
			</div>
		</aside>
	);
}

function EmptyState({
	disabled,
	onGenerate,
}: {
	disabled: boolean;
	onGenerate: () => void;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
			<span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-md">
				<SparklesIcon className="size-5" />
			</span>
			<div className="space-y-1">
				<p className="text-sm font-semibold text-foreground">
					Generate a reply with AI
				</p>
				<p className="mx-auto max-w-[16rem] text-xs text-muted-foreground">
					Let AI analyse this email and draft professional, friendly,
					and formal replies for you.
				</p>
			</div>
			<Button onClick={onGenerate} disabled={disabled} className="gap-2">
				<SparklesIcon className="size-4" />
				Generate draft
			</Button>
		</div>
	);
}

function LoadingState() {
	const [step, setStep] = useState(0);

	// Advance the checklist while the request is in flight. Caps at the last
	// step so it keeps spinning until the real result arrives.
	useEffect(() => {
		const id = setInterval(() => {
			setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
		}, 700);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-5 text-center">
			<Loader2Icon className="size-6 animate-spin text-primary" />
			<div className="space-y-1">
				<p className="text-sm font-semibold text-foreground">
					AI is analysing your email
				</p>
				<p className="text-xs text-muted-foreground">
					Usually takes 2–4 seconds
				</p>
			</div>
			<ul className="w-full max-w-[15rem] space-y-2.5 text-left">
				{LOADING_STEPS.map((label, i) => {
					const done = i < step;
					const active = i === step;
					return (
						<li
							key={label}
							className={cn(
								"flex items-center gap-2.5 text-xs transition-colors",
								done || active
									? "text-foreground"
									: "text-muted-foreground/50",
							)}
						>
							<span
								className={cn(
									"flex size-4 items-center justify-center rounded-full",
									done
										? "bg-primary-soft text-primary"
										: "bg-muted text-muted-foreground",
								)}
							>
								{done ? (
									<CheckIcon className="size-3" />
								) : active ? (
									<Loader2Icon className="size-3 animate-spin" />
								) : (
									<span className="size-1 rounded-full bg-current" />
								)}
							</span>
							{label}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function Results({
	intent,
	activeDraft,
	activeTone,
	replyTo,
	meetLink,
	isCreatingMeet,
	onAddMeet,
	onToneChange,
	onRegenerate,
	onUse,
}: {
	intent: string | null;
	activeDraft: Draft;
	activeTone: Tone;
	replyTo: string;
	meetLink: string | null;
	isCreatingMeet: boolean;
	onAddMeet: (
		start: Date,
		durationMinutes: number,
		provider: MeetingProvider,
	) => void;
	onToneChange: (tone: Tone) => void;
	onRegenerate: () => void;
	onUse: () => void;
}) {
	const confidenceColor =
		activeDraft.confidence === "high"
			? "text-emerald-600"
			: activeDraft.confidence === "medium"
				? "text-amber-600"
				: "text-muted-foreground";

	return (
		<div className="flex h-full flex-col gap-3.5">
			{intent && (
				<div className="rounded-xl border border-primary/20 bg-primary-soft/60 p-3">
					<p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-primary-deep">
						Detected intent
					</p>
					<p className="text-xs leading-relaxed text-foreground">
						{intent}
					</p>
				</div>
			)}

			{/* Segmented tone control */}
			<div className="flex gap-0.5 rounded-full border border-border bg-muted p-0.5">
				{TONES.map((tone) => (
					<button
						key={tone}
						type="button"
						onClick={() => onToneChange(tone)}
						className={cn(
							"flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors",
							activeTone === tone
								? "bg-background text-primary shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{TONE_LABEL[tone]}
					</button>
				))}
			</div>

			{/* Draft card */}
			<div className="overflow-hidden rounded-xl border border-border bg-background">
				<div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
					<span className="text-xs font-bold text-foreground">
						{TONE_LABEL[activeDraft.tone]}
					</span>
					<span
						className={cn(
							"inline-flex items-center gap-1.5 text-[10px] font-semibold",
							confidenceColor,
						)}
					>
						<span className="size-1.5 rounded-full bg-current" />
						{CONFIDENCE_LABEL[activeDraft.confidence]}
					</span>
				</div>
				<p className="whitespace-pre-wrap px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
					{activeDraft.body}
				</p>
				<div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2 text-[10px] text-muted-foreground">
					<span className="rounded-full bg-muted px-2 py-0.5">
						~{wordCount(activeDraft.body)} words
					</span>
					<span className="truncate">
						{replyTo ? `To: ${replyTo}` : "Add a recipient"}
					</span>
				</div>
			</div>

			{/* Google Meet: create a link and attach it to the reply */}
			{meetLink ? (
				<div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-soft/50 px-3 py-2">
					<VideoIcon className="size-4 shrink-0 text-primary" />
					<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
						{meetLink.replace(/^https?:\/\//, "")}
					</span>
					<span className="shrink-0 text-[10px] font-semibold text-primary">
						Attached
					</span>
				</div>
			) : (
				<MeetPicker onCreate={onAddMeet} isCreating={isCreatingMeet} />
			)}

			<div className="mt-auto flex items-center gap-2 pt-1">
				<Button size="sm" className="gap-2" onClick={onRegenerate}>
					<RefreshCwIcon className="size-3.5" />
					Regenerate
				</Button>
				<Button size="sm" className="flex-1" onClick={onUse}>
					Use this draft
				</Button>
			</div>
		</div>
	);
}

/**
 * "Add meeting link" control: a button that expands into a provider (Google Meet
 * or Zoom) + date/time + duration picker so the user chooses the platform and
 * when the meeting is scheduled.
 */
function MeetPicker({
	onCreate,
	isCreating,
}: {
	onCreate: (
		start: Date,
		durationMinutes: number,
		provider: MeetingProvider,
	) => void;
	isCreating: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [provider, setProvider] = useState<MeetingProvider>("google");
	// Default the meeting to one hour from now.
	const [at, setAt] = useState(() =>
		toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
	);
	const [duration, setDuration] = useState<number>(30);

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary-soft px-3 py-2 text-xs font-semibold text-primary-deep transition-colors hover:bg-primary-soft/70"
			>
				<VideoIcon className="size-4" />
				Add meeting link
			</button>
		);
	}

	return (
		<div className="space-y-2 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
			<p className="flex items-center gap-2 text-xs font-semibold text-primary-deep">
				<VideoIcon className="size-3.5" />
				Schedule meeting
			</p>
			<div className="flex gap-0.5 rounded-full border border-border bg-muted p-0.5">
				{MEETING_PROVIDERS.map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => setProvider(p)}
						className={cn(
							"flex-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors",
							provider === p
								? "bg-background text-primary shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{MEETING_PROVIDER_SHORT[p]}
					</button>
				))}
			</div>
			<input
				type="datetime-local"
				aria-label="Meeting date and time"
				value={at}
				min={toDatetimeLocalValue(new Date())}
				onChange={(e) => setAt(e.target.value)}
				className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none"
			/>
			<select
				aria-label="Meeting duration"
				value={duration}
				onChange={(e) => setDuration(Number(e.target.value))}
				className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none"
			>
				{MEETING_DURATIONS.map((minutes) => (
					<option key={minutes} value={minutes}>
						{minutes} minutes
					</option>
				))}
			</select>
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					className="flex-1"
					onClick={() => setOpen(false)}
					disabled={isCreating}
				>
					Cancel
				</Button>
				<Button
					size="sm"
					className="flex-1 gap-2"
					disabled={isCreating || !at}
					onClick={() => onCreate(new Date(at), duration, provider)}
				>
					{isCreating ? (
						<Loader2Icon className="size-3.5 animate-spin" />
					) : (
						<VideoIcon className="size-3.5" />
					)}
					{isCreating ? "Creating…" : "Create link"}
				</Button>
			</div>
		</div>
	);
}
