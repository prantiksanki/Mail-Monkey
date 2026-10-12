"use client";

import { Alert, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { CheckCircleIcon, XCircleIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function CancelBookingCard() {
	const t = useTranslations();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const cancelMutation = useMutation(
		orpc.creatorProfiles.cancelBooking.mutationOptions(),
	);

	if (!token) {
		return (
			<Alert variant="error">
				<XCircleIcon />
				<AlertTitle>
					{t("profile.booking.cancelPage.missingToken")}
				</AlertTitle>
			</Alert>
		);
	}

	if (cancelMutation.isSuccess) {
		return (
			<Alert variant="success">
				<CheckCircleIcon />
				<AlertTitle>
					{t("profile.booking.cancelPage.success")}
				</AlertTitle>
			</Alert>
		);
	}

	if (cancelMutation.isError) {
		return (
			<Alert variant="error">
				<XCircleIcon />
				<AlertTitle>{t("profile.booking.cancelPage.error")}</AlertTitle>
			</Alert>
		);
	}

	return (
		<div className="rounded-2xl border border-border bg-card p-6 text-center">
			<h1 className="mb-2 font-semibold text-lg">
				{t("profile.booking.cancelPage.title")}
			</h1>
			<p className="mb-6 text-foreground/60 text-sm">
				{t("profile.booking.cancelPage.description")}
			</p>
			<Button
				variant="destructive"
				loading={cancelMutation.isPending}
				onClick={() => cancelMutation.mutate({ cancelToken: token })}
			>
				{t("profile.booking.cancelPage.confirm")}
			</Button>
		</div>
	);
}
