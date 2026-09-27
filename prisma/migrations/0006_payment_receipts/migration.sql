-- AlterTable
--
-- EXPAND ONLY. This migration used to DROP "receiptKey" in the same step as adding
-- "receiptKeys", and that took production down: the database in .env is the one
-- Vercel serves, the deployed build still selected "receiptKey", and every admin
-- order and invoice page failed with P2022 until the column was put back.
--
-- A column is dropped only AFTER no deployed build reads it — expand, deploy,
-- contract, as separate steps. "receiptKey" stays until main no longer references
-- it; a later migration removes it.
--
-- IF NOT EXISTS because scripts/db-migrate.ts re-runs every migration on every
-- invocation and skips a statement only when Postgres answers "already exists".
ALTER TABLE "PaymentIntentRequest"
ADD COLUMN IF NOT EXISTS "receiptKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "txRef" TEXT;
