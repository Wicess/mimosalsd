-- ─────────────────────────────────────────────────────────────────────────────
--  0020 · pricing by the pound.
--
--  Every product but disposables is now sold in 1/4, 1/3, 1/2 and 1 lb, priced
--  from one price per pound that the owner sets. The old basePriceCents held the
--  price of a different base size and is no longer read, so the pound price gets
--  its own column rather than a reinterpreted one. Additive, safe to run twice.
--
--  Apply BEFORE deploying the code that reads this column.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "ProductOverride" ADD COLUMN IF NOT EXISTS "poundPriceCents" INTEGER;
