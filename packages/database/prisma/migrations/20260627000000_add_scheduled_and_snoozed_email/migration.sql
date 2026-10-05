-- Create enum for scheduled email status
CREATE TYPE "ScheduledEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELED');

-- Create scheduled_email table
CREATE TABLE "scheduled_email" (
    "id"          TEXT NOT NULL,
    "mailboxId"   TEXT NOT NULL,
    "to"          TEXT NOT NULL,
    "cc"          TEXT,
    "bcc"         TEXT,
    "subject"     TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status"      "ScheduledEmailStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt"      TIMESTAMP(3),
    "messageId"   TEXT,
    "error"       TEXT,
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_email_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "scheduled_email" ADD CONSTRAINT "scheduled_email_mailboxId_fkey"
    FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "scheduled_email_mailboxId_idx" ON "scheduled_email"("mailboxId");
CREATE INDEX "scheduled_email_status_scheduledAt_idx" ON "scheduled_email"("status", "scheduledAt");

-- Create enum for snooze status
CREATE TYPE "SnoozeStatus" AS ENUM ('SNOOZED', 'RETURNED', 'CANCELED');

-- Create snoozed_email table
CREATE TABLE "snoozed_email" (
    "id"               TEXT NOT NULL,
    "mailboxId"        TEXT NOT NULL,
    "messageId"        TEXT NOT NULL,
    "threadId"         TEXT,
    "from"             TEXT NOT NULL,
    "subject"          TEXT NOT NULL,
    "snippet"          TEXT NOT NULL,
    "internalDate"     TIMESTAMP(3) NOT NULL,
    "isUnread"         BOOLEAN NOT NULL DEFAULT true,
    "originalLabelIds" TEXT[],
    "snoozeUntil"      TIMESTAMP(3) NOT NULL,
    "status"           "SnoozeStatus" NOT NULL DEFAULT 'SNOOZED',
    "returnedAt"       TIMESTAMP(3),
    "error"            TEXT,
    "attempts"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snoozed_email_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "snoozed_email" ADD CONSTRAINT "snoozed_email_mailboxId_fkey"
    FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "snoozed_email_mailboxId_idx" ON "snoozed_email"("mailboxId");
CREATE INDEX "snoozed_email_status_snoozeUntil_idx" ON "snoozed_email"("status", "snoozeUntil");
