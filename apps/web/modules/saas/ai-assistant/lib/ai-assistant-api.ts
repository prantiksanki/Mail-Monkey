"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const conversationsQueryKey = (mailboxId: string | null) =>
	["ai-conversations", mailboxId] as const;

export const conversationQueryKey = (id: string | null) =>
	["ai-conversation", id] as const;

/** Lists the user's conversations for a mailbox (newest first). */
export const useConversationsQuery = (mailboxId: string | null) =>
	useQuery({
		queryKey: conversationsQueryKey(mailboxId),
		queryFn: () =>
			orpcClient.ai.listAiConversations({
				mailboxId: mailboxId as string,
			}),
		enabled: !!mailboxId,
		staleTime: 10_000,
	});

/** Fetches a single conversation with its message history. */
export const useConversationQuery = (id: string | null) =>
	useQuery({
		queryKey: conversationQueryKey(id),
		queryFn: () => orpcClient.ai.getAiConversation({ id: id as string }),
		enabled: !!id,
		staleTime: 0,
	});

export const useCreateConversationMutation = (mailboxId: string | null) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (title?: string) =>
			orpcClient.ai.createAiConversation({
				mailboxId: mailboxId as string,
				title,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: conversationsQueryKey(mailboxId),
			});
		},
	});
};

export const useRenameConversationMutation = (mailboxId: string | null) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, title }: { id: string; title: string }) =>
			orpcClient.ai.renameAiConversation({ id, title }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: conversationsQueryKey(mailboxId),
			});
		},
	});
};

export const useDeleteConversationMutation = (mailboxId: string | null) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => orpcClient.ai.deleteAiConversation({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: conversationsQueryKey(mailboxId),
			});
		},
	});
};
