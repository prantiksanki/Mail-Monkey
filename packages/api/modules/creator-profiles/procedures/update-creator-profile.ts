import { ORPCError } from "@orpc/client";
import { upsertCreatorProfile } from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateCreatorProfileSchema } from "../types";

export const updateCreatorProfile = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/me",
		tags: ["Creator Profiles"],
		summary: "Update the current user's creator profile",
	})
	.input(updateCreatorProfileSchema)
	.handler(async ({ input, context }) => {
		try {
			await upsertCreatorProfile(context.user.id, input);
		} catch (error) {
			logger.error("Failed to update creator profile", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
