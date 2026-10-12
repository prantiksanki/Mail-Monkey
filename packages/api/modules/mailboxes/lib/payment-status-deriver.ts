/**
 * Deterministic Kanban-column assignment for payment cards. Deliberately not
 * AI-driven: the classifier (payment-classifier.ts) only extracts raw facts
 * (dueDate, paymentStatus); this module owns the actual due/overdue/paid
 * business rule so it stays consistent, testable, and auditable regardless of
 * model behavior.
 */

export type PaymentKanbanStatus = "UPCOMING" | "DUE_SOON" | "OVERDUE" | "PAID";

const DUE_SOON_WINDOW_DAYS = 3;

function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function deriveKanbanStatus(input: {
	dueDate: Date | null | undefined;
	paymentStatus: string | null | undefined;
	now?: Date;
}): PaymentKanbanStatus {
	const now = input.now ?? new Date();

	// Checked first: a paid bill is never Overdue, even with a past due date.
	if (input.paymentStatus === "paid") {
		return "PAID";
	}

	if (!input.dueDate) {
		return "UPCOMING";
	}

	const today = startOfDay(now);
	const due = startOfDay(input.dueDate);

	if (due.getTime() < today.getTime()) {
		return "OVERDUE";
	}

	const dueSoonThreshold = new Date(today);
	dueSoonThreshold.setDate(dueSoonThreshold.getDate() + DUE_SOON_WINDOW_DAYS);

	// Due today falls in this range too (due >= today), per the confirmed rule
	// that a same-day due date counts as Due Soon, not Overdue.
	if (due.getTime() <= dueSoonThreshold.getTime()) {
		return "DUE_SOON";
	}

	return "UPCOMING";
}
