-- AlterTable
ALTER TABLE "mailbox" ADD COLUMN     "lastHistoryId" TEXT,
ADD COLUMN     "watchEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "watchExpiry" TIMESTAMP(3);
