import { acceptBooking } from "./procedures/accept-booking";
import { cancelBooking } from "./procedures/cancel-booking";
import { createBooking } from "./procedures/create-booking";
import { createPaidBookingCheckout } from "./procedures/create-paid-booking-checkout";
import { createProfilePhotoUploadUrl } from "./procedures/create-profile-photo-upload-url";
import { declineBooking } from "./procedures/decline-booking";
import { getAvailableSlots } from "./procedures/get-available-slots";
import { getDirectoryTags } from "./procedures/get-directory-tags";
import { getMyCreatorProfile } from "./procedures/get-my-creator-profile";
import { getProfileAnalytics } from "./procedures/get-profile-analytics";
import { getPublicCreatorProfile } from "./procedures/get-public-creator-profile";
import { getSimilarProfilesProcedure } from "./procedures/get-similar-profiles";
import { listDirectory } from "./procedures/list-directory";
import { listMyBookings } from "./procedures/list-my-bookings";
import { submitProfileContactForm } from "./procedures/submit-profile-contact-form";
import { trackProfileEvent } from "./procedures/track-profile-event";
import { updateBookingSettings } from "./procedures/update-booking-settings";
import { updateBranding } from "./procedures/update-branding";
import { updateCreatorProfile } from "./procedures/update-creator-profile";
import { updateDirectorySettings } from "./procedures/update-directory-settings";
import { updateMediaKit } from "./procedures/update-media-kit";
import { updatePaidBookingSettings } from "./procedures/update-paid-booking-settings";

export const creatorProfilesRouter = {
	me: getMyCreatorProfile,
	update: updateCreatorProfile,
	photoUploadUrl: createProfilePhotoUploadUrl,
	updateBookingSettings,
	updateBranding,
	updateMediaKit,
	updateDirectorySettings,
	updatePaidBookingSettings,
	getByUsername: getPublicCreatorProfile,
	submitContactForm: submitProfileContactForm,
	getAvailableSlots,
	createBooking,
	createPaidBookingCheckout,
	cancelBooking,
	acceptBooking,
	declineBooking,
	listMyBookings,
	getProfileAnalytics,
	trackProfileEvent,
	listDirectory,
	getDirectoryTags,
	getSimilarProfiles: getSimilarProfilesProcedure,
};
