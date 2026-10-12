import type { RouterClient } from "@orpc/server";
import { adminRouter } from "../modules/admin/router";
import { aiRouter } from "../modules/ai/router";
import { analyticsRouter } from "../modules/analytics/router";
import { contactRouter } from "../modules/contact/router";
import { creatorProfilesRouter } from "../modules/creator-profiles/router";
import { mailboxesRouter } from "../modules/mailboxes/router";
import { newsletterRouter } from "../modules/newsletter/router";
import { notificationsRouter } from "../modules/notifications/router";
import { organizationsRouter } from "../modules/organizations/router";
import { paymentTrackingRouter } from "../modules/payment-tracking/router";
import { paymentsRouter } from "../modules/payments/router";
import { telemetryRouter } from "../modules/telemetry/router";
import { usersRouter } from "../modules/users/router";
import { publicProcedure } from "./procedures";

export const router = publicProcedure.router({
	admin: adminRouter,
	analytics: analyticsRouter,
	newsletter: newsletterRouter,
	contact: contactRouter,
	creatorProfiles: creatorProfilesRouter,
	organizations: organizationsRouter,
	users: usersRouter,
	payments: paymentsRouter,
	paymentTracking: paymentTrackingRouter,
	ai: aiRouter,
	mailboxes: mailboxesRouter,
	notifications: notificationsRouter,
	telemetry: telemetryRouter,
});

export type ApiRouterClient = RouterClient<typeof router>;
