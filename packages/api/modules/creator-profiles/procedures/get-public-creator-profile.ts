import { ORPCError } from "@orpc/client";
import {
	getPublicCreatorProfileByUsername,
	type ProfileDesign,
	type ProfileLink,
} from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

export const getPublicCreatorProfile = publicProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/{username}",
		tags: ["Creator Profiles"],
		summary: "Get a creator's public profile by username",
	})
	.input(z.object({ username: z.string().min(1) }))
	.handler(async ({ input }) => {
		try {
			const profile = await getPublicCreatorProfileByUsername(
				input.username,
			);

			if (!profile) {
				throw new ORPCError("NOT_FOUND");
			}

			return {
				name: profile.name,
				username: profile.username as string,
				image: profile.image,
				accountType: profile.accountType,
				bio: profile.creatorProfile?.bio ?? "",
				links: (profile.creatorProfile?.links ??
					[]) as unknown as ProfileLink[],
				bookingEnabled: profile.creatorProfile?.bookingEnabled ?? false,
				meetingLengthMinutes:
					profile.creatorProfile?.meetingLengthMinutes ?? 30,
				paidBookingEnabled:
					profile.creatorProfile?.paidBookingEnabled ?? false,
				accentColor: profile.creatorProfile?.accentColor ?? "#6E3BFF",
				layout: profile.creatorProfile?.layout ?? "STANDARD",
				design: (profile.creatorProfile?.design ?? {}) as ProfileDesign,
			};
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to fetch public creator profile", {
				error,
				username: input.username,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
