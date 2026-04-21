CREATE TYPE "Archetype" AS ENUM ('botan', 'sportsman', 'partygoer');

CREATE TYPE "ProfileEventType" AS ENUM ('profile_created', 'archetype_selected', 'action_performed');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "languageCode" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profiles" (
    "userId" UUID NOT NULL,
    "archetype" "Archetype",
    "level" INTEGER NOT NULL DEFAULT 1,
    "profileXp" INTEGER NOT NULL DEFAULT 0,
    "archetypeXp" INTEGER NOT NULL DEFAULT 0,
    "energy" INTEGER NOT NULL DEFAULT 3,
    "softCurrency" INTEGER NOT NULL DEFAULT 0,
    "energyUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "profile_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventType" "ProfileEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

CREATE INDEX "profile_events_userId_createdAt_idx" ON "profile_events"("userId", "createdAt");

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
