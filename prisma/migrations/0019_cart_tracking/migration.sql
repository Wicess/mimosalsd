-- ─────────────────────────────────────────────────────────────────────────────
--  0019 · cart tracking.
--
--  CartActivity has existed since 0002 but was never written: its visitorId had to
--  match a Visitor row, and that row is only filed the night after a first visit,
--  when most carts are filled. The constraint goes; the id stays, as on
--  VisitorActivity. The rest adds what a cart needs to be rebuilt from its events:
--  the option, the quantity, the cart's value after each change, and the tracking
--  link the visitor followed. Safe to run twice; no existing row is changed.
--
--  Apply BEFORE deploying the code that writes these columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "CartActivity" DROP CONSTRAINT IF EXISTS "CartActivity_visitorId_fkey";

ALTER TABLE "CartActivity" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
ALTER TABLE "CartActivity" ADD COLUMN IF NOT EXISTS "variantName" TEXT;
ALTER TABLE "CartActivity" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CartActivity" ADD COLUMN IF NOT EXISTS "cartValueCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CartActivity" ADD COLUMN IF NOT EXISTS "cartItems" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CartActivity" ADD COLUMN IF NOT EXISTS "linkSlug" TEXT;

CREATE INDEX IF NOT EXISTS "CartActivity_visitorId_createdAt_idx" ON "CartActivity"("visitorId", "createdAt");
CREATE INDEX IF NOT EXISTS "CartActivity_linkSlug_idx" ON "CartActivity"("linkSlug");
