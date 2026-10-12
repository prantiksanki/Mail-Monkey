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

import { classifyPaymentEmail } from "./payment-classifier";

function baseEmail(
	overrides: Partial<Parameters<typeof classifyPaymentEmail>[0]> = {},
) {
	return {
		from: "Jane Smith <jane@company.com>",
		fromEmail: "jane@company.com",
		subject: "Re: project update",
		snippet: "Sure, let's meet tomorrow",
		bodyText: "Sure, let's meet tomorrow at 3pm.",
		internalDate: new Date("2026-08-21T12:00:00Z"),
		...overrides,
	};
}

describe("classifyPaymentEmail", () => {
	const originalApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

	beforeEach(() => {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
		mockGenerateObject.mockReset();
	});

	afterEach(() => {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalApiKey;
	});

	it("classifies an invoice email", async () => {
		mockGenerateObject.mockResolvedValue({
			object: {
				isPaymentEmail: true,
				paymentType: "invoice",
				merchant: "Acme Corp",
				amount: 250,
				currency: "USD",
				dueDate: "2026-09-01",
				paymentStatus: "unpaid",
				confidence: 0.95,
			},
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Invoice #1234 from Acme Corp" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentType).toBe("invoice");
		expect(result?.merchant).toBe("Acme Corp");
	});

	it("classifies a utility bill email", async () => {
		mockGenerateObject.mockResolvedValue({
			object: {
				isPaymentEmail: true,
				paymentType: "bill",
				merchant: "ABC Electricity",
				amount: 2450,
				currency: "INR",
				dueDate: "2026-08-28",
				paymentStatus: "unpaid",
				confidence: 0.96,
			},
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Your electricity bill is due on August 28" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentType).toBe("bill");
	});

	it("classifies a payment confirmation/receipt as paid", async () => {
		mockGenerateObject.mockResolvedValue({
			object: {
				isPaymentEmail: true,
				paymentType: "receipt",
				merchant: "Acme Corp",
				paymentStatus: "paid",
				confidence: 0.9,
			},
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Payment received successfully" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentStatus).toBe("paid");
	});

	it("classifies a subscription renewal notice", async () => {
		mockGenerateObject.mockResolvedValue({
			object: {
				isPaymentEmail: true,
				paymentType: "subscription",
				merchant: "Streamflix",
				amount: 15.99,
				currency: "USD",
				paymentStatus: "unpaid",
				confidence: 0.88,
			},
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Your Streamflix subscription renews soon" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentType).toBe("subscription");
	});

	it("classifies a payment reminder", async () => {
		mockGenerateObject.mockResolvedValue({
			object: {
				isPaymentEmail: true,
				paymentType: "reminder",
				merchant: "Acme Corp",
				paymentStatus: "unpaid",
				confidence: 0.85,
			},
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Reminder: outstanding amount due" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentType).toBe("reminder");
	});

	it("classifies an ordinary email as not a payment email", async () => {
		mockGenerateObject.mockResolvedValue({
			object: { isPaymentEmail: false, confidence: 0.02 },
		});

		const result = await classifyPaymentEmail(baseEmail());

		expect(result?.isPaymentEmail).toBe(false);
	});

	it("defaults to not-a-payment-email when no API key is configured", async () => {
		process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

		const result = await classifyPaymentEmail(baseEmail());

		expect(result).toEqual({ isPaymentEmail: false, confidence: 0 });
		expect(mockGenerateObject).not.toHaveBeenCalled();
	});

	it("defaults to not-a-payment-email after exhausting retries on repeated 429s", async () => {
		vi.useFakeTimers();
		try {
			mockGenerateObject.mockRejectedValue(
				Object.assign(new Error("rate limited"), { statusCode: 429 }),
			);

			const resultPromise = classifyPaymentEmail(baseEmail());
			await vi.advanceTimersByTimeAsync(10_000);
			await vi.advanceTimersByTimeAsync(20_000);
			await vi.advanceTimersByTimeAsync(40_000);
			const result = await resultPromise;

			expect(result).toEqual({ isPaymentEmail: false, confidence: 0 });
			expect(mockGenerateObject).toHaveBeenCalledTimes(4);
		} finally {
			vi.useRealTimers();
		}
	});

	it("defaults to not-a-payment-email on a non-retryable error", async () => {
		mockGenerateObject.mockRejectedValue(new Error("boom"));

		const result = await classifyPaymentEmail(baseEmail());

		expect(result).toEqual({ isPaymentEmail: false, confidence: 0 });
		expect(mockGenerateObject).toHaveBeenCalledTimes(1);
	});

	it("returns null and pauses further Gemini calls when billing credits are depleted", async () => {
		// Isolated module instance so this test's cooldown state can't leak
		// into the shared, statically-imported instance the other tests use.
		vi.resetModules();
		const { classifyPaymentEmail: classifyWithFreshCooldownState } =
			await import("./payment-classifier");

		mockGenerateObject.mockRejectedValue(
			new Error(
				"Failed after 3 attempts. Last error: Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.",
			),
		);

		const result = await classifyWithFreshCooldownState(baseEmail());

		expect(result).toBeNull();
		// No retries burned on a wall we already know is there.
		expect(mockGenerateObject).toHaveBeenCalledTimes(1);

		mockGenerateObject.mockClear();
		const secondResult = await classifyWithFreshCooldownState(baseEmail());

		expect(secondResult).toBeNull();
		expect(mockGenerateObject).not.toHaveBeenCalled();
	});
});
