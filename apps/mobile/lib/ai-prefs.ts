import { getPref, setPref } from "./prefs";

// Per-user control over where AI is applied. Defaults on (AI-native), but the
// user can switch any surface off.
export type AiControls = {
	summaries: boolean; // AI insight text on rows + in chat bubbles
	labels: boolean; // smart labels + AI priority
	monkeychan: boolean; // the MonkeyChan AI assistant
	writing: boolean; // AI replies / drafting in your voice
	notifications: boolean; // AI-decided important-only alerts
};

export const AI_DEFAULTS: AiControls = {
	summaries: true,
	labels: true,
	monkeychan: true,
	writing: true,
	notifications: true,
};

export async function getAiControls(): Promise<AiControls> {
	const v = await getPref<Partial<AiControls>>("ai_controls", {});
	return { ...AI_DEFAULTS, ...v };
}

export async function setAiControls(value: AiControls): Promise<void> {
	await setPref("ai_controls", value);
}
