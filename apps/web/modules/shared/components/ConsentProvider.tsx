"use client";

import Cookies from "js-cookie";
import { createContext, useState } from "react";

const cookieOptions = {
	expires: 30,
	path: "/",
	sameSite: "lax" as const,
	secure: process.env.NODE_ENV === "production",
};

export const ConsentContext = createContext<{
	userHasConsented: boolean;
	allowCookies: () => void;
	declineCookies: () => void;
}>({
	userHasConsented: false,
	allowCookies: () => {},
	declineCookies: () => {},
});

export function ConsentProvider({
	children,
	initialConsent,
}: {
	children: React.ReactNode;
	initialConsent?: boolean;
}) {
	const [userHasConsented, setUserHasConsented] = useState(!!initialConsent);

	const allowCookies = () => {
		Cookies.set("consent", "true", cookieOptions);
		setUserHasConsented(true);
	};

	const declineCookies = () => {
		Cookies.set("consent", "false", cookieOptions);
		setUserHasConsented(false);
	};

	return (
		<ConsentContext.Provider
			value={{ userHasConsented, allowCookies, declineCookies }}
		>
			{children}
		</ConsentContext.Provider>
	);
}
