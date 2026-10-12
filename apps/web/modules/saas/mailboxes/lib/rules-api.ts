import { orpcClient } from "@shared/lib/orpc-client";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { mergeMailboxStats } from "./aggregate";
import { labelCountsQueryKey } from "./inbox-api";

interface RuleMutationConditionInput {
	conditionalOperator?: string | null;
	aiInstructions?: string | null;
	static?: {
		from?: string | null;
		to?: string | null;
		subject?: string | null;
	} | null;
}

interface RuleMutationActionInput {
	type: string;
	fields?: Record<string, unknown>;
}

interface CreateRuleMutationInput {
	mailboxId: string;
	data: {
		name: string;
		condition: RuleMutationConditionInput;
		actions: RuleMutationActionInput[];
		enabled?: boolean;
	};
}

interface UpdateRuleMutationInput {
	mailboxId: string;
	id: string;
	data: {
		name?: string;
		condition?: RuleMutationConditionInput;
		actions?: RuleMutationActionInput[];
		enabled?: boolean;
	};
}

/**
 * Returns the server error message when a mutation failed because of a
 * CONFLICT (e.g. a rule with the same name already exists in the mailbox),
 * otherwise `undefined` so callers can fall back to a generic message.
 */
export const getConflictMessage = (error: unknown): string | undefined => {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code?: string }).code === "CONFLICT" &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}
	return undefined;
};

export const rulesQueryKey = (mailboxId: string) =>
	["mailbox", mailboxId, "rules"] as const;

export const useRulesQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: rulesQueryKey(mailboxId ?? ""),
		queryFn: async () => {
			if (!mailboxId) {
				return { rules: [] };
			}
			return orpcClient.mailboxes.rules.list({ mailboxId });
		},
		enabled: !!mailboxId,
	});
};

export interface TaggedRule {
	rule: NonNullable<
		Awaited<ReturnType<typeof orpcClient.mailboxes.rules.list>>["rules"]
	>[number];
	mailboxId: string;
	mailboxEmail: string;
	mailboxProvider: string;
}

/**
 * Fetches rules for every mailbox in `mailboxIds` in parallel and returns
 * them as one flat, mailbox-tagged list — backs the "All mailboxes" rules
 * view. A rule always belongs to exactly one mailbox (it watches that one
 * inbox via that provider's API), so unlike the dashboard summary this is a
 * concatenation, not a numeric merge.
 */
export const useAllMailboxesRulesQuery = (
	mailboxes: Array<{ id: string; email: string; provider: string }>,
) => {
	const results = useQueries({
		queries: mailboxes.map((m) => ({
			queryKey: rulesQueryKey(m.id),
			queryFn: () => orpcClient.mailboxes.rules.list({ mailboxId: m.id }),
		})),
	});

	const isLoading = mailboxes.length > 0 && results.some((r) => r.isLoading);
	const rules: TaggedRule[] = results.flatMap((r, i) => {
		const mailbox = mailboxes[i];
		return (r.data?.rules ?? []).map((rule) => ({
			rule,
			mailboxId: mailbox.id,
			mailboxEmail: mailbox.email,
			mailboxProvider: mailbox.provider,
		}));
	});

	return { rules, isLoading };
};

export const ruleSuggestionsQueryKey = (mailboxId: string) =>
	["mailbox", mailboxId, "rule-suggestions"] as const;

export const useRuleSuggestionsQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: ruleSuggestionsQueryKey(mailboxId ?? ""),
		queryFn: async () => {
			if (!mailboxId) {
				return { suggestions: [] };
			}
			return orpcClient.mailboxes.rules.suggestions({ mailboxId });
		},
		enabled: !!mailboxId,
		staleTime: 60000,
	});
};

export const useCreateRuleMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: CreateRuleMutationInput) => {
			return orpcClient.mailboxes.rules.create(
				input as Parameters<
					typeof orpcClient.mailboxes.rules.create
				>[0],
			);
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: rulesQueryKey(variables.mailboxId),
			});
			queryClient.invalidateQueries({
				queryKey: ruleSuggestionsQueryKey(variables.mailboxId),
			});
		},
	});
};

export const useUpdateRuleMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: UpdateRuleMutationInput) => {
			return orpcClient.mailboxes.rules.update(
				input as Parameters<
					typeof orpcClient.mailboxes.rules.update
				>[0],
			);
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: rulesQueryKey(variables.mailboxId),
			});
		},
	});
};

export const useDeleteRuleMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { mailboxId: string; id: string }) => {
			return orpcClient.mailboxes.rules.delete(input);
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: rulesQueryKey(variables.mailboxId),
			});
		},
	});
};

export const useToggleRuleMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			mailboxId: string;
			id: string;
			enabled: boolean;
		}) => {
			return orpcClient.mailboxes.rules.toggle(input);
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: rulesQueryKey(variables.mailboxId),
			});
		},
	});
};

export const useTestRuleMutation = () => {
	return useMutation({
		mutationFn: async (input: { mailboxId: string; id: string }) => {
			return orpcClient.mailboxes.rules.test(input);
		},
	});
};

export const useApplyRulesToRecentMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { mailboxId: string }) => {
			return orpcClient.mailboxes.rules.applyRecent(input);
		},
		onSuccess: (_data, variables) => {
			// Rules just labelled recent emails — refresh the sidebar counts.
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(variables.mailboxId),
			});
		},
	});
};

export const useCompileRulesMutation = () => {
	return useMutation({
		mutationFn: async (input: { mailboxId: string; prompt: string }) => {
			return orpcClient.mailboxes.rules.compile(input);
		},
	});
};

export const ruleBackfillQueryKey = (mailboxId: string, ruleId: string) =>
	["rule-backfill", mailboxId, ruleId] as const;

