import { logger } from "@repo/logs";
import { listLabels } from "./gmail-client";

/**
 * Resolves Gmail label IDs (e.g. "Label_10") to their human display names
 * (e.g. "Urgent"). Gmail stores raw IDs on each message, so every inbox/label
 * view must translate them before rendering — otherwise the UI shows "LABEL_10"
 * instead of the real label name.
 *
 * The map is cached per account for a short window because:
 *   1. it is requested on every inbox page load, and
 *   2. during a heavy historical import, calling `listLabels` on every request
 *      gets rate-limited by Gmail — and the old code fell back to raw IDs on any
 *      failure, which is exactly the "LABEL_10 / LABEL_12" leak users saw.
 * A cached map means one transient `listLabels` failure no longer dumps raw IDs
 * across the whole view.
 */

interface CacheEntry {
	map: Record<string, string>;
	expiresAt: number;
}

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/**
 * Returns a map of Gmail label ID → display name for the account. Served from a
 * 60s cache; on a `listLabels` failure it returns the last known good map (even
 * if expired) rather than an empty one, so names keep resolving through
 * transient Gmail errors. Returns `{}` only if we have never fetched labels.
 */
export async function getLabelIdToNameMap(
	accountId: string,
): Promise<Record<string, string>> {
	const now = Date.now();
	const cached = cache.get(accountId);
	if (cached && cached.expiresAt > now) {
		return cached.map;
	}

	try {
		const labels = (await listLabels(accountId)) as {
			id: string;
			name: string;
		}[];
		const map = Object.fromEntries(labels.map((l) => [l.id, l.name]));
		cache.set(accountId, { map, expiresAt: now + TTL_MS });
		return map;
	} catch (error) {
		logger.warn("[label-resolver] Failed to list labels; using stale map", {
			accountId,
			error: error instanceof Error ? error.message : String(error),
		});
		// Serve the last known good map if we have one, else an empty map.
		return cached?.map ?? {};
	}
}

/**
 * Resolves a label *name* to its Gmail label ID (e.g. "Urgent" → "Label_10").
 * Used when filtering the DB by a label so we also match rows that stored only
 * the raw Gmail ID. If the cached map does not contain the name (e.g. the label
 * was created after the cache was populated), it force-refreshes once before
 * giving up — otherwise a whole label view could silently under-match.
 */
export async function resolveLabelNameToId(
	accountId: string,
	labelName: string,
): Promise<string | undefined> {
	const target = labelName.toLowerCase();
	const find = (map: Record<string, string>) =>
		Object.entries(map).find(
			([, name]) => name.toLowerCase() === target,
		)?.[0];

	let id = find(await getLabelIdToNameMap(accountId));
	if (id) {
		return id;
	}
	// Miss — the cached map may be stale for a just-created label. Invalidate
	// and try once more with a fresh listLabels.
	cache.delete(accountId);
	id = find(await getLabelIdToNameMap(accountId));
	return id;
}

/**
 * Maps a message's raw label IDs to display names, dropping any Gmail
 * `Label_*` ID that cannot be resolved to a real name. This prevents raw IDs
 * (e.g. "Label_10") from ever reaching the UI as a chip. Plain label names
 * (stored directly by the rule engine) and unmapped non-`Label_` values pass
 * through unchanged.
 */
export function mapLabelIdsToNames(
	labelIds: string[],
	idToName: Record<string, string>,
): string[] {
	const out: string[] = [];
	for (const id of labelIds) {
		const name = idToName[id];
		if (name) {
			out.push(name);
			continue;
		}
		// Unresolvable Gmail ID — drop it rather than showing "Label_10".
		if (id.startsWith("Label_")) {
			continue;
		}
		// A plain, human-readable label name applied directly by a rule.
		out.push(id);
	}
	// De-duplicate (case-insensitive) — the same label can appear as both an ID
	// and a mirrored name on emails synced at different times.
	const seen = new Set<string>();
	return out.filter((name) => {
		const key = name.toLowerCase();
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}
