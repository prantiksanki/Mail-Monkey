import { register } from "@repo/metrics";

// Gate via `Authorization: Bearer ${METRICS_SCRAPE_TOKEN}`, same convention
// as CRON_SECRET on the /api/internal/cron/* routes: unset token is a no-op
// (local dev keeps working unauthenticated), but every deployed environment
// must set METRICS_SCRAPE_TOKEN or this endpoint is public.
function isAuthorized(request: Request): boolean {
	const token = process.env.METRICS_SCRAPE_TOKEN;
	return !token || request.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(request: Request) {
	if (!isAuthorized(request)) {
		return new Response("Unauthorized", { status: 401 });
	}

	const metrics = await register.metrics();
	return new Response(metrics, {
		headers: { "Content-Type": register.contentType },
	});
}
