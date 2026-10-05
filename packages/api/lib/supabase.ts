import { nanoid } from "nanoid";
import { Pool } from "pg";

// Dedicated pool for the Supabase AI database. Completely separate from Neon
// (Prisma) — this only ever reads SUPABASE_DATABASE_URL. Holds embeddings,
// AI labels, and MonkeyChan chat.
let pool: Pool | null = null;

export function supabasePool(): Pool {
	if (!pool) {
		const connectionString = process.env.SUPABASE_DATABASE_URL;
		if (!connectionString) {
			throw new Error("SUPABASE_DATABASE_URL is not set");
		}
		pool = new Pool({
			connectionString,
			ssl: { rejectUnauthorized: false },
			max: 5,
		});
	}
	return pool;
}

function toVectorLiteral(embedding: number[]): string {
	return `[${embedding.join(",")}]`;
}

export type EmailAiRow = {
	emailId: string;
	mailboxId: string;
	aiPriority: string | null;
	aiSummary: string | null;
	aiCategory: string | null;
	embedding: number[] | null;
	taskType?: string | null;
	taskTitle?: string | null;
	taskDue?: string | null;
	payAmount?: string | null;
	payMerchant?: string | null;
};

export async function upsertEmailAi(row: EmailAiRow): Promise<void> {
	const embeddingLiteral = row.embedding
		? toVectorLiteral(row.embedding)
		: null;
	await supabasePool().query(
		`insert into email_ai
		   (email_id, mailbox_id, ai_priority, ai_summary, ai_category, embedding,
		    task_type, task_title, task_due, pay_amount, pay_merchant, enriched_at)
		 values ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9, $10, $11, now())
		 on conflict (email_id) do update set
		   ai_priority  = excluded.ai_priority,
		   ai_summary   = excluded.ai_summary,
		   ai_category  = excluded.ai_category,
		   embedding    = excluded.embedding,
		   task_type    = excluded.task_type,
		   task_title   = excluded.task_title,
		   task_due     = excluded.task_due,
		   pay_amount   = excluded.pay_amount,
		   pay_merchant = excluded.pay_merchant,
		   enriched_at  = now()`,
		[
			row.emailId,
			row.mailboxId,
			row.aiPriority,
			row.aiSummary,
			row.aiCategory,
			embeddingLiteral,
			row.taskType ?? null,
			row.taskTitle ?? null,
			row.taskDue ?? null,
			row.payAmount ?? null,
			row.payMerchant ?? null,
		],
	);
}

// Tasks & payments extracted from the mailbox, joined for display.
export type TaskRow = {
	emailId: string;
	taskType: string;
	taskTitle: string | null;
	taskDue: string | null;
	payAmount: string | null;
	payMerchant: string | null;
	aiSummary: string | null;
};

export async function getMailboxTasks(mailboxId: string): Promise<TaskRow[]> {
	const res = await supabasePool().query(
		`select email_id, task_type, task_title, task_due, pay_amount, pay_merchant, ai_summary
		 from email_ai
		 where mailbox_id = $1 and task_type is not null and task_type <> 'NONE'
		 order by enriched_at desc`,
		[mailboxId],
	);
	return res.rows.map((r) => ({
		emailId: r.email_id,
		taskType: r.task_type,
		taskTitle: r.task_title,
		taskDue: r.task_due,
		payAmount: r.pay_amount,
		payMerchant: r.pay_merchant,
		aiSummary: r.ai_summary,
	}));
}

// Default AI categories, seeded once per mailbox.
const DEFAULT_LABELS: { name: string; color: string; icon: string }[] = [
	{ name: "Work", color: "#2563eb", icon: "briefcase-outline" },
	{ name: "Finance", color: "#16a34a", icon: "cash-outline" },
	{ name: "Receipt", color: "#d97706", icon: "receipt-outline" },
	{ name: "Newsletter", color: "#7c3aed", icon: "newspaper-outline" },
	{ name: "Personal", color: "#db2777", icon: "person-outline" },
	{ name: "Promo", color: "#0891b2", icon: "pricetag-outline" },
];

