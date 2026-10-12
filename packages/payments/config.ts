export const config = {
	billingAttachedTo: "user" as "user" | "organization", // 'users' or 'organizations'
	// When true, every user gets the top plan (Pro) without paying, so the app
	// is fully free and checkout / the /choose-plan redirect are bypassed — for
	// EVERY provider (Gmail, Outlook and custom email alike). Set to false to
	// require a Starter/Pro plan or active trial again.
	freeAccess: true,
	plans: {
		// The free plan is treated differently. It will automatically be assigned if the user has no other plan.
		// There is no usable free tier in this pricing model — both paid plans are
		// trial-only, and an expired trial with no payment falls back to this
		// locked (read-only) state rather than a real free plan.
		free: {
			isFree: true,
			limits: {
				mailboxes: 0,
				rulesPerMailbox: 0,
				emailsProcessedPerMonth: 0,
				aiChat: false,
				ruleEngine: false,
			},
		},
		starter: {
			prices: [
				{
					type: "recurring",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY as string,
					interval: "month",
					amount: 4,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 7,
				},
				{
					type: "recurring",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_STARTER_YEARLY as string,
					interval: "year",
					amount: 36,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 7,
				},
			],
			limits: {
				mailboxes: 3,
				rulesPerMailbox: Number.POSITIVE_INFINITY,
				emailsProcessedPerMonth: 3000,
				aiChat: true,
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
					amount: 10,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 7,
				},
				{
					type: "recurring",
					productId: process.env
						.NEXT_PUBLIC_PRICE_ID_PRO_YEARLY as string,
					interval: "year",
					amount: 108,
					currency: "USD",
					seatBased: true,
					trialPeriodDays: 7,
				},
			],
			limits: {
				rulesPerMailbox: Number.POSITIVE_INFINITY,
				emailsProcessedPerMonth: 15000,
				aiChat: true,
				ruleEngine: true,
				voiceAgentMinutes: 300,
				calendarScheduling: true,
				autoDrafts: true,
				meetingIntegrations: true,
			},
		},
	},
	// Fixed platform price for a paid creator-profile booking (Phase 5).
	// One product for every creator — not a per-creator custom amount, since
	// checkout only supports pre-configured Polar product IDs today.
	paidBooking: {
		productId: process.env.NEXT_PUBLIC_PRICE_ID_PAID_BOOKING as string,
		amount: 25,
		currency: "USD",
	},
	// Pay-as-you-go top-up once a Pro plan's included 300 voice minutes / mo
	// run out: $15 per additional 500 minutes.
	voiceAgentAddon: {
		productId: process.env.NEXT_PUBLIC_PRICE_ID_VOICE_ADDON as string,
		amount: 15,
		currency: "USD",
		minutesPerUnit: 500,
	},
} as const;

export type PlanId = keyof typeof config.plans;
