import 'server-only'
import { db } from '@/lib/db/client'
import { jurisdictionName } from './jurisdictions'
import type { UsJurisdictionCode } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PACT ACT MONTHLY DELIVERY REPORTS
 *
 *  A separate report for every state we shipped vapor products into, filed with that
 *  state's tax authority, by the 10th of the following month. Penalties run to $5,000
 *  for a first violation and $10,000 for each one after.
 *
 *  This is why the Order model is indexed on (stateCode, createdAt): the report is a
 *  single indexed query rather than a full-table scan, and it will still be one when
 *  there are a hundred thousand orders.
 *
 *  Building this from day one rather than "when we need it" was deliberate. Bolting it
 *  on later means reconstructing months of shipments by hand, from data that may not
 *  have been captured.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PactReportRow {
  readonly orderNumber: string
  readonly shippedAt: string
  readonly buyerName: string
  readonly addressLine1: string
  readonly addressLine2: string
  readonly city: string
  readonly stateCode: string
  readonly postalCode: string
  readonly brand: string
  readonly quantity: number
}

export interface PactReport {
  readonly stateCode: UsJurisdictionCode
  readonly stateName: string
  readonly year: number
  readonly month: number
  readonly rows: readonly PactReportRow[]
  readonly totalUnits: number
}

/** Statuses that mean goods actually left the building. */
const SHIPPED_STATUSES = ['SHIPPED', 'DELIVERED'] as const

export async function buildPactReports(year: number, month: number): Promise<PactReport[]> {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  const orders = await db.order.findMany({
    where: {
      status: { in: [...SHIPPED_STATUSES] },
      shippedAt: { gte: start, lt: end },
      items: { some: { fulfillmentChannel: 'PACT_CARRIER' } },
    },
    include: { items: { where: { fulfillmentChannel: 'PACT_CARRIER' } } },
    orderBy: [{ stateCode: 'asc' }, { shippedAt: 'asc' }],
  })

  const byState = new Map<string, PactReportRow[]>()

  for (const order of orders) {
    for (const item of order.items) {
      const row: PactReportRow = {
        orderNumber: order.orderNumber,
        shippedAt: order.shippedAt?.toISOString().slice(0, 10) ?? '',
        buyerName: `${order.firstName} ${order.lastName}`,
        addressLine1: order.addressLine1,
        addressLine2: order.addressLine2 ?? '',
        city: order.city,
        stateCode: order.stateCode,
        postalCode: order.postalCode,
        brand: item.productName,
        quantity: item.quantity,
      }
      byState.set(order.stateCode, [...(byState.get(order.stateCode) ?? []), row])
    }
  }

  return [...byState.entries()]
    .map(([stateCode, rows]) => ({
      stateCode: stateCode as UsJurisdictionCode,
      stateName: jurisdictionName(stateCode as UsJurisdictionCode),
      year,
      month,
      rows,
      totalUnits: rows.reduce((sum, r) => sum + r.quantity, 0),
    }))
    .sort((a, b) => a.stateName.localeCompare(b.stateName))
}

const HEADERS = [
  'Order number', 'Date shipped', 'Buyer name', 'Address line 1', 'Address line 2',
  'City', 'State', 'ZIP', 'Brand', 'Quantity',
] as const

function escapeCsv(value: string | number): string {
  const text = String(value)
  // A buyer's name or address can contain a comma or a quote. Getting this wrong
  // corrupts a federal filing, so quote everything and double any inner quote.
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(report: PactReport): string {
  const lines = [HEADERS.map(escapeCsv).join(',')]
  for (const row of report.rows) {
    lines.push(
      [
        row.orderNumber, row.shippedAt, row.buyerName, row.addressLine1,
        row.addressLine2, row.city, row.stateCode, row.postalCode,
        row.brand, row.quantity,
      ]
        .map(escapeCsv)
        .join(','),
    )
  }
  return lines.join('\n')
}

/** The 10th of the month following the reporting period. */
export function filingDeadline(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 10))
}

/**
 * Deadline plus whether it has passed.
 *
 * The clock read lives here rather than in a component body — reading the current
 * time during render is impure, and React's lint correctly rejects it.
 */
export function filingStatus(
  year: number,
  month: number,
): { deadline: Date; overdue: boolean } {
  const deadline = filingDeadline(year, month)
  return { deadline, overdue: new Date().getTime() > deadline.getTime() }
}

/** The most recently completed reporting period. */
export function previousPeriod(): { year: number; month: number } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed now == 1-indexed previous month
  return month === 0 ? { year: year - 1, month: 12 } : { year, month }
}
