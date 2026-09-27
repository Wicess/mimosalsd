#!/usr/bin/env tsx
/**
 * Demo data for exercising the admin panel.
 *
 *   npm run db:demo          seed
 *   npm run db:demo -- clean remove everything it created
 *
 * Everything is tagged so it can be removed again: emails end in @demo.local,
 * order numbers start with DEMO-, and slugs/keys are prefixed `demo-` / `demo.`.
 * It never touches state_rules — compliance data is not demo data.
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { db } from '../src/lib/db/client'
import { PRODUCTS } from '../src/lib/catalog/catalog.data'
import {
  AGE_ATTESTATION,
  INTENDED_USE_ATTESTATION,
  PAYMENT_ATTESTATION,
} from '../src/lib/compliance/disclaimers'

const DEMO_EMAIL = '@demo.local'
const token = () => randomBytes(32).toString('base64url')

type Seed = {
  n: string
  first: string
  last: string
  city: string
  state: string
  zip: string
  status: string
  method: string
  slugs: string[]
  daysAgo: number
}

const ORDERS: Seed[] = [
  { n: 'DEMO-000001', first: 'Marcus', last: 'Reed', city: 'Austin', state: 'TX', zip: '78701', status: 'PENDING_VERIFICATION', method: 'CASHAPP', slugs: ['mhrb-powder'], daysAgo: 0 },
  { n: 'DEMO-000002', first: 'Dana', last: 'Whitfield', city: 'Portland', state: 'OR', zip: '97205', status: 'PENDING_VERIFICATION', method: 'BITCOIN', slugs: ['mhrb-shredded', 'mhrb-powder'], daysAgo: 0 },
  { n: 'DEMO-000003', first: 'Priya', last: 'Anand', city: 'Denver', state: 'CO', zip: '80202', status: 'PAYMENT_CLAIMED', method: 'CHIME', slugs: ['amanita-gummies-mixed-berry'], daysAgo: 1 },
  { n: 'DEMO-000004', first: 'Tomas', last: 'Ruiz', city: 'Phoenix', state: 'AZ', zip: '85004', status: 'PAYMENT_CLAIMED', method: 'APPLE_CASH', slugs: ['amanita-capsules', 'mhrb-powder'], daysAgo: 1 },
  { n: 'DEMO-000005', first: 'Grace', last: 'Okafor', city: 'Atlanta', state: 'GA', zip: '30303', status: 'PAID', method: 'CASHAPP', slugs: ['amanita-gummies-citrus'], daysAgo: 2 },
  { n: 'DEMO-000006', first: 'Ben', last: 'Sorensen', city: 'Columbus', state: 'OH', zip: '43215', status: 'PACKED', method: 'CHIME', slugs: ['mhrb-powder'], daysAgo: 3 },
  { n: 'DEMO-000007', first: 'Alice', last: 'Nguyen', city: 'Dallas', state: 'TX', zip: '75201', status: 'SHIPPED', method: 'BITCOIN', slugs: ['disposable-vape-classic', 'amanita-caps-whole-dried'], daysAgo: 6 },
  { n: 'DEMO-000008', first: 'Owen', last: 'Blackwell', city: 'Nashville', state: 'TN', zip: '37203', status: 'SHIPPED', method: 'CASHAPP', slugs: ['disposable-vape-menthol'], daysAgo: 8 },
  { n: 'DEMO-000009', first: 'Sofia', last: 'Marchetti', city: 'Tampa', state: 'FL', zip: '33602', status: 'DELIVERED', method: 'APPLE_CASH', slugs: ['amanita-powder', 'mhrb-shredded'], daysAgo: 14 },
  { n: 'DEMO-000010', first: 'Henry', last: 'Cole', city: 'Boise', state: 'ID', zip: '83702', status: 'DELIVERED', method: 'CHIME', slugs: ['mhrb-powder'], daysAgo: 20 },
  { n: 'DEMO-000011', first: 'Nadia', last: 'Rahman', city: 'Detroit', state: 'MI', zip: '48226', status: 'CANCELLED', method: 'CASHAPP', slugs: ['amanita-capsules'], daysAgo: 9 },
  { n: 'DEMO-000012', first: 'Louis', last: 'Pratt', city: 'Kansas City', state: 'MO', zip: '64106', status: 'REJECTED', method: 'BITCOIN', slugs: ['amanita-gummies-mixed-berry'], daysAgo: 11 },
]

const byLine = (channel: string) =>
  channel === 'PACT_CARRIER'
    ? { label: 'Age-restricted carrier', cents: 1995, sig: true }
    : { label: 'Standard parcel', cents: 795, sig: false }

async function seed() {
  console.log('\nSeeding demo data…\n')

  /*
   * OrderItem.productId and .variantId are real foreign keys, so they must be the
   * database ids — not the catalogue slugs. The catalogue is static data shared with
   * the seed; the order tables are not.
   */
  const dbProducts = await db.product.findMany({ include: { variants: true } })
  const dbBySlug = new Map(dbProducts.map((p) => [p.slug, p]))
  const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]))

  // ── Orders ────────────────────────────────────────────────────────────────
  for (const o of ORDERS) {
    const created = new Date(Date.now() - o.daysAgo * 86_400_000)
    const items = o.slugs.flatMap((slug) => {
      const cat = bySlug.get(slug)
      const row = dbBySlug.get(slug)
      const variant = row?.variants[0]
      if (!cat || !row || !variant) {
        console.warn(`  ! skipping ${slug} — not in the database`)
        return []
      }
      const qty = slug.includes('1kg') ? 1 : slug.includes('50g') ? 2 : 1
      return [
        {
          productId: row.id,
          variantId: variant.id,
          productName: cat.name,
          variantName: variant.name,
          productLine: cat.productLine,
          fulfillmentChannel: cat.fulfillmentChannel,
          unitPriceCents: variant.priceCents,
          quantity: qty,
          lineTotalCents: variant.priceCents * qty,
        },
      ]
    })
    if (items.length === 0) continue
    const subtotal = items.reduce((s, i) => s + i.lineTotalCents, 0)
    const channels = [...new Set(items.map((i) => i.fulfillmentChannel))]
    const shipments = channels.map((c) => {
      const r = byLine(c)
      const parcelFree = c === 'PARCEL' && subtotal >= 10_000
      return {
        channel: c,
        carrier: r.label,
        shippingCents: parcelFree ? 0 : r.cents,
        requiresAdultSignature: r.sig,
        status: ['SHIPPED', 'DELIVERED'].includes(o.status)
          ? ('IN_TRANSIT' as const)
          : ('PENDING' as const),
      }
    })
    const shipping = shipments.reduce((s, x) => s + x.shippingCents, 0)
    const needsIntendedUse = items.some((i) => i.productLine === 'MIMOSA_HOSTILIS')

    const events: { type: string; message: string; toStatus: string; at: Date }[] = [
      { type: 'CREATED', message: 'Order request received.', toStatus: 'PENDING_VERIFICATION', at: created },
    ]
    const chain = ['AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED']
    const target = chain.indexOf(o.status)
    for (let i = 0; i <= target; i++) {
      events.push({
        type: chain[i]!,
        message: `Moved to ${chain[i]!.replace(/_/g, ' ').toLowerCase()}.`,
        toStatus: chain[i]!,
        at: new Date(created.getTime() + (i + 1) * 3_600_000),
      })
    }

    await db.order.create({
      data: {
        orderNumber: o.n,
        orderToken: token(),
        status: o.status as never,
        email: `${o.first.toLowerCase()}.${o.last.toLowerCase()}${DEMO_EMAIL}`,
        phone: '+1-555-0100',
        firstName: o.first,
        lastName: o.last,
        addressLine1: '120 Example Street',
        city: o.city,
        stateCode: o.state,
        postalCode: o.zip,
        subtotalCents: subtotal,
        shippingCents: shipping,
        totalCents: subtotal + shipping,
        freeShippingApplied: shipments.some((s) => s.channel === 'PARCEL' && s.shippingCents === 0),
        preferredPaymentMethod: o.method as never,
        complianceSnapshot: {
          stateCode: o.state,
          evaluatedAt: created.toISOString(),
          requiresAgeVerification: items.some((i) => i.productLine !== 'MIMOSA_HOSTILIS'),
          requiresAdultSignature: shipments.some((s) => s.requiresAdultSignature),
        },
        placedAt: created,
        createdAt: created,
        expiresAt: new Date(created.getTime() + 48 * 3_600_000),
        ...(['PAID', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(o.status)
          ? { paidAt: new Date(created.getTime() + 4 * 3_600_000) }
          : {}),
        ...(['SHIPPED', 'DELIVERED'].includes(o.status)
          ? { shippedAt: new Date(created.getTime() + 24 * 3_600_000) }
          : {}),
        ...(o.status === 'DELIVERED'
          ? { deliveredAt: new Date(created.getTime() + 72 * 3_600_000) }
          : {}),
        items: { create: items as never },
        shipments: { create: shipments as never },
        events: {
          create: events.map((e) => ({
            type: e.type,
            message: e.message,
            toStatus: e.toStatus as never,
            createdAt: e.at,
          })),
        },
        attestations: {
          create: [
            { kind: 'AGE_21_PLUS' as const, text: AGE_ATTESTATION, acceptedAt: created },
            { kind: 'PAYMENT_METHOD_ACKNOWLEDGED' as const, text: PAYMENT_ATTESTATION, acceptedAt: created },
            ...(needsIntendedUse
              ? [{ kind: 'NOT_FOR_HUMAN_CONSUMPTION' as const, text: INTENDED_USE_ATTESTATION, acceptedAt: created }]
              : []),
          ],
        },
      },
    })
  }
  console.log(`  ✓ ${ORDERS.length} orders across every status`)
}

