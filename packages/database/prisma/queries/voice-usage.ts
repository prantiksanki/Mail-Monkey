import { db } from "../client";

/**
 * Get or create current month's voice-transcription usage tracking for a
 * user. Voice usage is per-user (not per-mailbox), since transcription is
 * used from the AI assistant composer rather than scoped to one mailbox.
 * @param userId - The ID of the user
 * @returns The current usage tracking record
 */
export async function getOrCreateCurrentVoiceUsage(userId: string) {
	const now = new Date();
	const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const periodEnd = new Date(
		now.getFullYear(),
		now.getMonth() + 1,
		0,
		23,
		59,
		59,
		999,
	);

	let usage = await db.voiceUsageTracking.findUnique({
		where: {
			userId_periodStart: {
				userId,
				periodStart,
			},
		},
	});

	if (!usage) {
		usage = await db.voiceUsageTracking.create({
			data: {
				userId,
				periodStart,
				periodEnd,
				secondsUsed: 0,
			},
		});
	}

	return usage;
}

/**
 * Increment the voice-transcription seconds used for a user this month.
 * @param userId - The ID of the user
 * @param seconds - The number of seconds to increment by
 * @returns The updated usage tracking record
 */
export async function incrementVoiceSecondsUsed(
	userId: string,
	seconds: number,
) {
	const usage = await getOrCreateCurrentVoiceUsage(userId);

	return await db.voiceUsageTracking.update({
		where: {
			id: usage.id,
		},
		data: {
			secondsUsed: {
				increment: Math.max(0, Math.round(seconds)),
			},
		},
	});
}

/**
 * Get the current month's voice-transcription minutes used for a user.
 * @param userId - The ID of the user
 * @returns The number of whole minutes used this month
 */
export async function getCurrentVoiceMinutesUsed(userId: string) {
	const usage = await getOrCreateCurrentVoiceUsage(userId);
	return usage.secondsUsed / 60;
}
