-- AlterEnum
BEGIN;
CREATE TYPE "AdminRole_new" AS ENUM ('SUPERADMIN', 'ADMIN', 'STAFF');
ALTER TABLE "public"."AdminUser" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "AdminUser" ALTER COLUMN "role" TYPE "AdminRole_new" USING ("role"::text::"AdminRole_new");
ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
ALTER TYPE "AdminRole_new" RENAME TO "AdminRole";
DROP TYPE "public"."AdminRole_old";
ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'STAFF';
COMMIT;

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "adminAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "role" SET DEFAULT 'STAFF';

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "href" TEXT,
    "linkLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "stateCode" VARCHAR(2),
    "landingPath" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "pageViews" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartActivity" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT,
    "type" TEXT NOT NULL,
    "productSlug" TEXT,
    "productName" TEXT,
    "stateCode" VARCHAR(2),
    "reason" TEXT,
    "valueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'NEWSLETTER',
    "stateCode" VARCHAR(2),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "complianceFlags" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "source" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastClickAt" TIMESTAMP(3),

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Announcement_isActive_startsAt_idx" ON "Announcement"("isActive", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_visitorId_key" ON "Visitor"("visitorId");

-- CreateIndex
CREATE INDEX "Visitor_lastSeen_idx" ON "Visitor"("lastSeen");

-- CreateIndex
CREATE INDEX "Visitor_stateCode_idx" ON "Visitor"("stateCode");

-- CreateIndex
CREATE INDEX "CartActivity_type_createdAt_idx" ON "CartActivity"("type", "createdAt");

-- CreateIndex
CREATE INDEX "CartActivity_stateCode_createdAt_idx" ON "CartActivity"("stateCode", "createdAt");

-- CreateIndex
CREATE INDEX "EmailCampaign_status_createdAt_idx" ON "EmailCampaign"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_slug_key" ON "TrackingLink"("slug");

-- CreateIndex
CREATE INDEX "TrackingLink_isActive_idx" ON "TrackingLink"("isActive");

-- CreateIndex
CREATE INDEX "Setting_group_idx" ON "Setting"("group");

-- CreateIndex
CREATE INDEX "AdminUser_isActive_idx" ON "AdminUser"("isActive");

-- AddForeignKey
ALTER TABLE "CartActivity" ADD CONSTRAINT "CartActivity_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("visitorId") ON DELETE SET NULL ON UPDATE CASCADE;

