-- AlterEnum
ALTER TYPE "ProfileEventType" ADD VALUE 'exam_completed';

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('queueing', 'ready_check', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ExamOutcome" AS ENUM ('success', 'partial_failure');

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerUserId" UUID NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "PartyStatus" NOT NULL DEFAULT 'queueing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "archetypeSnapshot" "Archetype" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "party_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partyId" UUID NOT NULL,
    "resolvedByUserId" UUID NOT NULL,
    "seed" TEXT NOT NULL,
    "successChancePct" INTEGER NOT NULL,
    "rollPct" INTEGER NOT NULL,
    "outcome" "ExamOutcome" NOT NULL,
    "summary" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "examRunId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileXp" INTEGER NOT NULL,
    "archetypeXp" INTEGER NOT NULL,
    "softCurrency" INTEGER NOT NULL,
    "reputation" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parties_status_capacity_createdAt_idx" ON "parties"("status", "capacity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "party_members_partyId_userId_key" ON "party_members"("partyId", "userId");

-- CreateIndex
CREATE INDEX "party_members_userId_idx" ON "party_members"("userId");

-- CreateIndex
CREATE INDEX "party_members_partyId_joinedAt_idx" ON "party_members"("partyId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_runs_partyId_key" ON "exam_runs"("partyId");

-- CreateIndex
CREATE INDEX "exam_runs_resolvedAt_idx" ON "exam_runs"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_rewards_examRunId_userId_key" ON "exam_rewards"("examRunId", "userId");

-- CreateIndex
CREATE INDEX "exam_rewards_userId_createdAt_idx" ON "exam_rewards"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_runs" ADD CONSTRAINT "exam_runs_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_rewards" ADD CONSTRAINT "exam_rewards_examRunId_fkey" FOREIGN KEY ("examRunId") REFERENCES "exam_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_rewards" ADD CONSTRAINT "exam_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
