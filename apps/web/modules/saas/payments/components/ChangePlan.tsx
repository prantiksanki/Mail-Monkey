"use client";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useTranslations } from "next-intl";

export function ChangePlan({
	organizationId,
	userId,
}: {
	organizationId?: string;
	userId?: string;
}) {
	const t = useTranslations();
	const { activePlan } = usePurchases(organizationId);

	return (
		<SettingsItem
			title={t("settings.billing.changePlan.title")}
			description={t("settings.billing.changePlan.description")}
		>
			<PricingTable
				organizationId={organizationId}
				userId={userId}
				activePlanId={activePlan?.id}
			/>
		</SettingsItem>
	);
}
