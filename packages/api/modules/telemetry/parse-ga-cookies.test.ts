import { parseGaCookies } from "@repo/analytics";
import { describe, expect, it } from "vitest";

describe("parseGaCookies", () => {
	it("extracts the client id from a well-formed _ga cookie", () => {
		expect(parseGaCookies("_ga=GA1.1.1234567890.1700000000")).toEqual({
			clientId: "1234567890.1700000000",
		});
	});

	it("extracts the session id from a _ga_<STREAM> cookie", () => {
		const header =
			"_ga=GA1.1.1234567890.1700000000; _ga_ABCDEF1234=GS1.1.1700000500.3.1.1700000600.0.0.0";
		expect(parseGaCookies(header)).toEqual({
			clientId: "1234567890.1700000000",
			sessionId: "1700000500",
		});
	});

	it("ignores unrelated cookies and tolerates surrounding whitespace", () => {
		const header =
			"session=abc; _ga=GA1.2.987654321.1699999999 ; theme=dark";
		expect(parseGaCookies(header)).toEqual({
			clientId: "987654321.1699999999",
		});
	});

	it("returns an empty object when _ga is missing", () => {
		expect(parseGaCookies("session=abc; theme=dark")).toEqual({});
	});

	it("returns an empty object for null / empty / malformed input", () => {
		expect(parseGaCookies(null)).toEqual({});
		expect(parseGaCookies(undefined)).toEqual({});
		expect(parseGaCookies("")).toEqual({});
		expect(parseGaCookies("_ga=nonsense")).toEqual({});
	});
});
