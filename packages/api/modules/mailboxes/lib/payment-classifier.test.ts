import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateWithSarvam = vi.fn();

vi.mock("@repo/ai", () => ({
	generateWithSarvam: (...args: unknown[]) => mockGenerateWithSarvam(...args),
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
	const originalApiKey = process.env.SARVAM_API_KEY;

	beforeEach(() => {
		process.env.SARVAM_API_KEY = "test-key";
		mockGenerateWithSarvam.mockReset();
	});

	afterEach(() => {
		process.env.SARVAM_API_KEY = originalApiKey;
	});

	it("classifies an invoice email", async () => {
		mockGenerateWithSarvam.mockResolvedValue({
			isPaymentEmail: true,
			paymentType: "invoice",
			merchant: "Acme Corp",
			amount: 250,
			currency: "USD",
			dueDate: "2026-09-01",
			paymentStatus: "unpaid",
			confidence: 0.95,
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
		mockGenerateWithSarvam.mockResolvedValue({
			isPaymentEmail: true,
			paymentType: "bill",
			merchant: "ABC Electricity",
			amount: 2450,
			currency: "INR",
			dueDate: "2026-08-28",
			paymentStatus: "unpaid",
			confidence: 0.96,
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Your electricity bill is due on August 28" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentType).toBe("bill");
	});

	it("classifies a payment confirmation/receipt as paid", async () => {
		mockGenerateWithSarvam.mockResolvedValue({
			isPaymentEmail: true,
			paymentType: "receipt",
			merchant: "Acme Corp",
			paymentStatus: "paid",
			confidence: 0.9,
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Payment received successfully" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentStatus).toBe("paid");
	});

	it("classifies a subscription renewal notice", async () => {
		mockGenerateWithSarvam.mockResolvedValue({
			isPaymentEmail: true,
			paymentType: "subscription",
			merchant: "Streamflix",
			amount: 15.99,
			currency: "USD",
			paymentStatus: "unpaid",
			confidence: 0.88,
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Your Streamflix subscription renews soon" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentType).toBe("subscription");
	});

	it("classifies a payment reminder", async () => {
		mockGenerateWithSarvam.mockResolvedValue({
			isPaymentEmail: true,
			paymentType: "reminder",
			merchant: "Acme Corp",
			paymentStatus: "unpaid",
			confidence: 0.85,
		});

		const result = await classifyPaymentEmail(
			baseEmail({ subject: "Reminder: outstanding amount due" }),
		);

		expect(result).not.toBeNull();
		expect(result?.isPaymentEmail).toBe(true);
		expect(result?.paymentType).toBe("reminder");
	});

	it("classifies an ordinary email as not a payment email", async () => {
		mockGenerateWithSarvam.mockResolvedValue({
			isPaymentEmail: false,
			confidence: 0.02,
		});

		const result = await classifyPaymentEmail(baseEmail());

		expect(result?.isPaymentEmail).toBe(false);
	});

	it("defaults to not-a-payment-email when no API key is configured", async () => {
		process.env.SARVAM_API_KEY = "";

		const result = await classifyPaymentEmail(baseEmail());

		expect(result).toEqual({ isPaymentEmail: false, confidence: 0 });
		expect(mockGenerateWithSarvam).not.toHaveBeenCalled();
	});

	it("returns null (retry later) after exhausting retries on repeated 429s", async () => {
		vi.useFakeTimers();
		try {
			mockGenerateWithSarvam.mockRejectedValue(
				new Error("Sarvam chat completion failed: 429 rate limited"),
			);

			const resultPromise = classifyPaymentEmail(baseEmail());
			await vi.advanceTimersByTimeAsync(10_000);
			await vi.advanceTimersByTimeAsync(20_000);
			await vi.advanceTimersByTimeAsync(40_000);
			const result = await resultPromise;

			expect(result).toBeNull();
			expect(mockGenerateWithSarvam).toHaveBeenCalledTimes(4);
		} finally {
			vi.useRealTimers();
		}
	});

	it("returns null (retry later) on an unclassified/transient error", async () => {
		mockGenerateWithSarvam.mockRejectedValue(new Error("boom"));

		const result = await classifyPaymentEmail(baseEmail());

		expect(result).toBeNull();
		expect(mockGenerateWithSarvam).toHaveBeenCalledTimes(1);
	});

	it("defaults to not-a-payment-email on a non-transient 4xx rejection", async () => {
		mockGenerateWithSarvam.mockRejectedValue(
			new Error("Sarvam chat completion failed: 400 bad request"),
		);

		const result = await classifyPaymentEmail(baseEmail());

		expect(result).toEqual({ isPaymentEmail: false, confidence: 0 });
	});

	it("returns null and pauses further calls when billing credits are depleted", async () => {
		// Isolated module instance so this test's cooldown state can't leak
		// into the shared, statically-imported instance the other tests use.
		vi.resetModules();
		const { classifyPaymentEmail: classifyWithFreshCooldownState } =
			await import("./payment-classifier");

		mockGenerateWithSarvam.mockRejectedValue(
			new Error(
				"Sarvam chat completion failed: 402 Your prepayment credits are depleted.",
			),
		);

		const result = await classifyWithFreshCooldownState(baseEmail());

		expect(result).toBeNull();
		// No retries burned on a wall we already know is there.
		expect(mockGenerateWithSarvam).toHaveBeenCalledTimes(1);

		mockGenerateWithSarvam.mockClear();
		const secondResult = await classifyWithFreshCooldownState(baseEmail());

		expect(secondResult).toBeNull();
		expect(mockGenerateWithSarvam).not.toHaveBeenCalled();
	});
});
