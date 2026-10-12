import { getSignedUploadUrl } from "@repo/storage";
import { protectedProcedure } from "../../../orpc/procedures";

export const createProfilePhotoUploadUrl = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/photo-upload-url",
		tags: ["Creator Profiles"],
		summary: "Create My Page profile photo upload URL",
		description:
			"Create a signed upload URL for the public My Page profile photo. Stored separately from the account avatar (`users.avatarUploadUrl`) so the two can differ.",
	})
	.handler(async ({ context: { user } }) => {
		const path = `profile-${user.id}.png`;
		const signedUploadUrl = await getSignedUploadUrl(path, {
			bucket: "avatars",
		});

		return { signedUploadUrl, path };
	});
