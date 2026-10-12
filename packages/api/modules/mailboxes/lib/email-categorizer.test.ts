import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateObject = vi.fn();

vi.mock("@repo/ai", () => ({
	generateObject: (...args: unknown[]) => mockGenerateObject(...args),
	TEXT_MODEL_ID: "gemini-flash-latest",
}));

vi.mock("@ai-sdk/google", () => ({
	createGoogleGenerativeAI: () => (modelName: string) => modelName,
}));

vi.mock("@repo/logs", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
	classifyEmailCategory,
	fastPathCategoryFromGmailLabels,
} from "./email-categorizer";

function baseEmail(
	overrides: Partial<Parameters<typeof classifyEmailCategory>[0]> = {},
) {
	return {
		from: "Jane Smith <jane@company.com>",
		to: "user@example.com",
		subject: "Re: project update",
		snippet: "Sure, let's meet tomorrow",
		bodyText: "Sure, let's meet tomorrow at 3pm.",
		labelIds: ["INBOX"],
		...overrides,
	};
}

describe("fastPathCategoryFromGmailLabels", () => {
	it("maps CATEGORY_PROMOTIONS to PROMOTION", () => {
		expect(
			fastPathCategoryFromGmailLabels(["INBOX", "CATEGORY_PROMOTIONS"]),
		).toBe("PROMOTION");
	});

	it("maps CATEGORY_SOCIAL to SOCIAL", () => {
		expect(
			fastPathCategoryFromGmailLabels(["INBOX", "CATEGORY_SOCIAL"]),
		).toBe("SOCIAL");
	});

	it("does not fast-path CATEGORY_UPDATES, CATEGORY_PERSONAL, or no category", () => {
		expect(
			fastPathCategoryFromGmailLabels(["INBOX", "CATEGORY_UPDATES"]),
		).toBeNull();
		expect(
			fastPathCategoryFromGmailLabels(["INBOX", "CATEGORY_PERSONAL"]),
		).toBeNull();
		expect(fastPathCategoryFromGmailLabels(["INBOX"])).toBeNull();
	});
});

describe("classifyEmailCategory", () => {
	const originalApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

	beforeEach(() => {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
		mockGenerateObject.mockReset();
	});

	afterEach(() => {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalApiKey;
	});

	it("uses the Gmail fast-path without calling Gemini", async () => {
		const result = await classifyEmailCategory(
			baseEmail({ labelIds: ["INBOX", "CATEGORY_SOCIAL"] }),
		);

		expect(result).toBe("SOCIAL");
		expect(mockGenerateObject).not.toHaveBeenCalled();
	});

	it("returns the classifier's category on success", async () => {
		mockGenerateObject.mockResolvedValue({
			object: { category: "NEWSLETTER" },
		});

		const result = await classifyEmailCategory(baseEmail());

		expect(result).toBe("NEWSLETTER");
		expect(mockGenerateObject).toHaveBeenCalledTimes(1);
	});

	it("defaults to PRIMARY when no API key is configured", async () => {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

		const result = await classifyEmailCategory(baseEmail());

		expect(result).toBe("PRIMARY");
		expect(mockGenerateObject).not.toHaveBeenCalled();
	});

	it("defaults to PRIMARY after exhausting retries on repeated 429s", async () => {
		vi.useFakeTimers();
		try {
			mockGenerateObject.mockRejectedValue(
				Object.assign(new Error("rate limited"), { statusCode: 429 }),
			);

			const resultPromise = classifyEmailCategory(baseEmail());
			// Backoff delays are 10s/20s/40s (2^(attempt+1)*5000ms) — fast-forward
			// through all of them instead of waiting in real time.
			await vi.advanceTimersByTimeAsync(10_000);
			await vi.advanceTimersByTimeAsync(20_000);
			await vi.advanceTimersByTimeAsync(40_000);
			const result = await resultPromise;

			expect(result).toBe("PRIMARY");
			// initial attempt + 3 retries = 4 calls
			expect(mockGenerateObject).toHaveBeenCalledTimes(4);
		} finally {
			vi.useRealTimers();
		}
	});

	it("defaults to PRIMARY on a non-retryable error", async () => {
		mockGenerateObject.mockRejectedValue(new Error("boom"));

		const result = await classifyEmailCategory(baseEmail());

		expect(result).toBe("PRIMARY");
		expect(mockGenerateObject).toHaveBeenCalledTimes(1);
	});
});
