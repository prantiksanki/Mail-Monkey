import { config } from "../config";

type PlanId = keyof typeof config.plans;

export interface PlanLimits {
	mailboxes?: number; // undefined = unlimited
	rulesPerMailbox: number;
	emailsProcessedPerMonth: number;
	aiChat: boolean;
	ruleEngine: boolean;
	voiceAgentMinutes?: number; // undefined = not included in this plan
	calendarScheduling?: boolean;
	autoDrafts?: boolean;
	meetingIntegrations?: boolean;
}

/**
 * Get the limits for a specific plan.
 * @param planId - The plan ID (e.g., "free", "pro", "premium")
 * @returns The limits object for the plan, or undefined if not found
 */
export function getPlanLimits(planId: PlanId): PlanLimits | undefined {
	const plan = config.plans[planId];
	if (!plan) {
		return undefined;
	}

	// Free plan — use config limits if defined, otherwise defaults
	if ("isFree" in plan && plan.isFree) {
		if ("limits" in plan && plan.limits) {
			return plan.limits as PlanLimits;
		}
		return {
			rulesPerMailbox: 0,
			emailsProcessedPerMonth: 0,
			aiChat: false,
			ruleEngine: false,
		};
	}

	// Enterprise plans typically have custom limits
	if ("isEnterprise" in plan && plan.isEnterprise) {
		return {
			rulesPerMailbox: Number.POSITIVE_INFINITY,
			emailsProcessedPerMonth: Number.POSITIVE_INFINITY,
			aiChat: true,
			ruleEngine: true,
		};
	}

	// Regular plans with defined limits
	if ("limits" in plan && plan.limits) {
		return plan.limits as PlanLimits;
	}

	// Default fallback
	return {
		rulesPerMailbox: 0,
		emailsProcessedPerMonth: 0,
		aiChat: false,
		ruleEngine: false,
	};
}

/**
 * Check if a user can create another rule for a specific mailbox.
 * @param planId - The plan ID
 * @param currentRuleCount - The current number of rules for the mailbox
 * @returns True if a rule can be created, false otherwise
 */
export function canCreateRule(
	planId: PlanId,
	currentRuleCount: number,
): boolean {
	const limits = getPlanLimits(planId);
	if (!limits) {
		return false;
	}

	// Unlimited rules
	if (limits.rulesPerMailbox === Number.POSITIVE_INFINITY) {
		return true;
	}

	return currentRuleCount < limits.rulesPerMailbox;
}

/**
 * Check if a user can connect another mailbox.
 * @param planId - The plan ID
 * @param currentMailboxCount - The current number of connected mailboxes
 * @returns True if a mailbox can be connected, false otherwise
 */
export function canConnectMailbox(
	planId: PlanId,
	currentMailboxCount: number,
): boolean {
	const limits = getPlanLimits(planId);
	if (!limits) {
		return false;
	}
	if (limits.mailboxes === undefined) {
		return true;
	} // paid plans = unlimited
	return currentMailboxCount < limits.mailboxes;
}

/**
 * Check if more emails can be processed this month for a specific mailbox.
 * @param planId - The plan ID
 * @param currentMonthProcessed - The number of emails processed this month
 * @returns True if more emails can be processed, false otherwise
 */
export function canProcessEmail(
	planId: PlanId,
	currentMonthProcessed: number,
): boolean {
	const limits = getPlanLimits(planId);
	if (!limits) {
		return false;
	}

	// Unlimited emails
	if (limits.emailsProcessedPerMonth === Number.POSITIVE_INFINITY) {
		return true;
	}

	return currentMonthProcessed < limits.emailsProcessedPerMonth;
}

/**
 * Check if the user can use AI chat features.
 * @param planId - The plan ID
 * @returns True if AI chat is available, false otherwise
 */
export function canUseAiChat(planId: PlanId): boolean {
	const limits = getPlanLimits(planId);
	if (!limits) {
		return false;
	}

	return limits.aiChat;
}

/**
 * Check if the user can use the rule engine.
 * @param planId - The plan ID
 * @returns True if rule engine is available, false otherwise
 */
export function canUseRuleEngine(planId: PlanId): boolean {
	const limits = getPlanLimits(planId);
	if (!limits) {
		return false;
	}

	return limits.ruleEngine;
}

/**
 * Check if more voice agent minutes can be used this month for a plan.
 * @param planId - The plan ID
 * @param minutesUsed - The number of voice minutes already used this month
 * @returns True if more voice minutes can be used, false otherwise
 */
export function canUseVoiceAgent(planId: PlanId, minutesUsed: number): boolean {
	const limits = getPlanLimits(planId);
	if (!limits?.voiceAgentMinutes) {
		return false;
	}

	return minutesUsed < limits.voiceAgentMinutes;
}
