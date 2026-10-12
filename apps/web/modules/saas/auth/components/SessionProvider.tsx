"use client";
import { authClient } from "@repo/auth/client";
import { sessionQueryKey, useSessionQuery } from "@saas/auth/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionContext } from "../lib/session-context";

export function SessionProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	// `data: null` is a *successful* resolution meaning "no session" (e.g.
	// every signed-out visitor) — `loaded` must key off the query having
	// settled (`!isPending`), not off `session` being truthy, or anonymous
	// visitors never see `loaded: true`.
	const { data: session, isPending } = useSessionQuery();

	return (
		<SessionContext.Provider
			value={{
				loaded: !isPending,
				session: session?.session ?? null,
				user: session?.user ?? null,
				reloadSession: async () => {
					const { data: newSession, error } =
						await authClient.getSession({
							query: {
								disableCookieCache: true,
							},
						});

					if (error) {
						throw new Error(
							error.message || "Failed to fetch session",
						);
					}

					queryClient.setQueryData(sessionQueryKey, () => newSession);
				},
			}}
		>
			{children}
		</SessionContext.Provider>
	);
}
