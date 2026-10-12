import { randomBytes } from "node:crypto";
import { Polar } from "@polar-sh/sdk";
import {
	validateEvent,
	WebhookVerificationError,
} from "@polar-sh/sdk/webhooks.js";
import { trackServerEvent } from "@repo/analytics";
import {
	createBookingIfFree,
	createNotification,
	createPurchase,
	deletePurchaseBySubscriptionId,
	getBookingByCheckoutId,
	getCreatorProfileByUserId,
	getPurchaseBySubscriptionId,
	getUserByUsername,
	recordProfileEvent,
	updatePurchase,
} from "@repo/database";
import { logger } from "@repo/logs";
import { setCustomerIdToEntity } from "../../lib/customer";
import type {
	CancelSubscription,
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	SetSubscriptionSeats,
	WebhookHandler,
} from "../../types";

let polarClient: Polar;

function getPolarClient() {
	if (polarClient) {
		return polarClient;
	}

	const polarAccessToken = process.env.POLAR_ACCESS_TOKEN as string;

	if (!polarAccessToken) {
		throw new Error("Missing env variable POLAR_ACCESS_TOKEN");
	}

	polarClient = new Polar({
		accessToken: polarAccessToken,
		server:
			process.env.NODE_ENV === "production" ? "production" : "sandbox",
	});

	return polarClient;
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	const polarClient = getPolarClient();

	const {
		productId,
		redirectUrl,
		customerId,
		organizationId,
		userId,
		metadata: customMetadata,
	} = options;

	const metadata: Record<string, string> = { ...customMetadata };

	if (organizationId) {
		metadata.organization_id = organizationId;
	}

	if (userId) {
		metadata.user_id = userId;
	}

	const response = await polarClient.checkouts.create({
		products: [productId],
		successUrl: redirectUrl ?? "",
		metadata,
		customerId: customerId || undefined,
	});

	return response.url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
}) => {
	const polarClient = getPolarClient();

	const response = await polarClient.customerSessions.create({
		customerId: customerId,
	});

	return response.customerPortalUrl;
};

export const setSubscriptionSeats: SetSubscriptionSeats = async () => {};

export const cancelSubscription: CancelSubscription = async (id) => {
	const polarClient = getPolarClient();

	await polarClient.subscriptions.revoke({
		id,
	});
};

/**
 * Turns a completed paid-booking checkout into a real Booking row. The slot
 * was already verified available when the checkout link was created; here we
 * just need createBookingIfFree's atomic re-check in case someone else
 * grabbed the slot while payment was in flight, plus idempotency against
 * webhook redelivery (checkoutId is unique on Booking).
 */
async function handlePaidBookingOrder({
	metadata,
	checkoutId,
}: {
	metadata: Record<string, string | number | boolean>;
	checkoutId: string | null;
}) {
	if (!checkoutId) {
		logger.error("Paid booking order missing checkoutId", { metadata });
		return;
	}

	const existing = await getBookingByCheckoutId(checkoutId);
	if (existing) {
		return;
	}

	const username = metadata.booking_username as string;
	const startsAt = new Date(metadata.booking_starts_at as string);
	const endsAt = new Date(metadata.booking_ends_at as string);
	const visitorName = metadata.booking_visitor_name as string;
	const visitorEmail = metadata.booking_visitor_email as string;
	const note = (metadata.booking_note as string) || undefined;

	const user = await getUserByUsername(username);
	if (!user) {
		logger.error("Paid booking order references unknown username", {
			username,
			checkoutId,
		});
		return;
	}

	const profile = await getCreatorProfileByUserId(user.id);
	if (!profile) {
		logger.error("Paid booking order references user with no profile", {
			username,
			checkoutId,
		});
		return;
	}

	const booking = await createBookingIfFree({
		creatorProfileId: profile.id,
		visitorName,
		visitorEmail,
		note,
		startsAt,
		endsAt,
		cancelToken: randomBytes(18).toString("base64url"),
		paid: true,
		checkoutId,
	});

	if (!booking) {
		logger.warn("Paid booking slot was taken before payment completed", {
			username,
			checkoutId,
		});
		return;
	}

	await createNotification({
		userId: user.id,
		type: "creator_profile_booking",
		title: `New paid booking from ${visitorName}`,
		body: `${startsAt.toLocaleString()}\n\nReply to: ${visitorEmail}${note ? `\n\n${note}` : ""}`,
	});
	await recordProfileEvent(profile.id, "BOOKING");
}

