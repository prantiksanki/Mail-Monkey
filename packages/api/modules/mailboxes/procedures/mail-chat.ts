import { embedText, generateText, textModel } from "@repo/ai";
import { db } from "@repo/database";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
	addChatMessage,
	createChatThread,
	getChatMessages,
	searchSimilarEmails,
} from "../../../lib/supabase";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

type EmailRow = {
	id: string;
	from: string;
	fromEmail: string;
	subject: string;
	snippet: string;
	bodyText: string;
	internalDate: Date;
};

// MonkeyChan — RAG chat over the mailbox. Vector retrieval from Supabase +
// answer from Gemini, with server-side conversation threads.
export const mailChat = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/chat",
		tags: ["Mailboxes"],
		summary: "MonkeyChan: chat with your mailbox (RAG)",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			question: z.string().min(1),
			threadId: z.string().optional(),
			mentions: z.array(z.string()).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		// Thread: reuse or create.
		let threadId = input.threadId;
		if (!threadId) {
			threadId = nanoid();
			await createChatThread(
				threadId,
				context.user.id,
				input.mailboxId,
				input.question.slice(0, 60),
			);
		}
		const priorMessages = await getChatMessages(threadId);

		// --- Retrieval ---
		const seen = new Set<string>();
		const emails: EmailRow[] = [];
		const push = (rows: EmailRow[]) => {
			for (const e of rows) {
				if (!seen.has(e.id)) {
					seen.add(e.id);
					emails.push(e);
				}
			}
		};

		// Vector similarity (semantic).
		try {
			const qvec = await embedText(input.question);
			const hits = await searchSimilarEmails(input.mailboxId, qvec, 12);
			if (hits.length) {
				const rows = (await db.email.findMany({
					where: { id: { in: hits.map((h) => h.emailId) } },
					select: {
						id: true,
						from: true,
						fromEmail: true,
						subject: true,
						snippet: true,
						bodyText: true,
						internalDate: true,
					},
				})) as EmailRow[];
				// keep vector order
				const order = new Map(hits.map((h, i) => [h.emailId, i]));
				rows.sort(
					(a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
				);
				push(rows);
			}
		} catch {}

		// @mentioned senders (keyword from Neon).
		if (input.mentions?.length) {
			for (const m of input.mentions) {
				const rows = (await db.email.findMany({
					where: {
						mailboxId: input.mailboxId,
						OR: [
							{ from: { contains: m, mode: "insensitive" } },
							{ fromEmail: { contains: m, mode: "insensitive" } },
						],
					},
					orderBy: { internalDate: "desc" },
					take: 6,
					select: {
						id: true,
						from: true,
						fromEmail: true,
						subject: true,
						snippet: true,
						bodyText: true,
						internalDate: true,
					},
				})) as EmailRow[];
				push(rows);
			}
		}

		const contextEmails = emails.slice(0, 14);
		const contextText = contextEmails
			.map(
				(e, i) =>
					`[${i + 1}] From: ${e.from}\nSubject: ${e.subject}\nDate: ${new Date(
						e.internalDate,
					)
						.toISOString()
						.slice(
							0,
							10,
						)}\n${(e.bodyText || e.snippet || "").slice(0, 1500)}`,
			)
			.join("\n\n");

		const historyText = priorMessages
			.slice(-6)
			.map(
				(h) =>
					`${h.role === "user" ? "User" : "MonkeyChan"}: ${h.content}`,
			)
			.join("\n");

		const { text } = await generateText({
			model: textModel,
			system: "You are MonkeyChan, MailMonkey's mailbox assistant. Answer using ONLY the provided emails as context. Be concise and specific; reference the sender or subject when useful. If the emails don't contain the answer, say so honestly — never invent facts.",
			prompt: `${historyText ? `Conversation so far:\n${historyText}\n\n` : ""}Emails:\n${
				contextText || "(no emails found)"
			}\n\nQuestion: ${input.question}`,
		});

		const sources = contextEmails.slice(0, 5).map((e) => ({
			email_id: e.id,
			from: e.from,
			subject: e.subject,
		}));

		// Persist the exchange.
		await addChatMessage(nanoid(), threadId, "user", input.question, null);
		await addChatMessage(nanoid(), threadId, "assistant", text, sources);

		return { threadId, answer: text, sources };
	});
