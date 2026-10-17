import { passkey } from "@better-auth/passkey";
import {
	clearFailedLoginAttempts,
	db,
	getInvitationById,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	getUserByEmail,
	recordFailedLoginAttempt,
	updateUser,
} from "@repo/database";
import type { Locale } from "@repo/i18n";
import { config as i18nConfig } from "@repo/i18n/config";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { authAttemptsTotal } from "@repo/metrics";
import { cancelSubscription } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { decryptToken, encryptToken } from "@repo/utils/lib/token-crypto";
import { type Account, APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import {
	admin,
	bearer,
	genericOAuth,
	magicLink,
	openAPI,
	organization,
	twoFactor,
	username,
} from "better-auth/plugins";
import type {
	InvitationStatus,
	Organization as OrganizationSchema,
} from "better-auth/plugins/organization";
import { parse as parseCookies } from "cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config";
import {
	type GaAttribution,
	gaAttributionFromContext,
	trackMailboxConnect,
	trackSignUp,
} from "./lib/analytics-events";
import { updateSeatsInOrganizationSubscription } from "./lib/organization";
import { addSequenzySubscriber } from "./lib/sequenzy";
import { invitationOnlyPlugin } from "./plugins/invitation-only";

const getLocaleFromRequest = (request?: Request) => {
	const cookies = parseCookies(request?.headers.get("cookie") ?? "");
	return (
		(cookies[i18nConfig.localeCookieName] as Locale) ??
		i18nConfig.defaultLocale
	);
};

// Usernames double as public profile handles at /u/[username] (creator
// profiles feature) — block app routes and obvious impersonation targets so
// nobody can claim a name that shadows a real page or looks official.
const RESERVED_USERNAMES = new Set([
	"admin",
	"api",
	"app",
	"about",
	"auth",
	"billing",
	"blog",
	"contact",
	"dashboard",
	"docs",
	"faq",
	"help",
	"legal",
	"login",
	"logout",
	"onboarding",
	"organization",
	"payments",
	"mailmonkey",
	"pricing",
	"privacy",
	"settings",
	"signup",
	"support",
	"terms",
	"u",
	"zeromail",
]);

function isUsernameAllowed(username: string): boolean {
	if (!/^[a-zA-Z0-9_]+$/.test(username)) {
		return false;
	}
	return !RESERVED_USERNAMES.has(username.toLowerCase());
}

// Endpoints where the response is an actual login/signup pass-or-fail
// outcome, as opposed to e.g. /sign-in/social (just returns a redirect URL —
// the real outcome lands on /callback/:id) or /passkey/generate-*-options
// (fetches a challenge, doesn't establish a session). Deliberately narrow so
// authAttemptsTotal reflects "did someone actually get a session", not every
// request that happens to touch auth.
const AUTH_ATTEMPT_PATHS = new Set([
	"/sign-in/email",
	"/sign-up/email",
	"/magic-link/verify",
	"/passkey/verify-authentication",
]);

function isAuthAttemptPath(path: string): boolean {
	// OAuth completion (Google/Microsoft/Zoom/Zoho all land on /callback/:id).
	return AUTH_ATTEMPT_PATHS.has(path) || path.startsWith("/callback/");
}

const appUrl = getBaseUrl();

// Zoom (user-managed OAuth) is optional: only register the provider when creds
// are present, so environments without a Zoom app (e.g. current staging) keep
// auth working untouched.
const zoomClientId = process.env.ZOOM_CLIENT_ID;
const zoomClientSecret = process.env.ZOOM_CLIENT_SECRET;

// Zoho Meeting (user-managed OAuth) — optional in the same way as Zoom above.
const zohoClientId = process.env.ZOHO_CLIENT_ID;
const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET;
// Zoho is data-centre scoped: an account created in the EU/IN/AU/JP DC only
// authenticates against that DC's domain. Keep in sync with the domains in
// `packages/api/modules/mailboxes/lib/zoho-meeting-client.ts`.
const zohoAccountsDomain =
	process.env.ZOHO_ACCOUNTS_DOMAIN ?? "https://accounts.zoho.com";
// Deliberately NOT the OIDC scopes (`openid,email,profile`): when `openid` is
// present Zoho treats the request as pure OIDC and silently drops service scopes,
// so the token comes back without ZohoMeeting.meeting.CREATE and every Meeting
// call fails with INVALID_OAUTHSCOPE. AaaServer.profile.READ carries the identity
// instead, and returns the email as long as the Zoho account has a verified one.
const zohoScopes = (
	process.env.ZOHO_SCOPES ??
	"ZohoMeeting.meeting.CREATE,AaaServer.profile.READ"
)
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

/**
 * User-managed OAuth providers (video meetings). These are opt-in per environment:
 * a provider is only registered once its creds are set, so an environment without
 * them keeps auth working untouched. Tokens land in the existing `account` table.
 * The mailbox account hooks create no Mailbox row for these providers — they
 * only fire the zoom_connect / zoho_connect GA4 activation event.
 */
const genericOAuthConfigs: Parameters<typeof genericOAuth>[0]["config"] = [];

if (zoomClientId && zoomClientSecret) {
	genericOAuthConfigs.push({
		providerId: "zoom",
		clientId: zoomClientId,
		clientSecret: zoomClientSecret,
		authorizationUrl: "https://zoom.us/oauth/authorize",
		tokenUrl: "https://zoom.us/oauth/token",
		userInfoUrl: "https://api.zoom.us/v2/users/me",
		// Zoom requires HTTP Basic auth on the token endpoint.
		authentication: "basic",
		// better-auth 1.7 rewrote generic-oauth as a first-class social
		// provider (PR #9069): the callback route moved from
		// /oauth2/callback/:id to /callback/:id. The Zoom app's redirect
		// URI must be updated to match in its developer console.
		redirectURI: `${appUrl}/api/auth/callback/zoom`,
		// Scopes must match what the Zoom app grants; override via ZOOM_SCOPES if
		// your app uses different names.
		scopes: (
			process.env.ZOOM_SCOPES ?? "meeting:write:meeting,user:read:user"
		)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
		mapProfileToUser: (profile) => {
			const p = profile as {
				email?: string;
				first_name?: string;
				last_name?: string;
			};
			return {
				email: p.email ?? "",
				name:
					[p.first_name, p.last_name].filter(Boolean).join(" ") ||
					undefined,
			};
		},
	});
}

if (zohoClientId && zohoClientSecret) {
	genericOAuthConfigs.push({
		providerId: "zoho",
		clientId: zohoClientId,
		clientSecret: zohoClientSecret,
		authorizationUrl: `${zohoAccountsDomain}/oauth/v2/auth`,
		tokenUrl: `${zohoAccountsDomain}/oauth/v2/token`,
		// Zoho passes client creds as form params; it has no Basic-auth mode.
		authentication: "post",
		// Same /oauth2/callback/:id -> /callback/:id move as Zoom above; the
		// Zoho app's redirect URI must be updated to match.
		redirectURI: `${appUrl}/api/auth/callback/zoho`,
		scopes: zohoScopes,
		// Zoho only issues a refresh token when BOTH are set. Without them the
		// connection would silently break at the first token expiry.
		accessType: "offline",
		prompt: "consent",
		// Better Auth space-joins scopes, but Zoho requires them comma-separated.
		// These params are applied last when building the authorize URL, so this
		// overrides the default `scope`.
		authorizationUrlParams: { scope: zohoScopes.join(",") },
		// Zoho's pre-OIDC user endpoint, which pairs with AaaServer.profile.READ.
		// The OIDC /oauth/v2/userinfo can't be used: it needs the `openid` scope,
		// whose presence makes Zoho drop ZohoMeeting.meeting.CREATE. Zoho also
		// authenticates with `Zoho-oauthtoken` rather than `Bearer`, so the default
		// user-info fetch would be rejected regardless.
		getUserInfo: async (tokens) => {
			const res = await fetch(`${zohoAccountsDomain}/oauth/user/info`, {
				headers: {
					Authorization: `Zoho-oauthtoken ${tokens.accessToken}`,
				},
			});
			const raw = await res.text().catch(() => "");
			let p: {
				ZUID?: number | string;
				Email?: string;
				Display_Name?: string;
			} | null = null;
			try {
				p = JSON.parse(raw);
			} catch {
				p = null;
			}
			if (!res.ok || !p?.ZUID || !p.Email) {
				// Returning null here surfaces as a bare `user_info_is_missing`,
				// which says nothing about why — log the actual reply instead. An
				// empty `Email` on a 200 means the Zoho account has no verified
				// address for Zoho to release.
				logger.error("[zoho] user info failed", {
					status: res.status,
					contentType: res.headers.get("content-type"),
					hasAccessToken: !!tokens.accessToken,
					grantedScopes: tokens.scopes,
					body: raw.slice(0, 400),
				});
				return null;
			}
			return {
				id: String(p.ZUID),
				email: p.Email,
				name: p.Display_Name,
				// Zoho only releases an address once it has been verified.
				emailVerified: true,
			};
		},
	});
}

// Support additional trusted origins via env var (comma-separated)
// e.g. BETTER_AUTH_TRUSTED_ORIGINS=https://abc123.ngrok-free.app
const extraTrustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
	? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim())
	: [];

