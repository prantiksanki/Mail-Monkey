import { passkey } from "@better-auth/passkey";
import {
	db,
	getInvitationById,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	getUserByEmail,
} from "@repo/database";
import type { Locale } from "@repo/i18n";
import { config as i18nConfig } from "@repo/i18n/config";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { cancelSubscription } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { type Account, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
	admin,
	bearer,
	createAuthMiddleware,
	magicLink,
	openAPI,
	organization,
	twoFactor,
	username,
} from "better-auth/plugins";
import { parse as parseCookies } from "cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config";
import { updateSeatsInOrganizationSubscription } from "./lib/organization";
import { invitationOnlyPlugin } from "./plugins/invitation-only";

const getLocaleFromRequest = (request?: Request) => {
	const cookies = parseCookies(request?.headers.get("cookie") ?? "");
	return (
		(cookies[i18nConfig.localeCookieName] as Locale) ??
		i18nConfig.defaultLocale
	);
};

const appUrl = getBaseUrl();

// Support additional trusted origins via env var (comma-separated)
// e.g. BETTER_AUTH_TRUSTED_ORIGINS=https://abc123.ngrok-free.app
const extraTrustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
	? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim())
	: [];

// Google JWKS for OAuth token verification (cached automatically)
const GOOGLE_JWKS = createRemoteJWKSet(
	new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const createMailboxAfterAccountCreation = async (account: Account) => {
	try {
		logger.info("Account created", {
			userId: account.userId,
			providerId: account.providerId,
		});
		if (account.providerId === "microsoft") {
			// Fetch user profile from Microsoft Graph
			let profileData: {
				email: string;
				name?: string;
			};

			try {
				const accessToken = account.accessToken;
				if (!accessToken) {
					throw new Error("No Microsoft access token available");
				}
				const res = await fetch("https://graph.microsoft.com/v1.0/me", {
					headers: { Authorization: `Bearer ${accessToken}` },
				});
				if (!res.ok) {
					throw new Error(
						`Microsoft Graph /me request failed: ${res.status}`,
					);
				}
				const profile = (await res.json()) as {
					mail?: string;
					userPrincipalName?: string;
					displayName?: string;
				};
				const email = profile.mail ?? profile.userPrincipalName ?? "";
				if (!email) {
					throw new Error(
						"Microsoft Graph /me did not return an email address",
					);
				}
				profileData = {
					email: email.toLowerCase(),
					name: profile.displayName,
				};
			} catch (profileError) {
				logger.error("Failed to fetch Microsoft Graph /me", {
					profileError:
						profileError instanceof Error
							? profileError.message
							: String(profileError),
					userId: account.userId,
				});
				throw profileError;
			}

			await db.mailbox.upsert({
				where: { accountId: account.id },
				update: {
					name: profileData.name,
					email: profileData.email,
				},
				create: {
					userId: account.userId,
					accountId: account.id,
					name: profileData.name,
					email: profileData.email,
					provider: "OUTLOOK",
				},
			});

			return;
		}
		if (account.providerId === "google") {
			// 1. Ensure idToken exists and is a string
			if (!account.idToken || typeof account.idToken !== "string") {
				logger.error(
					"Google account creation attempted without valid idToken",
					{ account },
				);
				throw new Error(
					"Missing or invalid idToken for Google OAuth flow",
				);
			}

			// 2. Verify JWT signature and decode payload
			let payload: Record<string, unknown>;
			try {
				const { payload: verifiedPayload } = await jwtVerify(
					account.idToken,
					GOOGLE_JWKS,
					{
						issuer: "https://accounts.google.com",
						audience: process.env.GOOGLE_CLIENT_ID,
						algorithms: ["RS256"],
					},
				);
				payload = verifiedPayload as Record<string, unknown>;
			} catch (verificationError) {
				logger.error("Failed to verify Google idToken signature", {
					verificationError:
						verificationError instanceof Error
							? verificationError.message
							: String(verificationError),
					userId: account.userId,
					providerId: account.providerId,
				});
				throw new Error(
					"Invalid or forged Google idToken - signature verification failed",
				);
			}

			// 3. Validate email verification
			if (payload.email_verified !== true) {
				logger.warn("Google OAuth returned unverified email", {
					sub: payload.sub,
					email: payload.email,
				});
			}

			// 4. Extract and validate email
			if (!payload.email || typeof payload.email !== "string") {
				logger.error("Google profile missing valid email field", {
					payload,
					account,
				});
				throw new Error("No valid email found in Google OAuth profile");
			}

			// 5. Prepare mailbox data
			const mailboxData = {
				email: (payload.email as string).toLowerCase(),
				name:
					typeof payload.name === "string" ? payload.name : undefined,
				picture:
					typeof payload.picture === "string"
						? payload.picture
						: undefined,
			};

			logger.info("Extracted profile data for Mailbox", {
				...mailboxData,
				userId: account.userId,
			});

			// 6. Create or update Mailbox entity
			// We use upsert to be atomic and handle potential race conditions
			await db.mailbox.upsert({
				where: { accountId: account.id },
				update: {
					name: mailboxData.name,
					email: mailboxData.email,
					picture: mailboxData.picture,
				},
				create: {
					userId: account.userId,
					accountId: account.id,
					name: mailboxData.name,
					email: mailboxData.email,
					picture: mailboxData.picture,
					provider: "GOOGLE",
				},
			});
		}
	} catch (error) {
		// Log the error but don't fail the OAuth flow
		// User authentication should succeed even if mailbox creation fails
		// User can retry connecting mailbox through the UI later
		logger.error("Failed to create mailbox after account creation", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			userId: account.userId,
			providerId: account.providerId,
			accountId: account.id,
		});

		// Don't re-throw - allow OAuth flow to complete
	}
};

