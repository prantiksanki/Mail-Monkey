import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/zoom-client", () => ({
	deleteZoomAccountsByZoomUserId: vi.fn(),
}));

vi.mock("@repo/logs", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { deleteZoomAccountsByZoomUserId } from "../lib/zoom-client";
import { zoomWebhookHandler } from "./zoom";

const mockDelete = vi.mocked(deleteZoomAccountsByZoomUserId);

const SECRET = "zoom-webhook-secret";

function sign(
	rawBody: string,
	{ secret = SECRET, timestamp = String(Math.floor(Date.now() / 1000)) } = {},
) {
	const signature = `v0=${createHmac("sha256", secret)
		.update(`v0:${timestamp}:${rawBody}`)
		.digest("hex")}`;
	return { "x-zm-signature": signature, "x-zm-request-timestamp": timestamp };
}

// Signs the body by default; pass `headers` (e.g. `{}`) to override.
function makeRequest(body: unknown, headers?: Record<string, string>) {
	const rawBody = typeof body === "string" ? body : JSON.stringify(body);
	return new Request("https://app.test/api/webhooks/zoom", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(headers ?? sign(rawBody)),
		},
		body: rawBody,
	});
}

const deauthEvent = {
	event: "app_deauthorized",
	payload: {
		account_id: "zoom-acct-1",
		user_id: "zoom-user-1",
		client_id: "zoom-client-id",
		deauthorization_time: "2026-09-21T10:00:00Z",
	},
};

beforeEach(() => {
	vi.clearAllMocks();
	mockDelete.mockResolvedValue(1);
	process.env.ZOOM_WEBHOOK_SECRET_TOKEN = SECRET;
	process.env.ZOOM_CLIENT_ID = "zoom-client-id";
});

describe("zoomWebhookHandler — configuration", () => {
	it("returns 503 when the webhook secret token is not configured", async () => {
		process.env.ZOOM_WEBHOOK_SECRET_TOKEN = "";

		const res = await zoomWebhookHandler(makeRequest(deauthEvent));

		expect(res.status).toBe(503);
		expect(mockDelete).not.toHaveBeenCalled();
	});
});

describe("zoomWebhookHandler — signature verification", () => {
	it("rejects a request with no signature headers", async () => {
		const res = await zoomWebhookHandler(makeRequest(deauthEvent, {}));

		expect(res.status).toBe(401);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("rejects a signature made with the wrong secret", async () => {
		const rawBody = JSON.stringify(deauthEvent);

		const res = await zoomWebhookHandler(
			makeRequest(rawBody, sign(rawBody, { secret: "attacker-secret" })),
		);

		expect(res.status).toBe(401);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("rejects a body that was modified after signing", async () => {
		const signedBody = JSON.stringify(deauthEvent);
		const tampered = JSON.stringify({
			...deauthEvent,
			payload: { ...deauthEvent.payload, user_id: "someone-else" },
		});

		const res = await zoomWebhookHandler(
			makeRequest(tampered, sign(signedBody)),
		);

		expect(res.status).toBe(401);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("rejects a stale timestamp even when the signature is valid (replay)", async () => {
		const rawBody = JSON.stringify(deauthEvent);
		const tenMinutesAgo = String(Math.floor(Date.now() / 1000) - 600);

		const res = await zoomWebhookHandler(
			makeRequest(rawBody, sign(rawBody, { timestamp: tenMinutesAgo })),
		);

		expect(res.status).toBe(401);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("rejects a non-numeric timestamp", async () => {
		const rawBody = JSON.stringify(deauthEvent);

		const res = await zoomWebhookHandler(
			makeRequest(rawBody, sign(rawBody, { timestamp: "not-a-number" })),
		);

		expect(res.status).toBe(401);
	});

	it("requires a valid signature on url_validation too (no HMAC oracle)", async () => {
		const res = await zoomWebhookHandler(
			makeRequest(
				{
					event: "endpoint.url_validation",
					payload: { plainToken: "x" },
				},
				{},
			),
		);

		expect(res.status).toBe(401);
	});
});

describe("zoomWebhookHandler — endpoint.url_validation", () => {
	it("answers the challenge with HMAC-SHA256(plainToken) as hex", async () => {
		const res = await zoomWebhookHandler(
			makeRequest({
				event: "endpoint.url_validation",
				payload: { plainToken: "qgg8vlvZRS6UYooatFL8Aw" },
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			plainToken: "qgg8vlvZRS6UYooatFL8Aw",
			encryptedToken: createHmac("sha256", SECRET)
				.update("qgg8vlvZRS6UYooatFL8Aw")
				.digest("hex"),
		});
	});

	it("returns 400 when plainToken is missing", async () => {
		const res = await zoomWebhookHandler(
			makeRequest({ event: "endpoint.url_validation", payload: {} }),
		);

		expect(res.status).toBe(400);
	});
});

describe("zoomWebhookHandler — app_deauthorized", () => {
	it("deletes the Zoom account for the deauthorizing Zoom user", async () => {
		const res = await zoomWebhookHandler(makeRequest(deauthEvent));

		expect(res.status).toBe(200);
		expect(mockDelete).toHaveBeenCalledExactlyOnceWith("zoom-user-1");
	});

	it("returns 200 when there was no matching account to delete", async () => {
		mockDelete.mockResolvedValue(0);

		const res = await zoomWebhookHandler(makeRequest(deauthEvent));

		expect(res.status).toBe(200);
	});

	it("returns 400 when user_id is missing", async () => {
		const res = await zoomWebhookHandler(
			makeRequest({ event: "app_deauthorized", payload: {} }),
		);

		expect(res.status).toBe(400);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("ignores a deauthorization meant for a different Zoom app", async () => {
		const res = await zoomWebhookHandler(
			makeRequest({
				...deauthEvent,
				payload: { ...deauthEvent.payload, client_id: "other-app" },
			}),
		);

		expect(res.status).toBe(200);
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("returns 500 so Zoom retries when the delete fails", async () => {
		mockDelete.mockRejectedValue(new Error("db down"));

		const res = await zoomWebhookHandler(makeRequest(deauthEvent));

		expect(res.status).toBe(500);
	});
});

describe("zoomWebhookHandler — other input", () => {
	it("returns 400 for a signed body that is not JSON", async () => {
		const res = await zoomWebhookHandler(makeRequest("not json"));

		expect(res.status).toBe(400);
	});

	it("acknowledges unrelated events without touching accounts", async () => {
		const res = await zoomWebhookHandler(
			makeRequest({ event: "meeting.started", payload: {} }),
		);

		expect(res.status).toBe(200);
		expect(mockDelete).not.toHaveBeenCalled();
	});
});