async function seedRest() {
  const products = await db.product.findMany({ take: 6 })

  // ── Reviews: clean, and ones the lexicon must catch ───────────────────────
  const reviews = [
    ['Arrived quickly and the batch code matched the label. Packaging was discreet.', 5, 'Marcus R.', true],
    ['Colour came out deep purple on wool. Exactly what I wanted for dyeing.', 5, 'Dana W.', true],
    ['Good product but shipping to my state took longer than I expected.', 3, 'Ben S.', true],
    ['This completely cured my anxiety and I sleep better than any medicine.', 5, 'Anon', false],
    ['Great for treating my chronic pain — better than prescription options.', 5, 'J. Doe', false],
  ] as const

  const { scanReview } = await import('../src/lib/compliance/lexicon')
  for (const [body, rating, author, clean] of reviews) {
    const p = products[Math.floor(Math.random() * products.length)]
    if (!p) continue
    const scan = scanReview(body)
    await db.review.create({
      data: {
        productId: p.id,
        authorName: `${author} (demo)`,
        rating,
        body,
        isVerifiedPurchase: clean,
        moderationStatus: scan.clean ? 'PENDING' : 'FLAGGED_COMPLIANCE',
        complianceFlags: scan.matches.map((m) => ({ term: m.term, reason: m.reason })),
      },
    })
  }
  console.log(`  ✓ ${reviews.length} reviews (2 flagged by the lexicon)`)

  // ── Support threads ───────────────────────────────────────────────────────
  const threads = [
    ['sam.carter@demo.local', 'Can you ship the root bark to Idaho? I dye wool.', true],
    ['ines.lopez@demo.local', 'My order says payment claimed — how long does verification take?', true],
    ['no-reply-visitor@demo.local', 'Will this help with my depression?', true],
  ] as const
  for (const [email, body, open] of threads) {
    const t = await db.supportThread.create({
      data: { email, visitorId: `demo-${randomBytes(6).toString('hex')}`, isOpen: open },
    })
    await db.supportMessage.create({
      data: { threadId: t.id, fromCustomer: true, body, authorName: email },
    })
  }
  console.log(`  ✓ ${threads.length} support threads (1 mentions a condition)`)

  // ── Visitors + cart activity (including refusals) ──────────────────────────
  const visitorStates = ['TX', 'CA', 'LA', 'FL', 'NY', 'OH', 'ID', 'WA']
  for (const [i, st] of visitorStates.entries()) {
    await db.visitor.create({
      data: {
        visitorId: `demo-visitor-${i}`,
        stateCode: st,
        landingPath: i % 2 === 0 ? `/legality/${st.toLowerCase()}` : '/shop',
        referrer: i % 3 === 0 ? 'https://www.google.com/' : null,
        pageViews: 2 + i,
      },
    })
  }
  const refusals = [
    ['LA', 'Amanita Muscaria Gummies — Mixed Berry, 10ct', 'Louisiana lists Amanita muscaria among 40 plants that are unlawful when intended for human consumption.'],
    ['LA', 'Amanita Muscaria Capsules — 30ct', 'Louisiana prohibits Amanita products.'],
    ['CA', 'Disposable Vape — Classic', 'California bans flavored e-cigarette sales statewide.'],
    ['NY', 'Disposable Vape — Berry', 'New York prohibits the online sale of any liquid vape product.'],
    ['WA', 'Disposable Vape — Menthol', 'Washington restricts flavored vapor product sales.'],
  ] as const
  /*
    Every cart row belongs to one of the demo visitors above. That is how the
    teardown finds them: a CHECKOUT_STARTED row carries no product and no reason,
    so there is nothing in its content to recognise it by, and matching on content
    is what made the old teardown delete real refusals along with these.
  */
  const demoVisitor = (state: string) => `demo-visitor-${visitorStates.indexOf(state)}`
  for (const [st, name, reason] of refusals) {
    await db.cartActivity.create({
      data: {
        type: 'BLOCKED_BY_STATE',
        visitorId: demoVisitor(st),
        stateCode: st,
        productName: name,
        reason,
        valueCents: 3500,
      },
    })
  }
  // States the demo visitors are actually in, so every row has a visitor to belong to.
  for (const [i, st] of ['TX', 'FL', 'OH', 'ID'].entries()) {
    await db.cartActivity.create({
      data: {
        type: 'ADDED',
        visitorId: demoVisitor(st),
        stateCode: st,
        productName: 'Mimosa Hostilis Root Bark Powder — 100g',
        valueCents: 4500,
      },
    })
    if (i % 2 === 0) {
      await db.cartActivity.create({
        data: { type: 'CHECKOUT_STARTED', visitorId: demoVisitor(st), stateCode: st, valueCents: 4500 },
      })
    }
  }
  console.log(`  ✓ ${visitorStates.length} visitors, ${refusals.length} refusals + cart events`)

  // ── Marketing & ops ───────────────────────────────────────────────────────
  await db.announcement.createMany({
    data: [
      { title: 'Demo — holiday shipping cut-off', body: 'Orders placed after 20 December ship in the new year.', severity: 'INFO', isActive: true },
      { title: 'Demo — carrier delay in the Northeast', body: 'Winter weather is delaying some parcel shipments by one to two days.', severity: 'WARNING', isActive: false },
    ],
  })
  await db.newsletterSubscriber.createMany({
    data: Array.from({ length: 8 }, (_, i) => ({
      email: `subscriber${i}${DEMO_EMAIL}`,
      source: i % 2 === 0 ? 'footer' : 'blog',
      isActive: i !== 7,
    })),
  })
  await db.emailCampaign.createMany({
    data: [
      { name: 'Demo — new batch published', subject: 'New lab results are up', body: 'Fresh certificates of analysis are published for this month.', segment: 'NEWSLETTER', status: 'SENT', recipients: 8, delivered: 8 },
      { name: 'Demo — draft blast', subject: 'A draft that has not sent', body: 'Still being written.', segment: 'ALL', status: 'DRAFT' },
    ],
  })
  await db.trackingLink.createMany({
    data: [
      // On-site targets: a demo link that lands on the homepage teaches an operator
      // that the feature is broken. These go where a real one would.
      { slug: 'demo-forum-thread', label: 'Demo — forum thread', targetUrl: '/shop/mimosa-hostilis', source: 'forum', clicks: 412, orders: 17 },
      { slug: 'demo-guide-link', label: 'Demo — guide backlink', targetUrl: '/guides/how-to-read-a-certificate-of-analysis', source: 'blog', clicks: 96, orders: 3 },
    ],
  })
  await db.paymentHandle.createMany({
    data: [
      { method: 'CASHAPP', handle: '$demoprimary', label: 'Demo primary', isActive: true },
      { method: 'CHIME', handle: 'demo-chime-01', label: 'Demo Chime', isActive: true },
      { method: 'CASHAPP', handle: '$demoburned', label: 'Demo burned', isActive: false, burnedAt: new Date(), burnReason: 'Demo — account frozen' },
    ],
  })
  await db.setting.createMany({
    data: [
      { key: 'demo.shipping.cutoff', label: 'Same-day cut-off time', value: '14:00 CT', group: 'shipping' },
      { key: 'demo.support.hours', label: 'Support hours', value: 'Monday to Friday, 9am–5pm CT', group: 'support' },
    ],
  })
  console.log('  ✓ announcements, subscribers, campaigns, links, handles, settings')
}

