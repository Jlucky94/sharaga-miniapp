-- AlterEnum
ALTER TYPE "ProfileEventType" ADD VALUE 'project_contributed';
ALTER TYPE "ProfileEventType" ADD VALUE 'project_unlocked';
ALTER TYPE "ProfileEventType" ADD VALUE 'benefit_claimed';
ALTER TYPE "ProfileEventType" ADD VALUE 'contribution_liked';
ALTER TYPE "ProfileEventType" ADD VALUE 'reputation_gained';

-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('notes', 'gym', 'festival');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "reputation" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "profile_events_createdAt_idx" ON "profile_events"("createdAt");

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "ProjectKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "affinity" "Archetype",
    "unlockedAt" TIMESTAMP(3),
    "unlockCycle" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "unlockCycle" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contributionId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_kind_key" ON "projects"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_userId_requestId_key" ON "contributions"("userId", "requestId");

-- CreateIndex
CREATE INDEX "contributions_projectId_createdAt_idx" ON "contributions"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "contributions_userId_createdAt_idx" ON "contributions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_claims_projectId_userId_unlockCycle_key" ON "benefit_claims"("projectId", "userId", "unlockCycle");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_likes_contributionId_fromUserId_key" ON "contribution_likes"("contributionId", "fromUserId");

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_claims" ADD CONSTRAINT "benefit_claims_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_claims" ADD CONSTRAINT "benefit_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_likes" ADD CONSTRAINT "contribution_likes_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
