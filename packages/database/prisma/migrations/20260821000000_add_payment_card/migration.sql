-- AlterTable
ALTER TABLE "email" ADD COLUMN     "paymentScanCategory" TEXT;

-- CreateEnum
CREATE TYPE "PaymentKanbanStatus" AS ENUM ('UPCOMING', 'DUE_SOON', 'OVERDUE', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatusSource" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateTable
CREATE TABLE "payment_card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "dueDate" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "kanbanStatus" "PaymentKanbanStatus" NOT NULL DEFAULT 'UPCOMING',
    "statusSource" "PaymentStatusSource" NOT NULL DEFAULT 'AUTOMATIC',
    "manuallyOverriddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_mailboxId_paymentScanCategory_idx" ON "email"("mailboxId", "paymentScanCategory");

-- CreateIndex
CREATE UNIQUE INDEX "payment_card_mailboxId_emailId_key" ON "payment_card"("mailboxId", "emailId");

-- CreateIndex
CREATE INDEX "payment_card_userId_kanbanStatus_idx" ON "payment_card"("userId", "kanbanStatus");

-- CreateIndex
CREATE INDEX "payment_card_mailboxId_dueDate_idx" ON "payment_card"("mailboxId", "dueDate");

-- AddForeignKey
ALTER TABLE "payment_card" ADD CONSTRAINT "payment_card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_card" ADD CONSTRAINT "payment_card_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_card" ADD CONSTRAINT "payment_card_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "email"("id") ON DELETE CASCADE ON UPDATE CASCADE;
