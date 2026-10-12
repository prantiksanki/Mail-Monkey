import { ORPCError } from "@orpc/client";
import { getUserById, upsertCreatorProfile } from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateMediaKitSchema } from "../types";

export const updateMediaKit = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/me/media-kit",
		tags: ["Creator Profiles"],
		summary: "Update the current user's media kit (Creator accounts only)",
	})
	.input(updateMediaKitSchema)
	.handler(async ({ input, context }) => {
		const user = await getUserById(context.user.id);
		if (user?.accountType !== "CREATOR") {
			throw new ORPCError("FORBIDDEN", {
				message: "Media kit is only available on Creator accounts.",
			});
		}

		try {
			await upsertCreatorProfile(context.user.id, input);
		} catch (error) {
			logger.error("Failed to update media kit", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
