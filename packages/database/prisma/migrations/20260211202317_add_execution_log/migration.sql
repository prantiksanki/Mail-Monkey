-- CreateTable
CREATE TABLE "rule_execution_log" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "subject" TEXT,
    "from" TEXT,
    "status" TEXT NOT NULL,
    "actionsRun" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_execution_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rule_execution_log_ruleId_idx" ON "rule_execution_log"("ruleId");

-- CreateIndex
CREATE INDEX "rule_execution_log_mailboxId_idx" ON "rule_execution_log"("mailboxId");

-- CreateIndex
CREATE INDEX "rule_execution_log_messageId_idx" ON "rule_execution_log"("messageId");

-- AddForeignKey
ALTER TABLE "rule_execution_log" ADD CONSTRAINT "rule_execution_log_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_execution_log" ADD CONSTRAINT "rule_execution_log_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
