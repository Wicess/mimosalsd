import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sending a blast against a REAL Postgres: the claim on a shift is a conditional
 * update, and "nobody gets it twice" is a property of rows, not of a mock.
 *
 * Skipped unless TEST_DATABASE_URL points at a disposable database with the
 * current schema. It empties the campaign, subscriber and notification tables.
 * Nothing is actually emailed: the mail provider is an in-memory fake.
 */
const url = process.env.TEST_DATABASE_URL
const local = url ? new PrismaClient({ datasourceUrl: url }) : null

vi.mock('@/lib/db/client', () => ({ db: local }))
vi.mock('@/lib/site/company-email.server', () => ({ getCompanyEmail: async () => 'sales@shop.test' }))
vi.mock('@/lib/site/postal-address.server', () => ({ getPostalAddress: async () => '1 Main St, Austin, TX 78701' }))
vi.mock('@/lib/brand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/brand')>()
  return { BRAND: { ...actual.BRAND, postalAddress: '1 Main St, Austin, TX 78701' } }
})

const { setMailProvider, resetMailProvider } = await import('@/lib/mail/mailer')
const { sendShift, SHIFT_SIZE, campaignProgress } = await import('@/lib/mail/blast')
const { verifyUnsubscribeToken } = await import('@/lib/newsletter/unsubscribe')

const SECRET = 's'.repeat(40)
type Sent = { to: string; headers?: Readonly<Record<string, string>>; text: string }
let sent: Sent[] = []
const failFor = new Set<string>()

const provider = {
  name: 'fake',
  async send(message: Sent) {
    if (failFor.has(message.to)) throw new Error('mailbox does not exist')
    sent.push(message)
  },
}

async function seedSubscribers(active: number, inactive = 0) {
  const base = Date.UTC(2026, 0, 1)
  await local!.newsletterSubscriber.createMany({
    data: [
      ...Array.from({ length: active }, (_, i) => ({
        email: `person${i}@x.test`,
        isActive: true,
        createdAt: new Date(base + i * 60_000),
      })),
      ...Array.from({ length: inactive }, (_, i) => ({
        email: `gone${i}@x.test`,
        isActive: false,
        unsubscribedAt: new Date(base),
      })),
    ],
  })
}

async function campaign(body = 'Every batch has a lab report.\n\n[Read them](/lab-results)') {
  return local!.emailCampaign.create({ data: { name: 'Test', subject: 'Fresh reports', body, status: 'DRAFT' } })
}

