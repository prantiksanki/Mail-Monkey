import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ApiRouterClient } from "@repo/api/orpc/router";
import { getBaseUrl } from "@repo/utils/lib/base-url";

function isRateLimitedError(
	error: unknown,
): error is { code: "RATE_LIMITED"; data?: { retryAfter?: number } } {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: unknown }).code === "RATE_LIMITED"
	);
}

const RATE_LIMIT_COPY: Record<
	"en" | "de",
	{ withSeconds: (s: number) => string; generic: string }
> = {
	en: {
		withSeconds: (s) =>
			`You're doing that too fast. Please wait ${s}s and try again.`,
		generic:
			"You're doing that too fast. Please wait a moment and try again.",
	},
	de: {
		withSeconds: (s) =>
			`Du machst das zu schnell. Bitte warte ${s}s und versuche es erneut.`,
		generic:
			"Du machst das zu schnell. Bitte warte einen Moment und versuche es erneut.",
	},
};

function readLocaleFromCookie(): "en" | "de" {
	const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
	return match?.[1] === "de" ? "de" : "en";
}

function surfaceRateLimitedToast(retryAfter: number | null): void {
	const copy = RATE_LIMIT_COPY[readLocaleFromCookie()];
	const message =
		retryAfter !== null ? copy.withSeconds(retryAfter) : copy.generic;
	void import("sonner").then(({ toast }) => toast.error(message));
}

// On the server, call the app's own API over loopback instead of its public
// domain: a self-call through the public hostname round-trips through
// Nginx/TLS and fails the whole page (see choose-plan 500s) on any blip in
// that path, even though the process is reachable on localhost the whole
// time.
function getRpcBaseUrl() {
	if (typeof window !== "undefined") {
		return getBaseUrl();
	}

	return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

const link = new RPCLink({
	url: `${getRpcBaseUrl()}/api/rpc`,
	headers: async () => {
		if (typeof window !== "undefined") {
			return {};
		}

		const { headers } = await import("next/headers");
		return Object.fromEntries(await headers());
	},
	interceptors: [
		onError((error) => {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}

			if (typeof window !== "undefined" && isRateLimitedError(error)) {
				const retryAfter =
					typeof error.data?.retryAfter === "number"
						? error.data.retryAfter
						: null;
				surfaceRateLimitedToast(retryAfter);
				return;
			}

			console.error(error);
		}),
	],
});

export const orpcClient: ApiRouterClient = createORPCClient(link);
