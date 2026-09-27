-- The visit buffer, in our own database instead of a third-party Redis.
--
-- Browsing does not write here directly: the proxy batches page views in memory and
-- posts a batch at a time to /api/visits/collect, which inserts them. The nightly
-- filing turns a finished day into visitor rows and daily counts and then deletes
-- that day's rows, so this table holds at most a day or two of raw events.
--
-- Idempotent, because scripts/db-migrate.ts re-runs every migration on every run.

-- CreateTable
CREATE TABLE IF NOT EXISTS "VisitEvent" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VisitEvent_day_idx" ON "VisitEvent"("day");
