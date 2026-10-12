-- CreateEnum
CREATE TYPE "CategoryLabel" AS ENUM ('PRIMARY', 'NEWSLETTER', 'PROMOTION', 'SOCIAL');

-- AlterTable
ALTER TABLE "email" ADD COLUMN     "category" "CategoryLabel",
ADD COLUMN     "categorizedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_classification_run" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cursor" TEXT,
    "totalAtStart" INTEGER,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "classifiedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_classification_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_mailboxId_category_idx" ON "email"("mailboxId", "category");

-- CreateIndex
CREATE INDEX "email_classification_run_mailboxId_idx" ON "email_classification_run"("mailboxId");

-- CreateIndex
CREATE INDEX "email_classification_run_status_idx" ON "email_classification_run"("status");

-- AddForeignKey
ALTER TABLE "email_classification_run" ADD CONSTRAINT "email_classification_run_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
