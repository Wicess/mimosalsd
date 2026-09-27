import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expectedFromSchema, missingFromReplay, replayMigrations } from '../../scripts/migration-replay'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE MIGRATION HISTORY MUST REBUILD THE DATABASE FROM NOTHING.
 *
 *  This database was built by `prisma db push`, not by replaying these files, so
 *  nothing ever forced them to be replayable — and one of them was not. 0008
 *  updated `Order."paymentDiscountCents"`, a column that reached production by a
 *  push and that no migration created. Replaying the history onto an empty
 *  database would have failed there, and the day that matters is the day the
 *  database is gone.
 *
 *  So the history is replayed symbolically on every run: no Postgres needed, which
 *  is the point — a check that only runs where a throwaway database happens to
 *  exist is a check that does not run.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const built = replayMigrations(join(process.cwd(), 'prisma', 'migrations'))
const expected = expectedFromSchema(join(process.cwd(), 'prisma', 'schema.prisma'))

describe('prisma/migrations, replayed onto an empty database', () => {
  it('only ever touches a table, column or enum an earlier migration created', () => {
    expect(built.problems.join('\n\n')).toBe('')
  })

  it('rebuilds every table, column and enum schema.prisma expects', () => {
    expect(missingFromReplay(built, expected).join('\n')).toBe('')
  })

  /*
    A checker that skipped what it could not parse would pass a broken history in
    silence, so an unread statement is a problem above. This keeps it honest about
    how much it read: a splitter that returned nothing would otherwise be "clean".
  */
  it('actually read the whole history', () => {
    expect(built.migrations).toBeGreaterThanOrEqual(14)
    expect(built.statements).toBeGreaterThan(200)
    expect(built.tables.size).toBe(expected.models.size)
  })

  it('would notice a column that nothing creates', () => {
    const invented = new Map(expected.models)
    invented.set('Order', new Set([...(expected.models.get('Order') ?? []), 'inventedColumn']))
    expect(missingFromReplay(built, { models: invented, enums: expected.enums })).toEqual([
      'the migrations never add "Order"."inventedColumn"',
    ])
  })
})
