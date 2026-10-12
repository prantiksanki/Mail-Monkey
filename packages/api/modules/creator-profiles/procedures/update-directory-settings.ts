import { ORPCError } from "@orpc/client";
import { upsertCreatorProfile } from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateDirectorySettingsSchema } from "../types";

export const updateDirectorySettings = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/me/directory",
		tags: ["Creator Profiles"],
		summary: "Update the current user's tags and directory listing status",
	})
	.input(updateDirectorySettingsSchema)
	.handler(async ({ input, context }) => {
		try {
			await upsertCreatorProfile(context.user.id, input);
		} catch (error) {
			logger.error("Failed to update directory settings", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
