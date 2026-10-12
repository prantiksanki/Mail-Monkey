import { ORPCError } from "@orpc/client";
import {
	getCreatorProfileByUserId,
	getWeeklyAvailability,
	type ProfileDesign,
	type ProfileLink,
} from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";

export const getMyCreatorProfile = protectedProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/me",
		tags: ["Creator Profiles"],
		summary: "Get the current user's creator profile",
	})
	.handler(async ({ context }) => {
		try {
			const profile = await getCreatorProfileByUserId(context.user.id);
			const availability = profile
				? await getWeeklyAvailability(profile.id)
				: [];

			return {
				displayName: profile?.displayName ?? null,
				avatarUrl: profile?.avatarUrl ?? null,
				bio: profile?.bio ?? "",
				links: (profile?.links ?? []) as unknown as ProfileLink[],
				enabled: profile?.enabled ?? false,
				bookingEnabled: profile?.bookingEnabled ?? false,
				bookingTimezone: profile?.bookingTimezone ?? "Asia/Calcutta",
				meetingLengthMinutes: profile?.meetingLengthMinutes ?? 30,
				availability: availability.map((w) => ({
					dayOfWeek: w.dayOfWeek,
					startTime: w.startTime,
					endTime: w.endTime,
				})),
				accentColor: profile?.accentColor ?? "#6E3BFF",
				layout: profile?.layout ?? "STANDARD",
				design: (profile?.design ?? {}) as ProfileDesign,
				mediaKitEnabled: profile?.mediaKitEnabled ?? false,
				mediaKit: (profile?.mediaKit ?? {}) as {
					stats?: { label: string; value: string }[];
					collaborations?: { label: string; url?: string }[];
					rateCard?: { label: string; price: string }[];
				},
				tags: profile?.tags ?? [],
				directoryListed: profile?.directoryListed ?? false,
				paidBookingEnabled: profile?.paidBookingEnabled ?? false,
			};
		} catch (error) {
			logger.error("Failed to fetch creator profile", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
