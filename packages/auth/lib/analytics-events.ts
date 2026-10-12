import { parseGaCookies, trackServerEvent } from "@repo/analytics";

/**
 * Server-side GA4 conversion events fired from better-auth database hooks.
 *
 * These run at the point the backend has *confirmed* the action (a user row was
 * created, a mailbox account was linked post-OAuth), so each fires exactly once
 * and cannot be lost to ad-blockers or abandoned OAuth redirects the way the
 * old client-side `trackEvent` calls could. Every call is fire-and-forget —
 * `trackServerEvent` never throws — so a GA outage can't break signup or OAuth.
 */

export interface GaAttribution {
	clientId?: string;
	sessionId?: string;
}

/**
 * Pull GA4 client/session ids from the request that triggered a database hook.
 * `context` is a better-auth `GenericEndpointContext` and is `undefined` when
 * the hook runs outside a request (e.g. a background token refresh) — callers
 * then get an empty attribution and the event is still counted, just not joined
 * to the visitor's web session.
 */
interface HookContext {
	headers?: Headers | null;
	path?: string;
	params?: Record<string, string | undefined> | null;
}

export function gaAttributionFromContext(
	context?: HookContext | null,
): GaAttribution {
	return parseGaCookies(context?.headers?.get("cookie"));
}

function deriveSignUpMethod(context?: HookContext | null): string {
	const path = context?.path ?? "";
	if (path.includes("/sign-up/email")) {
		return "email";
	}
	if (path.includes("magic-link")) {
		return "magic_link";
	}
	if (path.includes("/callback/")) {
		return context?.params?.id ?? "oauth";
	}
	return "unknown";
}

export async function trackSignUp(
	user: { id: string },
	context?: HookContext | null,
): Promise<void> {
	const attribution = gaAttributionFromContext(context);
	await trackServerEvent({
		name: "sign_up",
		userId: user.id,
		clientId: attribution.clientId,
		sessionId: attribution.sessionId,
		params: { method: deriveSignUpMethod(context) },
	});
}

// Each provider gets its own first-class key event so adoption can be compared
// per provider in GA4 without a third aggregate event. Covers both the mailbox
// providers (Gmail, Outlook) and the user-managed meeting integrations (Zoom,
// Zoho Meeting), which connect via Better Auth's genericOAuth link flow.
const MAILBOX_CONNECT_EVENT: Record<
	string,
	{ name: string; provider: string }
> = {
	google: { name: "gmail_connect", provider: "google" },
	microsoft: { name: "outlook_connect", provider: "outlook" },
	zoom: { name: "zoom_connect", provider: "zoom" },
	zoho: { name: "zoho_connect", provider: "zoho" },
	imap: { name: "imap_connect", provider: "imap" },
};

export async function trackMailboxConnect(
	input: { userId: string; providerId: string },
	attribution: GaAttribution,
): Promise<void> {
	const event = MAILBOX_CONNECT_EVENT[input.providerId];
	if (!event) {
		return;
	}
	await trackServerEvent({
		name: event.name,
		userId: input.userId,
		clientId: attribution.clientId,
		sessionId: attribution.sessionId,
		params: { provider: event.provider },
	});
}
