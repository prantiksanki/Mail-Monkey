"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

export const useInboxMessagesQuery = (
	mailboxId: string | null,
	folder: string,
	label?: string,
	search?: string,
) => {
	const trimmedSearch = search?.trim() || undefined;
	return useInfiniteQuery({
		queryKey: ["inbox", mailboxId, folder, label, trimmedSearch],
		queryFn: ({ pageParam }) =>
			orpcClient.mailboxes.inbox.list({
				mailboxId: mailboxId as string,
				folder,
				label,
				search: trimmedSearch,
				pageToken: pageParam,
				maxResults: 50,
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextPageToken,
		enabled: !!mailboxId,
		staleTime: 30_000,
	});
};

/**
 * Triggers the full historical email sync (fire-and-forget on the server). The
 * sync is idempotent — calling it when already complete is a no-op — so it is
 * safe to fire whenever the inbox opens.
 *
 * Must pass `mode: "full"`: only the full backfill walks the account all the way
 * back and sets `emailSyncComplete`. The default "recent" mode pulls just the
 * newest messages and never marks the sync complete, which would leave the inbox
 * stuck on "Importing…" forever and never populate older mail into the DB.
 */
export const useTriggerSyncMutation = (mailboxId: string | null) => {
	return useMutation({
		mutationFn: () =>
			orpcClient.mailboxes.inbox.sync({
				mailboxId: mailboxId as string,
				mode: "full",
			}),
	});
};

export const syncStatusQueryKey = (mailboxId: string | null) =>
	["sync-status", mailboxId] as const;

/**
 * Polls the historical-sync progress while it is running so the inbox can show
 * how many emails have been pulled in, and stops polling once complete.
 */
export const useSyncStatusQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: syncStatusQueryKey(mailboxId),
		queryFn: () =>
			orpcClient.mailboxes.inbox.syncStatus({
				mailboxId: mailboxId as string,
			}),
		enabled: !!mailboxId,
		// Poll every few seconds while the sync runs; stop once complete.
		refetchInterval: (query) => (query.state.data?.complete ? false : 4000),
	});
};

export const useSyncInboxMutation = (mailboxId: string | null) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			orpcClient.mailboxes.inbox.sync({
				mailboxId: mailboxId as string,
				mode: "recent",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
		},
	});
};

export const labelCountsQueryKey = (mailboxId: string | null) =>
	["label-counts", mailboxId] as const;

/**
 * Per-label email counts shown next to each label in the sidebar. Kept fresh but
 * lightly cached — counts drift slowly and a stale value for a few seconds is
 * fine.
 */
export const useLabelCountsQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: labelCountsQueryKey(mailboxId),
		queryFn: () =>
			orpcClient.mailboxes.inbox.labelCounts({
				mailboxId: mailboxId as string,
			}),
		enabled: !!mailboxId,
		staleTime: 30_000,
		// Mail can be read/moved/arrive outside this app; keep the badges honest.
		refetchInterval: 60_000,
		refetchOnWindowFocus: true,
	});
};

export const snoozedEmailsQueryKey = (mailboxId: string | null) =>
	["snoozed-emails", mailboxId] as const;

export const useSnoozedEmailsQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: snoozedEmailsQueryKey(mailboxId),
		queryFn: () =>
			orpcClient.mailboxes.inbox.listSnoozed({
				mailboxId: mailboxId as string,
			}),
		enabled: !!mailboxId,
		staleTime: 30_000,
	});
};

export const scheduledEmailsQueryKey = (mailboxId: string | null) =>
	["scheduled-emails", mailboxId] as const;

export const useScheduledEmailsQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: scheduledEmailsQueryKey(mailboxId),
		queryFn: () =>
			orpcClient.mailboxes.inbox.listScheduled({
				mailboxId: mailboxId as string,
			}),
		enabled: !!mailboxId,
		staleTime: 30_000,
	});
};

export const draftsQueryKey = (mailboxId: string | null) =>
	["drafts", mailboxId] as const;

export const useDraftsQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: draftsQueryKey(mailboxId),
		queryFn: () =>
			orpcClient.mailboxes.inbox.listDrafts({
				mailboxId: mailboxId as string,
			}),
		enabled: !!mailboxId,
		staleTime: 30_000,
	});
};

export const useCancelScheduledEmailMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			orpcClient.mailboxes.inbox.cancelScheduled({ mailboxId, id }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: scheduledEmailsQueryKey(mailboxId),
			});
		},
	});
};

export const useGetDraftQuery = (
	mailboxId: string | null,
	draftId: string | null,
) => {
	return useQuery({
		queryKey: ["draft", mailboxId, draftId],
		queryFn: () =>
			orpcClient.mailboxes.inbox.getDraft({
				mailboxId: mailboxId as string,
				draftId: draftId as string,
			}),
		enabled: !!mailboxId && !!draftId,
		staleTime: 0,
	});
};

export const useSaveDraftMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			draftId?: string;
			to?: string;
			cc?: string;
			bcc?: string;
			subject?: string;
			body?: string;
		}) => orpcClient.mailboxes.inbox.saveDraft({ mailboxId, ...input }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: draftsQueryKey(mailboxId),
			});
		},
	});
};

export const useSendDraftMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (draftId: string) =>
			orpcClient.mailboxes.inbox.sendDraft({ mailboxId, draftId }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: draftsQueryKey(mailboxId),
			});
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
		},
	});
};

