-- better-auth 1.7's twoFactor plugin adds verification-attempt tracking
-- (verified / failedVerificationCount / lockedUntil) to the twoFactor table.
-- All three are nullable/defaulted so this is safe against existing rows.
-- AlterTable
ALTER TABLE "twoFactor" ADD COLUMN     "verified" BOOLEAN DEFAULT true,
ADD COLUMN     "failedVerificationCount" INTEGER DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
