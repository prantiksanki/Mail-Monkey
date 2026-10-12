import { z } from "zod";

// Pure schema for voice transcription input — kept free of database and
// AI-SDK imports so it can be unit-tested without a DATABASE_URL or network,
// mirroring generate-drafts.prompt.ts / inbox-assistant.prompt.ts.

// ~4.5MB decoded, leaving headroom under Vercel's serverless request-body
// cap (base64 inflates size ~33%, so this bounds the wire payload well
// under that limit). A hard cap so an oversized/corrupt blob fails fast
// with a clear Zod error instead of an opaque platform-level 413.
export const MAX_BASE64_LENGTH = 6_000_000;

export const SUPPORTED_MEDIA_TYPES = [
	"audio/webm",
	"audio/mp4",
	"audio/wav",
	"audio/ogg",
] as const;

export const TranscribeVoiceInputSchema = z.object({
	audio: z
		.string()
		.min(1, "No audio was recorded")
		.max(MAX_BASE64_LENGTH, "Recording is too large to transcribe"),
	mediaType: z.enum(SUPPORTED_MEDIA_TYPES),
});

export function isEffectivelySilent(transcript: string): boolean {
	return transcript.trim().length === 0;
}
