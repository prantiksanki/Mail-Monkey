import { ORPCError } from "@orpc/client";
import {
	createNotification,
	getPublicCreatorProfileByUsername,
	recordProfileEvent,
} from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";
import { publicProfileContactFormSchema } from "../types";

export const submitProfileContactForm = publicProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/{username}/contact",
		tags: ["Creator Profiles"],
		summary: "Send a message to a creator through their public profile",
	})
	.input(publicProfileContactFormSchema)
	.handler(async ({ input }) => {
		const profile = await getPublicCreatorProfileByUsername(input.username);

		if (!profile) {
			throw new ORPCError("NOT_FOUND");
		}

		try {
			await createNotification({
				userId: profile.id,
				type: "creator_profile_inquiry",
				title: `New message from ${input.name}`,
				body: `${input.message}\n\nReply to: ${input.email}`,
			});
			if (profile.creatorProfile) {
				await recordProfileEvent(profile.creatorProfile.id, "CONTACT");
			}
		} catch (error) {
			logger.error("Failed to submit profile contact form", {
				error,
				username: input.username,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