// Google JWKS for OAuth token verification (cached automatically)
const GOOGLE_JWKS = createRemoteJWKSet(
	new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

// Encrypts accessToken/refreshToken/idToken (AES-256-GCM) if present on the
// object being written, leaving everything else untouched. Safe to call on a
// partial update payload — only encrypts fields that are actually included.
function encryptAccountTokens<
	T extends {
		accessToken?: string | null;
		refreshToken?: string | null;
		idToken?: string | null;
	},
>(data: T): T {
	return {
		...data,
		...("accessToken" in data && {
			accessToken: encryptToken(data.accessToken),
		}),
		...("refreshToken" in data && {
			refreshToken: encryptToken(data.refreshToken),
		}),
		...("idToken" in data && { idToken: encryptToken(data.idToken) }),
	};
}

const createMailboxAfterAccountCreation = async (
	account: Account,
	attribution: GaAttribution = {},
) => {
	try {
		logger.info("Account created", {
			userId: account.userId,
			providerId: account.providerId,
		});
		if (account.providerId === "zoom" || account.providerId === "zoho") {
			// Zoom / Zoho Meeting are user-managed meeting integrations, not
			// mailboxes — there is no Mailbox row to create. Fire the GA4
			// activation event only, so Zoom vs Zoho adoption is visible next
			// to gmail_connect / outlook_connect.
			await trackMailboxConnect(
				{ userId: account.userId, providerId: account.providerId },
				attribution,
			);
			return;
		}
		if (account.providerId === "microsoft") {
			// Fetch user profile from Microsoft Graph
			let profileData: {
				email: string;
				name?: string;
			};

			try {
				// Stored encrypted (databaseHooks.account.create.before /
				// update.before below) — this is the plaintext value.
				const accessToken = decryptToken(account.accessToken);
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

			await trackMailboxConnect(
				{ userId: account.userId, providerId: account.providerId },
				attribution,
			);

			return;
		}
		if (account.providerId === "google") {
			// 1. Ensure idToken exists and is a string
			if (!account.idToken || typeof account.idToken !== "string") {
				logger.error(
					"Google account creation attempted without valid idToken",
					{ userId: account.userId, providerId: account.providerId },
				);
				throw new Error(
					"Missing or invalid idToken for Google OAuth flow",
				);
			}

			// 2. Verify JWT signature and decode payload
			let payload: Record<string, unknown>;
			try {
				const { payload: verifiedPayload } = await jwtVerify(
					// Stored encrypted — decrypt before verification.
					decryptToken(account.idToken),
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
					sub: payload.sub,
					userId: account.userId,
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

			await trackMailboxConnect(
				{ userId: account.userId, providerId: account.providerId },
				attribution,
			);
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

// Fires once per newly created user (every signup path: email/password, OAuth,
// magic link). Sends the welcome email immediately. Never throws — a mail
// failure must not interrupt the signup transaction.
const sendWelcomeEmailAfterUserCreation = async (user: {
	email: string;
	name: string;
}) => {
	try {
		await sendEmail({
			to: user.email,
			templateId: "welcome",
			context: {
				name: user.name,
				url: `${appUrl}/auth/login`,
			},
		});
	} catch (error) {
		logger.error("Failed to send welcome email", {
			error: error instanceof Error ? error.message : String(error),
			email: user.email,
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
		// Require a recently-authenticated session for the operations Better Auth
		// gates on freshness (e.g. unlinking a social account). `0` disabled the
		// check entirely; 24h matches the library default.
		freshAge: 60 * 60 * 24,
		// Serves session reads from a signed cookie instead of hitting the DB
		// on every request. Avoids turning a brief DB blip into an app-wide
		// 401 storm. Revoked sessions / role changes propagate within maxAge;
		// 60s keeps that window short (sensitive routes bypass the cache
		// entirely via Better Auth's sensitiveSessionMiddleware).
		cookieCache: {
			enabled: true,
			maxAge: 60,
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "microsoft"],
			allowDifferentEmails: true,
		},
	},
	databaseHooks: {
		user: {
			create: {
				// Connect the new signup to Sequenzy so the Product
				// Onboarding sequence fires without any manual step.
				after: async (user, context) => {
					await addSequenzySubscriber(user);
					await sendWelcomeEmailAfterUserCreation(user);
					await trackSignUp(user, context);
				},
			},
		},
		account: {
			create: {
				// Encrypts OAuth tokens at rest (AES-256-GCM) before better-auth's
				// own account-linking flow persists them — this is the only path
				// through which better-auth itself writes Account rows, so it
				// covers OAuth sign-in/sign-up. Token-refresh writes made directly
				// by this app (google-auth.ts, microsoft-auth.ts, zoom/zoho
				// clients) encrypt inline at their own db.account.update calls,
				// since those bypass better-auth's hooks entirely.
				before: async (account) => ({
					data: encryptAccountTokens(account),
				}),
				after: (account, context) =>
					createMailboxAfterAccountCreation(
						account,
						gaAttributionFromContext(context),
					),
			},
			update: {
				before: async (account) => ({
					data: encryptAccountTokens(account),
				}),
				after: ensureMailboxAfterAccountUpdate,
			},
		},
	},
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			// Runs on every auth request, success or handled failure — see
			// isAuthAttemptPath for why only some paths count as an "attempt".
			// ctx.context.returned is the APIError instance itself when the
			// endpoint failed (better-auth catches it before running after
			// hooks), or the success payload otherwise.
			if (isAuthAttemptPath(ctx.path)) {
				authAttemptsTotal.inc({
					status:
						ctx.context.returned instanceof APIError
							? "failure"
							: "success",
				});
			}

			// Soft account lockout (CASA 1.1.1) for password sign-in — see
			// recordFailedLoginAttempt/clearFailedLoginAttempts. IP-based rate
			// limiting alone can't stop an attacker rotating IPs against one
			// account, so this is the per-account backstop. Looked up by email
			// since ctx.context.session doesn't exist yet on a failed attempt.
			if (
				ctx.path === "/sign-in/email" &&
				typeof ctx.body?.email === "string"
			) {
				const targetUser = await getUserByEmail(ctx.body.email);
				if (targetUser) {
					if (ctx.context.returned instanceof APIError) {
						await recordFailedLoginAttempt(targetUser.id);
					} else {
						await clearFailedLoginAttempts(targetUser.id);
					}
				}
			}

			// Clears the CASA 1.1.2 forced-change gate (see mustChangePassword on
			// User) once the recipient of a system-issued initial password sets
			// their own. session.userId is available here since a successful
			// /change-password requires an authenticated session.
			if (
				ctx.path === "/change-password" &&
				!(ctx.context.returned instanceof APIError)
			) {
				const userId = ctx.context.session?.session.userId;
				if (userId) {
					await updateUser({ id: userId, mustChangePassword: false });
				}
			}

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
				ctx.path === "/sign-in/email" &&
				typeof ctx.body?.email === "string"
			) {
				const targetUser = await getUserByEmail(ctx.body.email);
				if (
					targetUser?.lockedUntil &&
					targetUser.lockedUntil > new Date()
				) {
					throw new APIError("TOO_MANY_REQUESTS", {
						message:
							"Too many failed sign-in attempts. Please try again later.",
					});
				}
			}

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
			mustChangePassword: {
				type: "boolean",
				required: false,
			},
			locale: {
				type: "string",
				required: false,
			},
			accountType: {
				type: "string",
				required: false,
			},
		},
		deleteUser: {
			enabled: true,
			// Account deletion is irreversible and cascades to connected
			// mailboxes, so require the user to confirm from a link mailed to
			// their address — a valid session alone is not enough.
			sendDeleteAccountVerification: async ({ user, url }, request) => {
				const locale = getLocaleFromRequest(request);
				await sendEmail({
					to: user.email,
					templateId: "deleteAccountVerification",
					context: {
						url,
						name: user.name,
					},
					locale,
				});
			},
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailConfirmation: async (
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
		// A password reset via the emailed recovery link must kill every other
		// active session for the account (attacker-held tokens included) — the
		// authenticated change-password flow already does this via
		// `revokeOtherSessions`; this is the equivalent for the unauthenticated
		// recovery path.
		revokeSessionsOnPasswordReset: true,
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
				// Write scope so ZeroMail can create Google Meet links (events
				// with conferenceData). Must also be added to the Google Cloud
				// OAuth consent screen; existing users reconnect to grant it.
				"https://www.googleapis.com/auth/calendar.events",
			],
			accessType: "offline",
			// "select_account" forces Google's account chooser even when the
			// browser already has an active Google session — without it, adding
			// a second Gmail mailbox silently re-links whichever account is
			// already signed in, instead of letting the user pick a different one.
			prompt: "select_account consent",
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
		username({
			usernameValidator: isUsernameAllowed,
		}),
		// Registered as a single plugin: genericOAuth registers its providers
		// into the core social sign-in flow (better-auth 1.7+, PR #9069), so
		// instantiating it once per provider would collide. Always included
		// (even with an empty config) rather than conditionally spread — a
		// conditional array member here widens the whole `plugins` tuple to a
		// union type, which breaks better-auth's `$Infer` distribution over
		// each plugin and silently drops other plugins' session/user fields
		// (role, twoFactorEnabled, activeOrganizationId, ...) from the
		// inferred Session type. The plugin itself no-ops safely on an empty
		// config array (it just `for`/`map`s over it).
		genericOAuth({ config: genericOAuthConfigs }),
		// Native mobile app: accepts the signed session token as
		// `Authorization: Bearer …` (issued via packages/api/lib/mobile-auth.ts).
		// requireSignature rejects bare, unsigned tokens. Browser cookie
		// sessions are unaffected.
		bearer({ requireSignature: true }),
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
			// CVE-2026-53514: without this, a user with an unverified
			// session for the invited email can accept/reject/read an
			// organization invitation just by obtaining the invitation ID
			// (e.g. from a forwarded/leaked email), since the recipient
			// endpoints only checked session.user.email against the
			// invitation, not that the email was actually verified.
			requireEmailVerificationOnInvitation: true,
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
		onError(error) {
			// Never log the AuthContext argument — it carries `secret`
			// (BETTER_AUTH_SECRET itself), the live database adapter, and
			// full session/user objects. Only the error itself is safe to
			// log; better-auth's own error types don't carry request bodies.
			logger.error(error);
		},
	},
});

export * from "./lib/mailbox-subscription";
export * from "./lib/organization";

export type Session = typeof auth.$Infer.Session;

export type ActiveOrganization = NonNullable<
	Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

export type Organization = OrganizationSchema;

export type OrganizationMemberRole =
	ActiveOrganization["members"][number]["role"];

export type OrganizationInvitationStatus = InvitationStatus;

export type OrganizationMetadata = Record<string, unknown> | undefined;
