-- CreateTable
--
-- Products posted from the admin panel. IF NOT EXISTS throughout because
-- scripts/db-migrate.ts re-runs every migration on every invocation.
--
-- Additive only. This is a new table that no existing query reads, so it can be
-- applied before or after the code that uses it ships, and the storefront treats
-- a missing table as nothing posted yet.
CREATE TABLE IF NOT EXISTS "PostedProduct" (
    "slug" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "PostedProduct_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostedProduct_categorySlug_isActive_idx" ON "PostedProduct"("categorySlug", "isActive");
