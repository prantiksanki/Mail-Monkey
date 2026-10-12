import { routing } from "@i18n/routing";
import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { withQuery } from "ufo";
import { config as appConfig } from "@/config";

const intlMiddleware = createMiddleware(routing);
const isDevelopment = process.env.NODE_ENV !== "production";

function resolveStorageOrigin(): string | null {
	// Azure Blob Storage: avatar uploads and signed downloads are served from
	// the account's blob endpoint, which must be allowed by the CSP so the
	// browser can PUT/GET directly against it.
	const azureAccount = process.env.AZURE_STORAGE_ACCOUNT;
	if (azureAccount) {
		return `https://${azureAccount}.blob.core.windows.net`;
	}

	const endpoint = process.env.S3_ENDPOINT;
	if (!endpoint) {
		return null;
	}
	try {
		return new URL(endpoint).origin;
	} catch {
		return null;
	}
}

const storageOrigin = resolveStorageOrigin();

function generateNonce(): string {
	return btoa(crypto.randomUUID());
}

function buildContentSecurityPolicy(nonce: string): string {
	return [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		[
			"script-src",
			"'self'",
			`'nonce-${nonce}'`,
			"'strict-dynamic'",
			...(isDevelopment ? ["'unsafe-eval'"] : []),
		].join(" "),
		"style-src 'self' 'unsafe-inline'",
		[
			"img-src",
			"'self'",
			"blob:",
			"data:",
			// Explicit allow-list matching `images.remotePatterns` in
			// next.config.ts — a bare `https:` here would let the browser
			// load an <img> from literally any HTTPS host (flagged by DAST
			// scanners as a CSP wildcard directive).
			"https://lh3.googleusercontent.com", // Google account profile photos
			"https://picsum.photos", // placeholder images
			"https://images.unsplash.com", // blog hero images
			"https://randomuser.me", // testimonial portraits
			"https://miro.medium.com", // blog posts cross-published from Medium
			...(storageOrigin ? [storageOrigin] : []),
		].join(" "),
		"font-src 'self' data:",
		[
			"connect-src",
			"'self'",
			"blob:",
			...(isDevelopment ? ["ws:", "wss:"] : []),
			"https://www.google-analytics.com",
			"https://*.google-analytics.com",
			"https://*.analytics.google.com",
			"https://www.googletagmanager.com",
			"https://i.posthog.com",
			"https://api.posthog.com",
			"https://plausible.io",
			"https://analytics.eu.umami.is",
			"https://api.pirsch.io",
			"https://*.enzuzo.com",
			...(storageOrigin ? [storageOrigin] : []),
		].join(" "),
		"frame-src 'self' https://www.googletagmanager.com",
		"media-src 'self' blob: data:",
		"worker-src 'self' blob:",
		"manifest-src 'self'",
		...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
	].join("; ");
}

export default async function proxy(req: NextRequest) {
	const { pathname, origin } = req.nextUrl;

	const nonce = generateNonce();
	const csp = buildContentSecurityPolicy(nonce);

	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-nonce", nonce);

	const withCsp = (response: NextResponse): NextResponse => {
		response.headers.set("Content-Security-Policy", csp);
		return response;
	};

	const sessionCookie = getSessionCookie(req);

	if (pathname.startsWith("/app")) {
		if (!appConfig.saas.enabled) {
			return withCsp(NextResponse.redirect(new URL("/", origin)));
		}

		if (!sessionCookie) {
			return withCsp(
				NextResponse.redirect(
					new URL(
						withQuery("/auth/login", {
							redirectTo: pathname,
						}),
						origin,
					),
				),
			);
		}

		return withCsp(
			NextResponse.next({ request: { headers: requestHeaders } }),
		);
	}

	if (pathname.startsWith("/auth")) {
		if (!appConfig.saas.enabled) {
			return withCsp(NextResponse.redirect(new URL("/", origin)));
		}

		return withCsp(
			NextResponse.next({ request: { headers: requestHeaders } }),
		);
	}

	const pathsWithoutLocale = [
		"/onboarding",
		"/new-organization",
		"/choose-plan",
		"/organization-invitation",
	];

	if (pathsWithoutLocale.some((path) => pathname.startsWith(path))) {
		return withCsp(
			NextResponse.next({ request: { headers: requestHeaders } }),
		);
	}

	if (!appConfig.marketing.enabled) {
		return withCsp(NextResponse.redirect(new URL("/app", origin)));
	}

	const intlReq = new NextRequest(req, { headers: requestHeaders });
	return withCsp(intlMiddleware(intlReq));
}

export const config = {
	matcher: [
		"/((?!api|image-proxy|images|fonts|lottie|_next/static|_next/image|favicon.ico|icon.png|opengraph-image|sitemap.xml|robots.txt|.well-known).*)",
	],
};
