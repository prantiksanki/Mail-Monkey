import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import { getClientIp } from "./rate-limit";

// Minimal Context stub — getClientIp only reads request headers.
function ctxWithHeaders(headers: Record<string, string>): Context {
	const lower = Object.fromEntries(
		Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
	);
	return {
		req: { header: (name: string) => lower[name.toLowerCase()] },
	} as unknown as Context;
}

describe("getClientIp", () => {
	it("returns the bare x-azure-clientip when present", () => {
		expect(
			getClientIp(ctxWithHeaders({ "x-azure-clientip": "203.0.113.5" })),
		).toBe("203.0.113.5");
	});

	it("strips the source port Azure App Service appends to x-forwarded-for", () => {
		// This is the bug the fix addresses: the port changes per TCP
		// connection, so an un-stripped value is a fresh rate-limit key each
		// request.
		expect(
			getClientIp(
				ctxWithHeaders({ "x-forwarded-for": "203.0.113.5:52086" }),
			),
		).toBe("203.0.113.5");
	});

	it("takes the last (right-most) x-forwarded-for entry and strips its port", () => {
		expect(
			getClientIp(
				ctxWithHeaders({
					"x-forwarded-for": "10.0.0.1, 203.0.113.5:41000",
				}),
			),
		).toBe("203.0.113.5");
	});

	it("prefers x-azure-clientip over x-forwarded-for", () => {
		expect(
			getClientIp(
				ctxWithHeaders({
					"x-azure-clientip": "203.0.113.5",
					"x-forwarded-for": "198.51.100.9:1234",
				}),
			),
		).toBe("203.0.113.5");
	});

	it("unwraps a bracketed IPv6 address with a port", () => {
		expect(
			getClientIp(
				ctxWithHeaders({ "x-forwarded-for": "[2001:db8::1]:8080" }),
			),
		).toBe("2001:db8::1");
	});

	it("leaves a bare IPv6 address untouched", () => {
		expect(
			getClientIp(ctxWithHeaders({ "x-forwarded-for": "2001:db8::1" })),
		).toBe("2001:db8::1");
	});

	it("falls back to x-real-ip", () => {
		expect(
			getClientIp(ctxWithHeaders({ "x-real-ip": "203.0.113.5:9999" })),
		).toBe("203.0.113.5");
	});

	it("returns 'anonymous' when no client IP header is present", () => {
		expect(getClientIp(ctxWithHeaders({}))).toBe("anonymous");
	});

	it("ignores an empty x-forwarded-for and falls through", () => {
		expect(
			getClientIp(
				ctxWithHeaders({
					"x-forwarded-for": "",
					"x-real-ip": "203.0.113.5",
				}),
			),
		).toBe("203.0.113.5");
	});
});
