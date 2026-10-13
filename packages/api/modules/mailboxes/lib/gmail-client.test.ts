import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/logs", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@repo/metrics", () => ({
	integrationApiCalls: { inc: vi.fn() },
}));

vi.mock("./google-auth", () => ({
	getOAuth2Client: vi.fn(),
}));

import { translateGmailError } from "./gmail-client";

function googleError(
	status: number,
	message: string,
	reason?: string,
): Error & { response: unknown } {
	return Object.assign(new Error(message), {
		response: {
			status,
			data: { error: { message, errors: reason ? [{ reason }] : [] } },
		},
	});
}

function codeOf(error: Error): string | undefined {
	return error instanceof ORPCError ? error.code : undefined;
}

describe("translateGmailError — rate limits", () => {
	it("maps a 403 quota error to TOO_MANY_REQUESTS, not UNAUTHORIZED", () => {
		const error = googleError(
			403,
			"Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user'",
		);

		expect(codeOf(translateGmailError(error, "acc-1"))).toBe(
			"TOO_MANY_REQUESTS",
		);
	});

	it("maps a 403 with reason userRateLimitExceeded to TOO_MANY_REQUESTS", () => {
		const error = googleError(
			403,
			"User-rate limit",
			"userRateLimitExceeded",
		);

		expect(codeOf(translateGmailError(error, "acc-1"))).toBe(
			"TOO_MANY_REQUESTS",
		);
	});

	it("maps a 429 to TOO_MANY_REQUESTS", () => {
		const error = googleError(429, "Too Many Requests");

		expect(codeOf(translateGmailError(error, "acc-1"))).toBe(
			"TOO_MANY_REQUESTS",
		);
	});
});

describe("translateGmailError — authorization", () => {
	it("still maps a genuine 403 permission error to UNAUTHORIZED", () => {
		const error = googleError(
			403,
			"Request had insufficient authentication scopes.",
			"insufficientPermissions",
		);

		expect(codeOf(translateGmailError(error, "acc-1"))).toBe(
			"UNAUTHORIZED",
		);
	});

	it("maps a revoked refresh token to UNAUTHORIZED", () => {
		const error = new Error("invalid_grant");

		expect(codeOf(translateGmailError(error, "acc-1"))).toBe(
			"UNAUTHORIZED",
		);
	});

	it("passes an existing ORPCError through unchanged", () => {
		const original = new ORPCError("NOT_FOUND");

		expect(translateGmailError(original, "acc-1")).toBe(original);
	});
});
