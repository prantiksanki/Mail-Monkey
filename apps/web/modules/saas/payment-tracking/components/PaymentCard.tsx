"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@repo/ui";
import { Badge } from "@repo/ui/components/badge";
import {
	PAYMENT_TYPE_LABELS,
	type PaymentCardListItem,
} from "@saas/payment-tracking/lib/payment-tracking-api";
import { MailIcon } from "lucide-react";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

function formatAmount(
	amount: number | null,
	currency: string | null,
): string | null {
	if (amount === null) {
		return null;
	}
	if (currency) {
		try {
			return new Intl.NumberFormat(undefined, {
				style: "currency",
				currency,
			}).format(amount);
		} catch {
			// Unrecognized currency code — fall through to plain formatting.
		}
	}
	return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Light per-card tint cycling through a fixed palette so adjacent cards read
// as visually distinct at a glance, even when several share the same payment
// type. Keyed by a hash of the card's id (stable across refetches/reorders)
// rather than payment type, so e.g. three invoices don't all look identical.
const CARD_COLOR_PALETTE = [
	"bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900",
	"bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
	"bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900",
	"bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
	"bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900",
	"bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900",
	"bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900",
	"bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:border-fuchsia-900",
];

function cardColorFor(id: string): string {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	const index = Math.abs(hash) % CARD_COLOR_PALETTE.length;
	return CARD_COLOR_PALETTE[index];
}

export function PaymentCard({
	card,
	onOpen,
	overlay = false,
}: {
	card: PaymentCardListItem;
	onOpen: (id: string) => void;
	overlay?: boolean;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: card.id, disabled: overlay });

	const style = overlay
		? undefined
		: {
				transform: CSS.Transform.toString(transform),
				transition,
			};

	const amountLabel = formatAmount(card.amount, card.currency);
	const isOverdue = card.kanbanStatus === "OVERDUE";

	return (
		<button
			type="button"
			ref={overlay ? undefined : setNodeRef}
			style={style}
			{...(overlay ? {} : attributes)}
			{...(overlay ? {} : listeners)}
			onClick={() => onOpen(card.id)}
			className={cn(
				"w-full cursor-pointer rounded-lg border p-3 text-left shadow-sm transition-shadow hover:shadow-md",
				cardColorFor(card.id),
				isDragging && !overlay && "invisible",
				overlay && "shadow-lg",
			)}
		>
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<span>Received: {formatDate(card.receivedAt)}</span>
				{card.dueDate && (
					<span
						className={cn(
							isOverdue && "font-semibold text-destructive",
						)}
					>
						Due: {formatDate(card.dueDate)}
					</span>
				)}
			</div>

			<h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-foreground">
				{card.subject}
			</h3>

			<div className="mt-2 flex items-center justify-between gap-2">
				{amountLabel && (
					<span className="text-base font-semibold text-foreground">
						{amountLabel}
					</span>
				)}
				<Badge status="info" className="shrink-0 normal-case">
					{(PAYMENT_TYPE_LABELS as Record<string, string>)[
						card.paymentType
					] ?? card.paymentType}
				</Badge>
			</div>

			<div className="mt-2 truncate text-xs text-muted-foreground">
				From: {card.merchant || card.fromEmail}
			</div>

			<div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
				<MailIcon className="size-3.5 shrink-0" />
				<span className="truncate">
					{card.provider === "GOOGLE" ? "Gmail" : "Outlook"} ·{" "}
					{card.mailboxEmail}
				</span>
			</div>
		</button>
	);
}
