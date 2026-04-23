-- CreateEnum
CREATE TYPE "BotNotificationKind" AS ENUM ('write_access_confirmed', 'social_payoff', 'exam_update', 'exam_result');

-- CreateEnum
CREATE TYPE "BotNotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "writeAccessGranted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isSeededDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bot_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "kind" "BotNotificationKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "BotNotificationStatus" NOT NULL DEFAULT 'pending',
    "messageText" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "bot_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_notifications_dedupeKey_key" ON "bot_notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "bot_notifications_userId_createdAt_idx" ON "bot_notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "bot_notifications" ADD CONSTRAINT "bot_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
