import 'server-only'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { notify } from '@/lib/notify/ntfy'
import { absoluteUrl } from '@/lib/seo/routes'
import { isVisitorId, VISITOR_COOKIE } from '@/lib/visitors/cookie'
import { recordActivity } from '@/lib/visitors/record-activity'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHO GETS THE WELCOME DISCOUNTS (owner, 2026-09-14).
 *
 *  10% off for joining the email list, 5% off for installing the app. Each once per
 *  customer email, and both together make 15%. The arithmetic is in
 *  lib/orders/coupons.ts; this decides who qualifies, on the server, at the moment
 *  the order is placed.
 *
 *  ── Subscriber ─────────────────────────────────────────────────────────────
 *  The order's email is on the list, or the customer ticks "subscribe" at checkout,
 *  which puts it there. An address that unsubscribed is not switched back on from a
 *  public form (see actions/newsletter.ts), so it does not qualify.
 *
 *  ── App ────────────────────────────────────────────────────────────────────
 *  This browser has installed the app (the APP_INSTALLED milestone), or the order is
 *  placed from inside it. An iPhone's installed app keeps its own cookies apart from
 *  Safari's, so on an iPhone this means ordering in the app, which is what the offer
 *  says. The signal is the browser's own report, so it can be faked by someone
 *  determined; for 5% of a first order that is an accepted risk.
 *
 *  ── Once per email ─────────────────────────────────────────────────────────
 *  An earlier order with that email that received the discount uses it up, unless it
 *  was cancelled, rejected or refunded: a customer whose order never went through has
 *  not had their welcome.
 *
 *  ── What the checkout page may know ────────────────────────────────────────
 *  Nothing about an email someone types. Whether an address is on the list is private
 *  (a stranger could otherwise test anyone's email), so the page previews the 10%
 *  only for the address THIS browser subscribed with, or when the box is ticked. The
 *  order is what settles it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VOID_STATUSES = ['CANCELLED', 'REJECTED', 'REFUNDED'] as const

async function currentVisitor(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value
  return isVisitorId(value) ? value : null
}

/** Which welcome discounts earlier orders with this email already received. */
async function usedByEmail(email: string): Promise<{ subscriber: boolean; app: boolean }> {
  const rows = await db.order.findMany({
    where: {
      email: { equals: email.trim(), mode: 'insensitive' },
      status: { notIn: [...VOID_STATUSES] },
      OR: [{ subscriberDiscountCents: { gt: 0 } }, { appDiscountCents: { gt: 0 } }],
    },
    select: { subscriberDiscountCents: true, appDiscountCents: true },
    take: 10,
  })
  return {
    subscriber: rows.some((row) => row.subscriberDiscountCents > 0),
    app: rows.some((row) => row.appDiscountCents > 0),
  }
}

export interface CheckoutWelcome {
  /** The address this browser joined the list with, while it is still on the list. */
  readonly subscribedEmail: string | null
  /** That address has already had its subscriber discount. */
  readonly subscriberUsed: boolean
  /** This browser installed the app. */
  readonly appInstalled: boolean
  /** The app discount was already used, by this browser's orders or its subscribed address. */
  readonly appUsed: boolean
}

const NONE: CheckoutWelcome = { subscribedEmail: null, subscriberUsed: false, appInstalled: false, appUsed: false }

/** What the checkout page can preview for this browser. Never fails the page. */
export async function checkoutWelcome(): Promise<CheckoutWelcome> {
  try {
    const visitor = await currentVisitor()
    if (!visitor) return NONE
    const acts = await db.visitorActivity.findMany({
      where: { visitorId: visitor, kind: { in: ['SUBSCRIBED', 'APP_INSTALLED', 'ORDER_PLACED'] } },
      select: { kind: true, detail: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const joined = acts.find((a) => a.kind === 'SUBSCRIBED' && a.detail?.includes('@'))?.detail?.toLowerCase() ?? null
    const appInstalled = acts.some((a) => a.kind === 'APP_INSTALLED')
    // ORDER_PLACED's detail is "SG-XXXX · $12.00".
    const numbers = acts
      .filter((a) => a.kind === 'ORDER_PLACED' && a.detail)
      .map((a) => a.detail!.split(' · ')[0]!.trim())
      .filter(Boolean)

    const [subscriber, byEmail, byBrowser] = await Promise.all([
      joined ? db.newsletterSubscriber.findUnique({ where: { email: joined }, select: { isActive: true } }) : null,
      joined ? usedByEmail(joined) : { subscriber: false, app: false },
      numbers.length
        ? db.order.count({
            where: { orderNumber: { in: numbers }, status: { notIn: [...VOID_STATUSES] }, appDiscountCents: { gt: 0 } },
          })
        : 0,
    ])
    const subscribedEmail = joined && subscriber?.isActive ? joined : null
    return {
      subscribedEmail,
      subscriberUsed: subscribedEmail ? byEmail.subscriber : false,
      appInstalled,
      appUsed: byEmail.app || byBrowser > 0,
    }
  } catch {
    return NONE
  }
}

export interface WelcomeDecision {
  readonly subscriber: boolean
  readonly app: boolean
  /** Ticked "subscribe" with an address not on the list: add it once the order exists. */
  readonly joinList: boolean
  /** Ordered from inside the app before its install was recorded: record it with the order. */
  readonly recordInstall: boolean
}

/** The decision of record, made while the order is being placed. */
export async function decideWelcome({
  email,
  subscribe,
  standalone,
}: {
  email: string
  subscribe: boolean
  standalone: boolean
}): Promise<WelcomeDecision> {
  const address = email.trim().toLowerCase()
  const visitor = await currentVisitor()
  const [listed, used, installed] = await Promise.all([
    db.newsletterSubscriber.findUnique({ where: { email: address }, select: { isActive: true } }),
    usedByEmail(address),
    visitor ? db.visitorActivity.findFirst({ where: { visitorId: visitor, kind: 'APP_INSTALLED' }, select: { id: true } }) : null,
  ])
  const onList = listed ? listed.isActive : subscribe
  return {
    subscriber: onList && !used.subscriber,
    app: (Boolean(installed) || standalone) && !used.app,
    joinList: !listed && subscribe,
    recordInstall: standalone && !installed,
  }
}

/** After the order is saved: join the list from checkout, the same way the sign-up form does. */
export async function joinListFromCheckout(email: string): Promise<void> {
  const address = email.trim().toLowerCase()
  const existing = await db.newsletterSubscriber.findUnique({ where: { email: address }, select: { id: true } })
  await db.newsletterSubscriber.upsert({ where: { email: address }, update: {}, create: { email: address, source: 'checkout' } })
  await recordActivity('SUBSCRIBED', { path: '/checkout', detail: address })
  if (!existing) {
    await notify({
      topic: 'signups',
      title: 'New newsletter subscriber',
      body: `${address} signed up at checkout, with their order.`,
      tags: ['email'],
      clickUrl: absoluteUrl('/admin/newsletter'),
    })
  }
}
