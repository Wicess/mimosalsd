-- ─────────────────────────────────────────────────────────────────────────────
--  0008 · coupon redemption, and a backfill for a stored-discount defect.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;

-- The column the backfill at the bottom of this file repairs. Production already
-- had it when this migration was written — it arrived by `prisma db push`, not by
-- a migration — so no earlier file here creates it, and a database rebuilt from
-- these files alone reached the backfill with nothing to update. Creating it here
-- costs production nothing (it exists) and makes the history replayable from empty.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentDiscountCents" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_couponCode_idx" ON "Order"("couponCode");


-- ─────────────────────────────────────────────────────────────────────────────
--  BACKFILL — Bitcoin orders stored with a payment discount of 0.
--
--  The order provider READ `paymentDiscountCents` and never WROTE it, so every
--  Bitcoin order was saved with the column at its default of 0 while `totalCents`
--  already had the 7% taken off. The receipt built from those rows showed a
--  subtotal, a shipping line and a total that did not add up.
--
--  The missing value is recoverable exactly, because until this migration there
--  was no other discount: `discountCents` was never written, so the ONLY way a
--  total could fall below subtotal + shipping was the Bitcoin discount.
--
--  Every condition below narrows it further, and each one is there to make the
--  update provably correct rather than probably correct:
--
--    · method is BITCOIN          — the only method that ever had a discount
--    · paymentDiscountCents = 0   — only rows written wrong, so re-running is a no-op
--    · discountCents = 0          — no coupon on the row, so nothing else explains the gap
--    · the gap EQUALS the formula — FLOOR(subtotal × 0.07), exactly as
--                                   lib/orders/payment-discount.ts computes it
--
--  That last condition is the safety. A row whose gap does not match what the
--  formula would have produced — a total edited by hand, a rate that differed at
--  the time — is LEFT ALONE rather than rewritten on a guess. Postgres evaluates
--  `integer * 0.07` in NUMERIC, so there is no float in this comparison.
--
--  To see what it will touch before running it:
--
--    SELECT "orderNumber", "subtotalCents", "shippingCents", "totalCents",
--           "subtotalCents" + "shippingCents" - "totalCents" AS gap
--    FROM "Order"
--    WHERE "preferredPaymentMethod" = 'BITCOIN' AND "paymentDiscountCents" = 0;
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE "Order"
SET "paymentDiscountCents" = "subtotalCents" + "shippingCents" - "totalCents"
WHERE "preferredPaymentMethod" = 'BITCOIN'
  AND "paymentDiscountCents" = 0
  AND "discountCents" = 0
  AND "subtotalCents" + "shippingCents" - "totalCents" > 0
  AND "subtotalCents" + "shippingCents" - "totalCents" = FLOOR("subtotalCents" * 0.07);
