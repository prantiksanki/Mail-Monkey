/**
 * Resolves a user-supplied redirect target (e.g. the `redirectTo` query param
 * on the login/signup flow) to a same-origin path, falling back to `fallback`
 * for anything else. Prevents an open redirect: without this, a crafted link
 * like `/auth/login?redirectTo=https://evil.example` would send an
 * authenticated user off-site immediately after login.
 *
 * Only a path starting with exactly one `/` is accepted — `//host/path` and
 * `/\host/path` are rejected too, since browsers treat both as
 * protocol-relative (i.e. an absolute URL to a different host).
 */
export function getSafeRedirectPath(
	candidate: string | null | undefined,
	fallback: string,
): string {
	if (!candidate) {
		return fallback;
	}
	if (candidate.includes("://")) {
		return fallback;
	}
	if (!candidate.startsWith("/") || /^[/\\]{2}/.test(candidate)) {
		return fallback;
	}
	return candidate;
}
