import { z } from "zod";

// Pure schema/prompt helpers for the public "speak your mind" marketing demo —
// kept free of database and AI-SDK imports so it can be unit-tested without a
// DATABASE_URL or network, mirroring generate-drafts.prompt.ts.
//
// All four tones are generated in a single model call (like generate-drafts'
// three reply tones) so the UI can switch between them instantly without a
// re-fetch per click.

export const VOICE_EMAIL_TONES = [
	"professional",
	"casual",
	"formal",
	"friendly",
] as const;

export type VoiceEmailTone = (typeof VOICE_EMAIL_TONES)[number];

/** Cap the rambled transcript we send to the model to keep prompts small and cheap. */
export const MAX_TRANSCRIPT_CHARS = 4000;

export const ComposeVoiceEmailInputSchema = z.object({
	transcript: z
		.string()
		.min(1, "No transcript was provided")
		.max(MAX_TRANSCRIPT_CHARS),
});

export type ComposeVoiceEmailInput = z.infer<
	typeof ComposeVoiceEmailInputSchema
>;

const VoiceEmailDraftSchema = z.object({
	tone: z.enum(VOICE_EMAIL_TONES),
	subject: z.string(),
	body: z.string(),
});

export type VoiceEmailDraft = z.infer<typeof VoiceEmailDraftSchema>;

export const ComposeVoiceEmailResultSchema = z.object({
	drafts: z.array(VoiceEmailDraftSchema).length(VOICE_EMAIL_TONES.length),
});

export type ComposeVoiceEmailResult = z.infer<
	typeof ComposeVoiceEmailResultSchema
>;

const TONE_GUIDANCE: Record<VoiceEmailTone, string> = {
	professional:
		'Clear, competent, courteous business English. Neutral warmth. Greeting: "Hi [Name]," or "Hello,". Sign-off: "Best regards," or "Best,".',
	casual: 'Relaxed and conversational, like a quick note to a colleague. Contractions welcome (I\'m, let\'s, don\'t). Short sentences. Greeting: "Hey," or "Hi there,". Sign-off: "Thanks," or "Cheers,".',
	formal: 'Polished, structured, deferential. No contractions, no slang, no casual asides. Complete sentences with precise word choice. Greeting: "Dear [Name],". Sign-off: "Sincerely," or "Respectfully,".',
	friendly:
		'Warm, personable, genuinely upbeat, a little more expressive than professional (fine to use an exclamation point). Contractions welcome. Greeting: "Hi [Name]!" or "Hope you\'re doing well!". Sign-off: "Warmly," or "Take care,".',
};

export const VOICE_EMAIL_SYSTEM_PROMPT = `<role>
You turn a rambling, informal voice transcript into four clear, well-formatted email drafts — one per tone.
</role>

<tones>
${VOICE_EMAIL_TONES.map((tone) => `- ${tone}: ${TONE_GUIDANCE[tone]}`).join("\n")}
</tones>

<rules>
- The transcript is spoken, not written: strip filler words ("um", "like", "you know"), false starts, and repeated phrases.
- Do NOT invent facts, names, dates, or commitments that are not present in the transcript.
- Write exactly one draft per tone listed above, in that order.
- Each draft needs a concise subject line (no "Subject:" prefix, no quotes) and a body structured like a real email: a greeting line, one or more short paragraphs for the content, and a sign-off — with a blank line (\n\n) between the greeting, each paragraph, and the sign-off. Never run the greeting, body, and sign-off together as one paragraph.
- The sign-off is two lines: the closing phrase (e.g. "Best regards,") on its own line, then "[Your Name]" on the line after it.
- Output plain text only — no markdown formatting (no asterisks, no headers).
- Tone is not decoration — each draft must visibly differ in word choice, sentence length, greeting, and sign-off, using the greeting/sign-off style given for that tone. The four drafts must read as four different emails, not the same email with swapped sign-offs.
</rules>`;

/**
 * Builds the user prompt sent to the model. Pure so it can be unit-tested
 * without hitting the AI provider.
 */
export function buildVoiceEmailPrompt(input: ComposeVoiceEmailInput): string {
	const transcript = input.transcript.slice(0, MAX_TRANSCRIPT_CHARS);
	return `<transcript>
${transcript}
</transcript>

<task>
Write one email draft per tone (professional, casual, formal, friendly, in that order) for this transcript.
</task>`;
}
