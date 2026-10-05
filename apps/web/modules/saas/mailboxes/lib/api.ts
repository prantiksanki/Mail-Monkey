import type { MailboxType } from "@repo/database/prisma/zod";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const mailboxesQueryKey = ["user", "mailboxes"] as const;

export const useMailboxesQuery = () => {
	return useQuery<MailboxType[], Error>({
		queryKey: mailboxesQueryKey,
		queryFn: async () => {
			try {
				const mailboxes = await orpcClient.users.listUserMailboxes();
				return mailboxes;
			} catch (error) {
				// Log error with context for debugging
				console.error("Failed to fetch user mailboxes:", error);

				// Re-throw to let React Query handle it
				throw error;
			}
		},
		// Retry configuration for transient failures
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

export const useDisconnectMailboxMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { mailboxId: string }) => {
			return orpcClient.mailboxes.disconnect(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mailboxesQueryKey });
			queryClient.invalidateQueries({ queryKey: ["mailbox"] });
		},
	});
};
