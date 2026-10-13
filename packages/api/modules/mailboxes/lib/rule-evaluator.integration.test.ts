/**
 * Integration tests for the AI rule evaluator.
 *
 * Calls the real Gemini API with the live "VIP" and "Urgent" rule templates,
 * against fixture emails modeled on real automated senders (ChartMogul,
 * TrustMRR, Google/Microsoft/OpenAI security alerts, Railway, Calendly) that
 * were previously false-matching due to the "from <word>" short-circuit bug
 * in evaluateRule. Also asserts genuine positive cases still match, so the
 * fix doesn't overcorrect into blocking real VIP/urgent emails.
 *
 * Requires GOOGLE_GENERATIVE_AI_API_KEY. Run with:
 *
 *   pnpm --filter @repo/api test:integration -- rule-evaluator
 */

import { describe, expect, it } from "vitest";
import { RULE_TEMPLATES } from "../rule-templates";
import type { ParsedEmail } from "./email-parser";
import { evaluateRule } from "./rule-evaluator";

const hasApiKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const maybeDescribe = hasApiKey ? describe : describe.skip;

const vipInstructions = RULE_TEMPLATES.find((t) => t.id === "vip-flag")?.rule
	.condition.aiInstructions;
const urgentInstructions = RULE_TEMPLATES.find((t) => t.id === "urgent-alerts")
	?.rule.condition.aiInstructions;

if (!vipInstructions || !urgentInstructions) {
	throw new Error(
		"vip-flag / urgent-alerts templates not found — has rule-templates.ts changed?",
	);
}

function makeEmail(overrides: Partial<ParsedEmail>): ParsedEmail {
	return {
		id: "test-message-id",
		threadId: "test-thread-id",
		from: "Test Sender <sender@example.com>",
		fromEmail: "sender@example.com",
		to: "cuplabs07@gmail.com",
		toEmail: "cuplabs07@gmail.com",
		subject: "Test subject",
		snippet: "Test snippet",
		bodyText: "Test body",
		bodyHtml: "<p>Test body</p>",
		date: new Date(),
		labelIds: ["INBOX"],
		headers: {},
		attachments: [],
		...overrides,
	};
}

