-- CreateTable
CREATE TABLE "rule_backfill_run" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "windowMonths" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "query" TEXT,
    "nextPageToken" TEXT,
    "estimatedTotal" INTEGER,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_backfill_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rule_backfill_run_mailboxId_idx" ON "rule_backfill_run"("mailboxId");

-- CreateIndex
CREATE INDEX "rule_backfill_run_ruleId_idx" ON "rule_backfill_run"("ruleId");

-- CreateIndex
CREATE INDEX "rule_backfill_run_status_idx" ON "rule_backfill_run"("status");

-- AddForeignKey
ALTER TABLE "rule_backfill_run" ADD CONSTRAINT "rule_backfill_run_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_backfill_run" ADD CONSTRAINT "rule_backfill_run_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
