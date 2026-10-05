"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useMailboxesQuery } from "./api";

const STORAGE_KEY = "zeromail.selectedMailboxId";

type SelectedMailboxContextType = {
	selectedMailboxId: string | null;
	setSelectedMailboxId: (id: string | null) => void;
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
	const [selectedMailboxId, setSelectedMailboxIdState] = useState<
		string | null
	>(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem(STORAGE_KEY) ?? null;
		}
		return null;
	});
	const { data: mailboxes = [] } = useMailboxesQuery();

	const setSelectedMailboxId = (id: string | null) => {
		setSelectedMailboxIdState(id);
		if (typeof window !== "undefined") {
			if (id) {
				localStorage.setItem(STORAGE_KEY, id);
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	};

	// Auto-select first mailbox when mailboxes load and nothing is selected or selection is stale
	useEffect(() => {
		if (mailboxes.length > 0) {
			if (
				!selectedMailboxId ||
				!mailboxes.some((m) => m.id === selectedMailboxId)
			) {
				setSelectedMailboxId(mailboxes[0].id);
			}
		} else if (selectedMailboxId) {
			setSelectedMailboxId(null);
		}
	}, [mailboxes, selectedMailboxId]);

	return (
		<SelectedMailboxContext.Provider
			value={{ selectedMailboxId, setSelectedMailboxId }}
		>
			{children}
		</SelectedMailboxContext.Provider>
	);
}
