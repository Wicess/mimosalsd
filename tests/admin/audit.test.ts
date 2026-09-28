import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const reportError = vi.fn()

vi.mock('@/lib/db/client', () => ({ db: { complianceAuditLog: { create } } }))
vi.mock('@/lib/observability/report-error', () => ({ reportError }))

const { recordAdminAction } = await import('@/lib/admin/audit')

const ACTOR = { userId: 'usr_1', email: 'operator@example.com' }

beforeEach(() => {
  create.mockReset()
  create.mockResolvedValue({})
  reportError.mockReset()
})

describe('the admin audit trail', () => {
  it('records the real operator, never a literal', async () => {
    await recordAdminAction({
      entityType: 'StateRule',
      entityId: 'rule_1',
      action: 'UPDATE',
      actor: ACTOR,
      reason: 'Because',
    })

    const { data } = create.mock.calls[0]![0]
    expect(data.actorId).toBe('usr_1')
    expect(data.actorEmail).toBe('operator@example.com')
  })

  /*
    The reason this helper exists at all. Both defects found during the order-detail
    port were rows that recorded WHETHER someone was authorised without recording WHO
    — so the type has no way to express an anonymous actor, and this asserts the
    stamped value comes from the caller's identity rather than a default.
  */
  it('never writes the string "admin" as an actor', async () => {
    await recordAdminAction({
      entityType: 'Product',
      entityId: 'p1',
      action: 'UPDATE',
      actor: ACTOR,
    })
    const { data } = create.mock.calls[0]![0]
    expect(data.actorEmail).not.toBe('admin')
  })

  describe('redaction', () => {
    it('blanks a password hash rather than copying it into the trail', async () => {
      await recordAdminAction({
        entityType: 'AdminUser',
        entityId: 'u1',
        action: 'UPDATE',
        actor: ACTOR,
        before: { email: 'a@b.com', passwordHash: '$argon2id$v=19$SECRET', role: 'STAFF' },
        after: { email: 'a@b.com', passwordHash: '$argon2id$v=19$OTHER', role: 'ADMIN' },
      })

      const { data } = create.mock.calls[0]![0]
      expect(data.before.passwordHash).toBe('[redacted]')
      expect(data.after.passwordHash).toBe('[redacted]')
      // The fields that make the entry useful survive.
      expect(data.before.role).toBe('STAFF')
      expect(data.after.role).toBe('ADMIN')
    })

    /*
      Payment handles are server-only and rotated so they cannot be harvested and the
      accounts frozen (CLAUDE.md rule 7). A pool of live handles sitting in a table
      any operator can read is the same exposure arriving more slowly.
    */
    it('blanks a payment handle', async () => {
      await recordAdminAction({
        entityType: 'PaymentHandle',
        entityId: 'h1',
        action: 'CREATE',
        actor: ACTOR,
        after: { method: 'CASHAPP', handle: '$realcashtag', isActive: true },
      })

      const { data } = create.mock.calls[0]![0]
      expect(data.after.handle).toBe('[redacted]')
      expect(data.after.method).toBe('CASHAPP')
    })

    it('redacts case-insensitively and through nesting', async () => {
      await recordAdminAction({
        entityType: 'Order',
        entityId: 'o1',
        action: 'UPDATE',
        actor: ACTOR,
        after: { nested: { OrderToken: 'tok_live', city: 'Austin' } },
      })

      const { data } = create.mock.calls[0]![0]
      expect(data.after.nested.OrderToken).toBe('[redacted]')
      expect(data.after.nested.city).toBe('Austin')
    })
  })

  describe('JSON safety', () => {
    /*
      `PaymentIntentRequest.btcAmountSats` is a BigInt, and BigInt THROWS on
      JSON.stringify rather than degrading. Un-normalised, an audit write on that
      model would fail at exactly the moment it mattered.
    */
    it('survives a BigInt', async () => {
      await recordAdminAction({
        entityType: 'PaymentIntentRequest',
        entityId: 'pir1',
        action: 'UPDATE',
        actor: ACTOR,
        after: { btcAmountSats: 123456789012345n },
      })

      const { data } = create.mock.calls[0]![0]
      expect(data.after.btcAmountSats).toBe('123456789012345')
      expect(() => JSON.stringify(data.after)).not.toThrow()
    })

    it('serialises dates as ISO strings', async () => {
      await recordAdminAction({
        entityType: 'LabBatch',
        entityId: 'b1',
        action: 'PUBLISH',
        actor: ACTOR,
        after: { testedAt: new Date('2026-07-22T00:00:00Z') },
      })

      const { data } = create.mock.calls[0]![0]
      expect(data.after.testedAt).toBe('2026-07-22T00:00:00.000Z')
    })

    it('stops at a depth cap rather than following a cycle forever', async () => {
      const cyclic: Record<string, unknown> = { name: 'root' }
      cyclic.self = cyclic

      await expect(
        recordAdminAction({
          entityType: 'Thing',
          entityId: 't1',
          action: 'UPDATE',
          actor: ACTOR,
          after: cyclic,
        }),
      ).resolves.toBeUndefined()

      expect(create).toHaveBeenCalledOnce()
    })
  })

  /*
    By the time this runs the mutation has already committed and the operator has
    already been told it succeeded. Throwing here would unwind a change that is not
    coming back, so the failure is reported instead — but it MUST be reported, because
    an audit trail that silently stops writing is worse than one never claimed.
  */
  describe('when the write fails', () => {
    it('does not throw at the caller', async () => {
      create.mockRejectedValue(new Error('connection terminated'))

      await expect(
        recordAdminAction({
          entityType: 'StateRule',
          entityId: 'r1',
          action: 'UPDATE',
          actor: ACTOR,
        }),
      ).resolves.toBeUndefined()
    })

    it('reports the failure so it surfaces on /admin/errors', async () => {
      create.mockRejectedValue(new Error('connection terminated'))

      await recordAdminAction({
        entityType: 'StateRule',
        entityId: 'r1',
        action: 'UPDATE',
        actor: ACTOR,
      })

      expect(reportError).toHaveBeenCalledOnce()
      const [, meta] = reportError.mock.calls[0]!
      expect(meta.context).toMatchObject({ entityType: 'StateRule', entityId: 'r1' })
    })
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  COVERAGE — the test that stops this rotting.
 *
 *  The gap this work closed was not a broken helper; it was twenty-one mutations
 *  that never called one. A helper with no enforcement decays back to exactly that
 *  state the first time somebody adds an action in a hurry, and nothing fails.
 *
 *  So the rule is structural: every exported mutation in an admin action file
 *  records something. Source is read as text rather than imported, because
 *  importing a `'use server'` module drags in the database client, the session
 *  cookie and half the app — and what is being asserted is a property of the CODE,
 *  not of a running call.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('every admin mutation writes to a trail', () => {
  const dir = join(process.cwd(), 'src/app/actions')
  const files = readdirSync(dir).filter(
    (f) => f.startsWith('admin-') && f.endsWith('.ts'),
  )

  /**
   * Reads on a mutation-shaped module. `noteLocationBlockers` returns a count and
   * changes nothing; auditing a read would be noise in the table an incident is
   * reconstructed from.
   */
  const READS = new Set(['noteLocationBlockers'])

  /**
   * `advanceOrder` writes an `OrderEvent` instead, and that is correct rather than
   * an exemption. CLAUDE.md rule 8 requires every order transition to write one, and
   * an `OrderEvent` is strictly richer than an audit row here — it carries the from
   * and to status. Writing both would put the same transition in two tables and
   * invite them to disagree.
   */
  const ALTERNATIVE_TRAIL: Record<string, string> = {
    advanceOrder: 'appendEvent',
    /*
      A refund belongs in the order's own history, beside the payment it reverses.
      Splitting it into the general audit table would mean reading two logs to
      answer one question about one order — and the OrderEvent is the log a
      chargeback gets reconstructed from (CLAUDE.md rule 8).
    */
    issueRefund: 'appendEvent',
    /*
      Both rewrite actions hand the work to one helper, rewriteOne, so a single
      product's rewrite is written and audited in one place. The helper's own trail
      is asserted below, so delegating cannot become a way around this check.
    */
    rewritePostedProduct: 'rewriteOne(',
    rewriteNextPostedProduct: 'rewriteOne(',
    /*
      The products-list Show/Hide button hands the work to setPostedProductActive,
      which writes the UNPUBLISH/PUBLISH entry itself and is checked like any other
      action in this file.
    */
    togglePostedProductActive: 'setPostedProductActive(',
  }

  it('audits every rewrite in the helper both rewrite actions delegate to', () => {
    const source = readFileSync(join(dir, 'admin-posted-products.ts'), 'utf8')
    const start = source.indexOf('async function rewriteOne(')
    expect(start, 'rewriteOne not found').toBeGreaterThan(-1)
    const body = source.slice(start, source.indexOf('\n}\n', start))
    expect(body.includes('recordAdminAction')).toBe(true)
  })

  it('found the action files', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    const source = readFileSync(join(dir, file), 'utf8')
    // Split on the exported functions so each body can be inspected on its own.
    const parts = source.split(/^export async function /m).slice(1)

    for (const part of parts) {
      const name = part.slice(0, part.indexOf('(')).trim()
      if (READS.has(name)) continue

      it(`${file} › ${name}`, () => {
        const needle = ALTERNATIVE_TRAIL[name] ?? 'recordAdminAction'
        expect(
          part.includes(needle),
          `${name} mutates without writing to a trail — call recordAdminAction()`,
        ).toBe(true)
      })
    }
  }
})
