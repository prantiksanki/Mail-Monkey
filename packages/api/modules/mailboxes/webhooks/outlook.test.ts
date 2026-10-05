import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	getMailboxBySubscriptionId: vi.fn(),
}));

vi.mock("../lib/rule-engine", () => ({
	processOutlookNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logs", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getMailboxBySubscriptionId } from "@repo/database";
import { processOutlookNotification } from "../lib/rule-engine";
import { outlookWebhookHandler } from "./outlook";

const mockGetMailbox = vi.mocked(getMailboxBySubscriptionId);
const mockProcess = vi.mocked(processOutlookNotification);

function makeMailbox(overrides: Record<string, unknown> = {}) {
	return {
		id: "mbx-1",
		email: "user@example.com",
		accountId: "acct-1",
		userId: "user-1",
		watchEnabled: true,
		subscriptionClientState: "secret",
		...overrides,
	};
}

function makeNotificationRequest(
	notifications: {
		subscriptionId?: string;
		clientState?: string;
		changeType?: string;
		resourceData?: { id?: string };
	}[],
	url = "https://example.com/webhook",
) {
	return new Request(url, {
		method: "POST",
		body: JSON.stringify({ value: notifications }),
		headers: { "Content-Type": "application/json" },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("outlookWebhookHandler", () => {
	describe("Graph validation handshake", () => {
		it("returns the validationToken as plain text", async () => {
			const req = new Request(
				"https://example.com/webhook?validationToken=abc123",
				{ method: "GET" },
			);

			const res = await outlookWebhookHandler(req);

			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Type")).toBe("text/plain");
			expect(await res.text()).toBe("abc123");
		});

		it("does not call processOutlookNotification during handshake", async () => {
			const req = new Request(
				"https://example.com/webhook?validationToken=xyz",
				{ method: "GET" },
			);

			await outlookWebhookHandler(req);

			expect(mockProcess).not.toHaveBeenCalled();
		});
	});

	describe("mailbox not found", () => {
		it("skips processing when getMailboxBySubscriptionId returns null", async () => {
			mockGetMailbox.mockResolvedValue(null);

			const req = makeNotificationRequest([
				{
					subscriptionId: "sub-1",
					clientState: "secret",
					changeType: "created",
					resourceData: { id: "msg-1" },
				},
			]);

			const res = await outlookWebhookHandler(req);

			expect(res.status).toBe(200);
			expect(mockProcess).not.toHaveBeenCalled();
		});
	});

	describe("watchEnabled: false", () => {
		it("skips processing when mailbox watch is disabled", async () => {
			mockGetMailbox.mockResolvedValue(
				makeMailbox({ watchEnabled: false }) as never,
			);

			const req = makeNotificationRequest([
				{
					subscriptionId: "sub-1",
					clientState: "secret",
					changeType: "created",
					resourceData: { id: "msg-1" },
				},
			]);

			const res = await outlookWebhookHandler(req);

			expect(res.status).toBe(200);
			expect(mockProcess).not.toHaveBeenCalled();
		});
	});

	describe("clientState mismatch", () => {
		it("skips processing when notification clientState does not match mailbox", async () => {
			mockGetMailbox.mockResolvedValue(
				makeMailbox({
					subscriptionClientState: "correct-secret",
				}) as never,
			);

			const req = makeNotificationRequest([
				{
					subscriptionId: "sub-1",
					clientState: "wrong-secret",
					changeType: "created",
					resourceData: { id: "msg-1" },
				},
			]);

			const res = await outlookWebhookHandler(req);

			expect(res.status).toBe(200);
			expect(mockProcess).not.toHaveBeenCalled();
		});
	});

	describe("happy path", () => {
		it("calls processOutlookNotification with correct mailbox fields and message ids", async () => {
			mockGetMailbox.mockResolvedValue(makeMailbox() as never);

			const req = makeNotificationRequest([
				{
					subscriptionId: "sub-1",
					clientState: "secret",
					changeType: "created",
					resourceData: { id: "msg-1" },
				},
			]);

			await outlookWebhookHandler(req);

			expect(mockProcess).toHaveBeenCalledOnce();
			expect(mockProcess).toHaveBeenCalledWith(
				{
					id: "mbx-1",
					email: "user@example.com",
					accountId: "acct-1",
					userId: "user-1",
				},
				["msg-1"],
			);
		});

		it("deduplicates message ids for the same subscription", async () => {
			mockGetMailbox.mockResolvedValue(makeMailbox() as never);

			const req = makeNotificationRequest([
				{
					subscriptionId: "sub-1",
					clientState: "secret",
					changeType: "created",
					resourceData: { id: "msg-1" },
				},
				{
					subscriptionId: "sub-1",
					clientState: "secret",
					changeType: "created",
					resourceData: { id: "msg-1" },
				},
			]);

			await outlookWebhookHandler(req);

			const [, messageIds] = mockProcess.mock.calls[0];
			expect(messageIds).toEqual(["msg-1"]);
		});

		it("skips notifications with no resourceData id", async () => {
			mockGetMailbox.mockResolvedValue(makeMailbox() as never);

			const req = makeNotificationRequest([
				{
					subscriptionId: "sub-1",
					clientState: "secret",
					changeType: "created",
					resourceData: {},
				},
			]);

			await outlookWebhookHandler(req);

			expect(mockProcess).not.toHaveBeenCalled();
		});

		it("returns 200 OK for an empty value array", async () => {
			const req = new Request("https://example.com/webhook", {
				method: "POST",
				body: JSON.stringify({ value: [] }),
				headers: { "Content-Type": "application/json" },
			});

			const res = await outlookWebhookHandler(req);

			expect(res.status).toBe(200);
			expect(mockProcess).not.toHaveBeenCalled();
		});
	});
});
