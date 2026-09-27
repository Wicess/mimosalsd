-- Promoters: people who send us customers, and the credit for the orders that follow.
--
-- A promoter holds tracking links (/r/<slug>). An order stamped with a link slug and
-- promoter id was placed after a click on one of them. The credit is stored on the
-- order rather than recomputed, so renaming or retiring a link cannot move it.
--
-- Generated with prisma migrate diff, then made idempotent: IF NOT EXISTS throughout,
-- because scripts/db-migrate.ts re-runs every migration on every invocation. The two
-- foreign keys have no IF NOT EXISTS in Postgres, so each is dropped first if it is
-- already there: that is re-runnable under psql as well as under the script, and a DO
-- block is not an option because the statement splitter does not know dollar quoting.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "attributedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "attributedLinkSlug" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "attributedPromoterId" TEXT;

-- AlterTable
ALTER TABLE "TrackingLink" ADD COLUMN IF NOT EXISTS "promoterId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Promoter" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Promoter_slug_key" ON "Promoter"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Promoter_archived_idx" ON "Promoter"("archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_attributedPromoterId_idx" ON "Order"("attributedPromoterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackingLink_promoterId_idx" ON "TrackingLink"("promoterId");

-- AddForeignKey
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_attributedPromoterId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_attributedPromoterId_fkey" FOREIGN KEY ("attributedPromoterId") REFERENCES "Promoter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" DROP CONSTRAINT IF EXISTS "TrackingLink_promoterId_fkey";
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
