/**
 * Payment/bill email detection and extraction for the Payments Kanban board.
 *
 * Reuses the *pattern* from email-categorizer.ts (single-email call, 429
 * retry with backoff) rather than sharing code with it — this classifier
 * answers a different question (is this a payment email, and if so what are
 * its fields) with a different, larger schema and a safe failure mode of
 * "not a payment email" rather than "default category".
 *
 * Runs on Sarvam rather than Gemini — see email-categorizer.ts for why.
 */

import { generateWithSarvam } from "@repo/ai";
import { logger } from "@repo/logs";
import { z } from "zod";

export const PAYMENT_TYPES = [
	"invoice",
	"bill",
	"subscription",
	"receipt",
	"reminder",
	"other",
] as const;

export const PAYMENT_STATUSES = [
	"unpaid",
	"paid",
	"overdue",
	"unknown",
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_SCHEMA = z.object({
	isPaymentEmail: z.boolean(),
	// The model sometimes returns off-enum values (e.g. "pending", "n/a").
	// One bad optional field must not discard an otherwise valid
	// classification, so unrecognised values fall back instead of throwing.
	paymentType: z.enum(PAYMENT_TYPES).optional().catch("other"),
	merchant: z.string().optional(),
	amount: z.number().optional(),
	currency: z.string().optional(),
	dueDate: z.string().optional(), // ISO date, e.g. "2026-08-28"
	paymentStatus: z.enum(PAYMENT_STATUSES).optional().catch("unknown"),
	confidence: z.number().min(0).max(1),
});

export type PaymentClassification = z.infer<typeof PAYMENT_SCHEMA>;

export interface ClassifiablePaymentEmail {
	from: string;
	fromEmail: string;
	subject: string;
	snippet: string;
	bodyText: string;
	internalDate: Date;
}

/** Safe default when detection can't run or fails — never fabricates a card. */
export const NOT_A_PAYMENT_EMAIL: PaymentClassification = {
	isPaymentEmail: false,
	confidence: 0,
};

// Billing/quota exhaustion is not a transient blip a retry will fix — every
// call fails identically until someone tops up billing. Once we see it, stop
// calling the model at all for a cooldown window instead of burning 3
// retries per email, per poller tick, on a wall we already know is there.
// Module-level state is fine: this runs in one long-lived server process,
// same as the poller's globalThis timer.
//
// Sarvam's own billing-exhaustion wording isn't confirmed (never observed
// here, unlike Gemini's well-known "prepayment credits are depleted"), so
// this also treats 402/403 status codes as quota exhaustion generically.
const QUOTA_COOLDOWN_MS = 30 * 60 * 1000;
let quotaCooldownUntil = 0;

function isQuotaExhaustedError(
	message: string,
	statusCode: number | undefined,
): boolean {
	return (
		statusCode === 402 ||
		statusCode === 403 ||
		message.includes("prepayment credits are depleted") ||
		message.includes("RESOURCE_EXHAUSTED") ||
		/\b(quota|credits?)\b.*\b(depleted|exhausted|insufficient)\b/i.test(
			message,
		)
	);
}

/**
 * Parses the HTTP status code Sarvam embeds in its error message
 * (`generateWithSarvam` throws plain `Error`s, not typed API errors).
 */
function parseSarvamStatusCode(error: unknown): number | undefined {
	if (!(error instanceof Error)) {
		return undefined;
	}
	const match = error.message.match(/^Sarvam chat completion failed: (\d+)/);
	return match ? Number(match[1]) : undefined;
}

function buildSystemPrompt(): string {
	return `<role>
You are a precise financial-email detector. You determine whether an email is related to a bill, invoice, payment, or similar financial transaction, and extract structured details when it is.
</role>

<payment_email_types>
- invoice: a business invoice for goods/services rendered.
- bill: a recurring bill — utility, credit card, rent, insurance, tax, loan/EMI.
- subscription: a subscription renewal notice or charge.
- receipt: a payment confirmation or receipt for a completed transaction.
- reminder: a payment-due reminder (upcoming or overdue).
- other: any other financially relevant transactional email that doesn't fit the above (e.g. an e-commerce payment request).
</payment_email_types>

<instructions>
1. Examine the email's From, Subject, Snippet, and Body.
2. Decide whether this is genuinely a payment/bill-related email — not just any email that happens to mention money in passing.
3. If it is, extract: paymentType, merchant/company name, amount, currency (ISO 4217 code, e.g. "USD", "INR"), dueDate (ISO date, only if a clear due date is stated), and paymentStatus (whether the email indicates the amount is still owed, already paid, or overdue). paymentStatus MUST be exactly one of: "unpaid", "paid", "overdue", "unknown". paymentType MUST be exactly one of: "invoice", "bill", "subscription", "receipt", "reminder", "other".
4. Only include a field if it is clearly present in the email. Never guess or fabricate a value — omit fields you cannot determine from the text.
5. confidence must honestly reflect how certain you are that this is a payment-related email (0 = not at all, 1 = certain). Ordinary correspondence, marketing, or social notifications should score isPaymentEmail=false with low confidence in it being a payment email.
6. Do not rely only on keywords like "invoice" or "due" appearing in isolation — judge the email as a whole (sender, structure, intent).
</instructions>`;
}

function buildUserPrompt(email: ClassifiablePaymentEmail): string {
	return `<task>
Analyze the following email for payment/bill relevance.
</task>

<email>
From: ${email.from} <${email.fromEmail}>
Subject: ${email.subject}
Snippet: ${email.snippet}
Body: ${email.bodyText.substring(0, 2000)}
ReceivedAt: ${email.internalDate.toISOString()}
</email>`;
}

/**
 * Classifies a single email as payment-related or not, extracting structured
 * fields via Sarvam. Defaults to "not a payment email" (confidence 0) on any
 * ordinary error or missing API key — unlike email-categorizer's always-
 * bucket-somewhere default, the safe failure mode here is to create no card
 * at all rather than a low-quality one.
 *
 * Returns `null` instead when billing/quota is exhausted — that's not a real
 * classification, and persisting it as "not-payment" would permanently hide
 * a genuine bill for as long as the outage lasts. Callers should leave the
 * email unscanned (paymentScanCategory unset) on `null` so a later, healthy
 * poller tick retries it.
 */
export async function classifyPaymentEmail(
	email: ClassifiablePaymentEmail,
): Promise<PaymentClassification | null> {
	if (Date.now() < quotaCooldownUntil) {
		return null;
	}

	if (!process.env.SARVAM_API_KEY) {
		logger.warn(
			"[payment-classifier] SARVAM_API_KEY not set, skipping payment detection",
		);
		return NOT_A_PAYMENT_EMAIL;
	}

	const maxRetries = 3;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await generateWithSarvam({
				schema: PAYMENT_SCHEMA,
				system: buildSystemPrompt(),
				prompt: buildUserPrompt(email),
			});
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : String(error);
			const statusCode = parseSarvamStatusCode(error);

			if (isQuotaExhaustedError(message, statusCode)) {
				quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
				logger.error(
					"[payment-classifier] Sarvam quota/billing exhausted, pausing payment scanning",
					{ cooldownMs: QUOTA_COOLDOWN_MS, error: message },
				);
				return null;
			}

			if (statusCode === 429 && attempt < maxRetries) {
				const delay = 2 ** (attempt + 1) * 5000;
				logger.warn(
					"[payment-classifier] Sarvam rate limited, retrying",
					{
						attempt: attempt + 1,
						delayMs: delay,
					},
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			// Network errors, malformed output (no status code) and 429/5xx
			// are transient. Returning "not a payment email" here would be
			// persisted as paymentScanCategory="not-payment" and permanently
			// hide a real bill, so leave the email unscanned for a retry.
			const isTransient =
				statusCode === undefined ||
				statusCode === 429 ||
				statusCode >= 500;
			logger.error(
				isTransient
					? "[payment-classifier] Sarvam call failed, leaving email unscanned for retry"
					: "[payment-classifier] Sarvam call rejected, treating as not-a-payment-email",
				{ statusCode, error: message },
			);
			return isTransient ? null : NOT_A_PAYMENT_EMAIL;
		}
	}

	logger.error(
		"[payment-classifier] Exhausted all retries, leaving email unscanned for retry",
	);
	return null;
}
