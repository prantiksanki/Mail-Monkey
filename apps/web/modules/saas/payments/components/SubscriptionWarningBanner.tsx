"use client";

import { Button } from "@repo/ui/components/button";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { AlertTriangleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function SubscriptionWarningBanner({
	organizationId,
}: {
	organizationId?: string;
}) {
	const t = useTranslations();
	const router = useRouter();
	const { activePlan } = usePurchases(organizationId);

	if (!activePlan?.status) {
		return null;
	}
	if (!["past_due", "paused"].includes(activePlan.status)) {
		return null;
	}

	return (
		<div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
			<AlertTriangleIcon className="size-5 shrink-0 text-warning" />
			<p className="flex-1 text-sm text-warning-foreground/80">
				{t(
					`subscription.warning.${activePlan.status}` as
						| "subscription.warning.past_due"
						| "subscription.warning.paused",
				)}
			</p>
			<Button
				variant="secondary"
				size="sm"
				onClick={() => router.push("/app/settings/billing")}
			>
				{t("settings.billing.activePlan.title")}
			</Button>
		</div>
	);
}
