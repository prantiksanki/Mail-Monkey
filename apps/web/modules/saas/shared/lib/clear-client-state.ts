import { SELECTED_MAILBOX_STORAGE_KEY } from "@saas/mailboxes/lib/selected-mailbox-context";

/**
 * Clears account-linked client-side storage. Call this right before
 * redirecting away on logout (or when revoking the current session), so a
 * shared browser profile doesn't retain the previous user's mailbox
 * selection after the next person signs in.
 */
export function clearClientStateOnLogout() {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.removeItem(SELECTED_MAILBOX_STORAGE_KEY);
}
