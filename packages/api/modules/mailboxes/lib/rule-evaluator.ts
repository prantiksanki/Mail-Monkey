/**
 * AI Email Classification — Evaluator
 *
 * Contract between compiler (compile-rules.ts) and evaluator (this file):
 *
 * The compiler generates `aiInstructions` strings that describe observable email
 * properties a classifier can check against. These strings follow a canonical
 * format defined in ai-classification-contract.ts:
 *   - Start with "Email is a [category]"
 *   - Follow with observable indicators after an em dash
 *   - Reference only the fields this evaluator can see
 *
 * The evaluator receives an email and an `aiInstructions` string, then decides
 * whether the email matches. It uses a structured prompt with few-shot examples
 * drawn from the shared contract, and structured output for reliable JSON
 * output. When uncertain, the evaluator defaults to false (no match).
 */

import { generateWithSarvam } from "@repo/ai";
import { logger } from "@repo/logs";
import { z } from "zod";
import type { RuleCondition } from "../types";
import {
	CANONICAL_EXAMPLES,
	OBSERVABLE_FIELDS_DESCRIPTION,
} from "./ai-classification-contract";
import type { ParsedEmail } from "./email-parser";

const MATCH_ZOD_SCHEMA = z.object({
	match: z.boolean(),
});

// ─── System prompt (static) ───────────────────────────────────────────────────

function buildEvaluatorSystem(): string {
	const { newsletter, githubPRComment, deploySuccess, urgentAttention } =
		CANONICAL_EXAMPLES;

	return `<role>
You are a precise email classifier. Your job is to determine whether a given email matches a classification rule. You analyze observable email properties to make a binary match/no-match decision.
</role>

<context>
${OBSERVABLE_FIELDS_DESCRIPTION}

This AI classification may run alongside static sender/recipient/subject filters. Focus only on what this rule describes — other conditions are handled separately.
</context>

<instructions>
1. Read the classification rule carefully. It describes observable email properties to look for.
2. Examine the email's From, To, Subject, Snippet, Body, and Labels fields.
3. Determine whether the email clearly satisfies the rule's criteria based on these observable fields.
4. Return {"match": true} only if the email clearly matches. Return {"match": false} otherwise.
</instructions>

<constraints>
1. A match means the email clearly satisfies the rule's classification criteria based on observable properties.
2. When uncertain or when the email only partially matches, return {"match": false}.
3. Do not infer intent beyond what is observable in the email fields.
4. Evaluate the rule as-is — do not add conditions or relax criteria.
5. If the rule excludes a specific sub-category (e.g., "not a review request"), verify the email does not belong to that excluded category.
6. Do not match on isolated keywords. An automated, transactional, or system-generated message (e.g., a security alert, sign-in notification, OTP, receipt, or any message from a no-reply / notifications / accounts sender) does NOT satisfy a rule about human intent (such as urgency or a request for action) just because it contains alarming or action-sounding words. Judge what the email actually IS and who sent it, not which words appear in it.
</constraints>

<examples>
<example>
<rule>${newsletter.aiInstructions}</rule>
<email>
From: ${newsletter.evaluatorExamples.match.from}
To: ${newsletter.evaluatorExamples.match.to}
Subject: ${newsletter.evaluatorExamples.match.subject}
Snippet: ${newsletter.evaluatorExamples.match.snippet}
Body: ${newsletter.evaluatorExamples.match.body}
Labels: ${newsletter.evaluatorExamples.match.labels}
</email>
<explanation>${newsletter.evaluatorExamples.match.reasoning}</explanation>
<result>{"match": true}</result>
</example>

<example>
<rule>${newsletter.aiInstructions}</rule>
<email>
From: ${newsletter.evaluatorExamples.noMatch.from}
To: ${newsletter.evaluatorExamples.noMatch.to}
Subject: ${newsletter.evaluatorExamples.noMatch.subject}
Snippet: ${newsletter.evaluatorExamples.noMatch.snippet}
Body: ${newsletter.evaluatorExamples.noMatch.body}
Labels: ${newsletter.evaluatorExamples.noMatch.labels}
</email>
<explanation>${newsletter.evaluatorExamples.noMatch.reasoning}</explanation>
<result>{"match": false}</result>
</example>

<example>
<rule>${githubPRComment.aiInstructions}</rule>
<email>
From: ${githubPRComment.evaluatorExamples.noMatch.from}
To: ${githubPRComment.evaluatorExamples.noMatch.to}
Subject: ${githubPRComment.evaluatorExamples.noMatch.subject}
Snippet: ${githubPRComment.evaluatorExamples.noMatch.snippet}
Body: ${githubPRComment.evaluatorExamples.noMatch.body}
Labels: ${githubPRComment.evaluatorExamples.noMatch.labels}
</email>
<explanation>${githubPRComment.evaluatorExamples.noMatch.reasoning}</explanation>
<result>{"match": false}</result>
</example>

<example>
<rule>${deploySuccess.aiInstructions}</rule>
<email>
From: ${deploySuccess.evaluatorExamples.noMatch.from}
To: ${deploySuccess.evaluatorExamples.noMatch.to}
Subject: ${deploySuccess.evaluatorExamples.noMatch.subject}
Snippet: ${deploySuccess.evaluatorExamples.noMatch.snippet}
Body: ${deploySuccess.evaluatorExamples.noMatch.body}
Labels: ${deploySuccess.evaluatorExamples.noMatch.labels}
</email>
<explanation>${deploySuccess.evaluatorExamples.noMatch.reasoning}</explanation>
<result>{"match": false}</result>
</example>

<example>
<rule>${urgentAttention.aiInstructions}</rule>
<email>
From: ${urgentAttention.evaluatorExamples.match.from}
To: ${urgentAttention.evaluatorExamples.match.to}
Subject: ${urgentAttention.evaluatorExamples.match.subject}
Snippet: ${urgentAttention.evaluatorExamples.match.snippet}
Body: ${urgentAttention.evaluatorExamples.match.body}
Labels: ${urgentAttention.evaluatorExamples.match.labels}
</email>
<explanation>${urgentAttention.evaluatorExamples.match.reasoning}</explanation>
<result>{"match": true}</result>
</example>

<example>
<rule>${urgentAttention.aiInstructions}</rule>
<email>
From: ${urgentAttention.evaluatorExamples.noMatch.from}
To: ${urgentAttention.evaluatorExamples.noMatch.to}
Subject: ${urgentAttention.evaluatorExamples.noMatch.subject}
Snippet: ${urgentAttention.evaluatorExamples.noMatch.snippet}
Body: ${urgentAttention.evaluatorExamples.noMatch.body}
Labels: ${urgentAttention.evaluatorExamples.noMatch.labels}
</email>
<explanation>${urgentAttention.evaluatorExamples.noMatch.reasoning}</explanation>
<result>{"match": false}</result>
</example>
</examples>`;
}

