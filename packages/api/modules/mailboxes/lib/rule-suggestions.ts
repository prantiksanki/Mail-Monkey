import { getRulesByMailboxId } from "@repo/database";
import type { CreateRuleInput } from "../types";
import { getMailProvider } from "./mail-provider";
import { getBackfillWindow } from "./rule-backfill";

const SAMPLE_SIZE = 40;
const MAX_SUGGESTIONS = 5;
const SUGGESTION_CACHE_TTL_MS = 5 * 60 * 1000;
const SAMPLE_FETCH_BATCH_SIZE = 8;

const suggestionCache = new Map<
	string,
	{ expiresAt: number; suggestions: RuleSuggestion[] }
>();

export function invalidateRuleSuggestionsCache(mailboxId: string) {
	suggestionCache.delete(mailboxId);
}

interface SenderGroup {
	from: string;
	fromEmail: string;
	domain: string;
	count: number;
	newsletterSignals: number;
	financeSignals: number;
	notificationSignals: number;
	subjectSamples: string[];
}

export interface RuleSuggestion {
	id: string;
	title: string;
	description: string;
	reason: string;
	estimatedMatches: number;
	confidence: "high" | "medium";
	category: "Productivity" | "Finance" | "Social";
	rule: CreateRuleInput;
}

interface SampleEmail {
	from: string;
	fromEmail: string;
	subject: string;
	snippet: string;
	headers: Record<string, string>;
}

function getDomain(fromEmail: string) {
	return fromEmail.split("@")[1] ?? fromEmail;
}

