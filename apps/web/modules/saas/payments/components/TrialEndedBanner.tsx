"use client";

import { Button } from "@repo/ui/components/button";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const TRIAL_ENDED_TYPE = "trial_ended";

export function TrialEndedBanner() {
	const t = useTranslations();
	const router = useRouter();
	const queryClient = useQueryClient();
	const toastedRef = useRef(false);

	const { data } = useQuery(
		orpc.notifications.listNotifications.queryOptions({ input: {} }),
	);

	const markReadMutation = useMutation(
		orpc.notifications.markRead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.notifications.listNotifications.key(),
				});
			},
		}),
	);

	const notification = data?.notifications.find(
		(n) => n.type === TRIAL_ENDED_TYPE,
	);

	// Fire a one-time toast the first render this notification is present.
	useEffect(() => {
		if (notification && !toastedRef.current) {
			toastedRef.current = true;
			toast.error(t("trial.ended.toast"), {
				action: {
					label: t("trial.ended.action"),
					onClick: () => router.push("/app/settings/billing"),
				},
			});
		}
	}, [notification, router, t]);

	if (!notification) {
		return null;
	}

	return (
		<div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
			<AlertTriangleIcon className="size-5 shrink-0 text-warning" />
			<p className="flex-1 text-sm text-warning-foreground/80">
				{notification.body}
			</p>
			<Button
				variant="secondary"
				size="sm"
				onClick={() => router.push("/app/settings/billing")}
			>
				{t("trial.ended.action")}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				disabled={markReadMutation.isPending}
				onClick={() => markReadMutation.mutate({ id: notification.id })}
			>
				{t("trial.ended.dismiss")}
			</Button>
		</div>
	);
}
