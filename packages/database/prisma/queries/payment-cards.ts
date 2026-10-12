import { db } from "../client";

export type PaymentCardKanbanStatus =
	| "UPCOMING"
	| "DUE_SOON"
	| "OVERDUE"
	| "PAID";

export type PaymentCardStatusSource = "AUTOMATIC" | "MANUAL";

export interface PaymentCardUpsertData {
	userId: string;
	mailboxId: string;
	emailId: string;
	threadId: string;
	paymentType: string;
	merchant: string;
	amount?: number | null;
	currency?: string | null;
	dueDate?: Date | null;
	paymentStatus: string;
	confidence: number;
	kanbanStatus: PaymentCardKanbanStatus;
	statusSource: PaymentCardStatusSource;
}

export interface PaymentCardBoardFilters {
	kanbanStatus?: PaymentCardKanbanStatus;
	mailboxId?: string;
	provider?: "GOOGLE" | "OUTLOOK";
	paymentType?: string;
	merchant?: string;
	search?: string;
	dueDateFrom?: Date;
	dueDateTo?: Date;
	cursor?: { id: string; createdAt: Date };
	limit: number;
}

/** Upserts a PaymentCard keyed on (mailboxId, emailId) — the idempotency key. */
export async function upsertPaymentCard(data: PaymentCardUpsertData) {
	return db.paymentCard.upsert({
		where: {
			mailboxId_emailId: {
				mailboxId: data.mailboxId,
				emailId: data.emailId,
			},
		},
		create: data,
		update: data,
	});
}

/**
 * Updates only the descriptive fields extracted from a later re-classification
 * — never touches kanbanStatus/statusSource/manuallyOverriddenAt. Used when an
 * existing card has already been manually overridden by the user.
 */
export async function updatePaymentCardDetails(
	id: string,
	data: Pick<
		PaymentCardUpsertData,
		"paymentType" | "merchant" | "amount" | "currency" | "confidence"
	>,
) {
	return db.paymentCard.update({
		where: { id },
		data,
	});
}

export async function getPaymentCardByMailboxAndEmail(
	mailboxId: string,
	emailId: string,
) {
	return db.paymentCard.findUnique({
		where: { mailboxId_emailId: { mailboxId, emailId } },
	});
}

export async function getPaymentCardById(id: string, userId: string) {
	return db.paymentCard.findFirst({
		where: { id, userId },
	});
}

/**
 * Cursor-paginated board list, joined with the lightweight Email display
 * fields only — never bodyText/bodyHtml, so listing the board stays cheap
 * even with thousands of underlying emails.
 */
export async function getPaymentCardsForBoard(
	userId: string,
	filters: PaymentCardBoardFilters,
) {
	const { cursor, limit } = filters;

	const merchantClause = filters.merchant
		? {
				merchant: {
					contains: filters.merchant,
					mode: "insensitive" as const,
				},
			}
		: {};

	const dueDateClause =
		filters.dueDateFrom || filters.dueDateTo
			? {
					dueDate: {
						...(filters.dueDateFrom
							? { gte: filters.dueDateFrom }
							: {}),
						...(filters.dueDateTo
							? { lte: filters.dueDateTo }
							: {}),
					},
				}
			: {};

	const searchClause = filters.search
		? {
				OR: [
					{
						merchant: {
							contains: filters.search,
							mode: "insensitive" as const,
						},
					},
					{
						email: {
							subject: {
								contains: filters.search,
								mode: "insensitive" as const,
							},
						},
					},
				],
			}
		: {};

	return db.paymentCard.findMany({
		where: {
			userId,
			...(filters.kanbanStatus
				? { kanbanStatus: filters.kanbanStatus }
				: {}),
			...(filters.mailboxId ? { mailboxId: filters.mailboxId } : {}),
			...(filters.provider
				? { mailbox: { provider: filters.provider } }
				: {}),
			...(filters.paymentType
				? { paymentType: filters.paymentType }
				: {}),
			...merchantClause,
			...dueDateClause,
			...searchClause,
			...(cursor
				? {
						OR: [
							{ createdAt: { lt: cursor.createdAt } },
							{
								createdAt: cursor.createdAt,
								id: { lt: cursor.id },
							},
						],
					}
				: {}),
		},
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: limit,
		include: {
			mailbox: { select: { provider: true, email: true } },
			email: {
				select: {
					subject: true,
					from: true,
					fromEmail: true,
					to: true,
					internalDate: true,
				},
			},
		},
	});
}

export async function updatePaymentCardStatus(
	id: string,
	data: {
		kanbanStatus: PaymentCardKanbanStatus;
		statusSource: PaymentCardStatusSource;
		manuallyOverriddenAt?: Date | null;
	},
) {
	return db.paymentCard.update({
		where: { id },
		data,
	});
}

/** Emails not yet scanned for payment relevance (Email.paymentScanCategory is null). */
export async function getEmailsPendingPaymentScan(
	mailboxId: string,
	limit: number,
) {
	return db.email.findMany({
		where: { mailboxId, paymentScanCategory: null },
		orderBy: { internalDate: "desc" },
		take: limit,
	});
}

/** Distinct mailboxIds with at least one unscanned email — for the poller. */
export async function getMailboxIdsWithUnscannedEmails(
	limit: number,
): Promise<string[]> {
	const rows = await db.email.findMany({
		where: { paymentScanCategory: null },
		distinct: ["mailboxId"],
		select: { mailboxId: true },
		take: limit,
	});
	return rows.map((r) => r.mailboxId);
}

export async function markEmailPaymentScanCategory(
	id: string,
	category: "payment" | "not-payment",
) {
	return db.email.update({
		where: { id },
		data: { paymentScanCategory: category },
	});
}

/**
 * AUTOMATIC, unpaid cards with a due date — the only ones whose column can
 * drift purely from time passing (PAID never moves again; MANUAL is frozen
 * by definition; a null dueDate always derives to UPCOMING regardless of
 * "now", so it's excluded too). Used by the reposition poller.
 */
export async function getPaymentCardsForReposition(limit: number) {
	return db.paymentCard.findMany({
		where: {
			statusSource: "AUTOMATIC",
			kanbanStatus: { not: "PAID" },
			dueDate: { not: null },
		},
		take: limit,
		orderBy: { updatedAt: "asc" },
	});
}

export async function updatePaymentCardKanbanStatusOnly(
	id: string,
	kanbanStatus: PaymentCardKanbanStatus,
) {
	return db.paymentCard.update({
		where: { id },
		data: { kanbanStatus },
	});
}
