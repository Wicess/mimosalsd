-- ─────────────────────────────────────────────────────────────────────────────
--  0016 · a visitor's location, as exactly as an IP lookup allows.
--
--  The host already locates every request from its IP address; only the country,
--  region and city were kept. This adds the rest of that lookup: ZIP code,
--  latitude, longitude and time zone. The IP address itself is still not stored.
--  Additive only, and safe to run twice.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
