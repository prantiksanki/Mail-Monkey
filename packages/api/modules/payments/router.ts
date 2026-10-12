import { createCheckoutLink } from "./procedures/create-checkout-link";
import { createCustomerPortalLink } from "./procedures/create-customer-portal-link";
import { listPurchases } from "./procedures/list-purchases";
import { startTrial } from "./procedures/start-trial";

export const paymentsRouter = {
	createCheckoutLink,
	createCustomerPortalLink,
	listPurchases,
	startTrial,
};
