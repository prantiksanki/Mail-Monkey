/**
 * Builds the Dashboard's "AI Insight" sentence from real automation counts —
 * deterministic and template-based rather than a live per-view LLM call.
 * Cost/latency/determinism won over LLM-generated prose: the numbers are
 * always real and never hallucinated, and it's instant on every Dashboard
 * view instead of a Gemini round-trip per page load.
 */

interface ActionCount {
	type: string;
	count: number;
}

const ACTION_LABELS: Record<string, string> = {
	ARCHIVE: "archived",
	LABEL: "labeled",
	FORWARD: "forwarded",
	WEBHOOK: "sent to a webhook",
	MOVE_TO_FOLDER: "moved",
};

function describeAction(action: ActionCount): string {
	const verb = ACTION_LABELS[action.type] ?? action.type.toLowerCase();
	const noun = action.count === 1 ? "email" : "emails";
	return `${action.count} ${noun} ${verb}`;
}

export function buildAiInsightSentence(
	actionsBreakdown24h: ActionCount[],
): string {
	const topActions = [...actionsBreakdown24h]
		.filter((a) => a.count > 0)
		.sort((a, b) => b.count - a.count)
		.slice(0, 2);

	if (topActions.length === 0) {
		return "No automation activity in the last 24 hours.";
	}

	if (topActions.length === 1) {
		return `We ${describeAction(topActions[0])} for you in the last 24 hours.`;
	}

	return `We ${describeAction(topActions[0])} and ${describeAction(topActions[1])} for you.`;
}
