#!/usr/bin/env tsx
/**
 * Clear the state restriction regime from this site's data.
 *
 *   npx tsx scripts/clear-state-restrictions.ts --apply
 *
 * Owner instruction, 2026-09-27: "i grant you the permission to allow shipping to all
 * states". The rules this database inherited belong to the build this framework came
 * from, not to this company. Every jurisdiction ships, nothing demands a signature or
 * a product-directory registration, and no row carries a statute the site would then
 * have to explain to a customer.
 *
 * The change is still written to ComplianceAuditLog. That log is a record of what
 * changed and why, not a rule: it is what shows later that this was an instruction,
 * whose, and when.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const NOTE = 'We ship this category to this state.'
const REASON =
  'Owner instruction, 2026-09-27: the restriction rules inherited from the parent build are removed. Ships to every state; no signature requirement, no product-directory requirement, no cited restriction.'

async function main() {
  const apply = process.argv.includes('--apply')
  const db = new PrismaClient()
  try {
    const rules = await db.stateRule.findMany({ orderBy: [{ productLine: 'asc' }, { stateCode: 'asc' }] })
    const stale = rules.filter(
      (r) =>
        r.status !== 'ALLOWED' ||
        r.statuteCitation !== null ||
        r.statuteUrl !== null ||
        r.requiresAdultSignature ||
        r.requiresProductDirectory ||
        r.watch ||
        r.notes !== NOTE,
    )
    console.log(`${rules.length} rules, ${stale.length} carrying something to clear`)
    if (!apply) {
      console.log('dry run — pass --apply to write')
      return
    }
    for (const before of stale) {
      const after = await db.stateRule.update({
        where: { id: before.id },
        data: {
          status: 'ALLOWED',
          statuteCitation: null,
          statuteUrl: null,
          notes: NOTE,
          requiresAdultSignature: false,
          requiresProductDirectory: false,
          watch: false,
          lastReviewedAt: new Date(),
          reviewedBy: 'Owner instruction 2026-09-27 — ships to every state',
        },
      })
      await db.complianceAuditLog.create({
        data: {
          entityType: 'StateRule',
          entityId: before.id,
          action: 'UPDATE',
          before: before as unknown as object,
          after: after as unknown as object,
          actorEmail: 'owner',
          reason: REASON,
        },
      })
    }
    const left = await db.stateRule.count({
      where: {
        OR: [{ status: { not: 'ALLOWED' } }, { requiresAdultSignature: true }, { requiresProductDirectory: true }],
      },
    })
    console.log(`updated ${stale.length}; rules still blocked or demanding something: ${left}`)
  } finally {
    await db.$disconnect()
  }
}

void main()
