-- Idempotent by construction. scripts/db-migrate.ts re-runs EVERY migration on
-- every invocation, and its "already exists" skip-list is a string match against a
-- driver's error text — correct today, and one wording change away from halting the
-- run. IF NOT EXISTS makes a re-run a no-op without relying on that.

-- CreateTable
CREATE TABLE IF NOT EXISTS "CategoryOverride" (
    "slug" TEXT NOT NULL,
    "intro" TEXT,
    "detail" TEXT,
    "metaTitle" TEXT,
    "metaDesc" TEXT,
    "aboutHeading" TEXT,
    "aboutLede" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CategoryOverride_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CategoryOverride_updatedAt_idx" ON "CategoryOverride"("updatedAt");
