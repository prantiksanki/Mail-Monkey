import { ORPCError } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	db: {
		account: {
			findFirst: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
		},
	},
}));

vi.mock("@repo/logs", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// This suite exercises the Zoom refresh / API flow, not token encryption
// (covered separately) — stub encrypt/decrypt as identity so plain fixture
// strings like "rt-abc" don't fail decryptToken's format check.
vi.mock("@repo/utils", () => ({
	decryptToken: (value: string | null | undefined) => value ?? null,
	encryptToken: (value: string | null | undefined) => value ?? null,
}));

import { db } from "@repo/database";
import {
	classifyZoomError,
	createZoomMeeting,
	deleteZoomAccountsByZoomUserId,
	disconnectZoom,
	getZoomAccessToken,
	getZoomConnectionStatus,
	hasZoomConnection,
} from "./zoom-client";

const mockFindFirst = vi.mocked(db.account.findFirst);
const mockUpdate = vi.mocked(db.account.update);
const mockDeleteMany = vi.mocked(db.account.deleteMany);

function stubFetch(
	body: unknown,
	init: { ok?: boolean; status?: number } = {},
) {
	return vi.fn().mockResolvedValue({
		ok: init.ok ?? true,
		status: init.status ?? 200,
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
	mockDeleteMany.mockResolvedValue({ count: 1 } as never);
	process.env.ZOOM_CLIENT_ID = "zoom-client-id";
	process.env.ZOOM_CLIENT_SECRET = "zoom-client-secret";
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("getZoomAccessToken", () => {
	it("returns the cached access token when it is not expired", async () => {
		const fetchSpy = stubFetch({});
		vi.stubGlobal("fetch", fetchSpy);
		mockFindFirst.mockResolvedValue(
			makeAccount({
				accessToken: "cached-token",
				accessTokenExpiresAt: new Date(Date.now() + 120_000),
			}) as never,
		);

		const token = await getZoomAccessToken("user-1");

		expect(token).toBe("cached-token");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("refreshes when the cached token is inside the 60s expiry buffer", async () => {
		const fetchSpy = stubFetch({
			access_token: "fresh-token",
			expires_in: 3600,
		});
		vi.stubGlobal("fetch", fetchSpy);
		mockFindFirst.mockResolvedValue(
			makeAccount({
				accessToken: "almost-expired",
				accessTokenExpiresAt: new Date(Date.now() + 30_000),
			}) as never,
		);

		const token = await getZoomAccessToken("user-1");

		expect(token).toBe("fresh-token");
		expect(fetchSpy).toHaveBeenCalledOnce();
	});

	it("refreshes when there is no stored access token", async () => {
		vi.stubGlobal(
			"fetch",
			stubFetch({ access_token: "fresh-token", expires_in: 3600 }),
		);
		mockFindFirst.mockResolvedValue(makeAccount() as never);

		expect(await getZoomAccessToken("user-1")).toBe("fresh-token");
	});

	it("posts a refresh_token grant to Zoom with HTTP Basic client credentials", async () => {
		const fetchSpy = stubFetch({ access_token: "fresh-token" });
		vi.stubGlobal("fetch", fetchSpy);
		mockFindFirst.mockResolvedValue(makeAccount() as never);

		await getZoomAccessToken("user-1");

		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe("https://zoom.us/oauth/token");
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toBe(
			`Basic ${Buffer.from("zoom-client-id:zoom-client-secret").toString("base64")}`,
		);
		const params = init.body as URLSearchParams;
		expect(params.get("grant_type")).toBe("refresh_token");
		expect(params.get("refresh_token")).toBe("rt-abc");
	});

	it("persists the new access token and expiry", async () => {
		vi.stubGlobal(
			"fetch",
			stubFetch({ access_token: "fresh-token", expires_in: 3600 }),
		);
		mockFindFirst.mockResolvedValue(makeAccount() as never);

		await getZoomAccessToken("user-1");

		expect(mockUpdate).toHaveBeenCalledOnce();
		const { where, data } = mockUpdate.mock.calls[0][0];
		expect(where).toEqual({ id: "acct-1" });
		expect(data.accessToken).toBe("fresh-token");
		const expiresAt = data.accessTokenExpiresAt as Date;
		expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 3_500_000);
		// Zoom did not rotate the refresh token, so it must be left untouched.
		expect(data).not.toHaveProperty("refreshToken");
	});

	it("persists a rotated refresh token when Zoom returns one", async () => {
		vi.stubGlobal(
			"fetch",
			stubFetch({
				access_token: "fresh-token",
				refresh_token: "rt-rotated",
				expires_in: 3600,
			}),
		);
		mockFindFirst.mockResolvedValue(makeAccount() as never);

		await getZoomAccessToken("user-1");

		expect(mockUpdate.mock.calls[0][0].data.refreshToken).toBe(
			"rt-rotated",
		);
	});

	it("throws UNAUTHORIZED when the user has no Zoom account", async () => {
		mockFindFirst.mockResolvedValue(null);

		await expect(getZoomAccessToken("user-1")).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("throws UNAUTHORIZED when the account has no refresh token", async () => {
		mockFindFirst.mockResolvedValue(
			makeAccount({ refreshToken: null }) as never,
		);

		await expect(getZoomAccessToken("user-1")).rejects.toBeInstanceOf(
			ORPCError,
		);
	});

	it("throws UNAUTHORIZED and does not persist when Zoom rejects the refresh token", async () => {
		vi.stubGlobal(
			"fetch",
			stubFetch({ error: "invalid_grant" }, { ok: false, status: 400 }),
		);
		mockFindFirst.mockResolvedValue(makeAccount() as never);

		await expect(getZoomAccessToken("user-1")).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: expect.stringContaining("invalid_grant"),
		});
		expect(mockUpdate).not.toHaveBeenCalled();
	});

	it("throws UNAUTHORIZED when the token endpoint returns a non-JSON body", async () => {
		// A rejected .json() must be handled, not surface as a raw error.
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 502,
				json: () => Promise.reject(new Error("not json")),
			}),
		);
		mockFindFirst.mockResolvedValue(makeAccount() as never);

		await expect(getZoomAccessToken("user-1")).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: expect.stringContaining("HTTP 502"),
		});
	});

	it("throws when the Zoom client credentials are not configured", async () => {
		process.env.ZOOM_CLIENT_ID = "";
		vi.stubGlobal("fetch", stubFetch({}));
		mockFindFirst.mockResolvedValue(makeAccount() as never);

		await expect(getZoomAccessToken("user-1")).rejects.toThrow(
			"ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET are not configured",
		);
	});
});

