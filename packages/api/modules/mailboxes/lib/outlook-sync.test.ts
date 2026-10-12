import { describe, expect, it } from "vitest";
import { extractSkipToken } from "./outlook-sync";

describe("extractSkipToken", () => {
	it("returns undefined when there is no next link", () => {
		expect(extractSkipToken(undefined)).toBeUndefined();
	});

	it("extracts and decodes the skipToken from a Graph nextLink", () => {
		const nextLink =
			"https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skipToken=abc%2Bdef%3D%3D&$top=100";

		expect(extractSkipToken(nextLink)).toBe("abc+def==");
	});

	it("returns undefined when the link has no skipToken param", () => {
		const nextLink =
			"https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=100";

		expect(extractSkipToken(nextLink)).toBeUndefined();
	});
});
