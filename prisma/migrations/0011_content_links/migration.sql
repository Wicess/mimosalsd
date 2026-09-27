-- Internal links for posts and guides written in the admin panel.
--
-- Authored content already links in a loop: a cluster post points up at its pillar
-- guide and the guide points back down at its posts. These two columns let content
-- written in the admin join that loop instead of being the one page on the blog that
-- nothing links to.
--
-- Additive only, and IF NOT EXISTS throughout, because scripts/db-migrate.ts re-runs
-- every migration on every invocation.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "pillarSlug" TEXT;

-- AlterTable
ALTER TABLE "Guide" ADD COLUMN IF NOT EXISTS "clusterSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
