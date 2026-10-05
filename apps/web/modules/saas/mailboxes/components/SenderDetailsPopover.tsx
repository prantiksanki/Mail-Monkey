"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { Skeleton } from "@repo/ui/components/skeleton";
import { ChevronDownIcon, LockIcon, ShieldAlertIcon } from "lucide-react";
import { memo, useState } from "react";
import { useMessageHeadersQuery } from "../lib/inbox-api";

/** The minimal message fields the collapsed view falls back to before headers load. */
interface SenderFallback {
	from: string;
	fromEmail: string;
	to: string;
	subject: string;
	/** ISO date string. */
	date: string;
}

function formatDateTime(iso: string): string {
	try {
		return new Date(iso).toLocaleString([], {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return iso;
	}
}

/** A single label/value row in the expanded popup; renders nothing when empty. */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
	if (!value) {
		return null;
	}
	return (
		<div className="grid grid-cols-[5.5rem_1fr] gap-2 py-1 text-xs">
			<span className="text-right font-medium text-muted-foreground">
				{label}:
			</span>
			<span className="min-w-0 break-words text-foreground">{value}</span>
		</div>
	);
}

/**
 * Gmail-style "sender details" popover. Wraps a clickable trigger (the sender
 * block) and reveals detailed header metadata — fetched lazily the first time
 * the popup is opened.
 */
export const SenderDetailsPopover = memo(function SenderDetailsPopover({
	mailboxId,
	messageId,
	fallback,
	children,
}: {
	mailboxId: string;
	messageId: string;
	fallback: SenderFallback;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	// `open` gates the query so headers are only fetched on first interaction.
	const { data, isLoading, isError } = useMessageHeadersQuery(
		mailboxId,
		messageId,
		open,
	);

	const security = data?.security;
	const dateValue = data?.date || fallback.date;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Show sender details"
					className="group flex items-start gap-1 rounded-md text-left transition-colors hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
				>
					{children}
					<ChevronDownIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={8}
				className="w-[min(22rem,calc(100vw-2rem))]"
			>
				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="grid grid-cols-[5.5rem_1fr] gap-2"
							>
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-3/4" />
							</div>
						))}
					</div>
				) : isError ? (
					// Graceful degradation: show what we already know from the list.
					<div className="space-y-0.5">
						<DetailRow label="from" value={fallback.from} />
						<DetailRow label="to" value={fallback.to} />
						<DetailRow label="subject" value={fallback.subject} />
						<DetailRow
							label="date"
							value={
								fallback.date
									? formatDateTime(fallback.date)
									: undefined
							}
						/>
						<p className="pt-2 text-xs text-muted-foreground">
							Detailed headers are unavailable for this message.
						</p>
					</div>
				) : (
					<div className="space-y-0.5">
						<DetailRow
							label="from"
							value={data?.from || fallback.from}
						/>
						<DetailRow label="to" value={data?.to || fallback.to} />
						<DetailRow label="cc" value={data?.cc} />
						<DetailRow label="bcc" value={data?.bcc} />
						<DetailRow label="reply-to" value={data?.replyTo} />
						<DetailRow
							label="date"
							value={
								dateValue
									? formatDateTime(dateValue)
									: undefined
							}
						/>
						<DetailRow
							label="subject"
							value={data?.subject || fallback.subject}
						/>
						<DetailRow label="mailed-by" value={data?.mailedBy} />
						<DetailRow label="signed-by" value={data?.signedBy} />
						{security && (
							<div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs">
								{security.encrypted ? (
									<LockIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
								) : (
									<ShieldAlertIcon className="size-3.5 text-amber-500" />
								)}
								<span className="text-foreground">
									{security.label}
									{security.tls ? ` · ${security.tls}` : ""}
								</span>
							</div>
						)}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
});
