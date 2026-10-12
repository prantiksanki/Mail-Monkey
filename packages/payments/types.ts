export type CreateCheckoutLink = (params: {
	type: "subscription" | "one-time";
	productId: string;
	email?: string;
	name?: string;
	redirectUrl?: string;
	customerId?: string;
	organizationId?: string;
	userId?: string;
	trialPeriodDays?: number;
	seats?: number;
	// Arbitrary key-value pairs carried through to the provider's webhook
	// payload (e.g. order.created.metadata), for correlating a checkout back
	// to app-side state that isn't a subscription/organization.
	metadata?: Record<string, string>;
}) => Promise<string | null>;

export type CreateCustomerPortalLink = (params: {
	subscriptionId?: string;
	customerId: string;
	redirectUrl?: string;
}) => Promise<string | null>;

export type SetSubscriptionSeats = (params: {
	id: string;
	seats: number;
}) => Promise<void>;

export type CancelSubscription = (id: string) => Promise<void>;

export type WebhookHandler = (req: Request) => Promise<Response>;

export type PaymentProvider = {
	createCheckoutLink: CreateCheckoutLink;
	createCustomerPortalLink: CreateCustomerPortalLink;
	webhookHandler: WebhookHandler;
};
