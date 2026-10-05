import { createAvatarUploadUrl } from "./procedures/create-avatar-upload-url";
import { getConnectedMailboxes } from "./procedures/get-connected-mailboxes";

export const usersRouter = {
	avatarUploadUrl: createAvatarUploadUrl,
	listUserMailboxes: getConnectedMailboxes,
};
