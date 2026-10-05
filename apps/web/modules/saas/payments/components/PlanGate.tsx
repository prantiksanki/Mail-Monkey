"use client";

import type { PlanId } from "@repo/payments/config";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { ArrowRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const PLAN_HIERARCHY: Record<string, number> = {
	free: 0,
	pro: 1,
};

export function PlanGate({
	requiredPlan,
	organizationId,
	children,
	fallback,
}: {
	requiredPlan: PlanId;
	organizationId?: string;
	children: React.ReactNode;
	fallback?: React.ReactNode;
}) {
	const { activePlan } = usePurchases(organizationId);
	const currentLevel = PLAN_HIERARCHY[activePlan?.id ?? "free"] ?? 0;
	const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

	if (currentLevel >= requiredLevel) {
		return <>{children}</>;
	}
	return fallback ?? <UpgradeCard requiredPlan={requiredPlan} />;
}

export function UpgradeCard({ requiredPlan }: { requiredPlan: PlanId }) {
	const t = useTranslations();
	const router = useRouter();

	const planLabel =
		requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1);

	return (
		<Card className="p-6">
			<div className="flex flex-col items-center gap-3 text-center">
				<h4 className="font-semibold text-lg">
					{t("limits.upgrade.title")}
				</h4>
				<p className="text-sm text-muted-foreground">
					{t("limits.upgrade.planRequired", { plan: planLabel })}
				</p>
				<Button
					variant="primary"
					size="md"
					onClick={() => router.push("/app/settings/billing")}
				>
					{t("limits.upgrade.action")}
					<ArrowRightIcon className="ml-2 size-4" />
				</Button>
			</div>
		</Card>
	);
}
