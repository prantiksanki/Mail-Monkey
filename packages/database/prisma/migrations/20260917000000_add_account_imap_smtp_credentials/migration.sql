-- AlterEnum
ALTER TYPE "MailboxProvider" ADD VALUE 'IMAP';

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "imapHost" TEXT,
ADD COLUMN     "imapPort" INTEGER,
ADD COLUMN     "imapSecure" BOOLEAN,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpSecure" BOOLEAN,
ADD COLUMN     "imapPasswordEncrypted" TEXT;
