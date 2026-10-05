"use client";

import { cn } from "@repo/ui";
import { SelectedMailboxProvider } from "@saas/mailboxes/lib/selected-mailbox-context";
import { NavBar } from "@saas/shared/components/NavBar";
import type { PropsWithChildren } from "react";
import { config } from "@/config";
import { SidebarProvider } from "../lib/sidebar-context";

function AppContent({ children }: PropsWithChildren) {
	const { useSidebarLayout } = config.saas;

	return (
		<div className="bg-background h-screen overflow-hidden">
			<NavBar />
			<div
				className={cn("flex h-screen", {
					"md:ml-[var(--sidebar-width)]": useSidebarLayout,
				})}
			>
				{/* Mobile top-bar offset */}
				<main className="relative flex-1 min-w-0 w-0 bg-background overflow-hidden mt-14 md:mt-0">
					<div className="h-full overflow-auto px-4 py-6 md:p-8">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}

export function AppWrapper({ children }: PropsWithChildren) {
	return (
		<SidebarProvider>
			<SelectedMailboxProvider>
				<AppContent>{children}</AppContent>
			</SelectedMailboxProvider>
		</SidebarProvider>
	);
}
