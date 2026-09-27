-- First-party visit tracking, filed nightly from a Redis buffer (src/lib/visitors).
--
-- Visitor gains the columns the nightly filing writes: coarse location from the
-- host's geo headers, coarse device parsed from the user-agent, first-touch campaign
-- tags, and a bot flag. No IP address and no user-agent string are stored.
--
-- DailyVisitStat keeps each day's counts for good. PageView keeps per-page history
-- for 90 days. VisitFlush marks a filed day inside the same transaction as its rows,
-- so a retried filing can never count a day twice.
--
-- Generated with prisma migrate diff, then made idempotent: IF NOT EXISTS throughout,
-- because scripts/db-migrate.ts re-runs every migration on every invocation.

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "browser" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "country" VARCHAR(2);
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "device" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "isLikelyBot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "lastPath" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "os" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "region" VARCHAR(8);
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "sessionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DailyVisitStat" (
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL,
    "visitors" INTEGER NOT NULL,
    "humanViews" INTEGER NOT NULL,
    "humanVisitors" INTEGER NOT NULL,
    "newVisitors" INTEGER NOT NULL,
    "crawlerViews" INTEGER NOT NULL,
    "paths" JSONB NOT NULL,
    "referrers" JSONB NOT NULL,
    "countries" JSONB NOT NULL,
    "regions" JSONB NOT NULL,
    "devices" JSONB NOT NULL,
    "crawlers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyVisitStat_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VisitFlush" (
    "day" DATE NOT NULL,
    "events" INTEGER NOT NULL,
    "flushedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitFlush_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PageView" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PageView_visitorId_at_idx" ON "PageView"("visitorId", "at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PageView_at_idx" ON "PageView"("at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Visitor_isLikelyBot_lastSeen_idx" ON "Visitor"("isLikelyBot", "lastSeen");
