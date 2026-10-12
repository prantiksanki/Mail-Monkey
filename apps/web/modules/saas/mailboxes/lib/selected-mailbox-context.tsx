"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useMailboxesQuery } from "./api";

export const SELECTED_MAILBOX_STORAGE_KEY = "zeromail.selectedMailboxId";
const STORAGE_KEY = SELECTED_MAILBOX_STORAGE_KEY;

/**
 * The mailbox selection is either a real mailbox id, the special "all"
 * scope (combine every connected mailbox), or null (nothing to select yet).
 */
export const ALL_MAILBOXES_SCOPE = "all" as const;
export type MailboxScope = string | typeof ALL_MAILBOXES_SCOPE;

type SelectedMailboxContextType = {
	selectedMailboxId: MailboxScope | null;
	setSelectedMailboxId: (id: MailboxScope | null) => void;
};

export const SelectedMailboxContext = createContext<SelectedMailboxContextType>(
	{
		selectedMailboxId: null,
		setSelectedMailboxId: () => {},
	},
);

export const useSelectedMailbox = () => {
	return useContext(SelectedMailboxContext);
};

export function SelectedMailboxProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	// Initialize to null so the first server and client render agree. The
	// persisted selection is restored from localStorage after mount (below),
	// avoiding a hydration mismatch.
	const [selectedMailboxId, setSelectedMailboxIdState] =
		useState<MailboxScope | null>(null);
	const [hydrated, setHydrated] = useState(false);
	const { data: mailboxes = [], isLoading } = useMailboxesQuery();

	const setSelectedMailboxId = (id: MailboxScope | null) => {
		setSelectedMailboxIdState(id);
		if (typeof window !== "undefined") {
			if (id) {
				localStorage.setItem(STORAGE_KEY, id);
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	};

	// Restore the persisted selection on the client after mount.
	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			setSelectedMailboxIdState(stored);
		}
		setHydrated(true);
	}, []);

	// Auto-select the first mailbox once mailboxes load and nothing valid is
	// selected yet. Crucially, this waits for the mailboxes query to finish
	// loading before treating an empty list as "the user has zero mailboxes"
	// — otherwise, on the full-page reload that follows connecting a new
	// mailbox, the list is briefly empty while it refetches, which used to
	// wipe out a perfectly valid persisted selection and fall back to
	// whichever mailbox happened to load first.
	useEffect(() => {
		if (!hydrated || isLoading) {
			return;
		}
		if (mailboxes.length > 0) {
			const stillValid =
				selectedMailboxId === ALL_MAILBOXES_SCOPE ||
				mailboxes.some((m) => m.id === selectedMailboxId);
			if (!selectedMailboxId || !stillValid) {
				setSelectedMailboxId(mailboxes[0].id);
			}
		} else if (selectedMailboxId) {
			setSelectedMailboxId(null);
		}
	}, [mailboxes, selectedMailboxId, hydrated, isLoading]);

	return (
		<SelectedMailboxContext.Provider
			value={{ selectedMailboxId, setSelectedMailboxId }}
		>
			{children}
		</SelectedMailboxContext.Provider>
	);
}
