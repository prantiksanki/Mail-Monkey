-- CreateTable
CREATE TABLE "mailbox_usage_tracking" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "emailsProcessed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailbox_usage_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailbox_usage_tracking_mailboxId_idx" ON "mailbox_usage_tracking"("mailboxId");

-- CreateIndex
CREATE INDEX "mailbox_usage_tracking_periodStart_idx" ON "mailbox_usage_tracking"("periodStart");

-- CreateIndex
CREATE INDEX "mailbox_usage_tracking_periodEnd_idx" ON "mailbox_usage_tracking"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_usage_tracking_mailboxId_periodStart_key" ON "mailbox_usage_tracking"("mailboxId", "periodStart");

-- AddForeignKey
ALTER TABLE "mailbox_usage_tracking" ADD CONSTRAINT "mailbox_usage_tracking_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