// On every account update (token refresh or re-auth), ensure the mailbox
// exists. This handles the case where the initial `create.after` hook failed
// on the first OAuth attempt and the account row already exists, so
// `create.after` will never fire again.
const ensureMailboxAfterAccountUpdate = async (account: Account) => {
	if (account.providerId !== "microsoft" && account.providerId !== "google") {
		return;
	}
	try {
		const existing = await db.mailbox.findUnique({
			where: { accountId: account.id },
			select: { id: true },
		});
		if (existing) {
			return;
		}

		logger.info("Mailbox missing after account update — creating now", {
			userId: account.userId,
			providerId: account.providerId,
		});
		await createMailboxAfterAccountCreation(account);
	} catch (error) {
		logger.error("Failed to ensure mailbox after account update", {
			error: error instanceof Error ? error.message : String(error),
			userId: account.userId,
			providerId: account.providerId,
		});
	}
};

export const auth = betterAuth({
	baseURL: appUrl,
	trustedOrigins: [appUrl, ...extraTrustedOrigins],
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		database: {
			generateId: false,
		},
	},
	session: {
		expiresIn: config.sessionCookieMaxAge,
		freshAge: 0,
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "microsoft"],
			allowDifferentEmails: true,
		},
	},
	databaseHooks: {
		account: {
			create: {
				after: createMailboxAfterAccountCreation,
			},
			update: {
				after: ensureMailboxAfterAccountUpdate,
			},
		},
	},
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path.startsWith("/organization/accept-invitation")) {
				const { invitationId } = ctx.body;

				if (!invitationId) {
					return;
				}

				const invitation = await getInvitationById(invitationId);

				if (!invitation) {
					return;
				}

				await updateSeatsInOrganizationSubscription(
					invitation.organizationId,
				);
			} else if (ctx.path.startsWith("/organization/remove-member")) {
				const { organizationId } = ctx.body;

				if (!organizationId) {
					return;
				}

				await updateSeatsInOrganizationSubscription(organizationId);
			}
		}),
		before: createAuthMiddleware(async (ctx) => {
			if (
				ctx.path.startsWith("/delete-user") ||
				ctx.path.startsWith("/organization/delete")
			) {
				const userId = ctx.context.session?.session.userId;
				const { organizationId } = ctx.body;

				if (userId || organizationId) {
					const purchases = organizationId
						? await getPurchasesByOrganizationId(organizationId)
						: // biome-ignore lint/style/noNonNullAssertion: This is a valid case
							await getPurchasesByUserId(userId!);
					const subscriptions = purchases.filter(
						(purchase) =>
							purchase.type === "SUBSCRIPTION" &&
							purchase.subscriptionId !== null,
					);

					if (subscriptions.length > 0) {
						for (const subscription of subscriptions) {
							await cancelSubscription(
								// biome-ignore lint/style/noNonNullAssertion: This is a valid case
								subscription.subscriptionId!,
							);
						}
					}
				}
			}
		}),
	},
	user: {
		additionalFields: {
			onboardingComplete: {
				type: "boolean",
				required: false,
			},
			locale: {
				type: "string",
				required: false,
			},
		},
		deleteUser: {
			enabled: true,
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async (
				{ user: { email, name }, url },
				request,
			) => {
				const locale = getLocaleFromRequest(request);
				await sendEmail({
					to: email,
					templateId: "emailVerification",
					context: {
						url,
						name,
					},
					locale,
				});
			},
		},
	},
	emailAndPassword: {
		enabled: true,
		// If signup is disabled, the only way to sign up is via an invitation. So in this case we can auto sign in the user, as the email is already verified by the invitation.
		// If signup is enabled, we can't auto sign in the user, as the email is not verified yet.
		autoSignIn: !config.enableSignup,
		requireEmailVerification: config.enableSignup,
		sendResetPassword: async ({ user, url }, request) => {
			const locale = getLocaleFromRequest(request);
			await sendEmail({
				to: user.email,
				templateId: "forgotPassword",
				context: {
					url,
					name: user.name,
				},
				locale,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: config.enableSignup,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async (
			{ user: { email, name }, url },
			request,
		) => {
			const locale = getLocaleFromRequest(request);
			await sendEmail({
				to: email,
				templateId: "emailVerification",
				context: {
					url,
					name,
				},
				locale,
			});
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
			scope: [
				"email",
				"profile",
				"https://www.googleapis.com/auth/gmail.modify",
				"https://www.googleapis.com/auth/gmail.send",
				"https://www.googleapis.com/auth/calendar.readonly",
			],
			accessType: "offline",
			prompt: "consent",
		},
		microsoft: {
			clientId: process.env.MICROSOFT_CLIENT_ID as string,
			clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
			tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
			scope: [
				"openid",
				"profile",
				"email",
				"offline_access",
				"User.Read",
				"Mail.ReadWrite",
				"Mail.Send",
			],
		},
	},
	plugins: [
		// Mobile app auth: issues a token on sign-in (sent as `set-auth-token`
		// response header) and accepts it as `Authorization: Bearer <token>`.
		// Additive — does not change cookie-based web auth.
		bearer(),
		username(),
		admin(),
		passkey(),
		magicLink({
			disableSignUp: false,
			sendMagicLink: async ({ email, url }, ctx) => {
				const request = ctx?.request as Request;

				const locale = getLocaleFromRequest(request);
				await sendEmail({
					to: email,
					templateId: "magicLink",
					context: {
						url,
					},
					locale,
				});
			},
		}),
		organization({
			sendInvitationEmail: async (
				{ email, id, organization },
				request,
			) => {
				const locale = getLocaleFromRequest(request);
				const existingUser = await getUserByEmail(email);

				const url = new URL(
					existingUser ? "/auth/login" : "/auth/signup",
					getBaseUrl(),
				);

				url.searchParams.set("invitationId", id);
				url.searchParams.set("email", email);

				await sendEmail({
					to: email,
					templateId: "organizationInvitation",
					locale,
					context: {
						organizationName: organization.name,
						url: url.toString(),
					},
				});
			},
		}),
		openAPI(),
		invitationOnlyPlugin(),
		twoFactor(),
	],
	onAPIError: {
		onError(error, ctx) {
			logger.error(error, { ctx });
		},
	},
});

export * from "./lib/mailbox-subscription";
export * from "./lib/organization";

export type Session = typeof auth.$Infer.Session;

export type ActiveOrganization = NonNullable<
	Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

export type Organization = typeof auth.$Infer.Organization;

export type OrganizationMemberRole =
	ActiveOrganization["members"][number]["role"];

export type OrganizationInvitationStatus = typeof auth.$Infer.Invitation.status;

export type OrganizationMetadata = Record<string, unknown> | undefined;
