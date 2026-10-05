import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ORPCError } from "@orpc/server";
import { generateObject } from "@repo/ai";
import { logger } from "@repo/logs";
import { canUseRuleEngine } from "@repo/payments/lib/plan-limits";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import {
	AI_INSTRUCTIONS_STYLE,
	CANONICAL_EXAMPLES,
} from "../lib/ai-classification-contract";
import { verifyMailboxOwnership } from "../lib/ownership";
import { CreateRuleSchema } from "../types";

// ─── Zod Schema ──────────────────────────────────────────────────────────────
// KEY FIX: aiInstructions is type string (NOT nullable).
// The model MUST produce a string — it cannot take the null shortcut.
// For pure-static conditions, it writes "" (empty string).
// transformResponse() converts "" → null downstream.

const ActionZodSchema = z.object({
	type: z.enum([
		"LABEL",
		"ARCHIVE",
		"MARK_READ",
		"DRAFT_EMAIL",
		"REPLY",
		"FORWARD",
		"MARK_SPAM",
	]),
	label: z.string().optional(),
	to: z.string().optional(),
	cc: z.string().optional(),
	bcc: z.string().optional(),
	subject: z.string().optional(),
	content: z.string().optional(),
});

const RULE_ZOD_SCHEMA = z.object({
	rules: z.array(
		z.object({
			name: z.string(),
			condition: z.object({
				conditionalOperator: z.enum(["AND", "OR", "NONE"]),
				aiInstructions: z.string(),
				staticFrom: z.string(),
				staticTo: z.string(),
				staticSubject: z.string(),
			}),
			actions: z.array(ActionZodSchema).min(1),
		}),
	),
});

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `<role>
You convert natural language email management requests into structured JSON rules.
</role>

<context>
Your output is consumed by a downstream email classifier that sees: From, To, Subject, Snippet, Body (first 2000 chars), and Labels.

<condition_fields>
Every rule condition has ALL of these fields (none are optional):

- staticFrom: sender email/domain to match, or "" if not specified
- staticTo: recipient email/domain to match, or "" if not specified
- staticSubject: subject keyword to match, or "" if not needed
- aiInstructions: classification criteria for the downstream classifier, or "" if not needed
- conditionalOperator: "AND" if combining static + aiInstructions, "OR" if user says "or", "NONE" if only one type is used

When to write aiInstructions: any time the user describes a content type, category, intent, or tone (e.g., "about disputes", "critical alerts", "billing notifications", "security findings"). If the user says "from X about Y", then staticFrom handles X and aiInstructions handles "about Y".

When to leave aiInstructions as "": only when the condition is purely about who sent it, who received it, or a literal subject keyword — with no content filtering at all.

${AI_INSTRUCTIONS_STYLE}
</condition_fields>

<action_types>
LABEL, ARCHIVE, MARK_READ, DRAFT_EMAIL, REPLY, FORWARD, MARK_SPAM
</action_types>
</context>

<examples>
<example>
<input>If sender is billing@stripe.com, label as 'Finance' and mark as read</input>
<o>{"rules": [{"name": "Stripe", "condition": {"conditionalOperator": "NONE", "staticFrom": "billing@stripe.com", "staticTo": "", "staticSubject": "", "aiInstructions": ""}, "actions": [{"type": "LABEL", "label": "Finance"}, {"type": "MARK_READ"}]}]}</o>
</example>

<example>
<input>When I get a newsletter, archive it and label it as 'Newsletter'</input>
<o>{"rules": [{"name": "Newsletters", "condition": {"conditionalOperator": "NONE", "staticFrom": "", "staticTo": "", "staticSubject": "", "aiInstructions": "${CANONICAL_EXAMPLES.newsletter.aiInstructions}"}, "actions": [{"type": "ARCHIVE"}, {"type": "LABEL", "label": "Newsletter"}]}]}</o>
</example>

<example>
<input>If someone from stripe.com emails me about a disputed charge, forward to legal@mycompany.com</input>
<o>{"rules": [{"name": "Stripe Dispute", "condition": {"conditionalOperator": "AND", "staticFrom": "stripe.com", "staticTo": "", "staticSubject": "", "aiInstructions": "Email is about a disputed charge or chargeback — look for phrases like 'dispute', 'chargeback', 'disputed payment', 'evidence needed', or 'charge has been disputed' in the Subject or Body"}, "actions": [{"type": "FORWARD", "to": "legal@mycompany.com"}]}]}</o>
</example>

<example>
<input>If the subject says 'Invoice' and it's from a vendor I don't recognize, label as 'Review Invoices'</input>
<o>{"rules": [{"name": "Review Invoices", "condition": {"conditionalOperator": "AND", "staticFrom": "", "staticTo": "", "staticSubject": "Invoice", "aiInstructions": "Email sender appears to be an unfamiliar or external vendor — look for a sender domain that is not a well-known personal service and email content that resembles a billing or vendor communication rather than internal correspondence"}, "actions": [{"type": "LABEL", "label": "Review Invoices"}]}]}</o>
</example>

<example>
<input>When datadog.com sends me a critical alert, forward to oncall@myteam.com</input>
<o>{"rules": [{"name": "Critical Alert", "condition": {"conditionalOperator": "AND", "staticFrom": "datadog.com", "staticTo": "", "staticSubject": "", "aiInstructions": "Email is a critical or high-severity alert — look for phrases like 'critical', 'alert', 'triggered', 'threshold exceeded', 'incident', or 'P1/P2' severity indicators in the Subject or Body"}, "actions": [{"type": "FORWARD", "to": "oncall@myteam.com"}]}]}</o>
</example>

<example>
<input>For AWS emails: if it's a billing alert over budget, label 'Cost Alert' and forward to finance@company.com. If it's a security finding, label 'Security'. Archive everything else from AWS.</input>
<o>{"rules": [{"name": "Cost Alert", "condition": {"conditionalOperator": "AND", "staticFrom": "amazonaws.com", "staticTo": "", "staticSubject": "", "aiInstructions": "Email is a billing or budget alert — look for phrases like 'budget exceeded', 'cost anomaly', 'billing alert', 'over budget', or dollar amounts indicating unexpected charges"}, "actions": [{"type": "LABEL", "label": "Cost Alert"}, {"type": "FORWARD", "to": "finance@company.com"}]}, {"name": "Security", "condition": {"conditionalOperator": "AND", "staticFrom": "amazonaws.com", "staticTo": "", "staticSubject": "", "aiInstructions": "Email is a security finding or vulnerability notification — look for phrases like 'security finding', 'GuardDuty', 'vulnerability', 'exposed', 'unauthorized access', or 'compliance'"}, "actions": [{"type": "LABEL", "label": "Security"}]}, {"name": "AWS Other", "condition": {"conditionalOperator": "NONE", "staticFrom": "amazonaws.com", "staticTo": "", "staticSubject": "", "aiInstructions": ""}, "actions": [{"type": "ARCHIVE"}]}]}</o>
</example>

<example>
<input>For GitHub PRs: label as Code/PRs. Mark as read if it's a comment.</input>
<o>{"rules": [{"name": "PR Comments", "condition": {"conditionalOperator": "AND", "staticFrom": "notifications@github.com", "staticTo": "", "staticSubject": "", "aiInstructions": "${CANONICAL_EXAMPLES.githubPRComment.aiInstructions}"}, "actions": [{"type": "LABEL", "label": "Code/PRs"}, {"type": "MARK_READ"}]}, {"name": "PR Other", "condition": {"conditionalOperator": "AND", "staticFrom": "notifications@github.com", "staticTo": "", "staticSubject": "", "aiInstructions": "Email is about a pull request but is NOT a code review comment — look for review requests, merge notifications, or general PR activity rather than inline comments or review feedback"}, "actions": [{"type": "LABEL", "label": "Code/PRs"}]}]}</o>
</example>

<example>
<input>For deployments: label as DevOps. Archive if successful, keep unread if failed.</input>
<o>{"rules": [{"name": "Deploy OK", "condition": {"conditionalOperator": "NONE", "staticFrom": "", "staticTo": "", "staticSubject": "", "aiInstructions": "${CANONICAL_EXAMPLES.deploySuccess.aiInstructions}"}, "actions": [{"type": "LABEL", "label": "DevOps"}, {"type": "ARCHIVE"}]}, {"name": "Deploy Fail", "condition": {"conditionalOperator": "NONE", "staticFrom": "", "staticTo": "", "staticSubject": "", "aiInstructions": "${CANONICAL_EXAMPLES.deployFailure.aiInstructions}"}, "actions": [{"type": "LABEL", "label": "DevOps"}]}]}</o>
</example>
</examples>`;