/**
 * Report a new paid subscription to GA4 as a `purchase` conversion. The GA4
 * client id is threaded through checkout `metadata.ga_client_id` (set in
 * packages/api/modules/payments/procedures/create-checkout-link.ts) so the
 * revenue joins the visitor's original web session. `transaction_id` is the
 * subscription id, which also lets GA4 dedupe a redelivered webhook.
 */
async function trackSubscriptionPurchase(subscription: {
	id: string;
	amount: number;
	currency: string;
	productId?: string | null;
	metadata?: Record<string, unknown> | null;
}): Promise<void> {
	const metadata = subscription.metadata ?? {};
	await trackServerEvent({
		name: "purchase",
		userId: (metadata.user_id as string) || undefined,
		clientId: (metadata.ga_client_id as string) || undefined,
		params: {
			transaction_id: subscription.id,
			currency: (subscription.currency || "USD").toUpperCase(),
			// Polar amounts are in the currency's minor unit (cents).
			value: (subscription.amount ?? 0) / 100,
			...(subscription.productId
				? { items: [{ item_id: subscription.productId }] }
				: {}),
		},
	});
}

export const webhookHandler: WebhookHandler = async (req) => {
	const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET as string;

	if (!polarWebhookSecret) {
		return new Response("Missing env variable POLAR_WEBHOOK_SECRET", {
			status: 500,
		});
	}

	try {
		if (!req.body) {
			return new Response("No body", {
				status: 400,
			});
		}

		const event = validateEvent(
			await req.text(),
			Object.fromEntries(req.headers.entries()),
			polarWebhookSecret,
		);

		switch (event.type) {
			case "order.created": {
				const {
					metadata,
					customerId,
					subscription,
					productId,
					checkoutId,
				} = event.data;

				if (subscription) {
					break;
				}

				if (metadata?.booking_kind === "creator_profile_booking") {
					await handlePaidBookingOrder({ metadata, checkoutId });
					break;
				}

				if (!productId) {
					return new Response("Missing product ID.", {
						status: 400,
					});
				}

				await createPurchase({
					organizationId:
						(metadata?.organization_id as string) || null,
					userId: (metadata?.user_id as string) || null,
					customerId,
					type: "ONE_TIME",
					productId,
				});

				await setCustomerIdToEntity(customerId, {
					organizationId: metadata?.organization_id as string,
					userId: metadata?.user_id as string,
				});

				break;
			}
			case "subscription.created": {
				const {
					metadata,
					customerId,
					productId,
					id,
					status,
					amount,
					currency,
				} = event.data;

				// Fire the GA4 `purchase` conversion only on the first time we
				// see this subscription, so a redelivered webhook can't
				// double-count revenue.
				const alreadyRecorded = await getPurchaseBySubscriptionId(id);

				await createPurchase({
					subscriptionId: id,
					organizationId: metadata?.organization_id as string,
					userId: metadata?.user_id as string,
					customerId,
					type: "SUBSCRIPTION",
					productId,
					status,
				});

				await setCustomerIdToEntity(customerId, {
					organizationId: metadata?.organization_id as string,
					userId: metadata?.user_id as string,
				});

				if (!alreadyRecorded) {
					await trackSubscriptionPurchase({
						id,
						amount,
						currency,
						productId,
						metadata,
					});
				}

				break;
			}
			case "subscription.updated": {
				const { id, status, productId } = event.data;

				const existingPurchase = await getPurchaseBySubscriptionId(id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status,
						productId,
					});
				}

				break;
			}
			case "subscription.canceled": {
				const { id } = event.data;

				await deletePurchaseBySubscriptionId(id);

				break;
			}

			default:
				return new Response("Unhandled event type.", {
					status: 200,
				});
		}

		return new Response(null, {
			status: 202,
		});
	} catch (error) {
		if (error instanceof WebhookVerificationError) {
			return new Response("Invalid request.", {
				status: 403,
			});
		}
		throw error;
	}
};
