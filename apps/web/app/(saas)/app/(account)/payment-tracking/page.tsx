import { config as paymentsConfig } from "@repo/payments/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { isStagingEnvironment } from "@repo/utils";
import { KanbanBoard } from "@saas/payment-tracking/components/KanbanBoard";
import { ActivePlan } from "@saas/payments/components/ActivePlan";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { attemptAsync } from "es-toolkit";

export default async function PaymentTrackingRoute() {
	// No billing UI on staging or when the app is free for everyone.
	const showBilling = !isStagingEnvironment() && !paymentsConfig.freeAccess;

	let activePurchaseId: string | undefined;
	if (showBilling) {
		const [error, data] = await attemptAsync(() =>
			orpcClient.payments.listPurchases({}),
		);
		const purchases = error ? [] : (data?.purchases ?? []);

		await getServerQueryClient().prefetchQuery({
			queryKey: orpc.payments.listPurchases.queryKey({ input: {} }),
			queryFn: () => purchases,
		});

		activePurchaseId =
			createPurchasesHelper(purchases).activePlan?.purchaseId;
	}

	return (
		<>
			{activePurchaseId && (
				<div className="mb-8">
					<ActivePlan purchaseId={activePurchaseId} />
				</div>
			)}
			<KanbanBoard />
		</>
	);
}
