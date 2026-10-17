import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	signInSocial: vi.fn(),
	getSession: vi.fn(),
	verificationCreate: vi.fn(),
	verificationFindFirst: vi.fn(),
	verificationDeleteMany: vi.fn(),
}));

vi.mock("@repo/auth", () => ({
	auth: {
		api: {
			signInSocial: mocks.signInSocial,
			getSession: mocks.getSession,
		},
		$context: Promise.resolve({
			authCookies: {
				sessionToken: { name: "better-auth.session_token" },
			},
		}),
	},
}));

vi.mock("@repo/database", () => ({
	db: {
		verification: {
			create: mocks.verificationCreate,
			findFirst: mocks.verificationFindFirst,
			deleteMany: mocks.verificationDeleteMany,
		},
	},
}));

vi.mock("@repo/logs", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@repo/utils", () => ({
	getBaseUrl: () => "https://app.test",
}));

import {
	appRedirect,
	challengeFromVerifier,
	isValidChallenge,
	mobileAuthRouter,
	verifierMatchesChallenge,
} from "./mobile-auth";

const VERIFIER = `${"v".repeat(43)}-._~abc`;
const CHALLENGE = challengeFromVerifier(VERIFIER);
const CODE = "c".repeat(43);

function codeIdentifier(code: string) {
	return `mobile-auth:${createHash("sha256").update(code).digest("hex")}`;
}

function exchange(body: unknown) {
	return mobileAuthRouter.request("/exchange", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.verificationDeleteMany.mockResolvedValue({ count: 1 });
});

describe("PKCE helpers", () => {
	it("derives the RFC 7636 S256 challenge", () => {
		// Test vector from RFC 7636 appendix B
		expect(
			challengeFromVerifier(
				"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
			),
		).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
	});

	it("accepts only the matching verifier", () => {
		expect(verifierMatchesChallenge(VERIFIER, CHALLENGE)).toBe(true);
		expect(verifierMatchesChallenge(`${VERIFIER}x`, CHALLENGE)).toBe(false);
		expect(verifierMatchesChallenge(VERIFIER, "short")).toBe(false);
	});

	it("validates challenge format", () => {
		expect(isValidChallenge(CHALLENGE)).toBe(true);
		expect(isValidChallenge("abc")).toBe(false);
		expect(isValidChallenge(`${CHALLENGE}&x=1`)).toBe(false);
	});
});

describe("appRedirect", () => {
	it("always targets the fixed app URL", () => {
		expect(appRedirect({ code: CODE })).toBe(
			`mailmonkey://auth-callback?code=${CODE}`,
		);
	});

	it("strips anything but lowercase error codes", () => {
		expect(appRedirect({ error: "Access_Denied<script>" })).toBe(
			"mailmonkey://auth-callback?error=access_deniedscript",
		);
		expect(appRedirect({ error: "!!!" })).toBe(
			"mailmonkey://auth-callback?error=unknown",
		);
	});
});

describe("GET /start", () => {
	it("rejects an invalid challenge without calling Better Auth", async () => {
		const res = await mobileAuthRouter.request("/start?challenge=bad");

		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(
			"mailmonkey://auth-callback?error=invalid_request",
		);
		expect(mocks.signInSocial).not.toHaveBeenCalled();
	});

	it("rejects an unsupported provider", async () => {
		const res = await mobileAuthRouter.request(
			`/start?provider=github&challenge=${CHALLENGE}`,
		);

		expect(res.headers.get("location")).toContain("error=invalid_request");
		expect(mocks.signInSocial).not.toHaveBeenCalled();
	});

	it("redirects to the provider and forwards the OAuth state cookie", async () => {
		mocks.signInSocial.mockResolvedValue(
			new Response(
				JSON.stringify({ url: "https://accounts.google.com/o" }),
				{
					status: 200,
					headers: {
						"set-cookie": "better-auth.state=abc; Path=/; HttpOnly",
					},
				},
			),
		);

		const res = await mobileAuthRouter.request(
			`/start?provider=google&challenge=${CHALLENGE}`,
		);

		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(
			"https://accounts.google.com/o",
		);
		const cookies = res.headers.getSetCookie();
		expect(cookies.some((c) => c.startsWith("better-auth.state=abc"))).toBe(
			true,
		);
		const flow = cookies.find((c) => c.startsWith("mm_mobile_auth="));
		expect(flow).toContain(`mm_mobile_auth=${CHALLENGE};`);
		expect(flow).toContain("Path=/api/mobile-auth");
		expect(flow).toContain("HttpOnly");
		expect(flow).toContain("SameSite=Lax");
		expect(flow).toContain("Secure");
		expect(mocks.signInSocial).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					provider: "google",
					callbackURL: `https://app.test/api/mobile-auth/complete?challenge=${CHALLENGE}`,
				}),
			}),
		);
	});

	it("sends the app an error when the provider cannot start", async () => {
		mocks.signInSocial.mockRejectedValue(new Error("not configured"));

		const res = await mobileAuthRouter.request(
			`/start?provider=microsoft&challenge=${CHALLENGE}`,
		);

		expect(res.headers.get("location")).toBe(
			"mailmonkey://auth-callback?error=provider_unavailable",
		);
	});
});