// ─── User prompt (dynamic per email) ─────────────────────────────────────────

function buildEvaluatorPrompt(
	email: ParsedEmail,
	aiInstructions: string,
): string {
	return `<task>
Classify the following email against the given rule.
</task>

<rule>${aiInstructions}</rule>

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
 * (`generateWithSarvam` throws plain `Error`s, not typed API errors).
 */
function parseSarvamStatusCode(error: unknown): number | undefined {
	if (!(error instanceof Error)) {
		return undefined;
	}
	const match = error.message.match(/^Sarvam chat completion failed: (\d+)/);
	return match ? Number(match[1]) : undefined;
}

async function evaluateAiCondition(
	email: ParsedEmail,
	aiInstructions: string,
): Promise<boolean> {
	if (!process.env.SARVAM_API_KEY) {
		logger.warn(
			"[rule-evaluator] SARVAM_API_KEY not set, skipping AI condition",
		);
		return false;
	}

	logger.info("[rule-evaluator] Starting Sarvam evaluation", {
		messageId: email.id,
		subject: email.subject,
		from: email.from,
		aiInstructions,
	});

	const maxRetries = 3;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			logger.info("[rule-evaluator] Calling Sarvam", {
				messageId: email.id,
				attempt: attempt + 1,
			});

			const { match } = await generateWithSarvam({
				schema: MATCH_ZOD_SCHEMA,
				temperature: 0,
				system: buildEvaluatorSystem(),
				prompt: buildEvaluatorPrompt(email, aiInstructions),
			});

			logger.info("[rule-evaluator] Sarvam responded", {
				messageId: email.id,
				match,
				aiInstructions,
			});

			return match === true;
		} catch (error: unknown) {
			const statusCode = parseSarvamStatusCode(error);

			if (statusCode === 429 && attempt < maxRetries) {
				const delay = 2 ** (attempt + 1) * 5000;
				logger.warn("[rule-evaluator] Sarvam rate limited, retrying", {
					messageId: email.id,
					attempt: attempt + 1,
					delayMs: delay,
				});
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			logger.error("[rule-evaluator] Sarvam call failed", {
				messageId: email.id,
				aiInstructions,
				statusCode,
				error: error instanceof Error ? error.message : String(error),
			});
			throw new Error(
				`AI evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	throw new Error("[rule-evaluator] Exhausted all retries for AI evaluation");
}

