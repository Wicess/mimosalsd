-- CreateTable
CREATE TABLE "ProductOverride" (
    "slug" TEXT NOT NULL,
    "name" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "specs" JSONB,
    "basePriceCents" INTEGER,
    "defaultSizeKey" TEXT,
    "variantPrices" JSONB,
    "priceTiers" JSONB,
    "notForHumanConsumption" BOOLEAN,
    "ageRestricted" BOOLEAN,
    "pactRegulated" BOOLEAN,
    "fulfillmentChannel" TEXT,
    "directoryStates" JSONB,
    "isActive" BOOLEAN,
    "isFeatured" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ProductOverride_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "ProductOverride_updatedAt_idx" ON "ProductOverride"("updatedAt");

