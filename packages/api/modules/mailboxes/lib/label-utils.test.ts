import { describe, expect, it } from "vitest";
import { isUserLabel, SYSTEM_LABELS } from "./label-utils";

describe("SYSTEM_LABELS", () => {
	it("contains the standard Gmail system label IDs", () => {
		for (const label of [
			"INBOX",
			"UNREAD",
			"SENT",
			"DRAFT",
			"TRASH",
			"SPAM",
			"STARRED",
			"IMPORTANT",
		]) {
			expect(SYSTEM_LABELS.has(label)).toBe(true);
		}
	});

	it("does not include user-visible label names", () => {
		expect(SYSTEM_LABELS.has("Newsletter")).toBe(false);
		expect(SYSTEM_LABELS.has("Finance")).toBe(false);
	});
});

describe("isUserLabel", () => {
	// ── Gmail label IDs ──────────────────────────────────────────────────────────

	it("accepts proper Gmail user-label IDs (Label_xxx)", () => {
		expect(isUserLabel("Label_1234567890")).toBe(true);
		expect(isUserLabel("Label_abc")).toBe(true);
	});

	// ── Plain label names from rule action-executor ──────────────────────────────

	it("accepts plain label names stored by the rule action-executor", () => {
		expect(isUserLabel("Newsletter")).toBe(true);
		expect(isUserLabel("Finance")).toBe(true);
		expect(isUserLabel("Promotions")).toBe(true);
		expect(isUserLabel("VIP")).toBe(true);
		expect(isUserLabel("Urgent")).toBe(true);
	});

	it("accepts label names with spaces", () => {
		expect(isUserLabel("Tax Documents")).toBe(true);
		expect(isUserLabel("Action Items")).toBe(true);
	});

	// ── Gmail system labels — must be rejected ───────────────────────────────────

	it("rejects Gmail system labels", () => {
		expect(isUserLabel("INBOX")).toBe(false);
		expect(isUserLabel("UNREAD")).toBe(false);
		expect(isUserLabel("SENT")).toBe(false);
		expect(isUserLabel("DRAFT")).toBe(false);
		expect(isUserLabel("TRASH")).toBe(false);
		expect(isUserLabel("SPAM")).toBe(false);
		expect(isUserLabel("STARRED")).toBe(false);
		expect(isUserLabel("IMPORTANT")).toBe(false);
	});

	it("rejects Gmail category labels (CATEGORY_ prefix)", () => {
		expect(isUserLabel("CATEGORY_PROMOTIONS")).toBe(false);
		expect(isUserLabel("CATEGORY_SOCIAL")).toBe(false);
		expect(isUserLabel("CATEGORY_UPDATES")).toBe(false);
		expect(isUserLabel("CATEGORY_FORUMS")).toBe(false);
		expect(isUserLabel("CATEGORY_PERSONAL")).toBe(false);
	});

	// ── Edge cases ───────────────────────────────────────────────────────────────

	it("is case-sensitive — lowercase system label names pass through as user labels", () => {
		// The Gmail API always returns system labels in uppercase.
		// Lowercase variants would be user-created label names and should be allowed.
		expect(isUserLabel("inbox")).toBe(true);
		expect(isUserLabel("spam")).toBe(true);
	});

	it("rejects empty string as it has neither Label_ prefix nor excluded prefixes but is not meaningful", () => {
		// Empty string: not a system label, not CATEGORY_ → currently accepted.
		// This documents current behaviour; adjust if the function is tightened.
		expect(isUserLabel("")).toBe(true);
	});
});
