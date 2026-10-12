import { ORPCError } from "@orpc/client";
import { upsertCreatorProfile } from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateBrandingSchema } from "../types";

export const updateBranding = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/me/branding",
		tags: ["Creator Profiles"],
		summary:
			"Update the current user's profile branding (accent color, layout, design)",
	})
	.input(updateBrandingSchema)
	.handler(async ({ input, context }) => {
		try {
			await upsertCreatorProfile(context.user.id, input);
		} catch (error) {
			logger.error("Failed to update branding", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