// ─── Transform: flat schema → nested app format ──────────────────────────────
// Converts "" → null for all optional fields

type FlatRule = z.infer<typeof RULE_ZOD_SCHEMA>["rules"][number];

function transformResponse(flatResponse: { rules: FlatRule[] }) {
	return {
		rules: flatResponse.rules.map((rule) => {
			const {
				staticFrom,
				staticTo,
				staticSubject,
				aiInstructions,
				conditionalOperator,
			} = rule.condition;

			const hasStatic = staticFrom || staticTo || staticSubject;
			const hasAi = aiInstructions.length > 0;

			return {
				name: rule.name,
				condition: {
					conditionalOperator:
						conditionalOperator === "NONE"
							? null
							: conditionalOperator,
					aiInstructions: hasAi ? aiInstructions : null,
					static: hasStatic
						? {
								from: staticFrom || null,
								to: staticTo || null,
								subject: staticSubject || null,
							}
						: null,
				},
				actions: rule.actions.map((action) => {
					const { type, label, to, cc, bcc, subject, content } =
						action;
					const fields: Record<string, string> = {};
					if (label) {
						fields.label = label;
					}
					if (to) {
						fields.to = to;
					}
					if (cc) {
						fields.cc = cc;
					}
					if (bcc) {
						fields.bcc = bcc;
					}
					if (subject) {
						fields.subject = subject;
					}
					if (content) {
						fields.content = content;
					}

					return {
						type,
						...(Object.keys(fields).length > 0 ? { fields } : {}),
					};
				}),
			};
		}),
	};
}

