/**
 * Email category classification for the Dashboard's "Inbox Overview" donut.
 *
 * Deliberately NOT built on ai-classification-contract.ts — that module is the
 * compiler↔evaluator contract for dynamic, user-authored rule conditions
 * (arbitrary aiInstructions strings). This is a fixed 4-way enum classifier
 * with nothing to negotiate with a compiler, so it gets its own small,
 * self-contained prompt. It reuses the *pattern* from rule-evaluator.ts
 * (single-email call, 429 retry with backoff) rather than the contract
 * module itself.
 *
 * Runs on Sarvam rather than Gemini — this classifier fires on every synced
 * email, and the hosted Sarvam API has no per-call billing/prepay balance to
 * run out of (see the Oct 2026 Gemini 402 "prepayment credits depleted"
 * outage, which this swap avoids).
 */

import { generateWithSarvam } from "@repo/ai";
import { logger } from "@repo/logs";
import { z } from "zod";

export const CATEGORY_LABELS = [
	"PRIMARY",
	"NEWSLETTER",
	"PROMOTION",
	"SOCIAL",
] as const;

export type CategoryLabel = (typeof CATEGORY_LABELS)[number];

const CATEGORY_SCHEMA = z.object({
	category: z.enum(CATEGORY_LABELS),
});

export interface CategorizableEmail {
	from: string;
	to: string;
	subject: string;
	snippet: string;
	bodyText: string;
	labelIds: string[];
}

/**
 * Free, zero-latency pre-classification using Gmail's own category labels.
 * Only the two unambiguous buckets are fast-pathed: CATEGORY_PROMOTIONS and
 * CATEGORY_SOCIAL map 1:1 onto our taxonomy. CATEGORY_UPDATES/FORUMS/PERSONAL
 * and the absence of any CATEGORY_* label are deliberately routed through the
 * real classifier below — Updates in particular mixes receipts, shipping
 * notifications, and genuine newsletters, so it doesn't map cleanly.
 */
export function fastPathCategoryFromGmailLabels(
	labelIds: string[],
): CategoryLabel | null {
	if (labelIds.includes("CATEGORY_PROMOTIONS")) {
		return "PROMOTION";
	}
	if (labelIds.includes("CATEGORY_SOCIAL")) {
		return "SOCIAL";
	}
	return null;
}

function buildSystemPrompt(): string {
	return `<role>
You are a precise email categorizer. You sort emails into exactly one of four buckets based on observable properties: sender, subject, snippet, body, and Gmail-style labels.
</role>

<categories>
- NEWSLETTER: a newsletter or marketing digest — unsubscribe links, bulk sender patterns (digest@, newsletter@, noreply@), mailing list content.
- PROMOTION: a promotional or marketing offer — deals, sales, percent-off language, "limited time offer", coupon codes.
- SOCIAL: a notification from a social network or community platform — LinkedIn, Facebook, X/Twitter, Instagram, Reddit, Discord, etc. (connection requests, likes, mentions, comments).
- PRIMARY: everything else — personal correspondence, work/business email, transactional receipts, account/security notices, and anything that isn't clearly one of the three buckets above. This is the default when uncertain.
</categories>

<instructions>
1. Examine the email's From, To, Subject, Snippet, Body, and Labels fields.
2. Pick the single best-fitting category.
3. When genuinely uncertain or the email is ordinary correspondence/business mail, choose PRIMARY — never guess NEWSLETTER/PROMOTION/SOCIAL without a clear signal.
</instructions>`;
}

function buildUserPrompt(email: CategorizableEmail): string {
	return `<task>
Categorize the following email.
</task>

<email>
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Snippet: ${email.snippet}
Body: ${email.bodyText.substring(0, 2000)}
Labels: ${email.labelIds.join(", ")}
</email>`;
}

/**
 * Parses the HTTP status code Sarvam embeds in its error message
 * (`generateWithSarvam` throws plain `Error`s, not typed API errors), so the
 * 429 retry path below can still recognize a rate limit.
 */
function parseSarvamStatusCode(error: unknown): number | undefined {
	if (!(error instanceof Error)) {
		return undefined;
	}
	const match = error.message.match(/^Sarvam chat completion failed: (\d+)/);
	return match ? Number(match[1]) : undefined;
}

/**
 * Classifies a single email via Sarvam. Defaults to PRIMARY on any error
 * after exhausting retries — unlike rule-evaluator's default-to-false, every
 * email must land in exactly one bucket, and "treat as ordinary mail" is the
 * safe failure mode (never silently mis-bucket real mail as clutter).
 */
export async function classifyEmailCategory(
	email: CategorizableEmail,
): Promise<CategoryLabel> {
	const fastPath = fastPathCategoryFromGmailLabels(email.labelIds);
	if (fastPath) {
		return fastPath;
	}

	if (!process.env.SARVAM_API_KEY) {
		logger.warn(
			"[email-categorizer] SARVAM_API_KEY not set, defaulting to PRIMARY",
		);
		return "PRIMARY";
	}

	const maxRetries = 3;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const { category } = await generateWithSarvam({
				schema: CATEGORY_SCHEMA,
				system: buildSystemPrompt(),
				prompt: buildUserPrompt(email),
			});

			return category;
		} catch (error: unknown) {
			const statusCode = parseSarvamStatusCode(error);

			if (statusCode === 429 && attempt < maxRetries) {
				const delay = 2 ** (attempt + 1) * 5000;
				logger.warn(
					"[email-categorizer] Sarvam rate limited, retrying",
					{
						attempt: attempt + 1,
						delayMs: delay,
					},
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			logger.error(
				"[email-categorizer] Sarvam call failed, defaulting to PRIMARY",
				{
					statusCode,
					error:
						error instanceof Error ? error.message : String(error),
				},
			);
			return "PRIMARY";
		}
	}

	logger.error(
		"[email-categorizer] Exhausted all retries, defaulting to PRIMARY",
	);
	return "PRIMARY";
}