async function clean() {
  console.log('\nRemoving demo data…\n')
  const orders = await db.order.findMany({
    where: { orderNumber: { startsWith: 'DEMO-' } },
    select: { id: true },
  })
  const ids = orders.map((o) => o.id)
  await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } })
  await db.attestation.deleteMany({ where: { orderId: { in: ids } } })
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } })
  await db.shipment.deleteMany({ where: { orderId: { in: ids } } })
  await db.order.deleteMany({ where: { id: { in: ids } } })

  const threads = await db.supportThread.findMany({
    where: { visitorId: { startsWith: 'demo-' } },
    select: { id: true },
  })
  await db.supportMessage.deleteMany({ where: { threadId: { in: threads.map((t) => t.id) } } })
  await db.supportThread.deleteMany({ where: { id: { in: threads.map((t) => t.id) } } })

  await db.review.deleteMany({ where: { authorName: { contains: '(demo)' } } })
  /*
    Cart rows BEFORE their visitors: the relation is optional, so removing a
    visitor first only nulls this column and the rows become unfindable.

    Matched by visitor, never by content. The previous filter took every row with
    a reason — and a real BLOCKED_BY_STATE row always has one, so running this on
    live data would have deleted the refusal log, which is the demand signal this
    business reads to see where it is turning revenue away.
  */
  await db.cartActivity.deleteMany({ where: { visitorId: { startsWith: 'demo-visitor-' } } })
  await db.visitor.deleteMany({ where: { visitorId: { startsWith: 'demo-visitor-' } } })
  await db.announcement.deleteMany({ where: { title: { startsWith: 'Demo' } } })
  await db.newsletterSubscriber.deleteMany({ where: { email: { endsWith: DEMO_EMAIL } } })
  await db.emailCampaign.deleteMany({ where: { name: { startsWith: 'Demo' } } })
  await db.trackingLink.deleteMany({ where: { slug: { startsWith: 'demo-' } } })
  await db.paymentHandle.deleteMany({ where: { handle: { contains: 'demo' } } })
  await db.setting.deleteMany({ where: { key: { startsWith: 'demo.' } } })
  console.log(`  ✓ removed ${ids.length} orders and all associated demo records`)
}

async function main() {
  if (process.argv[2] === 'clean') {
    await clean()
  } else {
    await clean() // idempotent: re-seeding replaces rather than duplicates
    await seed()
    await seedRest()
  }
  console.log('\n✓ done.\n')
  await db.$disconnect()
}

main().catch((e: Error) => {
  console.error('✗', e.message)
  process.exit(1)
})
