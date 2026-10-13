import { ORPCError, streamToEventIterator } from "@orpc/client";
import {
	convertToModelMessages,
	streamText,
	textModel,
	tool,
	type UIMessage,
} from "@repo/ai";
import { canUseAiChat } from "@repo/payments/lib/plan-limits";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import {
	AI_INSTRUCTIONS_STYLE,
	CANONICAL_EXAMPLES,
} from "../../mailboxes/lib/ai-classification-contract";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";

// ─── Rule Proposal Schema ────────────────────────────────────────────────────

export const RuleProposalSchema = z.object({
	name: z.string(),
	condition: z.object({
		conditionalOperator: z.enum(["AND", "OR", "NONE"]).optional(),
		aiInstructions: z.string().optional(),
		staticFrom: z.string().optional(),
		staticTo: z.string().optional(),
		staticSubject: z.string().optional(),
	}),
	actions: z
		.array(
			z.object({
				type: z.enum([
					"LABEL",
					"MOVE_FOLDER",
					"ARCHIVE",
					"MARK_READ",
					"DRAFT_EMAIL",
					"REPLY",
					"FORWARD",
					"SEND_EMAIL",
					"MARK_SPAM",
					"DIGEST",
					"CALL_WEBHOOK",
				]),
				label: z.string().optional(),
				to: z.string().optional(),
				cc: z.string().optional(),
				bcc: z.string().optional(),
				subject: z.string().optional(),
				content: z.string().optional(),
				webhookUrl: z.string().optional(),
				folderName: z.string().optional(),
			}),
		)
		.min(1),
});

export type RuleProposal = z.infer<typeof RuleProposalSchema>;

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an email rule creation assistant. Your job is to have a friendly conversation with the user to understand their email management needs, then create structured rules.

<available_actions>
LABEL, MOVE_FOLDER, ARCHIVE, MARK_READ, DRAFT_EMAIL, REPLY, FORWARD, SEND_EMAIL, MARK_SPAM, DIGEST, CALL_WEBHOOK
</available_actions>

<condition_format>
Rules can match emails using:
- staticFrom: sender email/domain (e.g., "billing@stripe.com" or "stripe.com")
- staticTo: recipient email/domain
- staticSubject: subject keyword
- aiInstructions: AI classification criteria for content-based matching
- conditionalOperator: "AND" to require all conditions, "OR" for any, "NONE" if only one type

${AI_INSTRUCTIONS_STYLE}
</condition_format>

<workflow>
1. Ask clarifying questions to fully understand what the user wants.
2. Once you have enough information, call the proposeRule tool with a structured rule.
3. If the user rejects it, ask what they'd like changed, then call proposeRule again with the updated rule.
4. When the user accepts, say something like "Rule created! Would you like to create another rule?"
</workflow>

<examples>
Newsletter archiving: name="Newsletters", condition={conditionalOperator:"NONE", aiInstructions:"${CANONICAL_EXAMPLES.newsletter.aiInstructions}"}, actions=[{type:"ARCHIVE"},{type:"LABEL",label:"Newsletter"}]

From specific sender: name="Stripe Finance", condition={conditionalOperator:"NONE", staticFrom:"billing@stripe.com"}, actions=[{type:"LABEL",label:"Finance"},{type:"MARK_READ"}]

Combined condition: name="Stripe Disputes", condition={conditionalOperator:"AND", staticFrom:"stripe.com", aiInstructions:"Email is about a disputed charge — look for 'dispute', 'chargeback', 'evidence needed'"}, actions=[{type:"FORWARD",to:"legal@company.com"}]
</examples>

Always be conversational and helpful. Ask one or two focused questions at a time rather than overwhelming the user.`;

// ─── Procedure ────────────────────────────────────────────────────────────────

export const rulesAssistant = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/ai/rules-assistant",
		tags: ["AI"],
		summary: "Rules assistant",
		description: "Stream a rules assistant conversation",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			messages: z.array(z.any() as z.ZodType<UIMessage>),
		}),
	)
	.handler(async ({ input, context }) => {
		const { mailboxId, messages } = input;

		// Check if user can use AI chat (Premium only)
		const planId = await resolveUserPlan(context.user.id);
		if (!canUseAiChat(planId)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Rules assistant is only available on Premium plans. Please upgrade to access the rules assistant.",
			});
		}

		await verifyMailboxOwnership(mailboxId, context.user.id);

		const response = streamText({
			model: textModel,
			system: SYSTEM_PROMPT,
			messages: await convertToModelMessages(
				messages as unknown as UIMessage[],
			),
			tools: {
				proposeRule: tool({
					description:
						"Propose an email rule to the user for confirmation",
					inputSchema: RuleProposalSchema,
					// No execute → client-side tool
				}),
			},
		});

		return streamToEventIterator(response.toUIMessageStream());
	});
