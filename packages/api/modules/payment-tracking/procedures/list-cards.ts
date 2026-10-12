import { getPaymentCardsForBoard } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";
import type { PaymentCardListItem } from "../types";

const KANBAN_STATUSES = ["UPCOMING", "DUE_SOON", "OVERDUE", "PAID"] as const;

// Mirrors the values written by payment-classifier.ts (see the paymentType
// comment on the PaymentCard model in schema.prisma) — kept in sync by hand
// since the column itself is a plain String, not a DB enum.
const PAYMENT_TYPES = [
	"invoice",
	"bill",
	"subscription",
	"receipt",
	"reminder",
	"other",
] as const;

export const listCards = protectedProcedure
	.route({
		method: "GET",
		path: "/payment-tracking/cards",
		tags: ["Payment Tracking"],
		summary: "List payment cards for the Kanban board",
		description:
			"Returns lightweight payment-card metadata across all of the user's connected mailboxes (or one, if mailboxId is given), cursor-paginated.",
	})
	.input(
		z.object({
			kanbanStatus: z.enum(KANBAN_STATUSES).optional(),
			mailboxId: z.string().optional(),
			provider: z.enum(["GOOGLE", "OUTLOOK"]).optional(),
			paymentType: z.enum(PAYMENT_TYPES).optional(),
			merchant: z.string().optional(),
			search: z.string().optional(),
			dueDateFrom: z.string().optional(),
			dueDateTo: z.string().optional(),
			cursor: z.string().optional(),
			limit: z.number().min(1).max(100).default(50),
		}),
	)
	.handler(async ({ input, context }) => {
		if (input.mailboxId) {
			await verifyMailboxOwnership(input.mailboxId, context.user.id);
		}

		let cursor: { id: string; createdAt: Date } | undefined;
		if (input.cursor) {
			const [id, createdAtIso] = input.cursor.split("|");
			if (id && createdAtIso) {
				cursor = { id, createdAt: new Date(createdAtIso) };
			}
		}

		const cards = await getPaymentCardsForBoard(context.user.id, {
			kanbanStatus: input.kanbanStatus,
			mailboxId: input.mailboxId,
			provider: input.provider,
			paymentType: input.paymentType,
			merchant: input.merchant,
			search: input.search,
			dueDateFrom: input.dueDateFrom
				? new Date(input.dueDateFrom)
				: undefined,
			dueDateTo: input.dueDateTo ? new Date(input.dueDateTo) : undefined,
			cursor,
			limit: input.limit,
		});

		const items: PaymentCardListItem[] = cards.map((card) => ({
			id: card.id,
			mailboxId: card.mailboxId,
			provider: card.mailbox.provider,
			mailboxEmail: card.mailbox.email,
			emailId: card.emailId,
			threadId: card.threadId,
			subject: card.email.subject,
			from: card.email.from,
			fromEmail: card.email.fromEmail,
			receivedAt: card.email.internalDate.toISOString(),
			paymentType: card.paymentType,
			merchant: card.merchant,
			amount: card.amount,
			currency: card.currency,
			dueDate: card.dueDate ? card.dueDate.toISOString() : null,
			paymentStatus: card.paymentStatus,
			confidence: card.confidence,
			kanbanStatus: card.kanbanStatus,
			statusSource: card.statusSource,
		}));

		const last = cards.at(-1);
		const nextCursor =
			cards.length === input.limit && last
				? `${last.id}|${last.createdAt.toISOString()}`
				: undefined;

		return { cards: items, nextCursor };
	});
