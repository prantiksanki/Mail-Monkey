export const config = {
	billingAttachedTo: "user" as "user" | "organization", // 'users' or 'organizations'
	plans: {
		// The free plan is treated differently. It will automatically be assigned if the user has no other plan.
		free: {
			isFree: true,
			limits: {
				mailboxes: 1,
				rulesPerMailbox: 5,
				emailsProcessedPerMonth: 100,
				aiChat: false,
				ruleEngine: true,
			},
		},
		pro: {
			recommended: true,
			prices: [
				{
					type: "recurring",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY as string,
					interval: "month",
					amount: 9,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 0,
				},
				{
					type: "recurring",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_PRO_YEARLY as string,
					interval: "year",
					amount: 84,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 0,
				},
			],
			limits: {
				rulesPerMailbox: Number.POSITIVE_INFINITY,
				emailsProcessedPerMonth: 10000,
				aiChat: true,
				ruleEngine: true,
			},
		},
	},
} as const;

export type PlanId = keyof typeof config.plans;