// ─── Validation: detect likely missing aiInstructions ────────────────────────

const CONTENT_SIGNAL_PATTERNS = [
	/\babout\b/i,
	/\bif it'?s\s+a\b/i,
	/\bwhen.*(?:is|are|contains?|mentions?|says?)\b/i,
	/\b(?:critical|urgent|important|security|billing|fraud|alert|notification|digest|newsletter|promo|marketing)\b/i,
	/\b(?:over budget|threshold|exceeded|failed|success)\b/i,
	/\bunless\b/i,
	/\bbut (?:only|not)\b/i,
	/\b(?:type|kind|category)\s+of\b/i,
];

function promptLikelyNeedsAiInstructions(prompt: string): boolean {
	return CONTENT_SIGNAL_PATTERNS.some((pattern) => pattern.test(prompt));
}

function rulesAreMissingAiInstructions(
	rules: Array<{ condition: { aiInstructions: string | null } }>,
): boolean {
	return rules.every((rule) => !rule.condition.aiInstructions);
}

export const compileRules = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/rules/compile",
		tags: ["Mailboxes"],
		summary: "Compile rules from natural language",
		description: "Use AI to convert natural language into structured rules",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			prompt: z.string().min(5).max(2000),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const planId = await resolveUserPlan(context.user.id);
		if (!canUseRuleEngine(planId)) {
			throw new ORPCError("FORBIDDEN", {
				message: "AI rule compilation requires a Pro or Premium plan.",
			});
		}

		const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!apiKey) {
			logger.error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "AI rule compilation is not available",
			});
		}

		try {
			const google = createGoogleGenerativeAI({ apiKey });

			const makeUserPrompt = (userInput: string, retry = false) => {
				const retryHint = retry
					? `\n\nIMPORTANT: The user's request describes email content types or categories, not just senders. You MUST write aiInstructions for rules that filter by content. An empty aiInstructions means the rule matches ALL emails from that sender with no content filtering — only do this if that's what the user wants.\n`
					: "";

				return `<user_input>
${userInput}
</user_input>

<task>
Convert the user input into email management rules following the schema and examples.
For each rule, decide: does the user want to match ALL emails from a sender, or only specific TYPES of emails? If specific types, write aiInstructions.${retryHint}
</task>`;
			};

			const runCompiler = async (userPrompt: string) => {
				const { object } = await generateObject({
					model: google("gemini-3.5-flash"),
					schema: RULE_ZOD_SCHEMA,
					temperature: 0.1,
					system: SYSTEM_PROMPT,
					prompt: userPrompt,
				});
				return transformResponse(object);
			};

			// First attempt
			let transformed = await runCompiler(makeUserPrompt(input.prompt));

			// Safety net: retry if the prompt likely needs AI conditions but none were generated
			if (
				promptLikelyNeedsAiInstructions(input.prompt) &&
				rulesAreMissingAiInstructions(transformed.rules)
			) {
				logger.warn(
					"AI instructions likely missing, retrying with hint",
					{ prompt: input.prompt },
				);
				transformed = await runCompiler(
					makeUserPrompt(input.prompt, true),
				);
			}

			// Filter out rules with empty actions before validation
			const validatedRules = transformed.rules
				.filter((rule) => rule.actions.length > 0)
				.map((rule) => CreateRuleSchema.parse(rule));

			return { rules: validatedRules };
		} catch (error) {
			logger.error("Failed to compile rules:", { error });
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Could not compile rules from natural language",
			});
		}
	});
