/**
 * Which deploy environment this process is — staging and production both run
 * with `NODE_ENV=production` (same Next.js build), so only an explicit env var
 * tells them apart. `NEXT_PUBLIC_APP_ENV` is used (rather than a server-only
 * `APP_ENV`) so this same check works in client components too, e.g. to hide
 * billing UI or skip loading analytics scripts on staging.
 *
 * Set `NEXT_PUBLIC_APP_ENV=staging` on the staging host only.
 */
export function getAppEnvironment(): string {
	return (
		process.env.NEXT_PUBLIC_APP_ENV?.trim() ||
		process.env.APP_ENV?.trim() ||
		process.env.NODE_ENV ||
		"development"
	);
}

/** True on the staging deploy — used to keep it free of billing/paywalls and out of analytics. */
export function isStagingEnvironment(): boolean {
	return getAppEnvironment() === "staging";
}
