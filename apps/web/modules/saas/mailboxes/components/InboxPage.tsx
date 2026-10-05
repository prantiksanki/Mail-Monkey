"use client";

import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import {
	ArchiveIcon,
	ArrowLeftIcon,
	ClockIcon,
	ForwardIcon,
	InboxIcon,
	MailIcon,
	MailOpenIcon,
	MoreVerticalIcon,
	PencilIcon,
	RefreshCwIcon,
	ReplyIcon,
	SearchIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { buildForwardHtml } from "../lib/email-html";
import {
	useArchiveMessageMutation,
	useCancelScheduledEmailMutation,
	useCancelSnoozeMutation,
	useDeleteDraftMutation,
	useDeleteMessageMutation,
	useDraftsQuery,
	useGetDraftQuery,
	useInboxMessageQuery,
	useInboxMessagesQuery,
	useMarkReadMessageMutation,
	useMarkUnreadMessageMutation,
	useScheduledEmailsQuery,
	useSnoozedEmailsQuery,
	useSnoozeMessageMutation,
	useSyncInboxMutation,
	useSyncStatusQuery,
	useTrashMessageMutation,
	useTriggerSyncMutation,
} from "../lib/inbox-api";
import { ComposeDialog } from "./ComposeDialog";
import { MailboxSwitcher } from "./MailboxSwitcher";
import { SenderDetailsPopover } from "./SenderDetailsPopover";

function formatDate(iso: string) {
	try {
		const d = new Date(iso);
		const now = new Date();
		if (now.getTime() - d.getTime() < 24 * 60 * 60 * 1000) {
			return d.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
		}
		// Show both date and time so the send/receive time is always visible.
		return d.toLocaleString([], {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

function formatFullDate(iso: string) {
	try {
		return new Date(iso).toLocaleString([], {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

/**
 * Cleans a sender display name for rendering: strips the surrounding quotes
 * that RFC822 display names often carry (e.g. `"Workday at S&P Global"`),
 * keeping internal characters intact.
 */
function cleanSenderName(from: string): string {
	return (from ?? "")
		.trim()
		.replace(/^["']+|["']+$/g, "")
		.trim();
}

function senderInitial(from: string) {
	// Use the first letter, skipping quotes/punctuation/whitespace that often
	// prefix display names (e.g. `"Workday at S&P Global"`).
	const letter = from?.match(/\p{L}/u)?.[0];
	return (letter ?? "?").toUpperCase();
}

/** Gmail-style snooze presets relative to `now`. */
function buildSnoozePresets(now: Date): Array<{ label: string; at: Date }> {
	const laterToday = new Date(now.getTime() + 3 * 60 * 60 * 1000);

	const tomorrow = new Date(now);
	tomorrow.setDate(now.getDate() + 1);
	tomorrow.setHours(8, 0, 0, 0);

	// This weekend = upcoming Saturday 8am.
	const weekend = new Date(now);
	const daysUntilSat = (6 - now.getDay()) % 7 || 7;
	weekend.setDate(now.getDate() + daysUntilSat);
	weekend.setHours(8, 0, 0, 0);

	// Next week = upcoming Monday 8am.
	const nextWeek = new Date(now);
	const daysUntilMon = (8 - now.getDay()) % 7 || 7;
	nextWeek.setDate(now.getDate() + daysUntilMon);
	nextWeek.setHours(8, 0, 0, 0);

	return [
		{ label: "Later today", at: laterToday },
		{ label: "Tomorrow", at: tomorrow },
		{ label: "This weekend", at: weekend },
		{ label: "Next week", at: nextWeek },
	];
}

function formatSnoozePreset(d: Date): string {
	return d.toLocaleString([], {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** Local datetime formatted for a `datetime-local` input value. */
function toDatetimeLocalValue(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Pending snoozed emails for the "Snoozed" folder, with an unsnooze action. */
function SnoozedList({ mailboxId }: { mailboxId: string }) {
	const { data, isLoading } = useSnoozedEmailsQuery(mailboxId);
	const cancelMutation = useCancelSnoozeMutation(mailboxId);
	const snoozed = data?.snoozed ?? [];

	if (isLoading) {
		return (
			<div className="space-y-0">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className="flex gap-3 border-b border-border px-4 py-3"
					>
						<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
						<div className="flex-1 space-y-1.5">
							<Skeleton className="h-3.5 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (snoozed.length === 0) {
		return (
			<div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
				<ClockIcon className="size-8 opacity-30" />
				<p className="text-sm">No snoozed emails</p>
			</div>
		);
	}

	return (
		<div>
			{snoozed.map((item) => (
				<div
					key={item.id}
					className="flex items-start justify-between gap-3 border-b border-border px-4 py-3"
				>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium text-foreground">
							{item.subject || "(no subject)"}
						</p>
						<p className="truncate text-xs text-muted-foreground">
							{item.from}
						</p>
						<p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
							<ClockIcon className="size-3" />
							{formatFullDate(item.snoozeUntil)}
						</p>
					</div>
					<button
						type="button"
						onClick={() =>
							cancelMutation.mutate(item.id, {
								onSuccess: () =>
									toast.success("Returned to inbox"),
							})
						}
						disabled={cancelMutation.isPending}
						title="Unsnooze (return to inbox now)"
						className="shrink-0 rounded-full border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
						aria-label="Unsnooze"
					>
						<InboxIcon className="size-4" />
					</button>
				</div>
			))}
		</div>
	);
}

/** Drafts for the "Drafts" folder; clicking a row reopens it in compose. */
function DraftsList({
	mailboxId,
	onOpenDraft,
}: {
	mailboxId: string;
	onOpenDraft: (draftId: string) => void;
}) {
	const { data, isLoading } = useDraftsQuery(mailboxId);
	const deleteMutation = useDeleteDraftMutation(mailboxId);
	const drafts = data?.drafts ?? [];

	if (isLoading) {
		return (
			<div className="space-y-0">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className="flex gap-3 border-b border-border px-4 py-3"
					>
						<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
						<div className="flex-1 space-y-1.5">
							<Skeleton className="h-3.5 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (drafts.length === 0) {
		return (
			<div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
				<PencilIcon className="size-8 opacity-30" />
				<p className="text-sm">No drafts</p>
			</div>
		);
	}

	return (
		<div>
			{drafts.map((item) => (
				// biome-ignore lint/a11y/useSemanticElements: row contains a delete <button>; nested buttons are invalid HTML.
				<div
					key={item.draftId}
					role="button"
					tabIndex={0}
					onClick={() => onOpenDraft(item.draftId)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							onOpenDraft(item.draftId);
						}
					}}
					className="group flex w-full cursor-pointer items-start justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/40"
				>
					<div className="min-w-0 flex-1">
						<div className="flex items-center justify-between gap-2">
							<span className="truncate text-sm font-medium text-destructive">
								Draft
							</span>
							<span className="shrink-0 text-xs text-muted-foreground">
								{formatDate(item.date)}
							</span>
						</div>
						<p className="truncate text-sm text-foreground">
							{item.subject || "(no subject)"}
						</p>
						<p className="mt-0.5 truncate text-xs text-muted-foreground">
							{item.to ? `To: ${item.to}` : item.snippet}
						</p>
					</div>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							deleteMutation.mutate(item.draftId, {
								onSuccess: () => toast.success("Draft deleted"),
							});
						}}
						disabled={deleteMutation.isPending}
						title="Delete draft"
						aria-label="Delete draft"
						className="shrink-0 rounded-full border border-transparent p-2 text-muted-foreground opacity-0 transition-opacity hover:border-border hover:bg-muted group-hover:opacity-100 disabled:opacity-50"
					>
						<Trash2Icon className="size-4" />
					</button>
				</div>
			))}
		</div>
	);
}

/**
 * Fetches a draft's full content, then mounts ComposeDialog (only once loaded)
 * with the fields prefilled so its useState initializers get the right values.
 */
function DraftComposeLoader({
	mailboxId,
	draftId,
	onClose,
}: {
	mailboxId: string;
	draftId: string;
	onClose: () => void;
}) {
	const { data, isLoading } = useGetDraftQuery(mailboxId, draftId);

	if (isLoading || !data) {
		return (
			<div className="fixed bottom-0 right-6 z-[100] flex h-[520px] w-[560px] flex-col items-center justify-center rounded-t-xl border border-border bg-card shadow-2xl">
				<Skeleton className="h-6 w-40" />
			</div>
		);
	}

	return (
		<ComposeDialog
			mailboxId={mailboxId}
			initialDraftId={data.draftId}
			defaultTo={data.to}
			defaultCc={data.cc}
			defaultBcc={data.bcc}
			defaultSubject={data.subject}
			defaultBody={data.body}
			defaultBodyHtml={data.bodyHtml ?? undefined}
			onClose={onClose}
		/>
	);
}

/** Pending scheduled emails for the "Scheduled" folder, with a cancel action. */
function ScheduledList({ mailboxId }: { mailboxId: string }) {
	const { data, isLoading } = useScheduledEmailsQuery(mailboxId);
	const cancelMutation = useCancelScheduledEmailMutation(mailboxId);
	const scheduled = data?.scheduled ?? [];

	if (isLoading) {
		return (
			<div className="space-y-0">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className="flex gap-3 border-b border-border px-4 py-3"
					>
						<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
						<div className="flex-1 space-y-1.5">
							<Skeleton className="h-3.5 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (scheduled.length === 0) {
		return (
			<div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
				<ClockIcon className="size-8 opacity-30" />
				<p className="text-sm">No scheduled emails</p>
			</div>
		);
	}

	return (
		<div>
			{scheduled.map((item) => (
				<div
					key={item.id}
					className="flex items-start justify-between gap-3 border-b border-border px-4 py-3"
				>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium text-foreground">
							{item.subject || "(no subject)"}
						</p>
						<p className="truncate text-xs text-muted-foreground">
							To: {item.to}
						</p>
						<p className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
							<ClockIcon className="size-3" />
							{formatFullDate(item.scheduledAt)}
						</p>
					</div>
					<button
						type="button"
						onClick={() => cancelMutation.mutate(item.id)}
						disabled={cancelMutation.isPending}
						className="shrink-0 rounded-full border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
						aria-label="Cancel scheduled email"
					>
						<Trash2Icon className="size-4" />
					</button>
				</div>
			))}
		</div>
	);
}

function ActionBtn({
	icon: Icon,
	label,
	onClick,
	disabled,
}: {
	icon: React.ElementType;
	label: string;
	onClick?: (e: React.MouseEvent) => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={label}
			aria-label={label}
			disabled={disabled}
			className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
		>
			<Icon className="size-4" />
		</button>
	);
}

const GMAIL_SYSTEM_LABELS = new Set([
	"INBOX",
	"UNREAD",
	"SENT",
	"DRAFT",
	"TRASH",
	"SPAM",
	"STARRED",
	"IMPORTANT",
]);

function filterUserLabels(labelIds: string[] | undefined): string[] {
	return (labelIds ?? []).filter(
		(id) =>
			id.startsWith("Label_") ||
			(!GMAIL_SYSTEM_LABELS.has(id) && !id.startsWith("CATEGORY_")),
	);
}

function LabelChip({ label }: { label: string }) {
	return (
		<span className="inline-flex shrink-0 items-center rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-deep">
			{label}
		</span>
	);
}

function MessageLabels({ labelIds }: { labelIds: string[] | undefined }) {
	const labels = filterUserLabels(labelIds);
	if (labels.length === 0) {
		return null;
	}
	return (
		<div className="flex flex-wrap gap-1.5 px-8 pb-4">
			{labels.map((label) => (
				<LabelChip key={label} label={label} />
			))}
		</div>
	);
}

/**
 * The hover/focus quick-action toolbar for a message row. Extracted into its
 * own component and mounted lazily (only once the row is hovered or focused) so
 * the inbox list can render hundreds of rows without instantiating five
 * mutation hooks + a Radix dropdown per row. That lazy mounting is what keeps
 * scrolling smooth.
 */
function RowActions({
	mailboxId,
	messageId,
	isUnread,
	inTrash = false,
}: {
	mailboxId: string;
	messageId: string;
	isUnread: boolean;
	inTrash?: boolean;
}) {
	const archiveMutation = useArchiveMessageMutation(mailboxId);
	const trashMutation = useTrashMessageMutation(mailboxId);
	const deleteMutation = useDeleteMessageMutation(mailboxId);
	const markReadMutation = useMarkReadMessageMutation(mailboxId);
	const markUnreadMutation = useMarkUnreadMessageMutation(mailboxId);
	const snoozeMutation = useSnoozeMessageMutation(mailboxId);

	// In Trash, delete permanently rather than re-trashing.
	const removeMessage = () => {
		if (inTrash) {
			deleteMutation.mutate(messageId, {
				onSuccess: () => toast.success("Deleted permanently"),
			});
		} else {
			trashMutation.mutate(messageId, {
				onSuccess: () => toast.success("Moved to trash"),
			});
		}
	};

	const [snoozeOpen, setSnoozeOpen] = useState(false);
	const [showCustomSnooze, setShowCustomSnooze] = useState(false);
	const [customSnoozeAt, setCustomSnoozeAt] = useState("");
	// Presets reference "now"; computing them on open (not every render) is fine
	// because the toolbar only mounts on hover.
	const presets = buildSnoozePresets(new Date());

	const handleSnooze = (at: Date) => {
		if (at.getTime() <= Date.now()) {
			toast.error("Pick a time in the future");
			return;
		}
		snoozeMutation.mutate(
			{ messageId, snoozeUntil: at.toISOString() },
			{
				onSuccess: () =>
					toast.success(`Snoozed until ${formatSnoozePreset(at)}`),
				onError: (e) =>
					toast.error(
						e instanceof Error ? e.message : "Failed to snooze",
					),
			},
		);
		setSnoozeOpen(false);
	};

	return (
		<div
			className={cn(
				"absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-0.5 shadow-sm transition-opacity",
				snoozeOpen
					? "opacity-100"
					: "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
			)}
		>
			<ActionBtn
				icon={ArchiveIcon}
				label="Archive"
				disabled={archiveMutation.isPending}
				onClick={(e) => {
					e.stopPropagation();
					archiveMutation.mutate(messageId, {
						onSuccess: () => toast.success("Archived"),
					});
				}}
			/>
			<ActionBtn
				icon={Trash2Icon}
				label={inTrash ? "Delete permanently" : "Delete"}
				disabled={trashMutation.isPending || deleteMutation.isPending}
				onClick={(e) => {
					e.stopPropagation();
					removeMessage();
				}}
			/>
			<ActionBtn
				icon={isUnread ? MailOpenIcon : MailIcon}
				label={isUnread ? "Mark as read" : "Mark as unread"}
				disabled={
					markReadMutation.isPending || markUnreadMutation.isPending
				}
				onClick={(e) => {
					e.stopPropagation();
					if (isUnread) {
						markReadMutation.mutate(messageId);
					} else {
						markUnreadMutation.mutate(messageId);
					}
				}}
			/>
			<DropdownMenu
				open={snoozeOpen}
				onOpenChange={(open) => {
					setSnoozeOpen(open);
					if (!open) {
						setShowCustomSnooze(false);
					}
				}}
			>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						title="Snooze"
						aria-label="Snooze"
						onClick={(e) => e.stopPropagation()}
						className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
					>
						<ClockIcon className="size-4" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="w-56"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
						Snooze until
					</div>
					{presets.map((preset) => (
						<DropdownMenuItem
							key={preset.label}
							onSelect={() => handleSnooze(preset.at)}
							className="flex items-center justify-between gap-3"
						>
							<span>{preset.label}</span>
							<span className="text-xs text-muted-foreground">
								{formatSnoozePreset(preset.at)}
							</span>
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onSelect={(e) => {
							e.preventDefault();
							setShowCustomSnooze(true);
						}}
					>
						<ClockIcon className="mr-2 size-3.5" />
						Pick date & time
					</DropdownMenuItem>
					{showCustomSnooze && (
						<div className="flex flex-col gap-2 px-2 py-2">
							<input
								type="datetime-local"
								aria-label="Snooze date and time"
								title="Snooze date and time"
								value={customSnoozeAt}
								min={toDatetimeLocalValue(new Date())}
								onChange={(e) =>
									setCustomSnoozeAt(e.target.value)
								}
								onClick={(e) => e.stopPropagation()}
								className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none"
							/>
							<Button
								size="sm"
								disabled={
									!customSnoozeAt || snoozeMutation.isPending
								}
								onClick={() =>
									handleSnooze(new Date(customSnoozeAt))
								}
							>
								Snooze
							</Button>
						</div>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

const MessageListItem = memo(function MessageListItem({
	mailboxId,
	message,
	markedRead,
	isSelected,
	onSelect,
}: {
	mailboxId: string;
	message: {
		id: string;
		from: string;
		subject: string;
		snippet: string;
		date: string;
		isUnread: boolean;
		labelIds?: string[];
		inTrash?: boolean;
	};
	/** Locally marked read (optimistic) — overrides the server's isUnread. */
	markedRead: boolean;
	isSelected: boolean;
	onSelect: (id: string) => void;
}) {
	const labels = filterUserLabels(message.labelIds);
	const isUnread = message.isUnread && !markedRead;
	// Mount the heavy action toolbar (mutation hooks + dropdown) only after the
	// row is first hovered/focused. Keeps scrolling cheap; once activated it
	// stays mounted so the hover affordance is instant on subsequent hovers.
	const [actionsActive, setActionsActive] = useState(false);

	const onClick = () => onSelect(message.id);
	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect(message.id);
		}
	};

	const archiveMutation = useArchiveMessageMutation(mailboxId);
	const trashMutation = useTrashMessageMutation(mailboxId);
	const deleteMutation = useDeleteMessageMutation(mailboxId);
	const markReadMutation = useMarkReadMessageMutation(mailboxId);
	const markUnreadMutation = useMarkUnreadMessageMutation(mailboxId);
	const snoozeMutation = useSnoozeMessageMutation(mailboxId);

	// In Trash, the delete button permanently removes the message instead of
	// re-trashing it.
	const inTrash = message.inTrash ?? false;
	const removeMessage = () => {
		if (inTrash) {
			deleteMutation.mutate(message.id, {
				onSuccess: () => toast.success("Deleted permanently"),
			});
		} else {
			trashMutation.mutate(message.id, {
				onSuccess: () => toast.success("Moved to trash"),
			});
		}
	};

	const [snoozeOpen, setSnoozeOpen] = useState(false);
	const [showCustomSnooze, setShowCustomSnooze] = useState(false);
	const [customSnoozeAt, setCustomSnoozeAt] = useState("");
	const presets = buildSnoozePresets(new Date());

	const handleSnooze = (at: Date) => {
		if (at.getTime() <= Date.now()) {
			toast.error("Pick a time in the future");
			return;
		}
		snoozeMutation.mutate(
			{ messageId: message.id, snoozeUntil: at.toISOString() },
			{
				onSuccess: () =>
					toast.success(`Snoozed until ${formatSnoozePreset(at)}`),
				onError: (e) =>
					toast.error(
						e instanceof Error ? e.message : "Failed to snooze",
					),
			},
		);
		setSnoozeOpen(false);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: must be a div, not a <button>, because it contains the hover action <button>s (nested buttons are invalid HTML); keyboard support is provided via role/tabIndex/onKeyDown.
		<div
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={onKeyDown}
			onMouseEnter={() => setActionsActive(true)}
			onFocus={() => setActionsActive(true)}
			className={cn(
				"group relative flex w-full cursor-pointer items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors",
				isSelected ? "bg-foreground/[0.035]" : "hover:bg-muted/40",
				isUnread && !isSelected ? "bg-foreground/[0.02]" : "",
			)}
		>
			<div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
				{senderInitial(message.from)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<span
						className={cn(
							"truncate text-sm",
							isUnread
								? "font-semibold text-foreground"
								: "text-muted-foreground",
						)}
					>
						{cleanSenderName(message.from) || "(Unknown)"}
					</span>
					<span className="shrink-0 text-xs text-muted-foreground group-hover:opacity-0">
						{formatDate(message.date)}
					</span>
				</div>
				<p
					className={cn(
						"truncate text-sm",
						isUnread
							? "font-medium text-foreground"
							: "text-muted-foreground",
					)}
				>
					{message.subject}
				</p>
				<p className="mt-0.5 truncate text-xs text-muted-foreground">
					{message.snippet}
				</p>
				{labels.length > 0 && (
					<div className="mt-1.5 flex flex-wrap gap-1">
						{labels.slice(0, 3).map((label) => (
							<LabelChip key={label} label={label} />
						))}
						{labels.length > 3 && (
							<span className="text-[10px] text-muted-foreground">
								+{labels.length - 3}
							</span>
						)}
					</div>
				)}
			</div>

			{/* Hover quick actions — mounted lazily on first hover/focus */}
			{actionsActive && (
				<RowActions
					mailboxId={mailboxId}
					messageId={message.id}
					isUnread={isUnread}
					inTrash={inTrash}
				/>
			)}
			{/* Hover quick actions */}
			<div
				className={cn(
					"absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-0.5 shadow-sm transition-opacity",
					snoozeOpen
						? "opacity-100"
						: "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
				)}
			>
				<ActionBtn
					icon={ArchiveIcon}
					label="Archive"
					disabled={archiveMutation.isPending}
					onClick={(e) => {
						e.stopPropagation();
						archiveMutation.mutate(message.id, {
							onSuccess: () => toast.success("Archived"),
						});
					}}
				/>
				<ActionBtn
					icon={Trash2Icon}
					label={inTrash ? "Delete permanently" : "Delete"}
					disabled={
						trashMutation.isPending || deleteMutation.isPending
					}
					onClick={(e) => {
						e.stopPropagation();
						removeMessage();
					}}
				/>
				<ActionBtn
					icon={message.isUnread ? MailOpenIcon : MailIcon}
					label={message.isUnread ? "Mark as read" : "Mark as unread"}
					disabled={
						markReadMutation.isPending ||
						markUnreadMutation.isPending
					}
					onClick={(e) => {
						e.stopPropagation();
						if (message.isUnread) {
							markReadMutation.mutate(message.id);
						} else {
							markUnreadMutation.mutate(message.id);
						}
					}}
				/>
				<DropdownMenu
					open={snoozeOpen}
					onOpenChange={(open) => {
						setSnoozeOpen(open);
						if (!open) {
							setShowCustomSnooze(false);
						}
					}}
				>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							title="Snooze"
							aria-label="Snooze"
							onClick={(e) => e.stopPropagation()}
							className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
						>
							<ClockIcon className="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-56"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
							Snooze until
						</div>
						{presets.map((preset) => (
							<DropdownMenuItem
								key={preset.label}
								onSelect={() => handleSnooze(preset.at)}
								className="flex items-center justify-between gap-3"
							>
								<span>{preset.label}</span>
								<span className="text-xs text-muted-foreground">
									{formatSnoozePreset(preset.at)}
								</span>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								setShowCustomSnooze(true);
							}}
						>
							<ClockIcon className="mr-2 size-3.5" />
							Pick date & time
						</DropdownMenuItem>
						{showCustomSnooze && (
							<div className="flex flex-col gap-2 px-2 py-2">
								<input
									type="datetime-local"
									aria-label="Snooze date and time"
									title="Snooze date and time"
									value={customSnoozeAt}
									min={toDatetimeLocalValue(new Date())}
									onChange={(e) =>
										setCustomSnoozeAt(e.target.value)
									}
									onClick={(e) => e.stopPropagation()}
									className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none"
								/>
								<Button
									size="sm"
									disabled={
										!customSnoozeAt ||
										snoozeMutation.isPending
									}
									onClick={() =>
										handleSnooze(new Date(customSnoozeAt))
									}
								>
									Snooze
								</Button>
							</div>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
});

// Wraps raw email HTML in a self-contained, sandboxed document. Module-level
// and pure so the output is referentially stable when memoized by the caller.
function buildEmailSrcDoc(html: string): string {
	// Strip cid: images (inline attachments not fetched) to avoid broken img icons
	const sanitized = html.replace(/src="cid:[^"]*"/gi, 'src=""');
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; script-src 'none';">
<base target="_blank" rel="noopener noreferrer">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #ffffff;
    color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  }
  img { max-width: 100%; height: auto; display: inline-block; }
  a { color: #1a73e8; }
  table { max-width: 100% !important; }
  td, th { word-break: break-word; }
  pre { white-space: pre-wrap; font-family: inherit; }
</style>
</head>
<body>${sanitized}</body>
</html>`;
}

function MessageDetail({
	mailboxId,
	messageId,
	onBack,
	onReply,
	onForward,
}: {
	mailboxId: string;
	messageId: string;
	onBack: () => void;
	onReply: (to: string, subject: string) => void;
	onForward: (source: {
		from: string;
		to: string;
		date: string;
		subject: string;
		bodyHtml?: string;
		bodyText?: string;
	}) => void;
}) {
	const { data, isLoading } = useInboxMessageQuery(mailboxId, messageId);
	const archiveMutation = useArchiveMessageMutation(mailboxId);
	const trashMutation = useTrashMessageMutation(mailboxId);
	const deleteMutation = useDeleteMessageMutation(mailboxId);
	const markUnreadMutation = useMarkUnreadMessageMutation(mailboxId);
	const markReadMutation = useMarkReadMessageMutation(mailboxId);
	const snoozeMutation = useSnoozeMessageMutation(mailboxId);

	// In Trash, the delete action permanently removes the message; elsewhere it
	// moves it to Trash. Returns to the list on success either way.
	const inTrash = data?.labelIds?.includes("TRASH") ?? false;
	const removeMessage = () => {
		if (inTrash) {
			deleteMutation.mutate(messageId, {
				onSuccess: () => {
					toast.success("Deleted permanently");
					onBack();
				},
			});
		} else {
			trashMutation.mutate(messageId, { onSuccess: onBack });
		}
	};
	const [showCustomSnooze, setShowCustomSnooze] = useState(false);
	const [customSnoozeAt, setCustomSnoozeAt] = useState("");
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const handleSnooze = (at: Date) => {
		if (at.getTime() <= Date.now()) {
			toast.error("Pick a time in the future");
			return;
		}
		snoozeMutation.mutate(
			{ messageId, snoozeUntil: at.toISOString() },
			{
				onSuccess: () => {
					toast.success(`Snoozed until ${formatSnoozePreset(at)}`);
					onBack();
				},
				onError: (e) =>
					toast.error(
						e instanceof Error ? e.message : "Failed to snooze",
					),
			},
		);
	};

	// Mark as read in Gmail when the message loads and is unread
	useEffect(() => {
		if (data?.isUnread) {
			markReadMutation.mutate(messageId);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messageId, data?.isUnread]);

	// Memoize so the srcDoc string is stable for a given body — otherwise the
	// iframe document reloads on every component re-render (e.g. mark-as-read),
	// causing a visible second "load".
	const srcDoc = useMemo(
		() => (data?.bodyHtml ? buildEmailSrcDoc(data.bodyHtml) : ""),
		[data?.bodyHtml],
	);

	// Measure the iframe's real content height and apply it. Re-runs whenever the
	// document reflows (late-loading images, web fonts) so tall emails aren't
	// clipped to the initial min-height — which is what made them look like they
	// loaded "partially, then fully".
	const resizeIframe = useCallback(() => {
		const iframe = iframeRef.current;
		const doc = iframe?.contentDocument;
		if (!iframe || !doc?.documentElement) {
			return;
		}
		const h = Math.max(
			doc.documentElement.scrollHeight,
			doc.body?.scrollHeight ?? 0,
		);
		if (h > 0) {
			iframe.style.height = `${h}px`;
		}
	}, []);

	const resizeObserverRef = useRef<ResizeObserver | null>(null);

	const handleIframeLoad = useCallback(() => {
		const doc = iframeRef.current?.contentDocument;
		if (!doc) {
			return;
		}
		// Initial measure once the document is parsed.
		resizeIframe();
		// Re-measure after images finish loading — at onLoad time most remote
		// images haven't loaded yet, so the first measurement is too short.
		for (const img of Array.from(doc.images)) {
			if (!img.complete) {
				img.addEventListener("load", resizeIframe, { once: true });
				img.addEventListener("error", resizeIframe, { once: true });
			}
		}
		// Catch any other reflow (web fonts, async layout) via ResizeObserver.
		resizeObserverRef.current?.disconnect();
		if (doc.body && "ResizeObserver" in window) {
			const ro = new ResizeObserver(resizeIframe);
			ro.observe(doc.body);
			resizeObserverRef.current = ro;
		}
	}, [resizeIframe]);

	// Disconnect the observer when the message changes or the view unmounts.
	useEffect(() => {
		return () => resizeObserverRef.current?.disconnect();
	}, []);

	if (isLoading) {
		return (
			<div className="flex-1 flex flex-col overflow-hidden bg-card">
				<div className="flex items-center justify-between px-6 py-3 border-b border-border">
					<Skeleton className="h-4 w-4 rounded" />
					<div className="flex gap-2">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton
								key={i}
								className="h-8 w-8 rounded-full"
							/>
						))}
					</div>
				</div>
				<div className="p-8 space-y-4">
					<Skeleton className="h-7 w-3/4" />
					<div className="flex gap-3 mt-6">
						<Skeleton className="w-10 h-10 rounded-full shrink-0" />
						<div className="space-y-2 flex-1">
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-3 w-32" />
						</div>
					</div>
					<div className="mt-8 space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-4 w-full" />
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex-1 flex items-center justify-center text-muted-foreground">
				Failed to load message.
			</div>
		);
	}

	const isBusy =
		archiveMutation.isPending ||
		trashMutation.isPending ||
		deleteMutation.isPending ||
		markUnreadMutation.isPending;

	const isUnread = data.isUnread;

	const forwardSource = {
		from: data.from,
		to: data.to || "Me",
		date: data.date,
		subject: data.subject,
		bodyHtml: data.bodyHtml || undefined,
		bodyText: data.bodyText || undefined,
	};

	return (
		<div className="flex-1 flex flex-col overflow-hidden bg-card">
			<div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
				<button
					type="button"
					onClick={onBack}
					className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
					aria-label="Back"
				>
					<ArrowLeftIcon className="size-4" />
				</button>
				<div className="flex items-center gap-1">
					<ActionBtn
						icon={ArchiveIcon}
						label="Archive"
						disabled={isBusy}
						onClick={() =>
							archiveMutation.mutate(messageId, {
								onSuccess: onBack,
							})
						}
					/>
					<ActionBtn
						icon={Trash2Icon}
						label={inTrash ? "Delete permanently" : "Delete"}
						disabled={isBusy}
						onClick={removeMessage}
					/>
					<ActionBtn
						icon={isUnread ? MailOpenIcon : MailIcon}
						label={isUnread ? "Mark as read" : "Mark as unread"}
						disabled={isBusy}
						onClick={() => {
							if (isUnread) {
								markReadMutation.mutate(messageId);
							} else {
								markUnreadMutation.mutate(messageId, {
									onSuccess: onBack,
								});
							}
						}}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								aria-label="More options"
								className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
							>
								<MoreVerticalIcon className="size-4" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() =>
									onReply(data.fromEmail, data.subject)
								}
							>
								<ReplyIcon className="size-4 mr-2" />
								Reply
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => onForward(forwardSource)}
							>
								<ForwardIcon className="size-4 mr-2" />
								Forward
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<ClockIcon className="size-4 mr-2" />
									Snooze
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="w-56">
									{buildSnoozePresets(new Date()).map(
										(preset) => (
											<DropdownMenuItem
												key={preset.label}
												onSelect={() =>
													handleSnooze(preset.at)
												}
												className="flex items-center justify-between gap-3"
											>
												<span>{preset.label}</span>
												<span className="text-xs text-muted-foreground">
													{formatSnoozePreset(
														preset.at,
													)}
												</span>
											</DropdownMenuItem>
										),
									)}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onSelect={(e) => {
											// Keep the menu open to reveal the picker.
											e.preventDefault();
											setShowCustomSnooze(true);
										}}
									>
										<ClockIcon className="size-4 mr-2" />
										Pick date & time
									</DropdownMenuItem>
									{showCustomSnooze && (
										<div className="flex flex-col gap-2 px-2 py-2">
											<input
												type="datetime-local"
												aria-label="Snooze date and time"
												title="Snooze date and time"
												value={customSnoozeAt}
												min={toDatetimeLocalValue(
													new Date(),
												)}
												onChange={(e) =>
													setCustomSnoozeAt(
														e.target.value,
													)
												}
												onClick={(e) =>
													e.stopPropagation()
												}
												className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none"
											/>
											<Button
												size="sm"
												disabled={
													!customSnoozeAt ||
													snoozeMutation.isPending
												}
												onClick={() =>
													handleSnooze(
														new Date(
															customSnoozeAt,
														),
													)
												}
											>
												Snooze
											</Button>
										</div>
									)}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuItem
								onClick={() =>
									archiveMutation.mutate(messageId, {
										onSuccess: onBack,
									})
								}
							>
								<ArchiveIcon className="size-4 mr-2" />
								Archive
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={removeMessage}
							>
								<Trash2Icon className="size-4 mr-2" />
								{inTrash ? "Delete permanently" : "Delete"}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				<div className="px-8 pb-4 pt-7">
					<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-foreground">
						Message
					</p>
					<h2 className="font-serif text-3xl font-normal leading-[1.05] text-foreground">
						{data.subject || "(No subject)"}
					</h2>
				</div>

				<div className="flex items-start justify-between gap-4 px-8 pb-5">
					<SenderDetailsPopover
						mailboxId={mailboxId}
						messageId={messageId}
						fallback={{
							from: data.from,
							fromEmail: data.fromEmail,
							to: data.to || "Me",
							subject: data.subject,
							date: data.date,
						}}
					>
						<div className="flex items-start gap-3">
							<div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
								{senderInitial(data.from)}
							</div>
							<div>
								<p className="font-semibold text-sm text-foreground leading-tight">
									{data.from}
								</p>
								<p className="text-xs text-muted-foreground mt-0.5">
									To: {data.to || "Me"}
								</p>
							</div>
						</div>
					</SenderDetailsPopover>
					<div className="flex items-center gap-2 shrink-0">
						<span className="text-xs text-muted-foreground">
							{formatFullDate(data.date)}
						</span>
						<button
							type="button"
							aria-label="Reply"
							onClick={() =>
								onReply(data.fromEmail, data.subject)
							}
							className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
						>
							<ReplyIcon className="size-4" />
						</button>
						<button
							type="button"
							aria-label="Forward"
							onClick={() => onForward(forwardSource)}
							className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
						>
							<ForwardIcon className="size-4" />
						</button>
					</div>
				</div>

				<MessageLabels
					labelIds={data.labelIds as string[] | undefined}
				/>

				<div className="mx-8 border-t border-border" />

				<div className="px-8 py-6">
					{data.bodyHtml ? (
						<iframe
							key={messageId}
							ref={iframeRef}
							srcDoc={srcDoc}
							title="Email content"
							sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
							referrerPolicy="no-referrer"
							className="w-full border-0 min-h-[400px] rounded"
							onLoad={handleIframeLoad}
						/>
					) : data.bodyText ? (
						<pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
							{data.bodyText}
						</pre>
					) : (
						<p className="text-sm text-muted-foreground italic">
							(No readable content — this email may contain only
							attachments.)
						</p>
					)}
				</div>

				<div className="px-8 pb-10 flex gap-3">
					<Button
						variant="outline"
						className="flex-1 gap-2 border-border bg-muted/60 text-foreground hover:bg-muted"
						onClick={() => onReply(data.fromEmail, data.subject)}
					>
						<ReplyIcon className="size-4" />
						Reply
					</Button>
					<Button
						variant="outline"
						className="flex-1 gap-2 border-border bg-muted/60 text-foreground hover:bg-muted"
						onClick={() => onForward(forwardSource)}
					>
						<ForwardIcon className="size-4" />
						Forward
					</Button>
				</div>
			</div>
		</div>
	);
}

const FOLDER_LABELS: Record<string, string> = {
	inbox: "Inbox",
	all: "All Emails",
	sent: "Sent",
	drafts: "Drafts",
	trash: "Trash",
	spam: "Spam",
	scheduled: "Scheduled",
	snoozed: "Snoozed",
};

export function InboxPage({ autoCompose = false }: { autoCompose?: boolean }) {
	// `selectedMailboxId` comes from localStorage, so it is null during SSR and
	// the first client render but may be populated immediately after. Gate the
	// "no mailbox" branch on mount so the server and first client render agree
	// (both show the loading skeleton), avoiding a hydration mismatch.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	const { selectedMailboxId, setSelectedMailboxId } = useSelectedMailbox();
	const router = useRouter();
	const searchParams = useSearchParams();
	const folder = searchParams.get("folder") ?? "inbox";
	const label = searchParams.get("label") ?? undefined;
	const folderLabel = label ?? FOLDER_LABELS[folder] ?? "Inbox";

	const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
		null,
	);
	const [readIds, setReadIds] = useState<Set<string>>(new Set());
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchInput, setSearchInput] = useState("");
	// Debounce so we don't refetch on every keystroke.
	const [debouncedSearch] = useDebounceValue(searchInput, 300);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [composing, setComposing] = useState(autoCompose);
	const [composeDefaults, setComposeDefaults] = useState<{
		to?: string;
		subject?: string;
		body?: string;
		bodyHtml?: string;
	}>({});
	const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

	// Drafts/snoozed/scheduled aren't searchable — close the search bar (and drop
	// any query) when navigating into one of those folders.
	const searchable =
		folder !== "drafts" && folder !== "snoozed" && folder !== "scheduled";
	useEffect(() => {
		if (!searchable && (searchOpen || searchInput)) {
			setSearchOpen(false);
			setSearchInput("");
		}
	}, [searchable, searchOpen, searchInput]);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (autoCompose) {
			setComposing(true);
			const params = new URLSearchParams(searchParams.toString());
			params.delete("compose");
			router.replace(`?${params.toString()}`);
		}
	}, [autoCompose, router, searchParams]);

	// Stable across renders so memoized rows don't re-render on every parent
	// state change (selecting a message, marking read, etc.).
	const openMessage = useCallback((id: string | null) => {
		if (id) {
			setReadIds((prev) => new Set(prev).add(id));
		}
		setSelectedMessageId(id);
	}, []);
	const selectMessage = useCallback(
		(id: string) => openMessage(id),
		[openMessage],
	);

	const handleMailboxSwitch = (id: string) => {
		setSelectedMailboxId(id);
		setSelectedMessageId(null);
		router.replace("?folder=inbox");
	};

	// Toggle the search bar. Opening focuses the input; collapsing clears the
	// query so the inbox returns to the full list.
	const toggleSearch = () => {
		setSearchOpen((open) => {
			const next = !open;
			if (next) {
				// Focus after the input mounts.
				requestAnimationFrame(() => searchInputRef.current?.focus());
			} else {
				setSearchInput("");
			}
			return next;
		});
	};
	const {
		data,
		isLoading,
		refetch,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
	} = useInboxMessagesQuery(
		selectedMailboxId,
		label ? "all" : folder,
		label,
		debouncedSearch,
	);

	const messages = data?.pages.flatMap((page) => page.messages) ?? [];

	// Pull the full account history into the local DB so the inbox can page all
	// the way back to the first email. The sync runs in the background on the
	// server; we trigger it once per mailbox and poll its progress.
	const triggerSync = useTriggerSyncMutation(selectedMailboxId);
	const { data: syncStatus } = useSyncStatusQuery(selectedMailboxId);
	// Trigger the historical sync once we know it is not yet complete. Keyed off
	// the status query (which reliably loads) rather than mount timing, and
	// guarded by a per-mailbox ref so it fires at most once per mailbox.
	const triggeredSyncFor = useRef<string | null>(null);
	useEffect(() => {
		if (
			selectedMailboxId &&
			syncStatus &&
			!syncStatus.complete &&
			triggeredSyncFor.current !== selectedMailboxId
		) {
			triggeredSyncFor.current = selectedMailboxId;
			triggerSync.mutate();
		}
	}, [selectedMailboxId, syncStatus, triggerSync]);

	// While the background sync is still pulling emails in, refetch the inbox as
	// the count grows so newly synced messages appear. Once the sync is complete
	// we stop — refetching a fully-loaded infinite list re-runs every page and
	// would fight with the user's scrolling.
	const lastSyncedCount = useRef(0);
	useEffect(() => {
		if (syncStatus?.complete) {
			return;
		}
		const count = syncStatus?.syncedCount ?? 0;
		if (count !== lastSyncedCount.current) {
			lastSyncedCount.current = count;
			refetch();
		}
	}, [syncStatus?.syncedCount, syncStatus?.complete, refetch]);

	// Auto-load the next page as the user scrolls near the bottom of the list,
	// so the inbox shows all emails — not just the first page — all the way back
	// to the first email in the account.
	//
	// We watch the scroll container directly (rather than an IntersectionObserver
	// on a sentinel) because it fires on EVERY scroll, so loading reliably
	// continues page after page. Latest fetch state is read from a ref so the
	// handler closure always sees current values.
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const fetchStateRef = useRef({
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
		fetchNextPage,
	});
	fetchStateRef.current = {
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
		fetchNextPage,
	};

	const maybeLoadMore = useCallback(() => {
		const el = scrollContainerRef.current;
		if (!el) {
			return;
		}
		const {
			hasNextPage,
			isFetchingNextPage,
			isFetchNextPageError,
			fetchNextPage,
		} = fetchStateRef.current;
		// Within 600px of the bottom → fetch the next page. Guards prevent
		// duplicate/looping calls while loading or after a failed page.
		const nearBottom =
			el.scrollHeight - el.scrollTop - el.clientHeight < 600;
		if (
			nearBottom &&
			hasNextPage &&
			!isFetchingNextPage &&
			!isFetchNextPageError
		) {
			fetchNextPage();
		}
	}, []);
	const syncMutation = useSyncInboxMutation(selectedMailboxId);

	// Pull newly-arrived mail into the DB, then refetch the list. Falls back to
	// a plain refetch if the sync call fails so the button is never a dead end.
	const handleRefresh = async () => {
		try {
			await syncMutation.mutateAsync();
		} catch {
			// Non-fatal — still refetch below
		}
		await refetch();
	};

	const isRefreshing = isFetching || syncMutation.isPending;

	// After each page settles (or the list height changes), re-check: if the new
	// page didn't fill the viewport, keep loading so the list always reaches the
	// bottom or runs out of emails.
	useEffect(() => {
		maybeLoadMore();
	}, [maybeLoadMore, messages.length, isFetchingNextPage]);

	const openCompose = (
		defaults: {
			to?: string;
			subject?: string;
			body?: string;
			bodyHtml?: string;
		} = {},
	) => {
		setEditingDraftId(null);
		setComposeDefaults(defaults);
		setComposing(true);
	};

	const openDraft = (draftId: string) => {
		setComposeDefaults({});
		setEditingDraftId(draftId);
		setComposing(true);
	};

	const closeCompose = () => {
		setComposing(false);
		setComposeDefaults({});
		setEditingDraftId(null);
	};

	if (!mounted) {
		return null;
	}

	if (!selectedMailboxId) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
				<InboxIcon className="size-12 opacity-30" />
				<p className="text-sm">No mailbox connected.</p>
			</div>
		);
	}

	return (
		<div className="-mx-4 -my-6 flex h-[calc(100vh-3.5rem)] overflow-hidden border border-border bg-card md:-mx-8 md:-my-8">
			<div
				className={cn(
					"flex flex-col border-r border-border h-full overflow-hidden bg-card",
					selectedMessageId
						? "hidden md:flex md:w-80 lg:w-96 shrink-0"
						: "flex-1",
				)}
			>
				<div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
					<div className="flex min-w-0 shrink-0 items-center gap-3">
						<div className="flex min-w-0 flex-col gap-0.5">
							<MailboxSwitcher onSwitch={handleMailboxSwitch} />
							<h1 className="min-w-0 truncate font-serif text-2xl font-normal leading-none">
								{folderLabel}
							</h1>
						</div>
						{syncStatus && !syncStatus.complete && (
							<p className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex">
								<RefreshCwIcon className="size-3 animate-spin" />
								Importing… {syncStatus.syncedCount}
							</p>
						)}
					</div>
					{searchOpen && (
						<div className="flex min-w-0 flex-1 justify-center">
							<div className="relative w-full max-w-2xl">
								<SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									ref={searchInputRef}
									type="text"
									value={searchInput}
									onChange={(e) =>
										setSearchInput(e.target.value)
									}
									onKeyDown={(e) => {
										if (e.key === "Escape") {
											toggleSearch();
										}
									}}
									placeholder="Search emails"
									aria-label="Search emails"
									className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-9 text-sm outline-none transition-colors focus:border-foreground/30"
								/>
								{searchInput && (
									<button
										type="button"
										onClick={() => {
											setSearchInput("");
											searchInputRef.current?.focus();
										}}
										aria-label="Clear search"
										className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									>
										<XIcon className="size-3.5" />
									</button>
								)}
							</div>
						</div>
					)}
					<div className="flex items-center gap-1 shrink-0 ml-2">
						{searchable && (
							<button
								type="button"
								onClick={toggleSearch}
								aria-label={
									searchOpen ? "Close search" : "Search"
								}
								className={cn(
									"rounded-full border border-transparent p-2 transition-colors hover:border-border hover:bg-muted",
									searchOpen
										? "border-border bg-muted text-foreground"
										: "text-muted-foreground",
								)}
							>
								{searchOpen ? (
									<XIcon className="size-4" />
								) : (
									<SearchIcon className="size-4" />
								)}
							</button>
						)}
						<button
							type="button"
							onClick={() => openCompose()}
							className="rounded-full border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-muted"
							aria-label="Compose"
						>
							<PencilIcon className="size-4" />
						</button>
						<button
							type="button"
							onClick={handleRefresh}
							disabled={isRefreshing}
							className="rounded-full border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-muted disabled:opacity-60"
							aria-label="Refresh"
						>
							<RefreshCwIcon
								className={cn(
									"size-4",
									isRefreshing && "animate-spin",
								)}
							/>
						</button>
					</div>
				</div>

				<div
					ref={scrollContainerRef}
					onScroll={maybeLoadMore}
					className="flex-1 overflow-y-auto bg-card"
				>
					{folder === "scheduled" ? (
						<ScheduledList mailboxId={selectedMailboxId} />
					) : folder === "drafts" ? (
						<DraftsList
							mailboxId={selectedMailboxId}
							onOpenDraft={openDraft}
						/>
					) : folder === "snoozed" ? (
						<SnoozedList mailboxId={selectedMailboxId} />
					) : isLoading ? (
						<div className="space-y-0">
							{Array.from({ length: 8 }).map((_, i) => (
								<div
									key={i}
									className="px-4 py-3 border-b border-border flex gap-3"
								>
									<Skeleton className="w-8 h-8 rounded-full shrink-0" />
									<div className="flex-1 space-y-1.5">
										<Skeleton className="h-3.5 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
										<Skeleton className="h-3 w-full" />
									</div>
								</div>
							))}
						</div>
					) : messages.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
							<MailOpenIcon className="size-8 opacity-30" />
							<p className="text-sm">
								{debouncedSearch.trim()
									? `No emails match "${debouncedSearch.trim()}"`
									: "No emails found"}
							</p>
						</div>
					) : (
						<>
							{messages.map((msg) => (
								<MessageListItem
									key={msg.id ?? ""}
									mailboxId={selectedMailboxId}
									message={
										msg as {
											id: string;
											from: string;
											subject: string;
											snippet: string;
											date: string;
											isUnread: boolean;
											labelIds?: string[];
											inTrash?: boolean;
										}
									}
									markedRead={readIds.has(msg.id ?? "")}
									isSelected={
										selectedMessageId === (msg.id ?? "")
									}
									onSelect={selectMessage}
								/>
							))}
							{/* Loading rows shown while the next page is fetching */}
							{isFetchingNextPage &&
								Array.from({ length: 3 }).map((_, i) => (
									<div
										key={i}
										className="flex gap-3 border-b border-border px-4 py-3"
									>
										<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
										<div className="flex-1 space-y-1.5">
											<Skeleton className="h-3.5 w-3/4" />
											<Skeleton className="h-3 w-1/2" />
										</div>
									</div>
								))}
							{isFetchNextPageError && (
								<div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
									<p className="text-sm text-muted-foreground">
										Couldn’t load more emails.
									</p>
									<Button
										variant="outline"
										size="sm"
										onClick={() => fetchNextPage()}
									>
										<RefreshCwIcon className="mr-2 size-3.5" />
										Try again
									</Button>
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{selectedMessageId ? (
				<MessageDetail
					mailboxId={selectedMailboxId}
					messageId={selectedMessageId}
					onBack={() => openMessage(null)}
					onReply={(to, subject) =>
						openCompose({ to, subject: `Re: ${subject}` })
					}
					onForward={(source) =>
						openCompose({
							subject: `Fwd: ${source.subject}`,
							bodyHtml: buildForwardHtml(source),
						})
					}
				/>
			) : null}

			{composing &&
				(editingDraftId ? (
					<DraftComposeLoader
						mailboxId={selectedMailboxId}
						draftId={editingDraftId}
						onClose={closeCompose}
					/>
				) : (
					<ComposeDialog
						mailboxId={selectedMailboxId}
						defaultTo={composeDefaults.to}
						defaultSubject={composeDefaults.subject}
						defaultBody={composeDefaults.body}
						defaultBodyHtml={composeDefaults.bodyHtml}
						onClose={closeCompose}
					/>
				))}
		</div>
	);
}