describe("createZoomMeeting", () => {
	const opts = {
		summary: "Intro call",
		startIso: "2026-10-01T10:00:00.000Z",
		endIso: "2026-10-01T10:45:00.000Z",
		description: "Agenda",
	};

	function stubValidToken() {
		mockFindFirst.mockResolvedValue(
			makeAccount({
				accessToken: "cached-token",
				accessTokenExpiresAt: new Date(Date.now() + 120_000),
			}) as never,
		);
	}

	it("returns the join URL shaped like a CreatedMeeting", async () => {
		stubValidToken();
		vi.stubGlobal(
			"fetch",
			stubFetch({
				id: 987654321,
				join_url: "https://zoom.us/j/987654321",
				start_time: "2026-10-01T10:00:00Z",
			}),
		);

		const meeting = await createZoomMeeting("user-1", opts);

		expect(meeting).toEqual({
			eventId: "987654321",
			meetLink: "https://zoom.us/j/987654321",
			htmlLink: "https://zoom.us/j/987654321",
			start: "2026-10-01T10:00:00Z",
			end: opts.endIso,
		});
	});

	it("creates a scheduled meeting with a Bearer token and the computed duration", async () => {
		stubValidToken();
		const fetchSpy = stubFetch({ id: 1, join_url: "https://zoom.us/j/1" });
		vi.stubGlobal("fetch", fetchSpy);

		await createZoomMeeting("user-1", opts);

		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe("https://api.zoom.us/v2/users/me/meetings");
		expect(init.headers.Authorization).toBe("Bearer cached-token");
		expect(JSON.parse(init.body)).toMatchObject({
			topic: "Intro call",
			type: 2,
			start_time: opts.startIso,
			duration: 45,
			agenda: "Agenda",
		});
	});

	it("never sends a duration below one minute", async () => {
		stubValidToken();
		const fetchSpy = stubFetch({ id: 1, join_url: "https://zoom.us/j/1" });
		vi.stubGlobal("fetch", fetchSpy);

		await createZoomMeeting("user-1", {
			...opts,
			endIso: opts.startIso,
		});

		expect(JSON.parse(fetchSpy.mock.calls[0][1].body).duration).toBe(1);
	});

	it("truncates the agenda to Zoom's 2000 character limit", async () => {
		stubValidToken();
		const fetchSpy = stubFetch({ id: 1, join_url: "https://zoom.us/j/1" });
		vi.stubGlobal("fetch", fetchSpy);

		await createZoomMeeting("user-1", {
			...opts,
			description: "a".repeat(3000),
		});

		expect(JSON.parse(fetchSpy.mock.calls[0][1].body).agenda).toHaveLength(
			2000,
		);
	});

	it("throws UNAUTHORIZED when Zoom responds 401", async () => {
		stubValidToken();
		vi.stubGlobal(
			"fetch",
			stubFetch(
				{ code: 124, message: "Invalid access token." },
				{ ok: false, status: 401 },
			),
		);

		await expect(createZoomMeeting("user-1", opts)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("throws a plain error (not UNAUTHORIZED) on other Zoom failures", async () => {
		stubValidToken();
		vi.stubGlobal(
			"fetch",
			stubFetch(
				{ code: 300, message: "Rate limited" },
				{ ok: false, status: 429 },
			),
		);

		const error = await createZoomMeeting("user-1", opts).catch((e) => e);

		expect(error).not.toBeInstanceOf(ORPCError);
		expect(error.message).toContain("Rate limited");
	});

	it("propagates UNAUTHORIZED when the user has no Zoom connection", async () => {
		mockFindFirst.mockResolvedValue(null);
		const fetchSpy = stubFetch({});
		vi.stubGlobal("fetch", fetchSpy);

		await expect(createZoomMeeting("user-1", opts)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

describe("classifyZoomError", () => {
	it("maps an ORPCError to needsReconnect", () => {
		expect(
			classifyZoomError(new ORPCError("UNAUTHORIZED", { message: "x" })),
		).toEqual({ status: "needsReconnect" });
	});

	it("maps any other error to error with its message", () => {
		expect(classifyZoomError(new Error("boom"))).toEqual({
			status: "error",
			message: "boom",
		});
	});

	it("stringifies non-Error throwables", () => {
		expect(classifyZoomError("weird")).toEqual({
			status: "error",
			message: "weird",
		});
	});
});

describe("hasZoomConnection / getZoomConnectionStatus (/zoom/status)", () => {
	it("is connected when the user's latest Zoom account has a refresh token", async () => {
		mockFindFirst.mockResolvedValue({ refreshToken: "rt-abc" } as never);

		expect(await getZoomConnectionStatus("user-1")).toEqual({
			connected: true,
			configured: true,
		});
		expect(mockFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "user-1", providerId: "zoom" },
				orderBy: { createdAt: "desc" },
			}),
		);
	});

	it("is not connected when the user has no Zoom account", async () => {
		mockFindFirst.mockResolvedValue(null);

		expect(await hasZoomConnection("user-1")).toBe(false);
	});

	it("is not connected when the account has no refresh token", async () => {
		mockFindFirst.mockResolvedValue({ refreshToken: null } as never);

		expect(await hasZoomConnection("user-1")).toBe(false);
	});

	it("reports configured: false when the client credentials are missing", async () => {
		process.env.ZOOM_CLIENT_SECRET = "";
		mockFindFirst.mockResolvedValue(null);

		expect(await getZoomConnectionStatus("user-1")).toEqual({
			connected: false,
			configured: false,
		});
	});
});

describe("disconnectZoom (/zoom/disconnect)", () => {
	it("deletes only the calling user's Zoom accounts", async () => {
		const result = await disconnectZoom("user-1");

		expect(mockDeleteMany).toHaveBeenCalledWith({
			where: { userId: "user-1", providerId: "zoom" },
		});
		expect(result).toEqual({ success: true });
	});

	it("succeeds when the user had no Zoom account to delete", async () => {
		mockDeleteMany.mockResolvedValue({ count: 0 } as never);

		expect(await disconnectZoom("user-1")).toEqual({ success: true });
	});
});

describe("deleteZoomAccountsByZoomUserId", () => {
	it("matches on the Zoom user id and returns the number removed", async () => {
		mockDeleteMany.mockResolvedValue({ count: 2 } as never);

		const removed = await deleteZoomAccountsByZoomUserId("zoom-user-9");

		expect(mockDeleteMany).toHaveBeenCalledWith({
			where: { providerId: "zoom", accountId: "zoom-user-9" },
		});
		expect(removed).toBe(2);
	});
});