describe("GET /complete", () => {
	it("stores a hashed, short-lived code and redirects to the app", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "u1" } });

		const res = await mobileAuthRouter.request(
			`/complete?challenge=${CHALLENGE}`,
			{
				headers: {
					cookie: `mm_mobile_auth=${CHALLENGE}; better-auth.session_token=tok.sig%3D`,
				},
			},
		);

		expect(res.headers.get("set-cookie")).toContain("mm_mobile_auth=;");
		const location = res.headers.get("location") ?? "";
		const code = new URL(
			location.replace("mailmonkey:", "https:"),
		).searchParams.get("code");
		expect(location.startsWith("mailmonkey://auth-callback?code=")).toBe(
			true,
		);
		expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);

		const { data } = mocks.verificationCreate.mock.calls[0][0];
		expect(data.identifier).toBe(codeIdentifier(code as string));
		expect(data.identifier).not.toContain(code);
		expect(JSON.parse(data.value)).toEqual({
			token: "tok.sig=",
			challenge: CHALLENGE,
		});
		const ttl = data.expiresAt.getTime() - Date.now();
		expect(ttl).toBeGreaterThan(0);
		expect(ttl).toBeLessThanOrEqual(2 * 60 * 1000);
	});

	it("redirects with no_session when the browser is not signed in", async () => {
		mocks.getSession.mockResolvedValue(null);

		const res = await mobileAuthRouter.request(
			`/complete?challenge=${CHALLENGE}`,
			{ headers: { cookie: `mm_mobile_auth=${CHALLENGE}` } },
		);

		expect(res.headers.get("location")).toBe(
			"mailmonkey://auth-callback?error=no_session",
		);
		expect(mocks.verificationCreate).not.toHaveBeenCalled();
	});
});

describe("GET /complete — flow binding", () => {
	it("rejects a direct link without the /start cookie, even when signed in", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "u1" } });

		const res = await mobileAuthRouter.request(
			`/complete?challenge=${CHALLENGE}`,
			{ headers: { cookie: "better-auth.session_token=tok.sig" } },
		);

		expect(res.headers.get("location")).toBe(
			"mailmonkey://auth-callback?error=invalid_request",
		);
		expect(mocks.verificationCreate).not.toHaveBeenCalled();
	});

	it("rejects a challenge different from the one /start bound", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "u1" } });
		const other = challengeFromVerifier(`${VERIFIER}-other`);

		const res = await mobileAuthRouter.request(
			`/complete?challenge=${other}`,
			{
				headers: {
					cookie: `mm_mobile_auth=${CHALLENGE}; better-auth.session_token=tok.sig`,
				},
			},
		);

		expect(res.headers.get("location")).toContain("error=invalid_request");
		expect(mocks.verificationCreate).not.toHaveBeenCalled();
	});
});

describe("POST /exchange", () => {
	function storedRecord(
		overrides: Partial<{ expiresAt: Date; value: string }> = {},
	) {
		return {
			identifier: codeIdentifier(CODE),
			value: JSON.stringify({ token: "tok.sig", challenge: CHALLENGE }),
			expiresAt: new Date(Date.now() + 60_000),
			...overrides,
		};
	}

	it("returns the session token for the right code and verifier", async () => {
		mocks.verificationFindFirst.mockResolvedValue(storedRecord());

		const res = await exchange({ code: CODE, verifier: VERIFIER });

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ token: "tok.sig" });
		expect(mocks.verificationDeleteMany).toHaveBeenCalledWith({
			where: { identifier: codeIdentifier(CODE) },
		});
	});

	it("rejects a wrong verifier but still burns the code", async () => {
		mocks.verificationFindFirst.mockResolvedValue(storedRecord());

		const res = await exchange({ code: CODE, verifier: `${VERIFIER}x` });

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_grant" });
		expect(mocks.verificationDeleteMany).toHaveBeenCalled();
	});

	it("rejects an expired code", async () => {
		mocks.verificationFindFirst.mockResolvedValue(
			storedRecord({ expiresAt: new Date(Date.now() - 1) }),
		);

		const res = await exchange({ code: CODE, verifier: VERIFIER });

		expect(res.status).toBe(400);
	});

	it("rejects an unknown or reused code", async () => {
		mocks.verificationFindFirst.mockResolvedValue(null);

		const res = await exchange({ code: CODE, verifier: VERIFIER });

		expect(res.status).toBe(400);
		expect(mocks.verificationDeleteMany).not.toHaveBeenCalled();
	});

	it("rejects malformed input without touching the database", async () => {
		for (const body of [
			{},
			{ code: "x", verifier: VERIFIER },
			{ code: CODE },
		]) {
			const res = await exchange(body);
			expect(res.status).toBe(400);
		}
		const malformed = await mobileAuthRouter.request("/exchange", {
			method: "POST",
			body: "not json",
		});
		expect(malformed.status).toBe(400);
		expect(mocks.verificationFindFirst).not.toHaveBeenCalled();
	});
});

describe("GET /error", () => {
	it("forwards the provider error code to the app", async () => {
		const res = await mobileAuthRouter.request(
			"/error?error=access_denied",
		);

		expect(res.headers.get("location")).toBe(
			"mailmonkey://auth-callback?error=access_denied",
		);
	});
});
