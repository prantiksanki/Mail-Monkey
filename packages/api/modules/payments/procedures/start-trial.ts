import { ORPCError } from "@orpc/client";
import { createPurchase, getTrialPurchaseByUserId } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../lib/resolve-plan";
import {
	getStarterMonthlyProductId,
	TRIAL_CUSTOMER_ID,
	TRIAL_PERIOD_DAYS,
	trialSubscriptionId,
} from "../lib/trial";

export const startTrial = protectedProcedure
	.route({
		method: "POST",
		path: "/payments/start-trial",
		tags: ["Payments"],
		summary: "Start free trial",
		description:
			"Starts a card-free 7-day Starter trial for the current user. One trial per user.",
	})
	.input(z.object({}))
	.handler(async ({ context: { user } }) => {
		const productId = getStarterMonthlyProductId();
		if (!productId) {
			logger.error(
				"startTrial: Starter monthly productId is not configured",
			);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Trials are not available right now.",
			});
		}

		// Already on a paid (or trialing) plan — nothing to start.
		const currentPlan = await resolveUserPlan(user.id);
		if (currentPlan === "starter" || currentPlan === "pro") {
			throw new ORPCError("CONFLICT", {
				message: "You're already on a paid plan.",
			});
		}

		// One trial per user, even if it has already expired.
		const existingTrial = await getTrialPurchaseByUserId(user.id);
		if (existingTrial) {
			throw new ORPCError("CONFLICT", {
				message: "You've already used your free trial.",
			});
		}

		const trialEndsAt = new Date(
			Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000,
		);

		const purchase = await createPurchase({
			type: "SUBSCRIPTION",
			userId: user.id,
			customerId: TRIAL_CUSTOMER_ID,
			subscriptionId: trialSubscriptionId(user.id),
			productId,
			status: "trialing",
			trialEndsAt,
		});

		return { purchase, trialEndsAt };
	});
