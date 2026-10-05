import { embedText, generateObject, textModel } from "@repo/ai";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import {
	ensureSmartLabels,
	setEmailLabels,
	upsertEmailAi,
} from "../../../lib/supabase";

const CLASSIFY_SCHEMA = z.object({
	priority: z.enum(["HANDLE_NOW", "CHECK_TODAY", "FYI"]),
	summary: z.string(),
	labels: z.array(
		z.enum([
			"Work",
			"Finance",
			"Receipt",
			"Newsletter",
			"Personal",
			"Promo",
		]),
	),
	// Money & smart tasks.
	taskType: z.enum(["PAYMENT", "ACTION", "NONE"]),
	taskTitle: z.string().nullable(),
	taskDue: z.string().nullable(),
	payAmount: z.string().nullable(),
	payMerchant: z.string().nullable(),
});

// Enrich a mailbox's emails into the Supabase AI DB: embedding (RAG) + AI
// priority/summary + smart labels. Reads from Neon, writes to Supabase.
export async function enrichMailbox(
	mailboxId: string,
	opts: { limit?: number } = {},
): Promise<{ enriched: number; total: number; failed: number }> {
	const limit = opts.limit ?? 40;
	const labelMap = await ensureSmartLabels(mailboxId);

	const emails = await db.email.findMany({
		where: { mailboxId },
		orderBy: { internalDate: "desc" },
		take: limit,
		select: {
			id: true,
			from: true,
			subject: true,
			snippet: true,
			bodyText: true,
		},
	});

	let enriched = 0;
	let failed = 0;

	for (const e of emails) {
		try {
			const text = `From: ${e.from}\nSubject: ${e.subject}\n\n${(
				e.bodyText || e.snippet || ""
			).slice(0, 6000)}`;

			const embedding = await embedText(text);

			const { object } = await generateObject({
				model: textModel,
				schema: CLASSIFY_SCHEMA,
				system:
					"Classify this email.\n" +
					"- priority: HANDLE_NOW (needs action soon) / CHECK_TODAY (read today) / FYI.\n" +
					"- summary: one short sentence capturing the gist.\n" +
					"- labels: 1-2 categories that best fit.\n" +
					"- taskType: PAYMENT if it's a bill/invoice/payment request; ACTION if it asks the user to do something (reply, sign, submit, confirm) by a time; else NONE.\n" +
					"- taskTitle: a short imperative of what to do (e.g. 'Pay electricity bill', 'Reply to Sarah'), or null.\n" +
					"- taskDue: any due date/deadline mentioned, or null.\n" +
					"- payAmount: the amount to pay with currency (e.g. '₹499'), or null.\n" +
					"- payMerchant: who is being paid, or null.",
				prompt: text.slice(0, 4000),
			});

			await upsertEmailAi({
				emailId: e.id,
				mailboxId,
				aiPriority: object.priority,
				aiSummary: object.summary,
				aiCategory: object.labels[0] ?? null,
				embedding,
				taskType: object.taskType,
				taskTitle: object.taskTitle,
				taskDue: object.taskDue,
				payAmount: object.payAmount,
				payMerchant: object.payMerchant,
			});

			const labelIds = object.labels
				.map((l) => labelMap.get(l))
				.filter((id): id is string => Boolean(id));
			await setEmailLabels(e.id, labelIds);

			enriched++;
		} catch (err) {
			failed++;
			logger.error("[enrich] email failed", {
				emailId: e.id,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return { enriched, total: emails.length, failed };
}
