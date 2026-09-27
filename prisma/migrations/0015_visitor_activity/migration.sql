-- ─────────────────────────────────────────────────────────────────────────────
--  0015 · what a visitor DID, recorded the moment it happens.
--
--  Page views are batched and filed nightly (0012, 0014). The handful of things
--  that matter commercially — installing the app, subscribing, adding to the cart,
--  turning on notifications, placing an order — are rare enough to write straight
--  away, so the admin sees them live. No foreign key to "Visitor": that row is only
--  filed the night after a first visit, and an order placed today must still be
--  recorded today. Additive only, and safe to run twice.
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE IF NOT EXISTS "VisitorActivity" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VisitorActivity_visitorId_createdAt_idx" ON "VisitorActivity"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VisitorActivity_kind_createdAt_idx" ON "VisitorActivity"("kind", "createdAt");
