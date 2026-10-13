import { z } from "zod";

// Pure prompt/schema helpers for AI draft generation. Kept free of database and
// AI-SDK imports so it can be unit-tested without a DATABASE_URL or network.

// ─── Constants ───────────────────────────────────────────────────────────────

/** The three reply tones the panel always offers. */
export const DRAFT_TONES = ["professional", "friendly", "formal"] as const;

export type DraftTone = (typeof DRAFT_TONES)[number];

/** Cap the email body we send to the model to keep prompts small and cheap. */
export const MAX_BODY_CHARS = 6000;

// ─── Input Schema ────────────────────────────────────────────────────────────

export const GenerateDraftsInputSchema = z.object({
	mailboxId: z.string().min(1),
	subject: z.string().max(998).optional(),
	/** Plain-text body of the email being replied to (HTML already stripped). */
	body: z.string().min(1, "Email body is required").max(50_000),
	/** Display name of the sender we're replying to. */
	fromName: z.string().max(320).optional(),
	fromEmail: z.string().max(320).optional(),
	/** Name of the mailbox owner, used to sign the reply. */
	senderName: z.string().max(320).optional(),
});

export type GenerateDraftsInput = z.infer<typeof GenerateDraftsInputSchema>;

// ─── Output Schema ───────────────────────────────────────────────────────────

const DraftSchema = z.object({
	tone: z.enum(DRAFT_TONES),
	/** Model's confidence that the draft addresses the email well. */
	confidence: z.enum(["high", "medium", "low"]),
	/** The reply body, plain text with line breaks. */
	body: z.string(),
});

export const GenerateDraftsResultSchema = z.object({
	/** One-sentence summary of what the incoming email is asking for. */
	intent: z.string(),
	drafts: z.array(DraftSchema).length(3),
});

export type GenerateDraftsResult = z.infer<typeof GenerateDraftsResultSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

export const DRAFT_SYSTEM_PROMPT = `<role>
You are an assistant that drafts email replies. Given the email a user received, you write three reply drafts in three distinct tones and detect what the email is asking for.
</role>

<tones>
- professional: clear, competent, courteous business English. Neutral warmth.
- friendly: warm, personable, conversational. Contractions welcome.
- formal: polished, respectful, more structured. No contractions, no slang.
</tones>

<rules>
- Reply from the perspective of the person who RECEIVED the email (the user), replying to the sender.
- Address every concrete request in the email (questions, meeting times, requested attachments/actions).
- Do NOT invent facts, commitments, dates, prices, or attachments the user did not provide. If a detail is unknown, keep it general (e.g. "I'll send it over shortly").
- Keep each draft self-contained: a greeting, the body, and a sign-off.
- Sign off with the user's name when provided; otherwise omit the name line.
- Output plain text only — no markdown, no subject line, no "Draft:" prefixes.
- "intent" must be one concise sentence describing what the sender wants.
- Set "confidence" per draft based on how well the email's requests are addressable from the given content.
</rules>

<output_format>
Respond with a single JSON object of exactly this shape — no extra text outside the JSON:
{"intent": string, "drafts": [{"tone": "professional"|"friendly"|"formal", "confidence": "high"|"medium"|"low", "body": string}, ...]}
"drafts" must have exactly 3 entries, one per tone, in the order professional, friendly, formal.
</output_format>`;

/**
 * Builds the user prompt sent to the model. Pure so it can be unit-tested
 * without hitting the AI provider.
 */
export function buildDraftPrompt(input: GenerateDraftsInput): string {
	const body = input.body.slice(0, MAX_BODY_CHARS);
	const from =
		[input.fromName, input.fromEmail && `<${input.fromEmail}>`]
			.filter(Boolean)
			.join(" ") || "the sender";

	return `<email_to_reply_to>
From: ${from}
Subject: ${input.subject?.trim() || "(no subject)"}

${body}
</email_to_reply_to>

<user_signature>
${input.senderName?.trim() || "(no name provided — omit the name line in the sign-off)"}
</user_signature>

<task>
1. Detect the sender's intent in one sentence.
2. Write exactly three reply drafts, one each for the professional, friendly, and formal tones, in that order.
</task>`;
}
