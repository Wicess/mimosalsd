import 'server-only'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db/client'
import { anchorFor, anchorOrderLines } from './catalogue-anchors'
import type { OrderProvider } from './repository'
import type { Order, OrderStatus } from './types'
import type { UsJurisdictionCode } from '@/lib/compliance/types'

/**
 * Database-backed orders.
 *
 * Orders are created at runtime by real customers, so unlike the catalogue they can
 * never live in memory — a restart would lose money.
 *
 * `OrderEvent` is append-only here as it is in the domain: transitions INSERT a row
 * and never update one. That log is what reconstructs history for a dispute, a
 * refund, or a PACT filing.
 */

type OrderRow = Prisma.OrderGetPayload<{
  include: { items: true; shipments: true; events: true; attestations: true }
}>

function toDomain(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    orderToken: row.orderToken,
    status: row.status as OrderStatus,
    email: row.email,
    phone: row.phone ?? '',
    firstName: row.firstName,
    lastName: row.lastName,
    addressLine1: row.addressLine1,
    ...(row.addressLine2 ? { addressLine2: row.addressLine2 } : {}),
    city: row.city,
    stateCode: row.stateCode as UsJurisdictionCode,
    postalCode: row.postalCode,
    items: row.items.map((i) => ({
      productSlug: i.productId,
      variantId: i.variantId,
      productName: i.productName,
      variantName: i.variantName,
      productLine: i.productLine,
      fulfillmentChannel: i.fulfillmentChannel,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
    shipments: row.shipments.map((s) => ({
      channel: s.channel,
      label: s.carrier ?? s.channel,
      costCents: s.shippingCents,
      requiresAdultSignature: s.requiresAdultSignature,
      estimate: s.estimatedDelivery?.toISOString() ?? '',
    })),
    subtotalCents: row.subtotalCents,
    shippingCents: row.shippingCents,
    paymentDiscountCents: row.paymentDiscountCents,
    discountCents: row.discountCents,
    subscriberDiscountCents: row.subscriberDiscountCents,
    appDiscountCents: row.appDiscountCents,
    ...(row.couponCode ? { couponCode: row.couponCode } : {}),
    totalCents: row.totalCents,
    freeShippingApplied: row.freeShippingApplied,
    preferredPaymentMethod: (row.preferredPaymentMethod ?? 'CASHAPP') as Order['preferredPaymentMethod'],
    attestations: row.attestations.map((a) => ({
      kind: a.kind,
      text: a.text,
      acceptedAt: a.acceptedAt.toISOString(),
    })),
    events: row.events
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => ({
        type: e.type,
        message: e.message ?? '',
        at: e.createdAt.toISOString(),
        ...(e.fromStatus ? { fromStatus: e.fromStatus as OrderStatus } : {}),
        ...(e.toStatus ? { toStatus: e.toStatus as OrderStatus } : {}),
      })),
    complianceSnapshot: (row.complianceSnapshot as Order['complianceSnapshot']) ?? {
      stateCode: row.stateCode as UsJurisdictionCode,
      evaluatedAt: row.createdAt.toISOString(),
      requiresAgeVerification: false,
      requiresAdultSignature: false,
    },
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? row.createdAt.toISOString(),
  }
}

const INCLUDE = {
  items: true,
  shipments: true,
  events: true,
  attestations: true,
} as const

export function createPrismaOrderProvider(): OrderProvider {
  return {
    async create(order) {
      // The rows OrderItem's foreign keys point at. Without them every real order
      // was refused by Postgres — see catalogue-anchors.ts.
      const anchors = await anchorOrderLines(db, order.items)
      await db.order.create({
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          orderToken: order.orderToken,
          status: order.status,
          email: order.email,
          phone: order.phone,
          firstName: order.firstName,
          lastName: order.lastName,
          addressLine1: order.addressLine1,
          addressLine2: order.addressLine2 ?? null,
          city: order.city,
          stateCode: order.stateCode,
          postalCode: order.postalCode,
          subtotalCents: order.subtotalCents,
          shippingCents: order.shippingCents,
          /*
            Written. It was READ on the way out and never WRITTEN on the way in, so
            every Bitcoin order was stored with a discount of 0 while its total
            already had the 7% taken off. The checkout confirmation was built from
            the in-memory order and added up; the "Payment confirmed" email, the
            admin order page and the invoice are all built from this row, and on
            every Bitcoin order they showed a subtotal, a shipping line and a total
            that did not reconcile — arriving at the exact moment the customer had
            just paid. Migration 0008 backfills the rows already written wrong.
          */
          paymentDiscountCents: order.paymentDiscountCents,
          discountCents: order.discountCents,
          subscriberDiscountCents: order.subscriberDiscountCents,
          appDiscountCents: order.appDiscountCents,
          couponCode: order.couponCode ?? null,
          totalCents: order.totalCents,
          freeShippingApplied: order.freeShippingApplied,
          attributedLinkSlug: order.attribution?.linkSlug ?? null,
          attributedPromoterId: order.attribution?.promoterId ?? null,
          attributedAt: order.attribution ? new Date(order.attribution.at) : null,
          preferredPaymentMethod: order.preferredPaymentMethod,
          complianceSnapshot: order.complianceSnapshot as Prisma.InputJsonValue,
          placedAt: new Date(order.createdAt),
          expiresAt: new Date(order.expiresAt),
          items: {
            create: order.items.map((i) => ({
              productId: anchorFor(anchors, i).productId,
              variantId: anchorFor(anchors, i).variantId,
              productName: i.productName,
              variantName: i.variantName,
              productLine: i.productLine as never,
              fulfillmentChannel: i.fulfillmentChannel,
              unitPriceCents: i.unitPriceCents,
              quantity: i.quantity,
              lineTotalCents: i.lineTotalCents,
            })),
          },
          shipments: {
            create: order.shipments.map((s) => ({
              channel: s.channel,
              carrier: s.label,
              shippingCents: s.costCents,
              requiresAdultSignature: s.requiresAdultSignature,
            })),
          },
          attestations: {
            create: order.attestations.map((a) => ({
              kind: a.kind,
              text: a.text,
              acceptedAt: new Date(a.acceptedAt),
            })),
          },
          events: {
            create: order.events.map((e) => ({
              type: e.type,
              message: e.message,
              fromStatus: e.fromStatus ?? null,
              toStatus: e.toStatus ?? null,
              createdAt: new Date(e.at),
            })),
          },
        },
      })
      return order
    },

    async findByToken(token) {
      const row = await db.order.findUnique({ where: { orderToken: token }, include: INCLUDE })
      return row ? toDomain(row) : undefined
    },

    async findByNumber(orderNumber) {
      const row = await db.order.findUnique({ where: { orderNumber }, include: INCLUDE })
      return row ? toDomain(row) : undefined
    },

    async appendEvent(token, event, nextStatus) {
      const existing = await db.order.findUnique({ where: { orderToken: token } })
      if (!existing) return undefined

      // INSERT the event, never UPDATE one. The log is the audit trail.
      await db.$transaction([
        db.orderEvent.create({
          data: {
            orderId: existing.id,
            type: event.type,
            message: event.message,
            fromStatus: event.fromStatus ?? null,
            toStatus: event.toStatus ?? null,
            ...(event.actorEmail ? { actorEmail: event.actorEmail } : {}),
          },
        }),
        db.order.update({
          where: { id: existing.id },
          data: {
            ...(nextStatus ? { status: nextStatus } : {}),
            ...(nextStatus === 'PAID' ? { paidAt: new Date() } : {}),
            ...(nextStatus === 'SHIPPED' ? { shippedAt: new Date() } : {}),
            ...(nextStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
          },
        }),
      ])

      const row = await db.order.findUnique({ where: { id: existing.id }, include: INCLUDE })
      return row ? toDomain(row) : undefined
    },

    async list() {
      const rows = await db.order.findMany({
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      return rows.map(toDomain)
    },
  }
}
