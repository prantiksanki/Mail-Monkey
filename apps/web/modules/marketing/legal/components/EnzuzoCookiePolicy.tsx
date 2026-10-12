"use client";

import { useEffect, useRef } from "react";

const enzuzoCookiebarId = process.env.NEXT_PUBLIC_ENZUZO_COOKIEBAR_ID;

// Enzuzo's embedded cookie policy. Its script fetches the policy HTML and
// inserts it directly after its own <script> tag, so the tag is appended
// inside this container on mount (a server-rendered tag would not re-run on
// client-side navigation). Uses the same account id as the cookie banner in
// the root layout.
export function EnzuzoCookiePolicy() {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !enzuzoCookiebarId) {
			return;
		}

		const script = document.createElement("script");
		script.id = "__enzuzo-root-script";
		script.src = `https://app.enzuzo.com/scripts/cookies/${enzuzoCookiebarId}`;
		container.appendChild(script);

		return () => {
			container.replaceChildren();
		};
	}, []);

	return <div id="__enzuzo-root" ref={containerRef} />;
}
