import { ORPCError } from "@orpc/client";
import {
	getCreatorProfileByUserId,
	getSimilarProfiles,
	getUserByUsername,
} from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";
import { getSimilarProfilesSchema } from "../types";

export const getSimilarProfilesProcedure = publicProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/{username}/similar",
		tags: ["Creator Profiles"],
		summary: "Get other directory-listed creators similar to this one",
	})
	.input(getSimilarProfilesSchema)
	.handler(async ({ input }) => {
		try {
			const user = await getUserByUsername(input.username);
			if (!user) {
				return [];
			}

			const profile = await getCreatorProfileByUserId(user.id);
			if (!profile?.directoryListed) {
				return [];
			}

			return await getSimilarProfiles(profile.id);
		} catch (error) {
			logger.error("Failed to fetch similar profiles", {
				error,
				username: input.username,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
