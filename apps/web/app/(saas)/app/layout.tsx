import { config as authConfig } from "@repo/auth/config";
import { config as paymentsConfig } from "@repo/payments/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { SubscriptionWarningBanner } from "@saas/payments/components/SubscriptionWarningBanner";
import { TrialEndedBanner } from "@saas/payments/components/TrialEndedBanner";
import { orpcClient } from "@shared/lib/orpc-client";
import { attemptAsync } from "es-toolkit";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Layout({ children }: PropsWithChildren) {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	if (authConfig.users.enableOnboarding && !session.user.onboardingComplete) {
		redirect("/onboarding");
	}

	// CASA 1.1.2: a system-generated initial password (see
	// tooling/scripts/src/create-user.ts) must be replaced before the account
	// can be used.
	if (session.user.mustChangePassword) {
		redirect("/force-password-change");
	}

	const organizations = await getOrganizationList();

	if (
		authConfig.organizations.enable &&
		authConfig.organizations.requireOrganization
	) {
		const organization =
			organizations.find(
				(org) => org.id === session?.session.activeOrganizationId,
			) || organizations[0];

		if (!organization) {
			redirect("/new-organization");
		}
	}

	// This app's `free` plan (packages/payments/config.ts) is a locked
	// fallback state, not a usable tier — an expired trial with no payment
	// falls back to it, but a user should never be able to enter /app on it.
	// So unlike the supastarter template default, the presence of a `free`
	// plan does NOT exempt a user from the active-plan check below.
	if (
		(authConfig.organizations.enable &&
			paymentsConfig.billingAttachedTo === "organization") ||
		paymentsConfig.billingAttachedTo === "user"
	) {
		const organizationId = authConfig.organizations.enable
			? session?.session.activeOrganizationId || organizations?.at(0)?.id
			: undefined;

		const [error, data] = await attemptAsync(() =>
			orpcClient.payments.listPurchases({
				organizationId,
			}),
		);

		if (error) {
			throw new Error("Failed to fetch purchases");
		}

		const purchases = data?.purchases ?? [];

		const { activePlan } = createPurchasesHelper(purchases);

		// createPurchasesHelper falls back to the locked `free` plan when
		// there's no real purchase, so `activePlan` alone isn't enough here —
		// exclude that fallback explicitly or it silently defeats the gate.
		if (!activePlan || activePlan.id === "free") {
			redirect("/choose-plan");
		}
	}

	return (
		<>
			<SubscriptionWarningBanner />
			<TrialEndedBanner />
			{children}
		</>
	);
}
