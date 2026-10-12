/**
 * AI Email Classification — Shared Contract
 *
 * This module defines the contract between the compiler (compile-rules.ts)
 * and the evaluator (evaluate-rules.ts). Both prompts reference these
 * canonical definitions to ensure alignment.
 *
 * The contract specifies:
 * 1. Which email fields the evaluator can observe
 * 2. The format and style of aiInstructions strings
 * 3. Canonical examples used in both prompts (compiler shows generation, evaluator shows consumption)
 */

// ─── Observable Email Fields ─────────────────────────────────────────────────
// These are the ONLY fields available to the evaluator at classification time.
// The compiler must write aiInstructions that reference only these fields.

export const OBSERVABLE_FIELDS_DESCRIPTION = `The evaluator sees these email fields at classification time:
- From: sender name and email address
- To: recipient name and email address
- Subject: email subject line
- Snippet: short preview of the email body
- Body: first 2000 characters of the plain-text body
- Labels: Gmail label IDs (e.g., INBOX, CATEGORY_PROMOTIONS, SENT)`;

// ─── aiInstructions Style Guide ──────────────────────────────────────────────
// Both prompts enforce this style so the compiler's output matches what the
// evaluator's few-shot examples consume.

export const AI_INSTRUCTIONS_STYLE = `aiInstructions are classification criteria written for a downstream email classifier. They must:
1. Start with a short declarative sentence: "Email is a [category]"
2. Follow with observable indicators after an em dash: "— look for [specific patterns]"
3. Reference only observable fields (From, To, Subject, Snippet, Body, Labels)
4. Use concrete phrases the classifier should look for (e.g., 'deployed successfully', 'unsubscribe')
5. Explicitly exclude confusable categories when needed (e.g., "not a review request or merge notification")`;

// ─── Canonical Examples ──────────────────────────────────────────────────────
// These exact aiInstructions strings appear in BOTH the compiler and evaluator
// few-shot examples, ensuring the two prompts speak the same language.

export const CANONICAL_EXAMPLES = {
	newsletter: {
		aiInstructions:
			"Email is a newsletter or marketing digest — look for unsubscribe links, bulk sender patterns (e.g., digest@, newsletter@, noreply@), promotional content, or mailing list headers",
		evaluatorExamples: {
			match: {
				from: "digest@techcrunch.com",
				to: "user@example.com",
				subject: "TechCrunch Daily Digest - Top Stories",
				snippet: "Your daily roundup of the latest tech news...",
				body: "Here are today's top stories. To unsubscribe, click here...",
				labels: "INBOX, CATEGORY_PROMOTIONS",
				reasoning:
					"From a bulk sender (digest@), has digest in subject, contains unsubscribe link, labeled as promotions.",
			},
			noMatch: {
				from: "jane.smith@company.com",
				to: "user@example.com",
				subject: "Re: Meeting tomorrow at 3pm",
				snippet: "Sure, let's meet in the conference room...",
				body: "Sure, let's meet in the conference room. I'll bring the project docs.",
				labels: "INBOX",
				reasoning:
					"Personal email from a colleague about a meeting. No newsletter indicators present.",
			},
		},
	},
	githubPRComment: {
		aiInstructions:
			"Email is about a pull request and contains a code review comment — look for inline code suggestions, review feedback, or comment notifications rather than review requests or merge notifications",
		evaluatorExamples: {
			noMatch: {
				from: "notifications@github.com",
				to: "user@example.com",
				subject: "[repo/project] Add auth middleware (#142)",
				snippet:
					"@reviewer requested your review on this pull request...",
				body: "@reviewer requested your review on #142. View it on GitHub...",
				labels: "INBOX",
				reasoning:
					"This is a review request notification, not a code review comment. The rule specifically excludes review requests.",
			},
		},
	},
	deploySuccess: {
		aiInstructions:
			"Email is a deployment notification indicating success — look for phrases like 'deployed successfully', 'build passed', 'deployment complete', or 'live in production'",
		evaluatorExamples: {
			noMatch: {
				from: "deploy@vercel.com",
				to: "user@example.com",
				subject: "Deployment failed for project-x",
				snippet: "Your deployment to production has failed...",
				body: "Deployment of commit abc123 to production failed. Error: Build timeout...",
				labels: "INBOX",
				reasoning:
					"This is a deployment notification but indicates failure, not success. The rule requires success indicators.",
			},
		},
	},
	urgentAttention: {
		aiInstructions:
			"Email requires the recipient's urgent personal attention or action — look for a human sender asking for a same-day reply, call, or decision, rather than automated security alerts, sign-in notifications, or system-generated messages that merely contain alarming words",
		evaluatorExamples: {
			match: {
				from: "Alex Morgan <alex.morgan@company.com>",
				to: "user@example.com",
				subject: "Urgent: need you today — project update",
				snippet:
					"Something's come up on the project and I need to sync with you today.",
				body: "Hi, something's come up on the project and I need to sync with you today. What's your availability in the next couple of hours?",
				labels: "INBOX",
				reasoning:
					"A real person is asking the recipient for a same-day response about a specific matter. Genuinely time-sensitive personal action.",
			},
			noMatch: {
				from: "Google <no-reply@accounts.google.com>",
				to: "user@example.com",
				subject: "Security alert",
				snippet:
					"You allowed access to some of your Google Account data. If you didn't do this, someone may be trying to access your account.",
				body: "You allowed access to some of your Google Account data. If you didn't allow this, someone else may be trying to access your account. Review activity.",
				labels: "INBOX",
				reasoning:
					"An automated security alert from a no-reply system sender. Although it contains alarming words ('someone may be trying to access'), it is not a human requesting the recipient's urgent action — the rule excludes automated/system messages.",
			},
		},
	},
	deployFailure: {
		aiInstructions:
			"Email is a deployment notification indicating failure — look for phrases like 'deploy failed', 'build failed', 'deployment error', or 'pipeline broken'",
	},
	fraudAlert: {
		aiInstructions:
			"Email is a fraud or suspicious activity alert — look for urgent language like 'unauthorized transaction', 'suspicious activity', 'verify your identity', or 'fraud alert'",
	},
	bankStatement: {
		aiInstructions:
			"Email is a bank statement or account summary notification — look for phrases like 'statement is ready', 'account summary', 'monthly statement', or 'view your statement'",
	},
	bankPromo: {
		aiInstructions:
			"Email is a promotional or marketing offer — look for phrases like 'pre-approved', 'limited time offer', 'earn rewards', 'new credit card', or 'special APR'",
	},
} as const;