function getSenderSlug(fromEmail: string) {
	return fromEmail.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function hasNewsletterSignals(email: SampleEmail) {
	return Boolean(
		email.headers["list-unsubscribe"] ||
			email.subject.match(/newsletter|digest|weekly|daily|roundup/i) ||
			email.snippet.match(/unsubscribe|manage preferences/i),
	);
}

function hasFinanceSignals(email: SampleEmail) {
	return Boolean(
		email.subject.match(
			/receipt|invoice|payment|paid|order confirmation|billing/i,
		) || email.snippet.match(/receipt|invoice|payment|order/i),
	);
}

function hasNotificationSignals(email: SampleEmail) {
	return Boolean(
		email.fromEmail.match(
			/(no-?reply|donotreply|notification|updates?|alerts?)/i,
		) ||
			email.subject.match(
				/notification|update|alert|digest|activity|summary/i,
			),
	);
}

function toTitleCase(value: string) {
	return value
		.split(/[\s._-]+/)
		.filter(Boolean)
		.map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}

function buildSuggestionFromGroup(group: SenderGroup): RuleSuggestion | null {
	const senderName = toTitleCase(group.domain.replace(/\.[^.]+$/, ""));
	const fromValue = group.fromEmail;

	if (group.financeSignals >= 2) {
		return {
			id: `finance-${getSenderSlug(group.fromEmail)}`,
			title: `Label ${senderName} receipts`,
			description: `Keep ${senderName} billing, invoice, and receipt mail in one place.`,
			reason: `${group.count} recent emails looked like receipts or payment confirmations from ${group.from}.`,
			estimatedMatches: group.count,
			confidence: "high",
			category: "Finance",
			rule: {
				name: `Label ${senderName} receipts`,
				condition: {
					conditionalOperator: "AND",
					static: { from: fromValue },
					aiInstructions:
						"This is a receipt, invoice, billing notice, or payment confirmation from this sender.",
				},
				actions: [{ type: "LABEL", fields: { label: "Finance" } }],
				enabled: true,
			},
		};
	}

	if (group.newsletterSignals >= 2) {
		return {
			id: `newsletter-${getSenderSlug(group.fromEmail)}`,
			title: `Archive ${senderName} newsletters`,
			description: `Move recurring newsletter-style mail from ${senderName} out of the primary inbox.`,
			reason: `${group.count} recent emails from ${group.from} included newsletter or unsubscribe signals.`,
			estimatedMatches: group.count,
			confidence: "high",
			category: "Productivity",
			rule: {
				name: `Archive ${senderName} newsletters`,
				condition: {
					conditionalOperator: "AND",
					static: { from: fromValue },
					aiInstructions:
						"This is a newsletter, digest, or promotional update from this sender rather than a personal email.",
				},
				actions: [
					{ type: "ARCHIVE" },
					{ type: "LABEL", fields: { label: "Newsletter" } },
				],
				enabled: true,
			},
		};
	}

	if (group.notificationSignals >= 3) {
		return {
			id: `notify-${getSenderSlug(group.fromEmail)}`,
			title: `Archive ${senderName} notifications`,
			description: `Quiet repeated notification mail from ${senderName} while still keeping it searchable.`,
			reason: `${group.count} recent emails from ${group.from} looked like automated notifications.`,
			estimatedMatches: group.count,
			confidence: "medium",
			category: "Productivity",
			rule: {
				name: `Archive ${senderName} notifications`,
				condition: {
					conditionalOperator: "AND",
					static: { from: fromValue },
					aiInstructions:
						"This is an automated notification, status update, digest, or activity email from this sender.",
				},
				actions: [{ type: "ARCHIVE" }],
				enabled: true,
			},
		};
	}

	return null;
}

export async function generateRuleSuggestions(mailbox: {
	id: string;
	accountId: string;
	email: string;
	provider?: string;
}) {
	const cached = suggestionCache.get(mailbox.id);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.suggestions;
	}

	const provider = (mailbox.provider ?? "GOOGLE") as "GOOGLE" | "OUTLOOK";
	const mailProvider = getMailProvider(provider);

	const existingRules = await getRulesByMailboxId({ mailboxId: mailbox.id });
	const sampled = await mailProvider.listInboxMessages(mailbox.accountId, {
		maxResults: SAMPLE_SIZE,
	});

	if (!sampled.messages.length) {
		return [];
	}

	const groups = new Map<string, SenderGroup>();

	const messageIds = sampled.messages
		.map((m) => m.id)
		.filter((id): id is string => Boolean(id));

	const sampleEmails: SampleEmail[] = [];
	for (let i = 0; i < messageIds.length; i += SAMPLE_FETCH_BATCH_SIZE) {
		const batch = await Promise.all(
			messageIds
				.slice(i, i + SAMPLE_FETCH_BATCH_SIZE)
				.map((id) =>
					mailProvider.getParsedMessage(mailbox.accountId, id),
				),
		);
		sampleEmails.push(...batch);
	}

	for (const email of sampleEmails) {
		if (
			!email.fromEmail ||
			email.fromEmail === mailbox.email.toLowerCase()
		) {
			continue;
		}

		const groupKey = email.fromEmail;
		const domain = getDomain(groupKey);
		const existing = groups.get(groupKey) ?? {
			from: email.from,
			fromEmail: email.fromEmail,
			domain,
			count: 0,
			newsletterSignals: 0,
			financeSignals: 0,
			notificationSignals: 0,
			subjectSamples: [],
		};

		existing.count += 1;
		existing.newsletterSignals += hasNewsletterSignals(email) ? 1 : 0;
		existing.financeSignals += hasFinanceSignals(email) ? 1 : 0;
		existing.notificationSignals += hasNotificationSignals(email) ? 1 : 0;
		if (existing.subjectSamples.length < 2 && email.subject) {
			existing.subjectSamples.push(email.subject);
		}
		groups.set(groupKey, existing);
	}

	const candidates = [...groups.values()]
		.filter((g) => g.count >= 2)
		.sort((a, b) => b.count - a.count)
		.slice(0, 12);

	const suggestions: RuleSuggestion[] = [];

	for (const group of candidates) {
		const suggestion = buildSuggestionFromGroup(group);
		if (!suggestion) {
			continue;
		}

		if (isCoveredByExistingRules(suggestion, existingRules)) {
			continue;
		}

		// Estimate historical matches
		const fromValue = suggestion.rule.condition.static?.from;
		if (fromValue) {
			const { windowStart, windowEnd } = getBackfillWindow(6);
			try {
				const count = await mailProvider.listInboxMessages(
					mailbox.accountId,
					{ maxResults: 1, windowStart, windowEnd },
				);
				suggestion.estimatedMatches =
					count.resultSizeEstimate ?? suggestion.estimatedMatches;
			} catch {
				// Keep original estimate on failure
			}
		}

		if (suggestion.estimatedMatches < 2) {
			continue;
		}

		suggestions.push(suggestion);
		if (suggestions.length >= MAX_SUGGESTIONS) {
			break;
		}
	}

	suggestionCache.set(mailbox.id, {
		expiresAt: Date.now() + SUGGESTION_CACHE_TTL_MS,
		suggestions,
	});

	return suggestions;
}

function isCoveredByExistingRules(
	suggestion: RuleSuggestion,
	existingRules: Awaited<ReturnType<typeof getRulesByMailboxId>>,
) {
	const suggestedFrom = suggestion.rule.condition.static?.from?.toLowerCase();
	if (!suggestedFrom) {
		return false;
	}

	return existingRules.some((rule) => {
		const existingFrom = (
			(rule.condition as { static?: { from?: string | null } }).static
				?.from ?? ""
		).toLowerCase();
		if (!existingFrom) {
			return false;
		}
		return (
			rule.name.toLowerCase() === suggestion.rule.name.toLowerCase() ||
			existingFrom.includes(suggestedFrom) ||
			suggestedFrom.includes(existingFrom)
		);
	});
}
