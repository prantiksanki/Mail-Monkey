import { describe, expect, it } from "vitest";
import { buildAiInsightSentence } from "./dashboard-insight";

describe("buildAiInsightSentence", () => {
	it("falls back to a generic message when there is no activity", () => {
		expect(buildAiInsightSentence([])).toBe(
			"No automation activity in the last 24 hours.",
		);
		expect(
			buildAiInsightSentence([
				{ type: "ARCHIVE", count: 0 },
				{ type: "LABEL", count: 0 },
			]),
		).toBe("No automation activity in the last 24 hours.");
	});

	it("describes a single action type", () => {
		expect(buildAiInsightSentence([{ type: "ARCHIVE", count: 38 }])).toBe(
			"We 38 emails archived for you in the last 24 hours.",
		);
	});

	it("uses singular 'email' for a count of one", () => {
		expect(buildAiInsightSentence([{ type: "LABEL", count: 1 }])).toBe(
			"We 1 email labeled for you in the last 24 hours.",
		);
	});

	it("combines the top two action types by count, highest first", () => {
		expect(
			buildAiInsightSentence([
				{ type: "LABEL", count: 8 },
				{ type: "ARCHIVE", count: 38 },
				{ type: "FORWARD", count: 2 },
			]),
		).toBe("We 38 emails archived and 8 emails labeled for you.");
	});

	it("falls back to a lowercased raw type for unknown action types", () => {
		expect(
			buildAiInsightSentence([{ type: "CUSTOM_ACTION", count: 3 }]),
		).toBe("We 3 emails custom_action for you in the last 24 hours.");
	});
});
