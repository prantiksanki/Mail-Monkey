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

export interface ImapMailboxInput {
	email: string;
	password: string;
	imapHost: string;
	imapPort: number;
	imapSecure: boolean;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
}

export const useConnectImapMailboxMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: ImapMailboxInput) => {
			return orpcClient.mailboxes.connectImap(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mailboxesQueryKey });
		},
	});
};

/**
 * Live-verifies IMAP/SMTP credentials with no account required — used by the
 * pre-signup "connect your custom email" flow (`/auth/connect-mailbox`) so a
 * visitor's connection details are confirmed working before we ever send
 * them a magic-link signup email. The verified credentials are persisted
 * server-side (see `finishPendingImap`); the mailbox row itself is only
 * created afterwards, once authenticated.
 */
export const useVerifyImapMailboxMutation = () => {
	return useMutation({
		mutationFn: async (input: ImapMailboxInput) => {
			return orpcClient.mailboxes.verifyImap(input);
		},
	});
};

/**
 * Finishes the pre-signup "connect your custom email" flow once the user is
 * authenticated — recovers verified credentials from the server-side
 * pending record (keyed by the signed-in user's email) and creates the
 * mailbox. A no-op (`connected: false`) if there's nothing pending, e.g. an
 * ordinary login. See PendingImapMailboxConnector.tsx.
 */
export const useFinishPendingImapMailboxMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			return orpcClient.mailboxes.finishPendingImap({});
		},
		onSuccess: (result) => {
			if (result.connected) {
				queryClient.invalidateQueries({ queryKey: mailboxesQueryKey });
			}
		},
	});
};
