import { describe, expect, it } from "vitest";
import {
	buildSystemPrompt,
	citeEmailsInput,
	findUnansweredInput,
	getCalendarInput,
	readEmailInput,
	searchEmailsInput,
} from "./inbox-assistant.prompt";

describe("inbox-assistant prompt & schemas", () => {
	describe("buildSystemPrompt", () => {
		it("injects the provided date so relative time resolves", () => {
			const prompt = buildSystemPrompt(new Date("2026-07-07T10:00:00Z"));
			expect(prompt).toContain("2026-07-07");
			expect(prompt).toContain("Tuesday");
		});

		it("resolves today/weekday in the user's timezone, not the server's", () => {
			// 2026-07-13T20:00:00Z is still Monday in UTC, but already
			// Tuesday 2026-07-14 01:30 in IST (UTC+5:30) — the exact
			// midnight-crossing case that caused "tomorrow" to land on the
			// wrong calendar day when the server's zone was used instead.
			const now = new Date("2026-07-13T20:00:00Z");
			const prompt = buildSystemPrompt(now, "Asia/Kolkata");
			expect(prompt).toContain("2026-07-14");
			expect(prompt).toContain("Tuesday");
			expect(prompt).toContain("Asia/Kolkata");
		});

		it("falls back to UTC for a missing or invalid timezone", () => {
			const now = new Date("2026-07-13T20:00:00Z");
			expect(buildSystemPrompt(now)).toContain("2026-07-13");
			expect(buildSystemPrompt(now, "Not/AZone")).toContain("2026-07-13");
		});

		it("instructs the model to cite emails and take real actions", () => {
			const prompt = buildSystemPrompt(new Date());
			expect(prompt).toMatch(/citeEmails/);
			expect(prompt.toLowerCase()).toContain("real actions");
			expect(prompt.toLowerCase()).toContain("never invent");
		});

		it("tells the model to be resourceful and mentions unanswered-thread handling", () => {
			const prompt = buildSystemPrompt(new Date());
			expect(prompt.toLowerCase()).toContain("resourceful");
			expect(prompt).toContain("findUnansweredThreads");
		});

		it("instructs the model to use the sent folder for 'sent to X' questions", () => {
			const prompt = buildSystemPrompt(new Date());
			expect(prompt.toLowerCase()).toContain('folder: "sent"');
			expect(prompt.toLowerCase()).toContain("recipient");
		});
	});

	describe("searchEmailsInput", () => {
		it("accepts an empty object (list-recent mode)", () => {
			expect(searchEmailsInput.safeParse({}).success).toBe(true);
		});

		it("accepts a full valid query", () => {
			const parsed = searchEmailsInput.safeParse({
				query: "linkedin",
				folder: "inbox",
				unreadOnly: true,
				limit: 10,
			});
			expect(parsed.success).toBe(true);
		});

		it("rejects a limit above the cap", () => {
			expect(searchEmailsInput.safeParse({ limit: 100 }).success).toBe(
				false,
			);
		});

		it("rejects a limit below 1", () => {
			expect(searchEmailsInput.safeParse({ limit: 0 }).success).toBe(
				false,
			);
		});

		it("rejects an unknown folder", () => {
			expect(
				searchEmailsInput.safeParse({ folder: "outbox" }).success,
			).toBe(false);
		});
	});

	describe("readEmailInput", () => {
		it("requires an emailId", () => {
			expect(readEmailInput.safeParse({}).success).toBe(false);
			expect(readEmailInput.safeParse({ emailId: "abc" }).success).toBe(
				true,
			);
		});
	});

	describe("findUnansweredInput", () => {
		it("accepts empty, a search term, and a bounded limit", () => {
			expect(findUnansweredInput.safeParse({}).success).toBe(true);
			expect(
				findUnansweredInput.safeParse({ search: "acme.com", limit: 5 })
					.success,
			).toBe(true);
			expect(findUnansweredInput.safeParse({ limit: 50 }).success).toBe(
				false,
			);
		});
	});

	describe("getCalendarInput", () => {
		it("accepts an empty window and an explicit one", () => {
			expect(getCalendarInput.safeParse({}).success).toBe(true);
			expect(
				getCalendarInput.safeParse({
					timeMin: "2026-07-07T00:00:00Z",
					timeMax: "2026-07-14T00:00:00Z",
				}).success,
			).toBe(true);
		});
	});

	describe("citeEmailsInput", () => {
		it("requires at least one id", () => {
			expect(citeEmailsInput.safeParse({ emailIds: [] }).success).toBe(
				false,
			);
			expect(
				citeEmailsInput.safeParse({ emailIds: ["e1", "e2"] }).success,
			).toBe(true);
		});
	});
});
