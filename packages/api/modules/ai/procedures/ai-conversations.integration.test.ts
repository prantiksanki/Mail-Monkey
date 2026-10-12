/**
 * Integration tests for AI conversation persistence.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import {
	appendMessages,
	createConversation,
	deleteConversation,
	getConversation,
	listConversations,
	renameConversation,
} from "@repo/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("ai conversation persistence — integration", () => {
	let seed: TestSeed;

	beforeAll(async () => {
		seed = await setupTestSeed("ai-conversations");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	beforeEach(async () => {
		const { db } = await import("@repo/database");
		await db.aiConversation.deleteMany({
			where: { userId: seed.userId },
		});
	});

	it("creates a conversation with a default title", async () => {
		const convo = await createConversation({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
		});
		expect(convo.id).toBeTruthy();
		expect(convo.title).toBe("New chat");
		expect(convo.userId).toBe(seed.userId);
		expect(convo.mailboxId).toBe(seed.mailboxId);
	});

	it("lists conversations scoped to the owner, newest first", async () => {
		const first = await createConversation({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
			title: "First",
		});
		const second = await createConversation({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
			title: "Second",
		});
		// A conversation owned by someone else must not appear.
		await createConversation({
			userId: seed.otherUserId,
			mailboxId: seed.mailboxId,
			title: "Other user's",
		});

		const list = await listConversations({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
		});
		const ids = list.map((c) => c.id);
		expect(ids).toContain(first.id);
		expect(ids).toContain(second.id);
		expect(list).toHaveLength(2);
		expect(list.every((c) => c.title !== "Other user's")).toBe(true);
	});

	it("appends messages and returns them oldest-first via getConversation", async () => {
		const convo = await createConversation({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
		});

		await appendMessages({
			conversationId: convo.id,
			messages: [
				{
					role: "user",
					parts: [{ type: "text", text: "hi" }],
				},
				{
					role: "assistant",
					parts: [{ type: "text", text: "hello" }],
				},
			],
		});

		const full = await getConversation({
			id: convo.id,
			userId: seed.userId,
		});
		expect(full?.messages).toHaveLength(2);
		expect(full?.messages[0]?.role).toBe("user");
		expect(full?.messages[1]?.role).toBe("assistant");
	});

	it("does not return a conversation to a non-owner", async () => {
		const convo = await createConversation({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
		});
		const asOther = await getConversation({
			id: convo.id,
			userId: seed.otherUserId,
		});
		expect(asOther).toBeNull();
	});

	it("renames only when the user owns the conversation", async () => {
		const convo = await createConversation({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
		});

		const okOther = await renameConversation({
			id: convo.id,
			userId: seed.otherUserId,
			title: "Hijacked",
		});
		expect(okOther).toBe(false);

		const okOwner = await renameConversation({
			id: convo.id,
			userId: seed.userId,
			title: "Renamed",
		});
		expect(okOwner).toBe(true);

		const full = await getConversation({
			id: convo.id,
			userId: seed.userId,
		});
		expect(full?.title).toBe("Renamed");
	});

	it("deletes only when the user owns the conversation, cascading messages", async () => {
		const convo = await createConversation({
			userId: seed.userId,
			mailboxId: seed.mailboxId,
		});
		await appendMessages({
			conversationId: convo.id,
			messages: [{ role: "user", parts: [{ type: "text", text: "x" }] }],
		});

		const okOther = await deleteConversation({
			id: convo.id,
			userId: seed.otherUserId,
		});
		expect(okOther).toBe(false);

		const okOwner = await deleteConversation({
			id: convo.id,
			userId: seed.userId,
		});
		expect(okOwner).toBe(true);

		const gone = await getConversation({
			id: convo.id,
			userId: seed.userId,
		});
		expect(gone).toBeNull();
	});
});
