-- ─────────────────────────────────────────────────────────────────────────────
--  0018 · welcome discounts.
--
--  10% off a first order for email-list subscribers and 5% off a first order from
--  someone who installed the app, each stored on the order like every other money
--  figure. Additive only, defaults of 0 for every existing order, safe to run twice.
--
--  Apply BEFORE deploying the code that writes these columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subscriberDiscountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "appDiscountCents" INTEGER NOT NULL DEFAULT 0;
