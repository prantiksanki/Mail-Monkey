import { ORPCError } from "@orpc/client";
import {
	getCreatorProfileByUserId,
	getDailyProfileViews,
	getProfileAnalytics as getProfileAnalyticsQuery,
} from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";
import { getProfileAnalyticsSchema } from "../types";

export const getProfileAnalytics = protectedProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/me/analytics",
		tags: ["Creator Profiles"],
		summary:
			"Get view/contact/booking counts for the current user's profile",
	})
	.input(getProfileAnalyticsSchema)
	.handler(async ({ input, context }) => {
		try {
			const profile = await getCreatorProfileByUserId(context.user.id);
			if (!profile) {
				return { views: 0, contacts: 0, bookings: 0, dailyViews: [] };
			}

			const since = new Date(
				Date.now() - input.rangeDays * 24 * 60 * 60 * 1000,
			);

			const [summary, viewEvents] = await Promise.all([
				getProfileAnalyticsQuery(profile.id, since),
				getDailyProfileViews(profile.id, since),
			]);

			const dailyCounts = new Map<string, number>();
			for (const event of viewEvents) {
				const day = event.createdAt.toISOString().slice(0, 10);
				dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
			}

			return {
				...summary,
				dailyViews: Array.from(dailyCounts.entries()).map(
					([date, count]) => ({ date, count }),
				),
			};
		} catch (error) {
			logger.error("Failed to fetch profile analytics", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
