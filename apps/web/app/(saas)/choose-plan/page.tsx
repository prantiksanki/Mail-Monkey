import { config as authConfig } from "@repo/auth/config";
import { config as paymentsConfig } from "@repo/payments/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { Logo } from "@repo/ui";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { getPurchases } from "@saas/payments/lib/server";
import { ColorModeToggle } from "@shared/components/ColorModeToggle";
import { attemptAsync } from "es-toolkit";
import NextLink from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("choosePlan.title"),
	};
}

export default async function ChoosePlanPage() {
	const t = await getTranslations();
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	let organizationId: string | undefined;
	if (
		authConfig.organizations.enable &&
		paymentsConfig.billingAttachedTo === "organization"
	) {
		const organization = (await getOrganizationList()).at(0);

		if (!organization) {
			redirect("/new-organization");
		}

		organizationId = organization.id;
	}

	const [error, purchases] = await attemptAsync(() =>
		getPurchases(organizationId),
	);

	if (error || !purchases) {
		throw new Error("Failed to fetch purchases");
	}

	const { activePlan } = createPurchasesHelper(purchases);

	// createPurchasesHelper falls back to the locked `free` plan when there's
	// no real purchase — only a genuine paid plan should bounce back to /app,
	// or this would loop against the same check in app/layout.tsx.
	if (activePlan && activePlan.id !== "free") {
		redirect("/app");
	}

	return (
		<div className="min-h-screen w-full bg-background text-foreground">
			<div className="flex items-center justify-between px-6 py-6 md:px-10">
				<NextLink href="/" className="block">
					<Logo />
				</NextLink>
				<ColorModeToggle />
			</div>

			<main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
				<div className="mb-8 flex flex-col items-center gap-3 text-center">
					<span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
						Pricing
					</span>
					<h1 className="font-semibold text-3xl tracking-[-0.03em] text-foreground lg:text-4xl">
						{t("choosePlan.title")}
					</h1>
					<p className="max-w-md text-base text-muted-foreground">
						{t("choosePlan.description")}
					</p>
				</div>

				<PricingTable
					variant="marketing"
					{...(organizationId
						? {
								organizationId,
							}
						: {
								userId: session.user.id,
							})}
				/>

				<div className="mt-8 text-center">
					<NextLink
						href="/"
						className="text-muted-foreground text-sm underline-offset-4 hover:underline"
					>
						{t("choosePlan.continueFree")}
					</NextLink>
				</div>
			</main>
		</div>
	);
}
