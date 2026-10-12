import { mergeDashboardSummaries } from "@saas/mailboxes/lib/aggregate";
import { orpcClient } from "@shared/lib/orpc-client";
import { useQueries, useQuery } from "@tanstack/react-query";

export const useDashboardSummaryQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: ["dashboard-summary", mailboxId ?? ""],
		queryFn: async () => {
			if (!mailboxId) {
				return null;
			}
			return orpcClient.mailboxes.dashboard.summary({ mailboxId });
		},
		enabled: !!mailboxId,
		refetchInterval: 30000,
	});
};

/**
 * Fetches the dashboard summary for every mailbox in `mailboxIds` in
 * parallel and merges them into one combined view — this is what backs the
 * "All mailboxes" option in the mailbox switcher. Pass an empty array to
 * disable (no requests are made).
 *
 * Reuses the same `["dashboard-summary", mailboxId]` query key as
 * {@link useDashboardSummaryQuery}, so switching between a single mailbox
 * and "All mailboxes" doesn't refetch data that's already cached.
 */
export const useAllMailboxesDashboardSummaryQuery = (mailboxIds: string[]) => {
	const results = useQueries({
		queries: mailboxIds.map((mailboxId) => ({
			queryKey: ["dashboard-summary", mailboxId],
			queryFn: () =>
				orpcClient.mailboxes.dashboard.summary({ mailboxId }),
			refetchInterval: 30000,
		})),
	});

	const isLoading = mailboxIds.length > 0 && results.some((r) => r.isLoading);
	const loaded = results
		.map((r) => r.data)
		.filter((d): d is NonNullable<typeof d> => !!d);

	return { data: mergeDashboardSummaries(loaded), isLoading };
};
