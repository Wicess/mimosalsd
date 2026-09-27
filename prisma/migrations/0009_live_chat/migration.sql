-- AlterTable
ALTER TABLE "SupportThread" ADD COLUMN     "adminLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "customerLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "customerTypingAt" TIMESTAMP(3),
ADD COLUMN     "customerTypingText" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "lastIp" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastMessageText" TEXT,
ADD COLUMN     "lastSender" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "unreadForAdmin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unreadForCustomer" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SupportMessage" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentType" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminPresence" (
    "adminId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPresence_pkey" PRIMARY KEY ("adminId")
);

-- CreateTable
CREATE TABLE "BlockedIp" (
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "threadId" TEXT,
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("ip")
);

-- CreateIndex
CREATE INDEX "BlockedIp_createdAt_idx" ON "BlockedIp"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportThread_publicId_key" ON "SupportThread"("publicId");

-- CreateIndex
CREATE INDEX "SupportThread_lastMessageAt_idx" ON "SupportThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportThread_email_idx" ON "SupportThread"("email");



-- ─────────────────────────────────────────────────────────────────────────────
--  BACKFILL — existing threads, so the new inbox is not born lying about them.
--
--  Without this every thread that predates live chat would show no handle, no
--  preview line and an unread count of zero, including threads whose customer is
--  still waiting on a reply.
--
--  GATED ON "publicId" IS NULL, and publicId is written LAST. scripts/db-migrate.ts
--  re-runs every migration on every invocation, so this block runs again and again.
--  Ungated, the unread UPDATE would recompute from message history each time and
--  reset a counter the operator had cleared by reading the thread, putting it back
--  in the inbox as unread. Setting publicId last means a thread counts as backfilled
--  only once every other column has been filled, and every later run matches nothing.
-- ─────────────────────────────────────────────────────────────────────────────

-- Preview line and ordering, from each thread's most recent message.
UPDATE "SupportThread" t
SET "lastMessageAt"   = m."createdAt",
    "lastMessageText" = left(m."body", 300),
    "lastSender"      = CASE WHEN m."fromCustomer" THEN 'CUSTOMER' ELSE 'ADMIN' END
FROM (
  SELECT DISTINCT ON ("threadId") "threadId", "createdAt", "body", "fromCustomer"
  FROM "SupportMessage"
  ORDER BY "threadId", "createdAt" DESC
) m
WHERE m."threadId" = t."id"
  AND t."publicId" IS NULL;

-- Unread for the operator: every customer message since the last operator reply.
UPDATE "SupportThread" t
SET "unreadForAdmin" = sub.n
FROM (
  SELECT m."threadId", count(*)::int AS n
  FROM "SupportMessage" m
  WHERE m."fromCustomer" = true
    AND m."createdAt" > COALESCE(
      (SELECT max(r."createdAt") FROM "SupportMessage" r
        WHERE r."threadId" = m."threadId" AND r."fromCustomer" = false),
      TIMESTAMP '1970-01-01')
  GROUP BY m."threadId"
) sub
WHERE sub."threadId" = t."id"
  AND t."publicId" IS NULL;

-- A readable name. An email local part reads as a stranger, a title-cased name as a customer.
UPDATE "SupportThread"
SET "displayName" = COALESCE(
  NULLIF(initcap(trim(regexp_replace(split_part("email", '@', 1), '[._+-]+', ' ', 'g'))), ''),
  'Visitor')
WHERE "displayName" IS NULL
  AND "publicId" IS NULL;

-- LAST: the handle, which is also the marker that this row has been backfilled.
UPDATE "SupportThread"
SET "publicId" = 'SG-' || upper(substr(md5("id"), 1, 8))
WHERE "publicId" IS NULL;