export const useRuleBackfillStatusQuery = (
	mailboxId: string | null,
	ruleId: string | null,
) => {
	return useQuery({
		queryKey: ruleBackfillQueryKey(mailboxId ?? "", ruleId ?? ""),
		queryFn: async () => {
			if (!mailboxId || !ruleId) {
				return { run: null };
			}
			return orpcClient.mailboxes.rules.backfill.status({
				mailboxId,
				ruleId,
			});
		},
		enabled: !!mailboxId && !!ruleId,
		refetchInterval: (query) => {
			const run = query.state.data?.run;
			return run && (run.status === "pending" || run.status === "running")
				? 2000
				: false;
		},
	});
};

export const useStartRuleBackfillMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			mailboxId: string;
			ruleId: string;
			windowMonths?: "1" | "3" | "6" | "12";
		}) => {
			return orpcClient.mailboxes.rules.backfill.start(input);
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: ruleBackfillQueryKey(
					data.run.mailboxId,
					data.run.ruleId,
				),
			});
		},
	});
};

export const useAdvanceRuleBackfillMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { mailboxId: string; runId: string }) => {
			return orpcClient.mailboxes.rules.backfill.advance(input);
		},
		onSuccess: (data) => {
			if (!data.run) {
				return;
			}
			queryClient.invalidateQueries({
				queryKey: ruleBackfillQueryKey(
					data.run.mailboxId,
					data.run.ruleId,
				),
			});
			// Backfill labels historical emails — keep sidebar counts fresh.
			queryClient.invalidateQueries({
				queryKey: labelCountsQueryKey(data.run.mailboxId),
			});
		},
	});
};

export const useWatchStatusQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: ["watch-status", mailboxId ?? ""],
		queryFn: async () => {
			if (!mailboxId) {
				return null;
			}
			return orpcClient.mailboxes.watch.status({ mailboxId });
		},
		enabled: !!mailboxId,
	});
};

export const useEnableWatchMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { mailboxId: string }) => {
			return orpcClient.mailboxes.watch.enable(input);
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["watch-status", variables.mailboxId],
			});
		},
	});
};

export const useDisableWatchMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { mailboxId: string }) => {
			return orpcClient.mailboxes.watch.disable(input);
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["watch-status", variables.mailboxId],
			});
		},
	});
};

export const useMailboxStatsQuery = (mailboxId: string | null) => {
	return useQuery({
		queryKey: ["mailbox-stats", mailboxId ?? ""],
		queryFn: async () => {
			if (!mailboxId) {
				return null;
			}
			return orpcClient.mailboxes.stats({ mailboxId });
		},
		enabled: !!mailboxId,
		refetchInterval: 30000,
	});
};

export const useAllMailboxesStatsQuery = (mailboxIds: string[]) => {
	const results = useQueries({
		queries: mailboxIds.map((mailboxId) => ({
			queryKey: ["mailbox-stats", mailboxId],
			queryFn: () => orpcClient.mailboxes.stats({ mailboxId }),
			refetchInterval: 30000,
		})),
	});

	const isLoading = mailboxIds.length > 0 && results.some((r) => r.isLoading);
	const loaded = results
		.map((r) => r.data)
		.filter((d): d is NonNullable<typeof d> => !!d);

	return { data: mergeMailboxStats(loaded), isLoading };
};

/** True if any connected mailbox currently has live watch enabled. */
export const useAllMailboxesWatchStatusQuery = (mailboxIds: string[]) => {
	const results = useQueries({
		queries: mailboxIds.map((mailboxId) => ({
			queryKey: ["watch-status", mailboxId],
			queryFn: () => orpcClient.mailboxes.watch.status({ mailboxId }),
		})),
	});

	return {
		isWatching: results.some((r) => r.data?.watchEnabled),
		isLoading: mailboxIds.length > 0 && results.some((r) => r.isLoading),
	};
};

export const useCalendarEventsQuery = (
	mailboxId: string | null,
	opts: { timeMin?: string; timeMax?: string } = {},
) => {
	return useQuery({
		queryKey: [
			"calendar-events",
			mailboxId ?? "",
			opts.timeMin ?? "",
			opts.timeMax ?? "",
		],
		queryFn: async () => {
			if (!mailboxId) {
				return null;
			}
			return orpcClient.mailboxes.calendar.events({
				mailboxId,
				...(opts.timeMin ? { timeMin: opts.timeMin } : {}),
				...(opts.timeMax ? { timeMax: opts.timeMax } : {}),
			});
		},
		enabled: !!mailboxId,
		refetchInterval: 5 * 60 * 1000,
		staleTime: 60 * 1000,
	});
};

export interface ExecutionLogsFilters {
	ruleId?: string;
	status?: "matched" | "not_matched" | "error";
	since?: string;
	search?: string;
}

export const useExecutionLogsQuery = (
	mailboxId: string | null,
	limit = 20,
	offset = 0,
	filters: ExecutionLogsFilters = {},
) => {
	const { ruleId, status, since, search } = filters;
	return useQuery({
		queryKey: [
			"execution-logs",
			mailboxId ?? "",
			limit,
			offset,
			ruleId ?? "",
			status ?? "",
			since ?? "",
			search ?? "",
		],
		queryFn: async () => {
			if (!mailboxId) {
				return { logs: [], total: 0 };
			}
			return orpcClient.mailboxes.executionLogs.list({
				mailboxId,
				limit,
				offset,
				...(ruleId ? { ruleId } : {}),
				...(status ? { status } : {}),
				...(since ? { since } : {}),
				...(search ? { search } : {}),
			});
		},
		enabled: !!mailboxId,
		refetchInterval: 30000,
	});
};
