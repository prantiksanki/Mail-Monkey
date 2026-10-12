import { db } from "../client";
import type { ProfileEventType } from "../generated/client";

export async function recordProfileEvent(
	creatorProfileId: string,
	type: ProfileEventType,
) {
	return db.profileEvent.create({
		data: { creatorProfileId, type },
	});
}

export interface ProfileAnalyticsSummary {
	views: number;
	contacts: number;
	bookings: number;
}

/** Event counts by type since `since`, for a creator's own analytics view. */
export async function getProfileAnalytics(
	creatorProfileId: string,
	since: Date,
): Promise<ProfileAnalyticsSummary> {
	const counts = await db.profileEvent.groupBy({
		by: ["type"],
		where: { creatorProfileId, createdAt: { gte: since } },
		_count: { _all: true },
	});

	const byType = Object.fromEntries(
		counts.map((c) => [c.type, c._count._all]),
	);

	return {
		views: byType.VIEW ?? 0,
		contacts: byType.CONTACT ?? 0,
		bookings: byType.BOOKING ?? 0,
	};
}

/** Daily view counts since `since`, oldest first — for a simple sparkline. */
export async function getDailyProfileViews(
	creatorProfileId: string,
	since: Date,
) {
	return db.profileEvent.findMany({
		where: { creatorProfileId, type: "VIEW", createdAt: { gte: since } },
		select: { createdAt: true },
		orderBy: { createdAt: "asc" },
	});
}
