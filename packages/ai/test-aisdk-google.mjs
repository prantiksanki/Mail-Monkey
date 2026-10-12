/**
 * AI SDK (@ai-sdk/google) Integration Test Script
 *
 * Same test cases as test-gemini-ai.mjs but using @ai-sdk/google + generateObject
 * instead of @google/genai directly. Verifies the migration is a drop-in replacement.
 *
 * Run: node scripts/test-aisdk-google.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
	const [key, ...rest] = line.split("=");
	if (key && rest.length) {
		process.env[key.trim()] = rest.join("=").replace(/^"|"$/g, "").trim();
	}
}

const { google } = await import("@ai-sdk/google");
const { generateText, Output } = await import("ai");
const { z } = await import("zod");

const MODEL = "gemini-3-flash-preview";

// thinkingBudget: 0 = disable thinking = equivalent to ThinkingLevel.LOW
const THINKING_OFF = {
	google: { thinkingConfig: { thinkingBudget: 0 } },
};

// ─── Zod Schemas (equivalent to the raw JSON schemas in production) ───────────

const ActionSchema = z.object({
	type: z.enum([
		"LABEL",
		"MOVE_FOLDER",
		"ARCHIVE",
		"MARK_READ",
		"DRAFT_EMAIL",
		"REPLY",
		"FORWARD",
		"SEND_EMAIL",
		"MARK_SPAM",
		"DIGEST",
		"CALL_WEBHOOK",
	]),
	label: z.string().optional(),
	to: z.string().optional(),
	cc: z.string().optional(),
	bcc: z.string().optional(),
	subject: z.string().optional(),
	content: z.string().optional(),
	webhookUrl: z.string().optional(),
	folderName: z.string().optional(),
});

const RuleSchema = z.object({
	rules: z.array(
		z.object({
			name: z.string(),
			condition: z.object({
				conditionalOperator: z.enum(["AND", "OR", "NONE"]),
				aiInstructions: z.string(),
				staticFrom: z.string(),
				staticTo: z.string(),
				staticSubject: z.string(),
			}),
			actions: z.array(ActionSchema).min(1),
		}),
	),
});

const MatchSchema = z.object({
	match: z.boolean(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
	if (condition) {
		console.log(`  ✅ ${label}`);
		passed++;
	} else {
		console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
		failed++;
	}
}

async function callCompiler(prompt) {
	const SYSTEM = `You convert natural language email management requests into structured JSON rules.
Every rule condition has ALL fields: staticFrom, staticTo, staticSubject, aiInstructions, conditionalOperator.
Use "" for unused string fields. Use "NONE" when only one condition type is used.
Write aiInstructions whenever the user describes email content types, categories, or intent.`;

	const { output: object } = await generateText({
		model: google(MODEL),
		output: Output.object({ schema: RuleSchema }),
		temperature: 0.1,
		providerOptions: THINKING_OFF,
		system: SYSTEM,
		prompt: `<user_input>${prompt}</user_input>\n\nConvert to structured rules.`,
	});

	return object;
}

async function callEvaluator(email, aiInstructions) {
	const { output: object } = await generateText({
		model: google(MODEL),
		output: Output.object({ schema: MatchSchema }),
		temperature: 0,
		providerOptions: THINKING_OFF,
		system: 'You are a precise email classifier. Determine if the email matches the rule. Return {"match": true} only if it clearly matches, {"match": false} otherwise.',
		prompt: `<rule>${aiInstructions}</rule>

<email>
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Snippet: ${email.snippet}
Body: ${email.body}
Labels: ${email.labels}
</email>`,
	});

	return object.match;
}

// ─── COMPILER TESTS ───────────────────────────────────────────────────────────

async function testCompiler() {
	console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("🔧 COMPILER TESTS (NL → Rules)");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

	// Test 1: Pure static sender rule
	{
		console.log("\n[1] Pure sender rule (static only)");
		const result = await callCompiler(
			"If sender is billing@stripe.com, label as Finance and mark as read",
		);
		console.log("  Model output:", JSON.stringify(result, null, 2));
		const rule = result.rules[0];
		assert(
			"produces exactly 1 rule",
			result.rules.length === 1,
			`got ${result.rules.length}`,
		);
		assert(
			"staticFrom is billing@stripe.com",
			rule.condition.staticFrom === "billing@stripe.com",
			rule.condition.staticFrom,
		);
		assert(
			"aiInstructions is empty",
			rule.condition.aiInstructions === "",
			rule.condition.aiInstructions,
		);
		assert(
			"has LABEL action",
			rule.actions.some((a) => a.type === "LABEL"),
		);
		assert(
			"has MARK_READ action",
			rule.actions.some((a) => a.type === "MARK_READ"),
		);
	}

	// Test 2: Content-based rule
	{
		console.log("\n[2] Content-based rule (AI instructions required)");
		const result = await callCompiler(
			"When I get a newsletter, archive it and label it as Newsletter",
		);
		console.log("  Model output:", JSON.stringify(result, null, 2));
		const rule = result.rules[0];
		assert("produces at least 1 rule", result.rules.length >= 1);
		assert(
			"aiInstructions is non-empty",
			rule.condition.aiInstructions.length > 0,
			"aiInstructions was empty",
		);
		assert(
			"aiInstructions mentions newsletter",
			/newsletter|unsubscribe|digest|bulk/i.test(
				rule.condition.aiInstructions,
			),
		);
		assert(
			"has ARCHIVE action",
			rule.actions.some((a) => a.type === "ARCHIVE"),
		);
	}

	// Test 3: Mixed rule (sender + content = AND)
	{
		console.log("\n[3] Mixed rule (sender + content = AND)");
		const result = await callCompiler(
			"If someone from stripe.com emails me about a disputed charge, forward to legal@mycompany.com",
		);
		console.log("  Model output:", JSON.stringify(result, null, 2));
		const rule = result.rules[0];
		assert(
			"produces 1 rule",
			result.rules.length === 1,
			`got ${result.rules.length}`,
		);
		assert(
			"staticFrom contains stripe.com",
			rule.condition.staticFrom.includes("stripe.com"),
			rule.condition.staticFrom,
		);
		assert(
			"aiInstructions is non-empty",
			rule.condition.aiInstructions.length > 0,
		);
		assert(
			"aiInstructions mentions dispute",
			/disput|chargeback/i.test(rule.condition.aiInstructions),
		);
		assert(
			"conditionalOperator is AND",
			rule.condition.conditionalOperator === "AND",
			rule.condition.conditionalOperator,
		);
		assert(
			"has FORWARD action",
			rule.actions.some((a) => a.type === "FORWARD"),
		);
	}

	// Test 4: Multi-rule prompt
	{
		console.log("\n[4] Multi-rule prompt");
		const result = await callCompiler(
			"For AWS emails: if it's a billing alert, label Cost Alert. If it's a security finding, label Security. Archive everything else from AWS.",
		);
		console.log("  Model output:", JSON.stringify(result, null, 2));
		assert(
			"produces 3 rules",
			result.rules.length === 3,
			`got ${result.rules.length}`,
		);
		const allFromAws = result.rules.every(
			(r) =>
				r.condition.staticFrom.includes("amazonaws.com") ||
				r.condition.staticFrom.includes("aws.amazon.com") ||
				r.condition.staticFrom.includes("amazon.com") ||
				r.condition.staticFrom.includes("aws.com"),
		);
		assert(
			"all rules target AWS domain",
			allFromAws,
			result.rules.map((r) => r.condition.staticFrom).join(", "),
		);
		const labels = result.rules.flatMap((r) =>
			r.actions.filter((a) => a.type === "LABEL").map((a) => a.label),
		);
		assert(
			"has Cost Alert label",
			labels.some((l) => /cost/i.test(l)),
		);
		assert(
			"has Security label",
			labels.some((l) => /security/i.test(l)),
		);
		assert(
			"has ARCHIVE action somewhere",
			result.rules.some((r) =>
				r.actions.some((a) => a.type === "ARCHIVE"),
			),
		);
	}

	// Test 5: Schema completeness
	{
		console.log("\n[5] Schema completeness check");
		const result = await callCompiler(
			"For GitHub PRs: label as Code/PRs. Mark as read if it's a comment.",
		);
		console.log("  Model output:", JSON.stringify(result, null, 2));
		for (const rule of result.rules) {
			const c = rule.condition;
			assert(
				`rule "${rule.name}" has all condition fields`,
				"conditionalOperator" in c &&
					"aiInstructions" in c &&
					"staticFrom" in c &&
					"staticTo" in c &&
					"staticSubject" in c,
			);
			assert(
				`rule "${rule.name}" has at least 1 action`,
				rule.actions.length > 0,
			);
		}
	}
}

// ─── EVALUATOR TESTS ──────────────────────────────────────────────────────────

async function testEvaluator() {
	console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("🔍 EVALUATOR TESTS (Email → Match/No-Match)");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

	const newsletterRule =
		"Email is a newsletter or marketing digest — look for unsubscribe links, bulk sender patterns (e.g., digest@, newsletter@, noreply@), promotional content, or mailing list headers";
	const deploySuccessRule =
		"Email is a deployment notification indicating success — look for phrases like 'deployed successfully', 'build passed', 'deployment complete', or 'live in production'";
	const deployFailureRule =
		"Email is a deployment notification indicating failure — look for phrases like 'deploy failed', 'build failed', 'deployment error', or 'pipeline broken'";
	const githubPRCommentRule =
		"Email is about a pull request and contains a code review comment — look for inline code suggestions, review feedback, or comment notifications rather than review requests or merge notifications";
	const fraudAlertRule =
		"Email is a fraud or suspicious activity alert — look for urgent language like 'unauthorized transaction', 'suspicious activity', 'verify your identity', or 'fraud alert'";

	// Test 1: Newsletter → match
	{
		console.log("\n[1] Newsletter email → should MATCH");
		const match = await callEvaluator(
			{
				from: "digest@techcrunch.com",
				to: "user@example.com",
				subject: "TechCrunch Daily Digest - Top Stories",
				snippet: "Your daily roundup of the latest tech news...",
				body: "Here are today's top stories. To unsubscribe from this list, click here: https://techcrunch.com/unsubscribe",
				labels: "INBOX, CATEGORY_PROMOTIONS",
			},
			newsletterRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert("newsletter email matches newsletter rule", match === true);
	}

	// Test 2: Personal email → no match
	{
		console.log("\n[2] Personal email → should NOT match newsletter rule");
		const match = await callEvaluator(
			{
				from: "jane.smith@company.com",
				to: "user@example.com",
				subject: "Re: Meeting tomorrow at 3pm",
				snippet: "Sure, let's meet in the conference room...",
				body: "Sure, let's meet in the conference room. I'll bring the project docs.",
				labels: "INBOX",
			},
			newsletterRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert(
			"personal email does not match newsletter rule",
			match === false,
		);
	}

	// Test 3: Deploy success → match
	{
		console.log("\n[3] Deploy success email → should MATCH");
		const match = await callEvaluator(
			{
				from: "deploy@vercel.com",
				to: "user@example.com",
				subject: "Deployment successful for my-app",
				snippet: "Your deployment has been successfully completed...",
				body: "Your deployment of commit abc123 to production was deployed successfully and is now live in production.",
				labels: "INBOX",
			},
			deploySuccessRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert("deploy success email matches success rule", match === true);
	}

	// Test 4: Deploy failure → no match on success rule
	{
		console.log(
			"\n[4] Deploy failure email → should NOT match success rule",
		);
		const match = await callEvaluator(
			{
				from: "deploy@vercel.com",
				to: "user@example.com",
				subject: "Deployment failed for project-x",
				snippet: "Your deployment to production has failed...",
				body: "Deployment of commit abc123 to production failed. Error: Build timeout exceeded.",
				labels: "INBOX",
			},
			deploySuccessRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert("deploy failure does not match success rule", match === false);
	}

	// Test 5: Deploy failure → match on failure rule
	{
		console.log("\n[5] Deploy failure email → should MATCH failure rule");
		const match = await callEvaluator(
			{
				from: "ci@github.com",
				to: "user@example.com",
				subject: "Build failed: main branch",
				snippet: "The pipeline broken on the main branch...",
				body: "Your build has failed. The pipeline broken after running tests. See the logs for details.",
				labels: "INBOX",
			},
			deployFailureRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert("deploy failure email matches failure rule", match === true);
	}

	// Test 6: GitHub review request → no match on PR comment rule
	{
		console.log(
			"\n[6] GitHub PR review request → should NOT match PR comment rule",
		);
		const match = await callEvaluator(
			{
				from: "notifications@github.com",
				to: "user@example.com",
				subject: "[repo/project] Add auth middleware (#142)",
				snippet:
					"@reviewer requested your review on this pull request...",
				body: "@reviewer requested your review on #142. View it on GitHub. You can approve, request changes, or leave comments.",
				labels: "INBOX",
			},
			githubPRCommentRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert(
			"review request does not match PR comment rule",
			match === false,
		);
	}

	// Test 7: GitHub actual PR comment → match
	{
		console.log("\n[7] GitHub PR code review comment → should MATCH");
		const match = await callEvaluator(
			{
				from: "notifications@github.com",
				to: "user@example.com",
				subject: "Re: [repo/project] Add auth middleware (#142)",
				snippet: "@reviewer commented on your pull request...",
				body: "@reviewer left a review comment on line 42: 'Consider extracting this into a helper function.' They suggested changes to the auth middleware implementation.",
				labels: "INBOX",
			},
			githubPRCommentRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert(
			"PR code review comment matches PR comment rule",
			match === true,
		);
	}

	// Test 8: Fraud alert → match
	{
		console.log("\n[8] Fraud alert email → should MATCH");
		const match = await callEvaluator(
			{
				from: "security@bankofamerica.com",
				to: "user@example.com",
				subject: "Fraud Alert: Suspicious activity on your account",
				snippet:
					"We detected an unauthorized transaction on your account...",
				body: "We detected an unauthorized transaction of $450 on your debit card ending in 1234. Please verify your identity immediately.",
				labels: "INBOX",
			},
			fraudAlertRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert("fraud alert email matches fraud rule", match === true);
	}

	// Test 9: Bank statement → no match on fraud rule
	{
		console.log(
			"\n[9] Regular bank statement email → should NOT match fraud alert rule",
		);
		const match = await callEvaluator(
			{
				from: "statements@bankofamerica.com",
				to: "user@example.com",
				subject: "Your March statement is ready",
				snippet: "Your monthly account statement is now available...",
				body: "Your account statement for March 2024 is ready to view. Log in to your account to view and download your statement.",
				labels: "INBOX",
			},
			fraudAlertRule,
		);
		console.log(`  Model output: { match: ${match} }`);
		assert(
			"bank statement does not match fraud alert rule",
			match === false,
		);
	}
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log("🚀 Starting @ai-sdk/google integration tests...");
console.log(`📡 Model: ${MODEL}`);

try {
	await testCompiler();
	await testEvaluator();
} catch (err) {
	console.error("\n💥 Test suite crashed:", err.message);
	process.exit(1);
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	console.log("❌ Some tests failed");
	process.exit(1);
} else {
	console.log("✅ All tests passed");
}
