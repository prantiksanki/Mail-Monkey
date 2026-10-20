import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { auth } from "@repo/auth";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { getBaseUrl } from "@repo/utils";
import { Hono } from "hono";

/**
 * Sign-in hand-off for the native mobile app (apps/mobile).
 *
 * Google only allows OAuth in the system browser, so the session cookie it
 * produces never reaches the app. This bridges it with PKCE (RFC 7636):
 *
 * 1. GET  /mobile-auth/start?provider&challenge — opened in the system
 *    browser; starts the normal Better Auth social sign-in (same scopes and
 *    consent as the web) with /mobile-auth/complete as the callback, and
 *    binds the challenge to this browser with a short-lived HttpOnly cookie.
 * 2. GET  /mobile-auth/complete?challenge — the browser now holds a session;
 *    store a single-use, short-lived code bound to the challenge and redirect
 *    to the fixed app URL mailmonkey://auth-callback?code=…
 * 3. POST /mobile-auth/exchange {code, verifier} — the app proves it started
 *    the flow (SHA-256(verifier) must equal the challenge) and receives the
 *    signed session token, used as `Authorization: Bearer …` (bearer plugin).
 *
 * An app that intercepts the custom-scheme redirect only sees the code, which
 * is useless without the verifier that never leaves the original app.
 */

export const MOBILE_REDIRECT_URI = "mailmonkey://auth-callback";

const CODE_TTL_MS = 2 * 60 * 1000;
const IDENTIFIER_PREFIX = "mobile-auth:";
const SUPPORTED_PROVIDERS = new Set(["google", "microsoft"]);
// base64url, 43 chars = 32 random bytes (challenge = SHA-256 digest)
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// RFC 7636 verifier: 43–128 unreserved characters
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// Ties /complete to a /start in the same browser (see /complete).
const FLOW_COOKIE = "mm_mobile_auth";
const FLOW_COOKIE_PATH = "/api/mobile-auth";
const FLOW_COOKIE_MAX_AGE_S = 10 * 60;