// Ensure the catalog exists for a mailbox; returns name → id.
export async function ensureSmartLabels(
	mailboxId: string,
): Promise<Map<string, string>> {
	const p = supabasePool();
	for (const l of DEFAULT_LABELS) {
		await p.query(
			`insert into smart_label (id, mailbox_id, name, color, icon, is_ai)
			 values ($1, $2, $3, $4, $5, true)
			 on conflict (mailbox_id, name) do nothing`,
			[nanoid(), mailboxId, l.name, l.color, l.icon],
		);
	}
	const res = await p.query<{ id: string; name: string }>(
		"select id, name from smart_label where mailbox_id = $1",
		[mailboxId],
	);
	return new Map(res.rows.map((r) => [r.name, r.id]));
}

export async function setEmailLabels(
	emailId: string,
	labelIds: string[],
): Promise<void> {
	const p = supabasePool();
	await p.query("delete from email_label where email_id = $1", [emailId]);
	for (const labelId of labelIds) {
		await p.query(
			`insert into email_label (email_id, smart_label_id) values ($1, $2)
			 on conflict do nothing`,
			[emailId, labelId],
		);
	}
}

export type EmailAiView = {
	emailId: string;
	aiPriority: string | null;
	aiSummary: string | null;
	aiCategory: string | null;
	labels: { name: string; color: string; icon: string | null }[];
};

// All AI enrichment for a mailbox (labels joined), for the app to merge with
// the inbox list it already fetches from Neon.
export async function getMailboxAi(mailboxId: string): Promise<EmailAiView[]> {
	const res = await supabasePool().query(
		`select ea.email_id, ea.ai_priority, ea.ai_summary, ea.ai_category,
		   coalesce(
		     json_agg(json_build_object('name', sl.name, 'color', sl.color, 'icon', sl.icon))
		       filter (where sl.id is not null),
		     '[]'
		   ) as labels
		 from email_ai ea
		 left join email_label el on el.email_id = ea.email_id
		 left join smart_label sl on sl.id = el.smart_label_id
		 where ea.mailbox_id = $1
		 group by ea.email_id, ea.ai_priority, ea.ai_summary, ea.ai_category`,
		[mailboxId],
	);
	return res.rows.map((r) => ({
		emailId: r.email_id,
		aiPriority: r.ai_priority,
		aiSummary: r.ai_summary,
		aiCategory: r.ai_category,
		labels: r.labels,
	}));
}

// ── MonkeyChan chat history ─────────────────────────────────────────────────
export type DbChatThread = {
	id: string;
	title: string;
	updatedAt: string;
};

export async function listChatThreads(userId: string): Promise<DbChatThread[]> {
	const res = await supabasePool().query(
		`select id, title, updated_at from chat_thread
		 where user_id = $1 order by updated_at desc limit 50`,
		[userId],
	);
	return res.rows.map((r) => ({
		id: r.id,
		title: r.title,
		updatedAt: r.updated_at,
	}));
}

export async function getChatMessages(
	threadId: string,
): Promise<{ role: string; content: string; sources: unknown }[]> {
	const res = await supabasePool().query(
		`select role, content, sources from chat_message
		 where thread_id = $1 order by created_at asc`,
		[threadId],
	);
	return res.rows;
}

export async function createChatThread(
	id: string,
	userId: string,
	mailboxId: string | null,
	title: string,
): Promise<void> {
	await supabasePool().query(
		`insert into chat_thread (id, user_id, mailbox_id, title) values ($1, $2, $3, $4)
		 on conflict (id) do nothing`,
		[id, userId, mailboxId, title],
	);
}

export async function addChatMessage(
	id: string,
	threadId: string,
	role: "user" | "assistant",
	content: string,
	sources: unknown,
): Promise<void> {
	const p = supabasePool();
	await p.query(
		`insert into chat_message (id, thread_id, role, content, sources)
		 values ($1, $2, $3, $4, $5)`,
		[id, threadId, role, content, sources ? JSON.stringify(sources) : null],
	);
	await p.query("update chat_thread set updated_at = now() where id = $1", [
		threadId,
	]);
}

// Vector similarity search — returns the nearest email_ids for a query vector.
export async function searchSimilarEmails(
	mailboxId: string,
	queryEmbedding: number[],
	limit = 12,
): Promise<{ emailId: string; distance: number }[]> {
	const res = await supabasePool().query<{
		email_id: string;
		distance: number;
	}>(
		`select email_id, embedding <=> $2::vector as distance
		 from email_ai
		 where mailbox_id = $1 and embedding is not null
		 order by distance asc
		 limit $3`,
		[mailboxId, toVectorLiteral(queryEmbedding), limit],
	);
	return res.rows.map((r) => ({ emailId: r.email_id, distance: r.distance }));
}
