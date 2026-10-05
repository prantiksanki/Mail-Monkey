-- CreateEnum
CREATE TYPE "TelegramActionType" AS ENUM ('ARCHIVE', 'MARK_READ', 'TRASH');

-- CreateTable
CREATE TABLE "telegram_connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Calcutta',
    "dailyDigestTime" TEXT NOT NULL DEFAULT '09:00',
    "lastBriefingSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_link_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_action" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "action" "TelegramActionType" NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_briefing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "briefingDate" TIMESTAMP(3) NOT NULL,
    "categoryCounts" JSONB NOT NULL,
    "messageIds" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_briefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_connection_telegramUserId_key" ON "telegram_connection"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_connection_chatId_key" ON "telegram_connection"("chatId");

-- CreateIndex
CREATE INDEX "telegram_connection_userId_idx" ON "telegram_connection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_token_token_key" ON "telegram_link_token"("token");

-- CreateIndex
CREATE INDEX "telegram_link_token_userId_idx" ON "telegram_link_token"("userId");

-- CreateIndex
CREATE INDEX "telegram_link_token_expiresAt_idx" ON "telegram_link_token"("expiresAt");

-- CreateIndex
CREATE INDEX "telegram_action_userId_idx" ON "telegram_action"("userId");

-- CreateIndex
CREATE INDEX "telegram_action_mailboxId_messageId_idx" ON "telegram_action"("mailboxId", "messageId");

-- CreateIndex
CREATE INDEX "telegram_action_expiresAt_idx" ON "telegram_action"("expiresAt");

-- CreateIndex
CREATE INDEX "telegram_briefing_userId_sentAt_idx" ON "telegram_briefing"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "telegram_briefing_mailboxId_briefingDate_idx" ON "telegram_briefing"("mailboxId", "briefingDate");

-- AddForeignKey
ALTER TABLE "telegram_connection" ADD CONSTRAINT "telegram_connection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_link_token" ADD CONSTRAINT "telegram_link_token_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_action" ADD CONSTRAINT "telegram_action_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_action" ADD CONSTRAINT "telegram_action_mailboxId_fkey"
    FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_briefing" ADD CONSTRAINT "telegram_briefing_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_briefing" ADD CONSTRAINT "telegram_briefing_mailboxId_fkey"
    FOREIGN KEY ("mailboxId") REFERENCES "mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
