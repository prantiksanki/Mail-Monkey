import { ORPCError } from "@orpc/client";
import {
	getPublicCreatorProfileByUsername,
	recordProfileEvent,
} from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";
import { trackProfileEventSchema } from "../types";

export const trackProfileEvent = publicProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/{username}/track",
		tags: ["Creator Profiles"],
		summary: "Record a profile view/contact/booking event for analytics",
	})
	.input(trackProfileEventSchema)
	.handler(async ({ input }) => {
		try {
			const profile = await getPublicCreatorProfileByUsername(
				input.username,
			);
			if (!profile?.creatorProfile) {
				// Don't leak whether a username exists via a distinguishable error;
				// tracking is best-effort, so just no-op.
				return;
			}

			await recordProfileEvent(profile.creatorProfile.id, input.type);
		} catch (error) {
			// Analytics must never break the page it's tracking.
			logger.error("Failed to record profile event", {
				error,
				username: input.username,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
