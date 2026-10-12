import { db } from "../client";

export interface DirectoryEntry {
	username: string;
	name: string;
	image: string | null;
	accountType: string;
	bio: string | null;
	tags: string[];
	accentColor: string;
}

export interface ListDirectoryOptions {
	tag?: string;
	cursor?: string;
	limit: number;
}

/** Cursor-paginated public directory of opted-in, enabled profiles. */
export async function listDirectoryProfiles({
	tag,
	cursor,
	limit,
}: ListDirectoryOptions): Promise<{
	entries: DirectoryEntry[];
	nextCursor: string | null;
}> {
	const rows = await db.creatorProfile.findMany({
		where: {
			enabled: true,
			directoryListed: true,
			...(tag ? { tags: { has: tag } } : {}),
		},
		orderBy: { id: "asc" },
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		take: limit + 1,
		select: {
			id: true,
			bio: true,
			tags: true,
			accentColor: true,
			user: {
				select: {
					username: true,
					name: true,
					image: true,
					accountType: true,
				},
			},
		},
	});

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;

	return {
		entries: page
			.filter((row) => row.user.username)
			.map((row) => ({
				username: row.user.username as string,
				name: row.user.name,
				image: row.user.image,
				accountType: row.user.accountType,
				bio: row.bio,
				tags: row.tags,
				accentColor: row.accentColor,
			})),
		nextCursor: hasMore ? page[page.length - 1].id : null,
	};
}

/** All distinct tags currently in use across listed profiles, for filter UI. */
export async function getDirectoryTags(): Promise<string[]> {
	const rows = await db.creatorProfile.findMany({
		where: { enabled: true, directoryListed: true },
		select: { tags: true },
	});
	const tagSet = new Set<string>();
	for (const row of rows) {
		for (const tag of row.tags) {
			tagSet.add(tag);
		}
	}
	return Array.from(tagSet).sort();
}

/**
 * Other listed profiles sharing at least one tag with `creatorProfileId`,
 * ranked by number of shared tags. Falls back to recent listed profiles if
 * the source profile has no tags or no overlap is found.
 */
export async function getSimilarProfiles(
	creatorProfileId: string,
	limit = 4,
): Promise<DirectoryEntry[]> {
	const source = await db.creatorProfile.findUnique({
		where: { id: creatorProfileId },
		select: { tags: true },
	});

	const baseWhere = {
		enabled: true,
		directoryListed: true,
		id: { not: creatorProfileId },
	};

	const candidates = await db.creatorProfile.findMany({
		where:
			source && source.tags.length > 0
				? { ...baseWhere, tags: { hasSome: source.tags } }
				: baseWhere,
		take: limit * 3, // over-fetch so we can rank by overlap client-side
		select: {
			id: true,
			bio: true,
			tags: true,
			accentColor: true,
			user: {
				select: {
					username: true,
					name: true,
					image: true,
					accountType: true,
				},
			},
		},
	});

	const sourceTags = new Set(source?.tags ?? []);
	const ranked = candidates
		.filter((c) => c.user.username)
		.map((c) => ({
			entry: {
				username: c.user.username as string,
				name: c.user.name,
				image: c.user.image,
				accountType: c.user.accountType,
				bio: c.bio,
				tags: c.tags,
				accentColor: c.accentColor,
			},
			overlap: c.tags.filter((t) => sourceTags.has(t)).length,
		}))
		.sort((a, b) => b.overlap - a.overlap)
		.slice(0, limit)
		.map((r) => r.entry);

	return ranked;
}
