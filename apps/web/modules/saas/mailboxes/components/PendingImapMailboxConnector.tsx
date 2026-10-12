"use client";

import { useSession } from "@saas/auth/hooks/use-session";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useFinishPendingImapMailboxMutation } from "../lib/api";

/**
 * Finishes the pre-signup "connect your custom email" flow
 * (`/auth/connect-mailbox`): that page verifies IMAP/SMTP credentials with no
 * account yet and stashes them server-side (see `verifyImap` /
 * `finishPendingImap`), then sends a magic-link signup email. There is no
 * session at that point to create the mailbox row under, so it's deferred to
 * this component — mounted once, high up in the authenticated (saas) tree,
 * so it fires on whatever page the user actually lands on after clicking the
 * magic link (onboarding, choose-plan, or straight to /app/mailboxes),
 * rather than depending on a specific redirect target.
 *
 * The pending credentials live in a server-side record keyed by email (not
 * sessionStorage), so this works even when the magic link is opened on a
 * different browser/device than the one that submitted the connect form.
 */
export function PendingImapMailboxConnector() {
	const { user, loaded } = useSession();
	const router = useRouter();
	const pathname = usePathname();
	const finishPendingImap = useFinishPendingImapMailboxMutation();
	const attempted = useRef(false);

	useEffect(() => {
		if (!loaded || !user || attempted.current) {
			return;
		}
		attempted.current = true;

		finishPendingImap
			.mutateAsync()
			.then((result) => {
				if (!result.connected) {
					return;
				}
				toast.success(`${result.email} has been connected`);
				if (pathname !== "/app/mailboxes") {
					router.push("/app/mailboxes");
				}
			})
			.catch((error) => {
				toast.error(
					error instanceof Error
						? error.message
						: "Couldn't finish connecting your mailbox — add it again from Mailboxes.",
				);
			});
	}, [loaded, user]);

	return null;
}
