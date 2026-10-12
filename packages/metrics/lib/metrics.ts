import client from "prom-client";

// Collect default Node.js process metrics (CPU, memory, event loop lag, GC, etc.)
client.collectDefaultMetrics({ prefix: "popsuites_" });

// HTTP request duration, labeled by method/route/status
export const httpRequestDuration = new client.Histogram({
	name: "popsuites_http_request_duration_seconds",
	help: "Duration of HTTP requests in seconds",
	labelNames: ["method", "route", "status_code"],
	buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

// Email rule execution outcomes (LABEL, ARCHIVE, MARK_READ, DRAFT_EMAIL, REPLY, FORWARD, MARK_SPAM)
export const ruleExecutionTotal = new client.Counter({
	name: "popsuites_rule_execution_total",
	help: "Count of email rule executions by action type, status, and provider",
	labelNames: ["action_type", "status", "provider"], // provider: gmail | outlook | zoho
});

// Outbound calls to email provider APIs
export const integrationApiCalls = new client.Counter({
	name: "popsuites_integration_api_calls_total",
	help: "Count of outbound calls to email provider APIs",
	labelNames: ["provider", "endpoint", "status_code"],
});

// Rate-limit quota remaining per provider (set this after each API response using their rate-limit headers)
export const integrationRateLimitRemaining = new client.Gauge({
	name: "popsuites_integration_rate_limit_remaining",
	help: "Remaining rate limit quota per provider",
	labelNames: ["provider"],
});

// Background job / queue health (email sync, rule processing queue, etc.)
export const queueDepth = new client.Gauge({
	name: "popsuites_queue_depth",
	help: "Current depth of background processing queues",
	labelNames: ["queue_name"],
});

// Auth outcomes (Better Auth)
export const authAttemptsTotal = new client.Counter({
	name: "popsuites_auth_attempts_total",
	help: "Count of authentication attempts by outcome",
	labelNames: ["status"], // success | failure
});

export const register = client.register;

/** Provider label used consistently across rule-execution and integration-call metrics. */
export type MetricsProvider = "gmail" | "outlook" | "zoho" | "imap";

/** Maps the DB/account provider enum ("GOOGLE" | "OUTLOOK" | "IMAP") to the metrics label. */
export function toMetricsProvider(
	provider: "GOOGLE" | "OUTLOOK" | "IMAP",
): MetricsProvider {
	if (provider === "OUTLOOK") {
		return "outlook";
	}
	if (provider === "IMAP") {
		return "imap";
	}
	return "gmail";
}
