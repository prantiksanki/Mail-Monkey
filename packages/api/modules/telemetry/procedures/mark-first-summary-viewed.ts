import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import { markFirstSummaryViewed } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";

export const markFirstSummaryViewedProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/telemetry/first-summary-viewed",
		tags: ["Telemetry"],
		summary: "Record first AI summary view",
		description:
			"Idempotently records that the current user has viewed their first AI inbox summary and fires the once-per-lifetime `first_summary_viewed` GA4 conversion. Safe to call on every summary view - only the first call per user does anything.",
	})
	.handler(async ({ context }) => {
		const fired = await markFirstSummaryViewed(context.user.id);

		if (fired) {
			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "first_summary_viewed",
				userId: context.user.id,
				clientId,
				sessionId,
			});
		}

		return { fired };
	});
