-- MailMonkey AI layer (Supabase). Keyed off Neon's email_id / mailbox_id / user_id.
-- Neon is NOT touched by this. Safe to re-run (IF NOT EXISTS).

create extension if not exists vector;

-- Per-email AI enrichment + embedding (RAG).
create table if not exists email_ai (
  email_id    text primary key,          -- = Neon email.id (Gmail message id)
  mailbox_id  text not null,             -- = Neon mailbox.id
  ai_priority text,                        -- HANDLE_NOW | CHECK_TODAY | FYI
  ai_summary  text,                        -- insight-in-your-tone bubble
  ai_category text,                        -- primary label name (quick chip)
  embedding   vector(768),                 -- RAG vector (text-embedding-004)
  enriched_at timestamptz,
  created_at  timestamptz default now()
);
create index if not exists email_ai_mailbox_idx on email_ai (mailbox_id);
create index if not exists email_ai_embedding_idx
  on email_ai using hnsw (embedding vector_cosine_ops);

-- Money & smart tasks (extracted during enrichment).
alter table email_ai add column if not exists task_type text;     -- PAYMENT | ACTION | NONE
alter table email_ai add column if not exists task_title text;    -- short action/summary
alter table email_ai add column if not exists task_due text;      -- due/deadline if any
alter table email_ai add column if not exists pay_amount text;    -- e.g. ₹499
alter table email_ai add column if not exists pay_merchant text;  -- who to pay
create index if not exists email_ai_task_idx on email_ai (mailbox_id, task_type);

-- Category catalog (AI + user labels).
create table if not exists smart_label (
  id         text primary key,
  mailbox_id text not null,
  name       text not null,
  color      text not null,               -- hex
  icon       text,                          -- ionicon name
  is_ai      boolean default true,
  created_at timestamptz default now(),
  unique (mailbox_id, name)
);

-- Email <-> labels (many-to-many).
create table if not exists email_label (
  email_id       text not null,
  smart_label_id text not null,
  created_at     timestamptz default now(),
  primary key (email_id, smart_label_id)
);

-- MonkeyChan conversations.
create table if not exists chat_thread (
  id         text primary key,
  user_id    text not null,
  mailbox_id text,
  title      text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists chat_thread_user_idx
  on chat_thread (user_id, updated_at desc);

create table if not exists chat_message (
  id         text primary key,
  thread_id  text not null references chat_thread(id) on delete cascade,
  role       text not null,                -- user | assistant
  content    text not null,
  sources    jsonb,                          -- [{ email_id, from, subject }]
  created_at timestamptz default now()
);
create index if not exists chat_message_thread_idx
  on chat_message (thread_id, created_at);
