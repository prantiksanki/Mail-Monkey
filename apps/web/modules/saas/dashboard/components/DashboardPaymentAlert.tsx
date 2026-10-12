"use client";

import { cn } from "@repo/ui";
import type { PaymentCardListItem } from "@saas/payment-tracking/lib/payment-tracking-api";
import { usePaymentCardsQuery } from "@saas/payment-tracking/lib/payment-tracking-api";
import { AlertTriangleIcon, Clock3Icon } from "lucide-react";
import Link from "next/link";

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
			// Unrecognized currency code — fall through.
		}
	}
	return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDueDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

function nearestByDueDate(
	cards: PaymentCardListItem[],
): PaymentCardListItem | undefined {
	return [...cards].sort((a, b) => {
		if (!a.dueDate) {
			return 1;
		}
		if (!b.dueDate) {
			return -1;
		}
		return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
	})[0];
}

/**
 * Dashboard-level "something needs attention" banner for the Payments
 * feature. Only renders when there's an overdue or due-soon bill — mirrors
 * the rest of the dashboard's "nothing needed your attention" quiet-when-
 * clear convention, rather than always occupying a slot.
 */
export function DashboardPaymentAlert() {
	const { data } = usePaymentCardsQuery({});

	const overdue = (data?.cards ?? []).filter(
		(c) => c.kanbanStatus === "OVERDUE",
	);
	const dueSoon = (data?.cards ?? []).filter(
		(c) => c.kanbanStatus === "DUE_SOON",
	);

	if (overdue.length === 0 && dueSoon.length === 0) {
		return null;
	}

	const isOverdue = overdue.length > 0;
	const highlighted = nearestByDueDate(isOverdue ? overdue : dueSoon);
	const amountLabel = highlighted
		? formatAmount(highlighted.amount, highlighted.currency)
		: null;

	const headline = isOverdue
		? overdue.length === 1
			? `${highlighted?.merchant || "A bill"} is overdue`
			: `${overdue.length} bills are overdue`
		: dueSoon.length === 1
			? `${highlighted?.merchant || "A bill"} is due soon`
			: `${dueSoon.length} bills are due soon`;

	const detail = [
		amountLabel,
		highlighted?.dueDate
			? `due ${formatDueDate(highlighted.dueDate)}`
			: null,
	]
		.filter(Boolean)
		.join(" · ");

	const remainingCount = (isOverdue ? overdue.length : dueSoon.length) - 1;

	return (
		<Link
			href="/app/payment-tracking"
			className={cn(
				"flex items-center gap-4 rounded-[26px] border p-5 shadow-[0_18px_40px_rgba(15,23,42,0.03)] transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)]",
				isOverdue
					? "bg-destructive/10 border-destructive/30 hover:border-destructive dark:bg-card dark:border-destructive/50 dark:hover:border-destructive"
					: "bg-warning-soft border-[#73470D]/30 hover:border-[#73470D] dark:bg-card dark:border-warning/50 dark:hover:border-warning",
			)}
		>
			<div
				className={cn(
					"flex size-11 shrink-0 items-center justify-center rounded-2xl text-white",
					isOverdue
						? "bg-destructive"
						: "bg-[#73470D] dark:bg-warning",
				)}
			>
				{isOverdue ? (
					<AlertTriangleIcon className="size-5" />
				) : (
					<Clock3Icon className="size-5" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p
					className={cn(
						"font-mono text-[11px] uppercase tracking-[0.24em]",
						isOverdue
							? "text-destructive"
							: "text-[#73470D] dark:text-warning",
					)}
				>
					{isOverdue ? "Payment overdue" : "Payment due soon"}
				</p>
				<p className="mt-1 text-[15px] text-foreground/80 leading-6">
					{headline}
					{detail && (
						<span className="text-foreground/55"> — {detail}</span>
					)}
					{remainingCount > 0 && ` (+${remainingCount} more)`}
				</p>
			</div>
		</Link>
	);
}
