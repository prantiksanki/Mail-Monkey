import { ORPCError } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	db: {
		account: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
	},
}));

vi.mock("@repo/logs", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// This suite exercises the Microsoft OAuth refresh flow, not token
// encryption (covered separately) — stub encrypt/decrypt as identity so
// plain fixture strings like "rt-abc" don't fail decryptToken's format check.
vi.mock("@repo/utils", () => ({
	decryptToken: (value: string | null | undefined) => value ?? null,
	encryptToken: (value: string | null | undefined) => value ?? null,
}));

import { db } from "@repo/database";
import { getMicrosoftAccessToken } from "./microsoft-auth";

const mockFindUnique = vi.mocked(db.account.findUnique);
const mockUpdate = vi.mocked(db.account.update);

function stubFetch(body: unknown, ok = true) {
	return vi.fn().mockResolvedValue({
		ok,
		json: () => Promise.resolve(body),
	});
}

function makeAccount(overrides: Record<string, unknown> = {}) {
	return {
		id: "acct-1",
		refreshToken: "rt-abc",
		accessToken: null,
		accessTokenExpiresAt: null,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockUpdate.mockResolvedValue({} as never);
	process.env.MICROSOFT_CLIENT_ID = "client-id";
	process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
	process.env.MICROSOFT_TENANT_ID = "common";
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("getMicrosoftAccessToken", () => {
	describe("cached token", () => {
		it("returns the cached access token when it is not expired", async () => {
			// accessTokenExpiresAt is 2 minutes from now — well past the 60-second buffer
			mockFindUnique.mockResolvedValue(
				makeAccount({
					accessToken: "cached-token",
					accessTokenExpiresAt: new Date(Date.now() + 120_000),
				}) as never,
			);

			const token = await getMicrosoftAccessToken("acct-1");

			expect(token).toBe("cached-token");
		});

		it("does not call fetch when returning a cached token", async () => {
			const fetchSpy = stubFetch({});
			vi.stubGlobal("fetch", fetchSpy);

			mockFindUnique.mockResolvedValue(
				makeAccount({
					accessToken: "cached-token",
					accessTokenExpiresAt: new Date(Date.now() + 120_000),
				}) as never,
			);

			await getMicrosoftAccessToken("acct-1");

			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});

	describe("token refresh", () => {
		it("calls the Microsoft token endpoint when the token is expired", async () => {
			const fetchSpy = stubFetch({
				access_token: "new-token",
				expires_in: 3600,
			});
			vi.stubGlobal("fetch", fetchSpy);

			mockFindUnique.mockResolvedValue(
				makeAccount({
					accessToken: "old-token",
					// within the 60-second buffer — treated as expired
					accessTokenExpiresAt: new Date(Date.now() + 30_000),
				}) as never,
			);

			const token = await getMicrosoftAccessToken("acct-1");

			expect(token).toBe("new-token");
			expect(fetchSpy).toHaveBeenCalledOnce();

			const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
			expect(calledUrl).toContain("login.microsoftonline.com");
			expect(calledUrl).toContain("/oauth2/v2.0/token");
			expect(calledInit.method).toBe("POST");
			expect(calledInit.headers["Content-Type"]).toBe(
				"application/x-www-form-urlencoded",
			);
			const body = new URLSearchParams(calledInit.body as string);
			expect(body.get("grant_type")).toBe("refresh_token");
			expect(body.get("refresh_token")).toBe("rt-abc");
		});

		it("also refreshes when there is no cached token at all", async () => {
			const fetchSpy = stubFetch({
				access_token: "fresh-token",
				expires_in: 3600,
			});
			vi.stubGlobal("fetch", fetchSpy);

			mockFindUnique.mockResolvedValue(makeAccount() as never);

			const token = await getMicrosoftAccessToken("acct-1");

			expect(token).toBe("fresh-token");
			expect(fetchSpy).toHaveBeenCalledOnce();
		});

		it("persists the rotated refresh token when Microsoft returns one", async () => {
			vi.stubGlobal(
				"fetch",
				stubFetch({
					access_token: "new-access",
					expires_in: 3600,
					refresh_token: "new-refresh",
				}),
			);

			mockFindUnique.mockResolvedValue(makeAccount() as never);

			await getMicrosoftAccessToken("acct-1");

			expect(mockUpdate).toHaveBeenCalledOnce();
			const updateCall = mockUpdate.mock.calls[0][0] as {
				where: { id: string };
				data: Record<string, unknown>;
			};
			expect(updateCall.where).toEqual({ id: "acct-1" });
			expect(updateCall.data.accessToken).toBe("new-access");
			expect(updateCall.data.refreshToken).toBe("new-refresh");
		});

		it("does not include refreshToken in the update when Microsoft omits it", async () => {
			vi.stubGlobal(
				"fetch",
				stubFetch({ access_token: "new-access", expires_in: 3600 }),
			);

			mockFindUnique.mockResolvedValue(makeAccount() as never);

			await getMicrosoftAccessToken("acct-1");

			const updateCall = mockUpdate.mock.calls[0][0] as {
				data: Record<string, unknown>;
			};
			expect(updateCall.data).not.toHaveProperty("refreshToken");
		});
	});

	describe("error handling", () => {
		it("throws UNAUTHORIZED when account has no refresh token", async () => {
			mockFindUnique.mockResolvedValue(
				makeAccount({ refreshToken: null }) as never,
			);

			await expect(
				getMicrosoftAccessToken("acct-1"),
			).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		});

		it("throws UNAUTHORIZED on invalid_grant error from Microsoft", async () => {
			vi.stubGlobal(
				"fetch",
				stubFetch({ error: "invalid_grant" }, false),
			);

			mockFindUnique.mockResolvedValue(makeAccount() as never);

			const error = await getMicrosoftAccessToken("acct-1").catch(
				(e) => e,
			);

			expect(error).toBeInstanceOf(ORPCError);
			expect(error.code).toBe("UNAUTHORIZED");
		});

		it("throws UNAUTHORIZED on invalid_client error from Microsoft", async () => {
			vi.stubGlobal(
				"fetch",
				stubFetch({ error: "invalid_client" }, false),
			);

			mockFindUnique.mockResolvedValue(makeAccount() as never);

			const error = await getMicrosoftAccessToken("acct-1").catch(
				(e) => e,
			);

			expect(error).toBeInstanceOf(ORPCError);
			expect(error.code).toBe("UNAUTHORIZED");
		});

		it("throws a plain Error for unexpected Microsoft failures", async () => {
			vi.stubGlobal(
				"fetch",
				stubFetch(
					{ error: "server_error", error_description: "oops" },
					false,
				),
			);

			mockFindUnique.mockResolvedValue(makeAccount() as never);

			await expect(getMicrosoftAccessToken("acct-1")).rejects.toThrow(
				"Microsoft token refresh failed",
			);
		});

		it("throws UNAUTHORIZED when the account does not exist in the database", async () => {
			mockFindUnique.mockResolvedValue(null);

			await expect(
				getMicrosoftAccessToken("acct-1"),
			).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		});
	});
});
