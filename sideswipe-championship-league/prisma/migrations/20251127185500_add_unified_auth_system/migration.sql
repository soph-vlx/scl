-- CreateEnum AccountRole (safe - only creates if not exists)
DO $$ BEGIN
    CREATE TYPE "AccountRole" AS ENUM ('VIEWER', 'PLAYER', 'LEADER', 'STAFF', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum WebhookType (safe - only creates if not exists)
DO $$ BEGIN
    CREATE TYPE "WebhookType" AS ENUM ('MATCH_UPDATES', 'STANDINGS', 'MATCHDAY_SCHEDULE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable AuthAccount
CREATE TABLE IF NOT EXISTS "AuthAccount" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'VIEWER',
    "teamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable Leader
CREATE TABLE IF NOT EXISTS "Leader" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leader_pkey" PRIMARY KEY ("id")
);

-- CreateTable LeaderRole
CREATE TABLE IF NOT EXISTS "LeaderRole" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable PlayerRole
CREATE TABLE IF NOT EXISTS "PlayerRole" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable MatchScreenshot
CREATE TABLE IF NOT EXISTS "MatchScreenshot" (
    "id" SERIAL NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "opponentTeam" TEXT NOT NULL,
    "matchday" INTEGER NOT NULL,
    "game1" TEXT NOT NULL,
    "game2" TEXT NOT NULL,
    "game3" TEXT NOT NULL,
    "game4" TEXT NOT NULL,
    "game5" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable MatchSubmit
CREATE TABLE IF NOT EXISTS "MatchSubmit" (
    "id" SERIAL NOT NULL,
    "imageData" TEXT NOT NULL,
    "submitterId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "opponentTeamId" INTEGER,
    "matchday" INTEGER NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "ocrResult" TEXT,
    "ocrProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSubmit_pkey" PRIMARY KEY ("id")
);

-- Add columns to SclTeam (safe - handles if column exists)
DO $$ BEGIN
    ALTER TABLE "SclTeam" ADD COLUMN "basePlayerRoleId" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SclTeam" ADD COLUMN "baseLeaderRoleId" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add column to SclStanding (safe - handles if column exists)
DO $$ BEGIN
    ALTER TABLE "SclStanding" ADD COLUMN "previousPosition" INTEGER;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Add type column to DiscordWebhook (safe - handles if column exists)
DO $$ BEGIN
    ALTER TABLE "DiscordWebhook" ADD COLUMN "type" "WebhookType";
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- CreateIndexes (safe - uses IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "AuthAccount_username_key" ON "AuthAccount"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "AuthAccount_email_key" ON "AuthAccount"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "DiscordWebhook_type_key" ON "DiscordWebhook"("type");

-- AddForeignKeys (safe - handles if constraint exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuthAccount_teamId_fkey') THEN
        ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SclTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Leader_teamId_fkey') THEN
        ALTER TABLE "Leader" ADD CONSTRAINT "Leader_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SclTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlayerRole_teamId_fkey') THEN
        ALTER TABLE "PlayerRole" ADD CONSTRAINT "PlayerRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SclTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MatchSubmit_submitterId_fkey') THEN
        ALTER TABLE "MatchSubmit" ADD CONSTRAINT "MatchSubmit_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "AuthAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MatchSubmit_teamId_fkey') THEN
        ALTER TABLE "MatchSubmit" ADD CONSTRAINT "MatchSubmit_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SclTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MatchSubmit_opponentTeamId_fkey') THEN
        ALTER TABLE "MatchSubmit" ADD CONSTRAINT "MatchSubmit_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "SclTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
