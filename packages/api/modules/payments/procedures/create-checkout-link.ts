import { ORPCError } from "@orpc/client";
import { parseGaCookies } from "@repo/analytics";
import { getMailboxesByUserId, getOrganizationById } from "@repo/database";
import { logger } from "@repo/logs";
import {
	createCheckoutLink as createCheckoutLinkFn,
	getCustomerIdFromEntity,
} from "@repo/payments";
import { config } from "@repo/payments/config";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { protectedProcedure } from "../../../orpc/procedures";

export const createCheckoutLink = protectedProcedure
	.use(localeMiddleware)
	.route({
		method: "POST",
		path: "/payments/create-checkout-link",
		tags: ["Payments"],
		summary: "Create checkout link",
		description:
			"Creates a checkout link for a one-time or subscription product",
	})
	.input(
		z.object({
			type: z.enum(["one-time", "subscription"]),
			productId: z.string(),
			redirectUrl: z.string().optional(),
			organizationId: z.string().optional(),
		}),
	)
	.handler(
		async ({
			input: { productId, redirectUrl, type, organizationId },
			context: { user, headers },
		}) => {
			// Carry the buyer's GA4 client id into the checkout so the Polar
			// webhook can report the `purchase` conversion against their
			// original web session.
			const { clientId: gaClientId } = parseGaCookies(
				headers.get("cookie"),
			);
			const customerId = await getCustomerIdFromEntity(
				organizationId
					? {
							organizationId,
						}
					: {
							userId: user.id,
						},
			);

			const plans = config.plans;

			const plan = Object.entries(plans).find(
				([_planId, plan]) =>
					"prices" in plan &&
					plan.prices?.find((price) => price.productId === productId),
			);

			if (!plan) {
				throw new ORPCError("NOT_FOUND");
			}

			const [_, planDetails] = plan;

			const price =
				"prices" in planDetails &&
				planDetails.prices?.find(
					(price) => price.productId === productId,
				);
			const trialPeriodDays =
				price && "trialPeriodDays" in price
					? price.trialPeriodDays
					: undefined;

			const organization = organizationId
				? await getOrganizationById(organizationId)
				: undefined;

			if (organization === null) {
				throw new ORPCError("NOT_FOUND");
			}

			// Mailbox-as-seat model: seats = number of connected mailboxes (minimum 1)
			let seats: number | undefined;
			if (
				organization &&
				price &&
				"seatBased" in price &&
				price.seatBased
			) {
				// For organizations, use member count
				seats = organization.members.length || 1;
			} else if (
				!organizationId &&
				price &&
				"seatBased" in price &&
				price.seatBased
			) {
				// For users, use mailbox count
				const mailboxes = await getMailboxesByUserId(user.id);
				seats = mailboxes.length || 1;
			}

			try {
				const checkoutLink = await createCheckoutLinkFn({
					type,
					productId,
					email: user.email,
					name: user.name ?? "",
					redirectUrl,
					...(organizationId
						? { organizationId }
						: { userId: user.id }),
					trialPeriodDays,
					seats,
					customerId: customerId ?? undefined,
					...(gaClientId
						? { metadata: { ga_client_id: gaClientId } }
						: {}),
				});

				if (!checkoutLink) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				return { checkoutLink };
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				logger.error(
					{ message, productId, userId: user.id },
					"createCheckoutLink failed",
				);
				throw new ORPCError("INTERNAL_SERVER_ERROR", { message });
			}
		},
	);
