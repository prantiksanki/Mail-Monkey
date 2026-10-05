"use client";

import Cookies from "js-cookie";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

const SIDEBAR_COLLAPSED_COOKIE = "sidebar-collapsed";
const sidebarCookieOptions = {
	expires: 365,
	path: "/",
	sameSite: "lax" as const,
	secure: process.env.NODE_ENV === "production",
};

interface SidebarContextValue {
	isCollapsed: boolean;
	setIsCollapsed: (collapsed: boolean) => void;
	toggleCollapsed: () => void;
	isMobileOpen: boolean;
	setIsMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(
	undefined,
);

export function SidebarProvider({ children }: { children: ReactNode }) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isMobileOpen, setIsMobileOpen] = useState(false);

	useEffect(() => {
		// Read from cookie on mount
		const cookieValue = Cookies.get(SIDEBAR_COLLAPSED_COOKIE);
		if (cookieValue !== undefined) {
			setIsCollapsed(cookieValue === "true");
		}
	}, []);

	const handleSetIsCollapsed = (collapsed: boolean) => {
		setIsCollapsed(collapsed);
		Cookies.set(SIDEBAR_COLLAPSED_COOKIE, collapsed ? "true" : "false", {
			...sidebarCookieOptions,
		});
	};

	const handleToggleCollapsed = () => {
		const newValue = !isCollapsed;
		setIsCollapsed(newValue);
		Cookies.set(SIDEBAR_COLLAPSED_COOKIE, newValue ? "true" : "false", {
			...sidebarCookieOptions,
		});
	};

	return (
		<SidebarContext.Provider
			value={{
				isCollapsed,
				setIsCollapsed: handleSetIsCollapsed,
				toggleCollapsed: handleToggleCollapsed,
				isMobileOpen,
				setIsMobileOpen,
			}}
		>
			{children}
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (context === undefined) {
		throw new Error("useSidebar must be used within a SidebarProvider");
	}
	return context;
}