maybeDescribe("rule-evaluator — VIP/Urgent regression (live Gemini)", () => {
	describe("VIP rule — should NOT match automated senders", () => {
		const cases: Array<[string, Partial<ParsedEmail>]> = [
			[
				"ChartMogul newsletter",
				{
					from: "Nick at ChartMogul <nfranklin@chartmogul.com>",
					fromEmail: "nfranklin@chartmogul.com",
					subject:
						"🚀 SaaS Roundup: Marketing for one is the new one-to-many",
					snippet:
						"Onboarding as a conversation. Plus, a roundup of this week's best SaaS thinking.",
					bodyText:
						"Onboarding as a conversation. Plus, a roundup of this week's best SaaS thinking.",
				},
			],
			[
				"TrustMRR marketplace digest",
				{
					from: "Marc at TrustMRR <hello@resend.trustmrr.com>",
					fromEmail: "hello@resend.trustmrr.com",
					subject:
						"TrustMRR Daily: 7 new startups for sale + 5 price drops",
					snippet:
						"TrustMRR Hi cup, 7 verified startups were listed for sale on Friday.",
					bodyText:
						"TrustMRR Hi cup, 7 verified startups were listed for sale on Friday. Plus, 5 startups reduced their asking price.",
				},
			],
			[
				"Google security alert",
				{
					from: "Google <no-reply@accounts.google.com>",
					fromEmail: "no-reply@accounts.google.com",
					subject: "Security alert",
					snippet:
						"You allowed Zer0 Email access to some of your Google Account data.",
					bodyText:
						"You allowed Zer0 Email access to some of your Google Account data. If you didn't allow this access, someone else may be trying to access your account.",
				},
			],
			[
				"Stripe receipt",
				{
					from: "Railway Corporation <invoice+statements@stripe.com>",
					fromEmail: "invoice+statements@stripe.com",
					subject: "Your receipt from Railway Corporation #2268-3983",
					snippet: "Your receipt from Railway Corporation #2268-3983",
					bodyText:
						"Your receipt from Railway Corporation #2268-3983",
				},
			],
			[
				"Calendly marketing",
				{
					from: "Calendly <teamcalendly@send.calendly.com>",
					fromEmail: "teamcalendly@send.calendly.com",
					subject: "Want to save time (and money)?",
					snippet: "More than a scheduling tool",
					bodyText: "More than a scheduling tool",
				},
			],
			[
				"OpenAI sign-in notification",
				{
					from: "OpenAI <noreply@tm.openai.com>",
					fromEmail: "noreply@tm.openai.com",
					subject: "New sign-in to your OpenAI account",
					snippet: "We noticed a new sign-in to your OpenAI account.",
					bodyText:
						"Hello, We noticed a new sign-in to your OpenAI account. App: Codex Time: July 16, 2026 at 5:18 PM (IST)",
				},
			],
		];

		it.each(cases)("%s", async (_label, overrides) => {
			const email = makeEmail(overrides);
			const matched = await evaluateRule(email, {
				aiInstructions: vipInstructions,
			});
			expect(matched).toBe(false);
		});

		it("still matches a genuine named individual emailing about business", async () => {
			const email = makeEmail({
				from: "Sarah Chen <sarah.chen@acmeventures.com>",
				fromEmail: "sarah.chen@acmeventures.com",
				subject: "Following up on our conversation",
				snippet:
					"Hi, following up on the term sheet we discussed last week.",
				bodyText:
					"Hi, following up on the term sheet we discussed last week — our fund would like to move forward with the investment. Can we get 30 minutes this week to finalize terms?",
			});
			const matched = await evaluateRule(email, {
				aiInstructions: vipInstructions,
			});
			expect(matched).toBe(true);
		});
	});

	describe("Urgent rule — should NOT match automated alerts", () => {
		const cases: Array<[string, Partial<ParsedEmail>]> = [
			[
				"Google security alert",
				{
					from: "Google <no-reply@accounts.google.com>",
					fromEmail: "no-reply@accounts.google.com",
					subject: "Security alert",
					snippet:
						"You allowed Zer0 Email access to some of your Google Account data.",
					bodyText:
						"You allowed Zer0 Email access to some of your Google Account data. If you didn't allow this access, someone else may be trying to access your account.",
				},
			],
			[
				"Railway scheduled project deletion",
				{
					from: "Railway <hello@notify.railway.app>",
					fromEmail: "hello@notify.railway.app",
					subject: "Scheduled Project Deletion",
					snippet:
						"The project superb-patience has been queued for deletion by someone on your team.",
					bodyText:
						"Upcoming Project Deletion. The project superb-patience has been queued for deletion by someone on your team. It will be permanently deleted within 48 hours.",
				},
			],
			[
				"Atlassian payment retry",
				{
					from: "Atlassian <no_reply@am.atlassian.com>",
					fromEmail: "no_reply@am.atlassian.com",
					subject:
						"Action needed: Retry your payment with 3DS authentication",
					snippet: "We couldn't process your payment since we...",
					bodyText:
						"Hi Acme Private Limited, We couldn't process your payment since we require 3DS authentication. Action needed: retry your payment.",
				},
			],
			[
				"LinkDM account deletion warning",
				{
					from: "LinkDM <no-reply@linkdm.com>",
					fromEmail: "no-reply@linkdm.com",
					subject: "LinkDM [Avoid Account Deletion]",
					snippet:
						"Verify your email within the next 7 days to keep your account.",
					bodyText:
						"Please verify your email address within the next 7 days to keep your LinkDM account active, or it will be deleted.",
				},
			],
		];

		it.each(cases)("%s", async (_label, overrides) => {
			const email = makeEmail(overrides);
			const matched = await evaluateRule(email, {
				aiInstructions: urgentInstructions,
			});
			expect(matched).toBe(false);
		});

		it("still matches a genuine human urgent request", async () => {
			const email = makeEmail({
				from: "Priya Sharma <priya@clientco.com>",
				fromEmail: "priya@clientco.com",
				subject: "Need signed contract ASAP — deadline today",
				snippet:
					"We need the signed contract back by 5pm today or we lose the slot.",
				bodyText:
					"Hi, this is urgent — we need the signed contract back by 5pm today or we lose our slot with the vendor. Can you send it over immediately?",
			});
			const matched = await evaluateRule(email, {
				aiInstructions: urgentInstructions,
			});
			expect(matched).toBe(true);
		});
	});
});
