-- DropForeignKey
ALTER TABLE "ai_chat" DROP CONSTRAINT "ai_chat_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ai_chat" DROP CONSTRAINT "ai_chat_userId_fkey";

-- DropTable
DROP TABLE "ai_chat";