function flowCookie(challenge: string, secure: boolean): string {
	return `${FLOW_COOKIE}=${challenge}; Path=${FLOW_COOKIE_PATH}; Max-Age=${FLOW_COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function isValidChallenge(value: unknown): value is string {
	return typeof value === "string" && CHALLENGE_PATTERN.test(value);
}

export function isValidVerifier(value: unknown): value is string {
	return typeof value === "string" && VERIFIER_PATTERN.test(value);
}

export function isValidCode(value: unknown): value is string {
	return typeof value === "string" && CODE_PATTERN.test(value);
}

/** base64url(SHA-256(verifier)) — the S256 PKCE transform. */
export function challengeFromVerifier(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

export function verifierMatchesChallenge(
	verifier: string,
	challenge: string,
): boolean {
	const expected = Buffer.from(challengeFromVerifier(verifier));
	const actual = Buffer.from(challenge);
	return (
		expected.length === actual.length && timingSafeEqual(expected, actual)
	);
}

function codeIdentifier(code: string): string {
	return IDENTIFIER_PREFIX + createHash("sha256").update(code).digest("hex");
}

/** Only lowercase error codes reach the app, never free-form text. */
export function appRedirect(params: { code: string } | { error: string }) {
	const query =
		"code" in params
			? `code=${encodeURIComponent(params.code)}`
			: `error=${params.error.toLowerCase().replace(/[^a-z_]/g, "") || "unknown"}`;
	return `${MOBILE_REDIRECT_URI}?${query}`;
}

function readCookie(header: string | null, name: string): string | undefined {
	if (!header) {
		return undefined;
	}
	for (const part of header.split(";")) {
		const index = part.indexOf("=");
		if (index > 0 && part.slice(0, index).trim() === name) {
			const value = part.slice(index + 1).trim();
			try {
				return decodeURIComponent(value);
			} catch {
				return value;
			}
		}
	}
	return undefined;
}

export const mobileAuthRouter = new Hono()
	.get("/start", async (c) => {
		const provider = c.req.query("provider") ?? "google";
		const challenge = c.req.query("challenge");
		if (
			!SUPPORTED_PROVIDERS.has(provider) ||
			!isValidChallenge(challenge)
		) {
			return c.redirect(appRedirect({ error: "invalid_request" }));
		}

		const base = getBaseUrl();
		try {
			const response = await auth.api.signInSocial({
				body: {
					provider: provider as "google" | "microsoft",
					callbackURL: `${base}/api/mobile-auth/complete?challenge=${challenge}`,
					errorCallbackURL: `${base}/api/mobile-auth/error`,
				},
				headers: c.req.raw.headers,
				asResponse: true,
			});
			const { url } = (await response.json()) as { url?: string };
			if (!response.ok || !url) {
				return c.redirect(
					appRedirect({ error: "provider_unavailable" }),
				);
			}
			// Keep the OAuth state cookie(s) Better Auth set, so its callback
			// can verify the flow when the browser comes back.
			const redirect = new Response(null, {
				status: 302,
				headers: { Location: url },
			});
			for (const cookie of response.headers.getSetCookie()) {
				redirect.headers.append("Set-Cookie", cookie);
			}
			redirect.headers.append(
				"Set-Cookie",
				flowCookie(challenge, base.startsWith("https://")),
			);
			return redirect;
		} catch (error) {
			logger.error("[mobile-auth] failed to start social sign-in", {
				provider,
				error: error instanceof Error ? error.message : String(error),
			});
			return c.redirect(appRedirect({ error: "provider_unavailable" }));
		}
	})
	.get("/complete", async (c) => {
		const challenge = c.req.query("challenge");
		if (!isValidChallenge(challenge)) {
			return c.redirect(appRedirect({ error: "invalid_request" }));
		}

		// Only finish flows that /start began in this same browser — blocks a
		// link straight to /complete from minting a code for a signed-in user.
		const cookieHeader = c.req.header("cookie") ?? null;
		if (readCookie(cookieHeader, FLOW_COOKIE) !== challenge) {
			return c.redirect(appRedirect({ error: "invalid_request" }));
		}

		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		const { authCookies } = await auth.$context;
		const signedToken = readCookie(
			cookieHeader,
			authCookies.sessionToken.name,
		);
		if (!session || !signedToken) {
			return c.redirect(appRedirect({ error: "no_session" }));
		}

		const code = randomBytes(32).toString("base64url");
		await db.verification.create({
			data: {
				identifier: codeIdentifier(code),
				value: JSON.stringify({ token: signedToken, challenge }),
				expiresAt: new Date(Date.now() + CODE_TTL_MS),
			},
		});
		const done = c.redirect(appRedirect({ code }));
		done.headers.append(
			"Set-Cookie",
			`${FLOW_COOKIE}=; Path=${FLOW_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax`,
		);
		return done;
	})
	.get("/error", (c) =>
		c.redirect(
			appRedirect({ error: c.req.query("error") ?? "oauth_failed" }),
		),
	)
	.post("/exchange", async (c) => {
		const body = (await c.req.json().catch(() => null)) as {
			code?: unknown;
			verifier?: unknown;
		} | null;
		const invalid = () => c.json({ error: "invalid_grant" }, 400);
		if (
			!body ||
			!isValidCode(body.code) ||
			!isValidVerifier(body.verifier)
		) {
			return invalid();
		}

		const identifier = codeIdentifier(body.code);
		const record = await db.verification.findFirst({
			where: { identifier },
		});
		if (!record) {
			return invalid();
		}
		// Single use: burn the code before any further checks.
		await db.verification.deleteMany({ where: { identifier } });
		if (record.expiresAt.getTime() < Date.now()) {
			return invalid();
		}

		let stored: { token?: string; challenge?: string };
		try {
			stored = JSON.parse(record.value);
		} catch {
			return invalid();
		}
		if (
			!stored.token ||
			!stored.challenge ||
			!verifierMatchesChallenge(body.verifier, stored.challenge)
		) {
			return invalid();
		}
		return c.json({ token: stored.token });
	});
