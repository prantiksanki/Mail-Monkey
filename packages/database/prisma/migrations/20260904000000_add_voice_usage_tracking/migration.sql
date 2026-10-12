-- Create voice_usage_tracking table (per-user, per-calendar-month voice
-- transcription minutes — not scoped to a mailbox, unlike email processing).
CREATE TABLE "voice_usage_tracking" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd"   TIMESTAMP(3) NOT NULL,
    "secondsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_usage_tracking_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "voice_usage_tracking" ADD CONSTRAINT "voice_usage_tracking_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique + indexes
CREATE UNIQUE INDEX "voice_usage_tracking_userId_periodStart_key" ON "voice_usage_tracking"("userId", "periodStart");
CREATE INDEX "voice_usage_tracking_userId_idx" ON "voice_usage_tracking"("userId");
CREATE INDEX "voice_usage_tracking_periodStart_idx" ON "voice_usage_tracking"("periodStart");
CREATE INDEX "voice_usage_tracking_periodEnd_idx" ON "voice_usage_tracking"("periodEnd");