export const useDeleteDraftMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (draftId: string) =>
			orpcClient.mailboxes.inbox.deleteDraft({ mailboxId, draftId }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: draftsQueryKey(mailboxId),
			});
		},
	});
};

export const useSnoozeMessageMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: { messageId: string; snoozeUntil: string }) =>
			orpcClient.mailboxes.inbox.snooze({ mailboxId, ...input }),
		onSuccess: (_data, input) => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(mailboxId),
			});
			queryClient.invalidateQueries({
				queryKey: snoozedEmailsQueryKey(mailboxId),
			});
			queryClient.removeQueries({
				queryKey: ["inbox-message", mailboxId, input.messageId],
			});
		},
	});
};

export const useCancelSnoozeMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			orpcClient.mailboxes.inbox.cancelSnooze({ mailboxId, id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(mailboxId),
			});
			queryClient.invalidateQueries({
				queryKey: snoozedEmailsQueryKey(mailboxId),
			});
		},
	});
};

export const useInboxMessageQuery = (
	mailboxId: string | null,
	messageId: string | null,
) => {
	return useQuery({
		queryKey: ["inbox-message", mailboxId, messageId],
		queryFn: () =>
			orpcClient.mailboxes.inbox.get({
				mailboxId: mailboxId as string,
				messageId: messageId as string,
			}),
		enabled: !!mailboxId && !!messageId,
		staleTime: 60_000,
	});
};

export const useMessageHeadersQuery = (
	mailboxId: string | null,
	messageId: string | null,
	enabled: boolean,
) => {
	return useQuery({
		queryKey: ["inbox-message-headers", mailboxId, messageId],
		queryFn: () =>
			orpcClient.mailboxes.inbox.headers({
				mailboxId: mailboxId as string,
				messageId: messageId as string,
			}),
		// Only fetched once the user opens the sender details popup.
		enabled: enabled && !!mailboxId && !!messageId,
		staleTime: 5 * 60_000,
	});
};

export const useArchiveMessageMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (messageId: string) =>
			orpcClient.mailboxes.inbox.archive({ mailboxId, messageId }),
		onSuccess: (_data, messageId) => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(mailboxId),
			});
			queryClient.removeQueries({
				queryKey: ["inbox-message", mailboxId, messageId],
			});
		},
	});
};

export const useTrashMessageMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (messageId: string) =>
			orpcClient.mailboxes.inbox.trash({ mailboxId, messageId }),
		onSuccess: (_data, messageId) => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(mailboxId),
			});
			queryClient.removeQueries({
				queryKey: ["inbox-message", mailboxId, messageId],
			});
		},
	});
};

/** Permanently deletes a message (used from the Trash folder). */
export const useDeleteMessageMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (messageId: string) =>
			orpcClient.mailboxes.inbox.delete({ mailboxId, messageId }),
		onSuccess: (_data, messageId) => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(mailboxId),
			});
			queryClient.removeQueries({
				queryKey: ["inbox-message", mailboxId, messageId],
			});
		},
	});
};

export const useMarkUnreadMessageMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (messageId: string) =>
			orpcClient.mailboxes.inbox.markUnread({ mailboxId, messageId }),
		onSuccess: (_data, messageId) => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(mailboxId),
			});
			queryClient.invalidateQueries({
				queryKey: ["inbox-message", mailboxId, messageId],
			});
		},
	});
};

export const useMarkReadMessageMutation = (mailboxId: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (messageId: string) =>
			orpcClient.mailboxes.inbox.markRead({ mailboxId, messageId }),
		onSuccess: (_data, messageId) => {
			queryClient.invalidateQueries({ queryKey: ["inbox", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(mailboxId),
			});
			// Patch the open message's cache in place instead of invalidating it.
			// Invalidating would refetch the message and hand the body iframe a new
			// srcDoc, causing a visible second load right after open. Only isUnread
			// changed, so update just that field.
			queryClient.setQueryData(
				["inbox-message", mailboxId, messageId],
				(old: { isUnread?: boolean } | undefined) =>
					old ? { ...old, isUnread: false } : old,
			);
		},
	});
};

/**
 * Generates three AI reply drafts (professional, friendly, formal) plus the
 * detected intent for the open email. Not cached — each call is an explicit
 * user action ("Generate draft" / "Regenerate").
 */
export const useGenerateDraftsMutation = (mailboxId: string) => {
	return useMutation({
		mutationFn: (input: {
			subject?: string;
			body: string;
			fromName?: string;
			fromEmail?: string;
			senderName?: string;
		}) => orpcClient.ai.generateDrafts({ mailboxId, ...input }),
	});
};

/**
 * Creates a meeting link (Google Meet, Zoom, Zoho Meeting, or Teams) via the
 * user's connected provider. Returns a classified result; the caller handles
 * `needsReconnect` by prompting the user to connect/reconnect the chosen provider.
 */
export const useCreateMeetingMutation = (mailboxId: string) => {
	return useMutation({
		mutationFn: (input: {
			provider?: "google" | "zoom" | "zoho" | "outlook";
			summary: string;
			startIso: string;
			endIso: string;
			attendees?: string[];
			description?: string;
		}) =>
			orpcClient.mailboxes.calendar.createMeeting({
				mailboxId,
				provider: input.provider ?? "google",
				summary: input.summary,
				startIso: input.startIso,
				endIso: input.endIso,
				attendees: input.attendees,
				description: input.description,
			}),
	});
};
