import { z } from "zod";
import { getChatMessages, listChatThreads } from "../../../lib/supabase";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const listChatThreadsProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/chat/threads",
		tags: ["Mailboxes"],
		summary: "List MonkeyChan chat threads",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);
		return { threads: await listChatThreads(context.user.id) };
	});

export const getChatThreadProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/chat/threads/{threadId}",
		tags: ["Mailboxes"],
		summary: "Get messages for a MonkeyChan thread",
	})
	.input(z.object({ mailboxId: z.string(), threadId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);
		return { messages: await getChatMessages(input.threadId) };
	});
