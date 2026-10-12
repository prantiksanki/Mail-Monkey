"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PaymentKanbanStatus = "UPCOMING" | "DUE_SOON" | "OVERDUE" | "PAID";

export type PaymentType =
	| "invoice"
	| "bill"
	| "subscription"
	| "receipt"
	| "reminder"
	| "other";

/** Display order for payment-type filter chips and card badges. */
export const PAYMENT_TYPES: PaymentType[] = [
	"invoice",
	"bill",
	"subscription",
	"receipt",
	"reminder",
	"other",
];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
	invoice: "Invoice",
	bill: "Bill",
	subscription: "Subscription",
	receipt: "Receipt",
	reminder: "Reminder",
	other: "Payment",
};

export interface PaymentCardFilters {
	kanbanStatus?: PaymentKanbanStatus;
	mailboxId?: string;
	provider?: "GOOGLE" | "OUTLOOK";
	paymentType?: PaymentType;
	merchant?: string;
	search?: string;
	dueDateFrom?: string;
	dueDateTo?: string;
}

export type PaymentCardListItem = Awaited<
	ReturnType<typeof orpcClient.paymentTracking.cards.list>
>["cards"][number];

export type PaymentCardDetail = Awaited<
	ReturnType<typeof orpcClient.paymentTracking.cards.get>
>;

export const paymentCardsQueryKey = (filters: PaymentCardFilters) =>
	["payment-cards", filters] as const;

/**
 * Board-list query — polled rather than pushed over SSE, consistent with the
 * rest of the app's TanStack Query `refetchInterval` convention (e.g.
 * useSyncStatusQuery in inbox-api.ts). 15s is far less aggressive than the
 * 4s sync-status poll since payment data changes much less often.
 */
export const usePaymentCardsQuery = (filters: PaymentCardFilters) => {
	return useQuery({
		queryKey: paymentCardsQueryKey(filters),
		queryFn: () =>
			orpcClient.paymentTracking.cards.list({
				...filters,
				limit: 100,
			}),
		refetchInterval: 15_000,
		staleTime: 10_000,
	});
};

/** Full card detail, including the source email body — fetched only on expand. */
export const usePaymentCardQuery = (id: string | null) => {
	return useQuery({
		queryKey: ["payment-card", id],
		queryFn: () =>
			orpcClient.paymentTracking.cards.get({ id: id as string }),
		enabled: !!id,
		staleTime: 60_000,
	});
};

function base64ToBlob(base64: string, mimeType: string): Blob {
	const byteChars = atob(base64);
	const byteNumbers = new Array(byteChars.length);
	for (let i = 0; i < byteChars.length; i++) {
		byteNumbers[i] = byteChars.charCodeAt(i);
	}
	return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/**
 * Fetches an attachment's content and triggers a browser save — content is
 * never stored locally, so this hits the provider live on every download.
 */
export const useDownloadAttachmentMutation = () => {
	return useMutation({
		mutationFn: async (input: {
			cardId: string;
			attachmentId: string;
			filename: string;
			mimeType: string;
		}) => {
			const { base64Data } =
				await orpcClient.paymentTracking.cards.getAttachment({
					id: input.cardId,
					attachmentId: input.attachmentId,
				});
			const blob = base64ToBlob(base64Data, input.mimeType);
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = input.filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		},
	});
};

/**
 * Drag-and-drop persistence. Optimistically patches the card's column in the
 * cache so the drag feels instant, and rolls back on failure so the card
 * snaps back to its origin column.
 */
export const useUpdatePaymentCardStatusMutation = (
	filters: PaymentCardFilters,
) => {
	const queryClient = useQueryClient();
	const queryKey = paymentCardsQueryKey(filters);

	return useMutation({
		mutationFn: (input: {
			id: string;
			kanbanStatus: PaymentKanbanStatus;
		}) => orpcClient.paymentTracking.cards.updateStatus(input),
		onMutate: async (input) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData(queryKey);

			queryClient.setQueryData(
				queryKey,
				(
					old:
						| {
								cards: Array<{
									id: string;
									kanbanStatus: string;
								}>;
								nextCursor?: string;
						  }
						| undefined,
				) => {
					if (!old) {
						return old;
					}
					return {
						...old,
						cards: old.cards.map((card) =>
							card.id === input.id
								? {
										...card,
										kanbanStatus: input.kanbanStatus,
										statusSource: "MANUAL",
									}
								: card,
						),
					};
				},
			);

			return { previous };
		},
		onError: (_err, _input, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey });
		},
	});
};
