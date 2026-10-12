import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { isStagingEnvironment } from "@repo/utils";
import { getActiveOrganization } from "@saas/auth/lib/server";
import { ActivePlan } from "@saas/payments/components/ActivePlan";
import { ChangePlan } from "@saas/payments/components/ChangePlan";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { attemptAsync } from "es-toolkit";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.billing.title"),
	};
}

export default async function BillingSettingsPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;

	// No billing on staging — every user already has full paid access.
	if (isStagingEnvironment()) {
		redirect(`/app/${organizationSlug}/settings`);
	}

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const [error, purchasesData] = await attemptAsync(() =>
		orpcClient.payments.listPurchases({
			organizationId: organization.id,
		}),
	);

	if (error) {
		throw new Error("Failed to fetch purchases");
	}

	const purchases = purchasesData?.purchases ?? [];
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: orpc.payments.listPurchases.queryKey({
			input: {
				organizationId: organization.id,
			},
		}),
		queryFn: () => purchasesData,
	});

	const { activePlan } = createPurchasesHelper(purchases);

	return (
		<SettingsList>
			{activePlan && (
				<ActivePlan
					organizationId={organization.id}
					purchaseId={activePlan.purchaseId}
				/>
			)}
			<ChangePlan organizationId={organization.id} />
		</SettingsList>
	);
}