describe.skipIf(!local)('sending a blast against Postgres', () => {
  beforeAll(async () => {
    process.env.ADMIN_SESSION_SECRET = SECRET
    setMailProvider(provider as never)
    await local!.$connect()
  })
  afterAll(async () => {
    resetMailProvider()
    await local?.$disconnect()
  })
  beforeEach(async () => {
    sent = []
    failFor.clear()
    await local!.$transaction([
      local!.notificationLog.deleteMany(),
      local!.emailCampaign.deleteMany(),
      local!.newsletterSubscriber.deleteMany(),
    ])
  })

  it('sends in shifts to active subscribers only, newest first, and finishes', async () => {
    await seedSubscribers(SHIFT_SIZE + 50, 5)
    const c = await campaign()

    const first = await sendShift(c.id)
    expect(first).toEqual({ kind: 'sent', accepted: SHIFT_SIZE, failed: 0, remaining: 50 })
    expect(sent[0]?.to).toBe(`person${SHIFT_SIZE + 49}@x.test`) // the most recent subscriber first
    expect((await local!.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('IN_PROGRESS')

    const second = await sendShift(c.id)
    expect(second).toEqual({ kind: 'sent', accepted: 50, failed: 0, remaining: 0 })
    const done = await local!.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })
    expect(done.status).toBe('SENT')
    expect(done.sentAt).not.toBeNull()
    expect([done.recipients, done.delivered, done.failed]).toEqual([SHIFT_SIZE + 50, SHIFT_SIZE + 50, 0])

    expect(await sendShift(c.id)).toEqual({ kind: 'finished' })
    expect(sent.some((m) => m.to.startsWith('gone'))).toBe(false)
  })

  it('never sends one person the same blast twice', async () => {
    await seedSubscribers(30)
    const c = await campaign()
    await sendShift(c.id)
    // A subscriber who joins afterwards is the only one left.
    await local!.newsletterSubscriber.create({ data: { email: 'late@x.test', isActive: true } })
    await local!.emailCampaign.update({ where: { id: c.id }, data: { status: 'IN_PROGRESS' } })
    await sendShift(c.id)
    const counts = new Map<string, number>()
    for (const m of sent) counts.set(m.to, (counts.get(m.to) ?? 0) + 1)
    expect(Math.max(...counts.values())).toBe(1)
    expect(counts.size).toBe(31)
  })

  it('records a failure and does not retry it', async () => {
    await seedSubscribers(5)
    failFor.add('person2@x.test')
    const c = await campaign()
    expect(await sendShift(c.id)).toMatchObject({ kind: 'sent', accepted: 4, failed: 1, remaining: 0 })
    const failure = await local!.notificationLog.findFirstOrThrow({ where: { target: 'person2@x.test' } })
    expect([failure.success, failure.error]).toEqual([false, 'mailbox does not exist'])
    expect(await campaignProgress(c.id)).toMatchObject({ accepted: 4, failed: 1, remaining: 0 })
  })

  it('lets only one shift run at a time', async () => {
    await seedSubscribers(20)
    const c = await campaign()
    const outcomes = await Promise.all([sendShift(c.id), sendShift(c.id), sendShift(c.id)])
    expect(outcomes.filter((o) => o.kind === 'sent')).toHaveLength(1)
    expect(outcomes.filter((o) => o.kind === 'busy')).toHaveLength(2)
    expect(sent).toHaveLength(20)
  })

  it('takes over a shift that died more than ten minutes ago', async () => {
    await seedSubscribers(3)
    const c = await campaign()
    // Stale on the server's clock, in UTC wall time like every Prisma write.
    await local!.$executeRaw`UPDATE "EmailCampaign" SET status = 'SENDING', "updatedAt" = (now() AT TIME ZONE 'UTC') - interval '11 minutes' WHERE id = ${c.id}`
    expect(await sendShift(c.id)).toMatchObject({ kind: 'sent', accepted: 3 })

    await local!.$executeRaw`UPDATE "EmailCampaign" SET status = 'SENDING', "updatedAt" = (now() AT TIME ZONE 'UTC') - interval '1 minute' WHERE id = ${c.id}`
    expect(await sendShift(c.id)).toEqual({ kind: 'busy' })
  })

  it('refuses copy the lexicon blocks, sends nothing, and leaves it a draft', async () => {
    await seedSubscribers(3)
    const c = await campaign('Our capsules may help with anxiety.')
    const outcome = await sendShift(c.id)
    expect(outcome.kind).toBe('refused')
    expect(sent).toHaveLength(0)
    expect((await local!.emailCampaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('DRAFT')
  })

  it('gives every recipient their own working opt-out', async () => {
    await seedSubscribers(3)
    const c = await campaign()
    await sendShift(c.id)
    const subscribers = await local!.newsletterSubscriber.findMany()
    for (const message of sent) {
      const subscriber = subscribers.find((s) => s.email === message.to)!
      const oneClick = /<([^>]+)>/.exec(message.headers?.['List-Unsubscribe'] ?? '')?.[1] ?? ''
      const params = new URL(oneClick).searchParams
      expect(params.get('s')).toBe(subscriber.id)
      expect(verifyUnsubscribeToken(subscriber.id, params.get('t') ?? '', SECRET)).toBe(true)
      expect(message.headers?.['List-Unsubscribe']).toContain('mailto:sales@shop.test')
      expect(message.text).toContain('1 Main St, Austin, TX 78701')
    }
  })
})
