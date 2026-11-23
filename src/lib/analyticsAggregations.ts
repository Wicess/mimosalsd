/**
 * Analytics dashboard aggregations.
 *
 * Pure server-only query functions that take a Period and return shaped data
 * ready for the admin analytics charts/tables. The return shapes mirror WHAM's
 * analyticsAggregations so the shared analytics page renders identically — but
 * every query here reads THIS project's schema:
 *
 *   - PageView = { visitorId, path, at }  (no sessionId, no device/geo columns)
 *   - Visitor  carries device / browser / os / country / city / referrer / utm*
 *   - Order    carries status + paidAt (no paymentStatus / channel / ip* columns)
 *
 * Device/browser/OS/geo/channel breakdowns therefore come off the Visitor row
 * (one per cookie, filed nightly); page-view counts and the live feed come off
 * PageView. Bot-flagged cookies are always excluded from visitor/pageview
 * counts. `?exclude=internal` is accepted for parity with WHAM; this project
 * keeps no internal-email list, so the toggle currently narrows only to
 * non-bot traffic (already the default) and never over-filters real customers.
 */

import { cache } from "react";
import { db } from "@/lib/db/client";

export type Period = "24h" | "7d" | "30d" | "90d";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

type PeriodBounds = {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
  bucketUnit: "hour" | "day";
  bucketCount: number;
};

function getPeriodBounds(period: Period, now = new Date()): PeriodBounds {
  const end = new Date(now);
  let start: Date;
  let bucketUnit: "hour" | "day";
  let bucketCount: number;

  switch (period) {
    case "24h":
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      bucketUnit = "hour";
      bucketCount = 24;
      break;
    case "7d":
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      bucketUnit = "day";
      bucketCount = 7;
      break;
    case "30d":
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      bucketUnit = "day";
      bucketCount = 30;
      break;
    case "90d":
      start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      bucketUnit = "day";
      bucketCount = 90;
      break;
  }

  const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
  return {
    current: { start, end },
    previous: { start: previousStart, end: start },
    bucketUnit,
    bucketCount,
  };
}

/**
 * Bot-flagged visitor cookies, resolved once per request. PageView has no bot
 * flag of its own, so counts that read PageView drop these cookie ids instead.
 */
const fetchBotVisitorIds = cache(async (): Promise<string[]> => {
  const rows = await db.visitor.findMany({
    where: { isLikelyBot: true },
    select: { visitorId: true },
  });
  return rows.map((r) => r.visitorId).filter(Boolean);
});

/** `where` fragment for PageView queries: always drops bot cookies. */
async function pageViewFilter(): Promise<Record<string, unknown>> {
  const bots = await fetchBotVisitorIds();
  if (bots.length === 0) return {};
  return { visitorId: { notIn: bots } };
}

// ────────────────────────────────────────────────────────────────────────────
// Live / today / yesterday / all-time
// ────────────────────────────────────────────────────────────────────────────

export async function getActiveVisitors(windowMs = 5 * 60 * 1000): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  const filter = await pageViewFilter();
  const rows = await db.pageView.findMany({
    where: { at: { gte: since }, ...filter },
    select: { visitorId: true },
    distinct: ["visitorId"],
  });
  return rows.length;
}

export async function getQuickStats(): Promise<{ today: number; yesterday: number; allTime: number }> {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
  const filter = await pageViewFilter();

  const [today, yesterday, allTime] = await Promise.all([
    db.pageView.count({ where: { at: { gte: startToday }, ...filter } }),
    db.pageView.count({ where: { at: { gte: startYesterday, lt: startToday }, ...filter } }),
    db.pageView.count({ where: filter }),
  ]);
  return { today, yesterday, allTime };
}

// ────────────────────────────────────────────────────────────────────────────
// Extended KPIs
// ────────────────────────────────────────────────────────────────────────────

export type ExtendedKpiPayload = {
  pageViews: number;
  pageViewsPrev: number;
  pageViewsToday: number;
  uniqueVisitors: number;
  uniqueVisitorsPrev: number;
  uniqueVisitorsToday: number;
  productViews: number;
  productViewsPrev: number;
  productViewsToday: number;
  orders: number;
  ordersPrev: number;
  ordersToday: number;
  uniqueCustomers: number;
  conversion: number;
  conversionPrev: number;
};

/** A page whose path looks like a product detail page — our "product view" proxy. */
const PRODUCT_PATH = { path: { contains: "/product" } } as const;

