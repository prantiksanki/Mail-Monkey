"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/** Fires a best-effort "profile viewed" analytics event once per page load. */
export function ProfileViewTracker({ username }: { username: string }) {
	const trackMutation = useMutation(
		orpc.creatorProfiles.trackProfileEvent.mutationOptions(),
	);
	const fired = useRef(false);

	useEffect(() => {
		if (fired.current) {
			return;
		}
		fired.current = true;
		trackMutation.mutate({ username, type: "VIEW" });
	}, [username]);

	return null;
}