export async function evaluateRule(
	email: ParsedEmail,
	condition: RuleCondition,
): Promise<boolean> {
	const hasStatic =
		condition.static &&
		(condition.static.from ||
			condition.static.to ||
			condition.static.subject);
	const hasAi = !!condition.aiInstructions;

	// No conditions at all → always match
	if (!hasStatic && !hasAi) {
		logger.info("[rule-evaluator] No conditions defined, auto-match", {
			messageId: email.id,
		});
		return true;
	}

	const results: boolean[] = [];

	// Evaluate static conditions — case-insensitive substring matching
	if (condition.static?.from) {
		const pattern = condition.static.from.toLowerCase();
		const matched =
			email.fromEmail.includes(pattern) ||
			email.from.toLowerCase().includes(pattern);
		logger.info("[rule-evaluator] Static from condition", {
			messageId: email.id,
			pattern,
			emailFrom: email.from,
			matched,
		});
		results.push(matched);
	}

	if (condition.static?.to) {
		const pattern = condition.static.to.toLowerCase();
		const matched =
			email.toEmail.includes(pattern) ||
			email.to.toLowerCase().includes(pattern);
		logger.info("[rule-evaluator] Static to condition", {
			messageId: email.id,
			pattern,
			matched,
		});
		results.push(matched);
	}

	if (condition.static?.subject) {
		const pattern = condition.static.subject.toLowerCase();
		const matched = email.subject.toLowerCase().includes(pattern);
		logger.info("[rule-evaluator] Static subject condition", {
			messageId: email.id,
			pattern,
			subject: email.subject,
			matched,
		});
		results.push(matched);
	}

	// Evaluate AI condition — but first try to short-circuit with a fast static
	// check extracted from the instruction text.  Pattern: "from <name>" /
	// "sender is <name>" / "sent by <name>".  This avoids an expensive LLM call
	// when the instruction is a simple sender rule, and prevents silent misses
	// when the LLM model is unavailable or returns a wrong answer.
	//
	// Guard: instructions are often full prose (e.g. "This email is from a
	// real, named individual... not sent by a platform"), where the word
	// immediately after "from"/"sent by" is a grammatical article or pronoun
	// ("a", "an", "any", "me") rather than a sender name/domain. Since almost
	// every email address contains such short substrings, matching on them
	// forces a false match and silently bypasses the AI check (and any
	// exclusion clause in the instructions) for most emails. Only allow the
	// short-circuit when the captured keyword is long enough and isn't a
	// common function word to still look like an actual name/domain token.
	const SHORT_CIRCUIT_STOPWORDS = new Set([
		"this",
		"that",
		"they",
		"them",
		"their",
		"your",
		"someone",
		"somebody",
		"anyone",
		"anybody",
		"another",
		"platform",
		"system",
		"service",
		"company",
	]);
	const MIN_SHORT_CIRCUIT_KEYWORD_LENGTH = 4;

	if (hasAi && condition.aiInstructions) {
		const instruction = condition.aiInstructions.toLowerCase();
		const fromPatterns = [
			/\bfrom\s+([a-z0-9._-]+)/,
			/\bsender\s+is\s+([a-z0-9._-]+)/,
			/\bsent\s+by\s+([a-z0-9._-]+)/,
			/\bemail\s+is\s+from\s+([a-z0-9._-]+)/,
		];
		let staticShortCircuit = false;
		for (const re of fromPatterns) {
			const m = instruction.match(re);
			if (m?.[1]) {
				const keyword = m[1];
				if (
					keyword.length < MIN_SHORT_CIRCUIT_KEYWORD_LENGTH ||
					SHORT_CIRCUIT_STOPWORDS.has(keyword)
				) {
					continue;
				}
				if (
					email.fromEmail.includes(keyword) ||
					email.from.toLowerCase().includes(keyword)
				) {
					logger.info(
						"[rule-evaluator] AI from-keyword short-circuit match",
						{ messageId: email.id, keyword },
					);
					staticShortCircuit = true;
					break;
				}
			}
		}

		if (staticShortCircuit) {
			results.push(true);
		} else {
			try {
				const aiResult = await evaluateAiCondition(
					email,
					condition.aiInstructions,
				);
				results.push(aiResult);
			} catch (aiError) {
				// AI model unavailable — degrade gracefully to false instead of
				// crashing the whole message evaluation and creating an error log.
				logger.warn(
					"[rule-evaluator] AI condition failed, defaulting to false",
					{
						messageId: email.id,
						error:
							aiError instanceof Error
								? aiError.message
								: String(aiError),
					},
				);
				results.push(false);
			}
		}
	}

	if (results.length === 0) {
		return true;
	}

	const operator = condition.conditionalOperator === "OR" ? "OR" : "AND";
	const finalResult =
		operator === "OR" ? results.some(Boolean) : results.every(Boolean);

	logger.info("[rule-evaluator] Final condition result", {
		messageId: email.id,
		operator,
		results,
		finalResult,
	});

	return finalResult;
}