export async function getExtendedKpis(period: Period): Promise<ExtendedKpiPayload> {
  const b = getPeriodBounds(period);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const filter = await pageViewFilter();

  const [
    pvCur,
    pvPrev,
    pvToday,
    sessCur,
    sessPrev,
    sessToday,
    productCur,
    productPrev,
    productToday,
    ordersCur,
    ordersPrev,
    ordersToday,
  ] = await Promise.all([
    db.pageView.count({ where: { at: { gte: b.current.start, lt: b.current.end }, ...filter } }),
    db.pageView.count({ where: { at: { gte: b.previous.start, lt: b.previous.end }, ...filter } }),
    db.pageView.count({ where: { at: { gte: startToday }, ...filter } }),
    db.pageView.findMany({
      where: { at: { gte: b.current.start, lt: b.current.end }, ...filter },
      select: { visitorId: true },
      distinct: ["visitorId"],
    }),
    db.pageView.findMany({
      where: { at: { gte: b.previous.start, lt: b.previous.end }, ...filter },
      select: { visitorId: true },
      distinct: ["visitorId"],
    }),
    db.pageView.findMany({
      where: { at: { gte: startToday }, ...filter },
      select: { visitorId: true },
      distinct: ["visitorId"],
    }),
    db.pageView.count({ where: { at: { gte: b.current.start, lt: b.current.end }, ...PRODUCT_PATH, ...filter } }),
    db.pageView.count({ where: { at: { gte: b.previous.start, lt: b.previous.end }, ...PRODUCT_PATH, ...filter } }),
    db.pageView.count({ where: { at: { gte: startToday }, ...PRODUCT_PATH, ...filter } }),
    db.order.count({ where: { createdAt: { gte: b.current.start, lt: b.current.end } } }),
    db.order.count({ where: { createdAt: { gte: b.previous.start, lt: b.previous.end } } }),
    db.order.count({ where: { createdAt: { gte: startToday } } }),
  ]);

  const uniqueVisitors = sessCur.length;
  const uniqueVisitorsPrev = sessPrev.length;
  const uniqueVisitorsToday = sessToday.length;

  const conversion = uniqueVisitors > 0 ? (ordersCur / uniqueVisitors) * 100 : 0;
  const conversionPrev = uniqueVisitorsPrev > 0 ? (ordersPrev / uniqueVisitorsPrev) * 100 : 0;

  const orderEmails = await db.order.findMany({
    where: { createdAt: { gte: b.current.start, lt: b.current.end } },
    select: { email: true },
    distinct: ["email"],
  });

  return {
    pageViews: pvCur,
    pageViewsPrev: pvPrev,
    pageViewsToday: pvToday,
    uniqueVisitors,
    uniqueVisitorsPrev,
    uniqueVisitorsToday,
    productViews: productCur,
    productViewsPrev: productPrev,
    productViewsToday: productToday,
    orders: ordersCur,
    ordersPrev,
    ordersToday,
    uniqueCustomers: orderEmails.length,
    conversion,
    conversionPrev,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Traffic trend (page views + product views per bucket)
// ────────────────────────────────────────────────────────────────────────────

export type TwoSeriesPoint = {
  ts: string;
  label: string;
  pageViews: number;
  productViews: number;
};

export async function getTrafficSeries(period: Period): Promise<TwoSeriesPoint[]> {
  const b = getPeriodBounds(period);
  const filter = await pageViewFilter();

  const rows = await db.pageView.findMany({
    where: { at: { gte: b.current.start, lt: b.current.end }, ...filter },
    select: { at: true, path: true },
  });

  const stepMs = b.bucketUnit === "hour" ? 3600_000 : 86400_000;
  const aligned = new Date(b.current.start);
  if (b.bucketUnit === "hour") aligned.setMinutes(0, 0, 0);
  else aligned.setHours(0, 0, 0, 0);

  const buckets = new Map<string, { ts: Date; pageViews: number; productViews: number }>();
  for (let i = 0; i < b.bucketCount; i++) {
    const ts = new Date(aligned.getTime() + i * stepMs);
    buckets.set(ts.toISOString(), { ts, pageViews: 0, productViews: 0 });
  }

  const keyFor = (d: Date) => {
    const x = new Date(d);
    if (b.bucketUnit === "hour") x.setMinutes(0, 0, 0);
    else x.setHours(0, 0, 0, 0);
    return x.toISOString();
  };

  for (const v of rows) {
    const slot = buckets.get(keyFor(v.at));
    if (!slot) continue;
    slot.pageViews++;
    if (v.path && v.path.includes("/product")) slot.productViews++;
  }

  return Array.from(buckets.values()).map((s) => ({
    ts: s.ts.toISOString(),
    label:
      b.bucketUnit === "hour"
        ? s.ts.toLocaleTimeString(undefined, { hour: "2-digit", hour12: false })
        : s.ts.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    pageViews: s.pageViews,
    productViews: s.productViews,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Device / Browser / OS breakdowns (off the Visitor row)
// ────────────────────────────────────────────────────────────────────────────

type LabeledRow = { label: string; count: number };

async function visitorGroup(
  field: "device" | "browser" | "os",
  period: Period,
  limit = 8,
): Promise<LabeledRow[]> {
  const b = getPeriodBounds(period);
  const rows = await db.visitor.groupBy({
    by: [field],
    where: { lastSeen: { gte: b.current.start, lt: b.current.end }, isLikelyBot: false },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({
      label: ((r as Record<string, unknown>)[field] as string | null) ?? "Unknown",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getDeviceBreakdown(period: Period): Promise<LabeledRow[]> {
  return visitorGroup("device", period);
}

export async function getBrowserBreakdown(period: Period): Promise<LabeledRow[]> {
  return visitorGroup("browser", period);
}

export async function getOsBreakdown(period: Period): Promise<LabeledRow[]> {
  return visitorGroup("os", period);
}

// ────────────────────────────────────────────────────────────────────────────
// Geo (country + city, off the Visitor row)
// ────────────────────────────────────────────────────────────────────────────

export type GeoRow = { country: string; city: string; visitors: number };

export async function getGeoBreakdown(period: Period): Promise<GeoRow[]> {
  const b = getPeriodBounds(period);
  const rows = await db.visitor.groupBy({
    by: ["country", "city"],
    where: {
      lastSeen: { gte: b.current.start, lt: b.current.end },
      isLikelyBot: false,
      country: { not: null },
    },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({
      country: r.country ?? "—",
      city: r.city ?? "—",
      visitors: r._count._all,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 20);
}

// ────────────────────────────────────────────────────────────────────────────
// Referrers + traffic channels (off Visitor.referrer)
// ────────────────────────────────────────────────────────────────────────────

function refererDomain(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer.replace(/^www\./, "") || null;
  }
}

export async function getReferrerBreakdown(period: Period): Promise<LabeledRow[]> {
  const b = getPeriodBounds(period);
  const rows = await db.visitor.findMany({
    where: {
      lastSeen: { gte: b.current.start, lt: b.current.end },
      isLikelyBot: false,
      referrer: { not: null },
    },
    select: { referrer: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = refererDomain(r.referrer) ?? "Direct";
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

const SEARCH = ["google", "bing", "yahoo", "duckduckgo", "ecosia", "brave"];
const AI = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "bard.google.com",
  "copilot.microsoft.com",
  "edgeservices.bing.com",
  "claude.ai",
  "you.com",
  "poe.com",
  "grok.com",
  "x.ai",
  "meta.ai",
];
const SOCIAL = [
  "instagram.com",
  "facebook.com",
  "m.facebook.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
  "snapchat.com",
];

function classifyDomain(domain: string | null): string {
  if (!domain) return "Direct";
  if (AI.some((d) => domain === d || domain.endsWith(`.${d}`) || domain.endsWith(d))) return "AI";
  if (SOCIAL.some((d) => domain.endsWith(d))) return "Social";
  if (SEARCH.some((s) => domain.includes(s))) return "Organic";
  return "Referral";
}

export async function getTrafficChannelsFromViews(period: Period): Promise<LabeledRow[]> {
  const b = getPeriodBounds(period);
  const rows = await db.visitor.findMany({
    where: { lastSeen: { gte: b.current.start, lt: b.current.end }, isLikelyBot: false },
    select: { referrer: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = classifyDomain(refererDomain(r.referrer));
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// ────────────────────────────────────────────────────────────────────────────
// Tracked links / campaign performance — no linked-campaign system here.
// Returned empty so the section renders with its empty state, matching WHAM.
// ────────────────────────────────────────────────────────────────────────────

export type CampaignRow = {
  id: string;
  slug: string;
  name: string;
  clicks: number;
  orders: number;
  revenueCents: number;
};

export async function getCampaignPerformance(_period: Period): Promise<CampaignRow[]> {
  void _period;
  return [];
}

// ────────────────────────────────────────────────────────────────────────────
// Top products + most-ordered products (from order line items)
// ────────────────────────────────────────────────────────────────────────────

/** Paid orders: payment confirmed, regardless of later fulfillment state. */
const PAID_ORDER = { paidAt: { not: null } } as const;

async function titlesFor(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(products.map((p) => [p.id, p.name]));
}

export type TopProductRow = {
  productId: string;
  title: string;
  units: number;
  revenueCents: number;
};

export async function getTopProducts(period: Period): Promise<TopProductRow[]> {
  const b = getPeriodBounds(period);
  const rows = await db.orderItem.groupBy({
    by: ["productId"],
    where: { order: { createdAt: { gte: b.current.start, lt: b.current.end }, ...PAID_ORDER } },
    _sum: { quantity: true, lineTotalCents: true },
  });
  const top = rows
    .sort((a, b) => (b._sum.lineTotalCents ?? 0) - (a._sum.lineTotalCents ?? 0))
    .slice(0, 10);
  if (top.length === 0) return [];
  const titles = await titlesFor(top.map((r) => r.productId));
  return top.map((r) => ({
    productId: r.productId,
    title: titles.get(r.productId) ?? "(deleted product)",
    units: r._sum.quantity ?? 0,
    revenueCents: r._sum.lineTotalCents ?? 0,
  }));
}

export type MostOrderedProductRow = {
  productId: string;
  title: string;
  imageUrl: string | null;
  units: number;
  orders: number;
};

export async function getMostOrderedProducts(period: Period): Promise<MostOrderedProductRow[]> {
  const b = getPeriodBounds(period);
  const rows = await db.orderItem.groupBy({
    by: ["productId"],
    where: { order: { createdAt: { gte: b.current.start, lt: b.current.end } } },
    _sum: { quantity: true },
    _count: { _all: true },
  });
  const top = rows.sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0)).slice(0, 6);
  if (top.length === 0) return [];
  const titles = await titlesFor(top.map((r) => r.productId));
  return top.map((r) => ({
    productId: r.productId,
    title: titles.get(r.productId) ?? "(deleted product)",
    imageUrl: null,
    units: r._sum.quantity ?? 0,
    orders: r._count._all,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Orders by country / city (US store — country is constant, city off the order)
// ────────────────────────────────────────────────────────────────────────────

export type CountryRow = { country: string; count: number };
export type CityRow = { city: string; country: string; count: number };

export async function getOrdersByCountry(period: Period): Promise<CountryRow[]> {
  const b = getPeriodBounds(period);
  const total = await db.order.count({
    where: { createdAt: { gte: b.current.start, lt: b.current.end } },
  });
  return total > 0 ? [{ country: "US", count: total }] : [];
}

export async function getOrdersByCity(period: Period): Promise<CityRow[]> {
  const b = getPeriodBounds(period);
  const rows = await db.order.groupBy({
    by: ["city", "stateCode"],
    where: { createdAt: { gte: b.current.start, lt: b.current.end } },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({
      city: r.stateCode ? `${r.city}, ${r.stateCode}` : r.city,
      // Blank country so the shared row shows just the city/state, no "United States" suffix.
      country: "",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

// ────────────────────────────────────────────────────────────────────────────
// Recent orders + recent cart activity (live feeds)
// ────────────────────────────────────────────────────────────────────────────

export type RecentOrder = {
  id: string;
  number: string;
  status: string;
  email: string;
  createdAt: Date;
  channel: string | null;
  notes: string | null;
  items: { id: string }[];
  shippingAddress: { city: string | null; state: string | null; country: string | null; postalCode: string | null } | null;
  ipCity: string | null;
  ipRegion: string | null;
  ipCountry: string | null;
  ipPostalCode: string | null;
};

export async function getRecentOrdersExtended(limit = 6): Promise<RecentOrder[]> {
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      email: true,
      createdAt: true,
      firstName: true,
      lastName: true,
      city: true,
      stateCode: true,
      postalCode: true,
      items: { select: { id: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    number: o.orderNumber,
    status: o.status,
    email: o.email,
    createdAt: o.createdAt,
    channel: null,
    // Give the shared card a name to show even though this project keeps no notes field.
    notes: `Name: ${[o.firstName, o.lastName].filter(Boolean).join(" ")}`.trim(),
    items: o.items,
    shippingAddress: {
      city: o.city,
      state: o.stateCode,
      country: "US",
      postalCode: o.postalCode,
    },
    ipCity: o.city,
    ipRegion: o.stateCode,
    ipCountry: "US",
    ipPostalCode: o.postalCode,
  }));
}

export type CartActivityItem = {
  id: string;
  type: string;
  city: string | null;
  region: string | null;
  country: string | null;
  createdAt: Date;
  user: { name: string | null } | null;
  email: string | null;
  sessionId: string | null;
  title: string | null;
  orderNumber: string | null;
  orderId: string | null;
  quantity: number | null;
  priceCents: number | null;
  subtotalCents: number | null;
  itemCount: number | null;
};

export async function getRecentCartActivity(limit = 12): Promise<CartActivityItem[]> {
  const rows = await db.cartActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      productName: true,
      quantity: true,
      cartValueCents: true,
      cartItems: true,
      valueCents: true,
      stateCode: true,
      visitorId: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    city: null,
    region: r.stateCode,
    country: "US",
    createdAt: r.createdAt,
    user: null,
    email: null,
    sessionId: r.visitorId,
    title: r.productName,
    orderNumber: null,
    orderId: null,
    quantity: r.quantity || null,
    priceCents: r.valueCents || null,
    subtotalCents: r.cartValueCents || null,
    itemCount: r.cartItems || null,
  }));
}
