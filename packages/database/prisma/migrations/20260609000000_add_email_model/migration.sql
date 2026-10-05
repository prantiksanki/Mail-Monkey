-- Add emailSyncComplete and emailSyncCursor to mailbox
ALTER TABLE "mailbox" ADD COLUMN "emailSyncComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mailbox" ADD COLUMN "emailSyncCursor" TEXT;

-- Create email table
CREATE TABLE "email" (
    "id"           TEXT NOT NULL,
    "mailboxId"    TEXT NOT NULL,
    "threadId"     TEXT NOT NULL,
    "from"         TEXT NOT NULL,
    "fromEmail"    TEXT NOT NULL,
    "to"           TEXT NOT NULL,
    "subject"      TEXT NOT NULL,
    "snippet"      TEXT NOT NULL,
    "bodyText"     TEXT NOT NULL,
    "bodyHtml"     TEXT NOT NULL,
    "labelIds"     TEXT[],
    "isUnread"     BOOLEAN NOT NULL DEFAULT true,
    "internalDate" TIMESTAMP(3) NOT NULL,
    "syncedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "email" ADD CONSTRAINT "email_mailboxId_fkey"
    FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "email_mailboxId_idx" ON "email"("mailboxId");
CREATE INDEX "email_mailboxId_internalDate_idx" ON "email"("mailboxId", "internalDate" DESC);
