/**
 * Day-by-day visitor/order trend for the admin analytics page.
 *
 * Mirrors the shape of WHAM's visitor-trend so the shared DailyComparisonChart
 * renders identically, but reads this project's schema:
 *   - new visitors  → Visitor.firstSeen (one row per cookie, filed nightly)
 *   - visitors      → distinct PageView.visitorId on the day
 *   - pageviews     → PageView rows on the day
 *   - orders / paid → Order.createdAt / Order.paidAt on the day
 *
 * Days are bucketed in US Eastern, matching the store's US customer base, so a
 * day boundary means the same thing on the Vercel (UTC) server and the admin's
 * machine. Bot-flagged visitors are excluded from the visitor/pageview counts.
 */

import { db } from "@/lib/db/client";

export type TrendDay = {
  /** ISO date (YYYY-MM-DD) in the analytics timezone. */
  day: string;
  /** Three-letter weekday label, e.g. "Sat". */
  dow: string;
  /** Visitors whose very first hit landed on this day. */
  newVisitors: number;
  /** Distinct visitor cookies that viewed a page on this day. */
  visitors: number;
  pageviews: number;
  /** Orders created that day (paid or not). */
  orders: number;
  /** Orders that day whose payment is confirmed. */
  paidOrders: number;
  /** True for the day currently in progress — its bars are incomplete. */
  partial: boolean;
};

export type TrendMetric = {
  label: string;
  key: "newVisitors" | "visitors" | "pageviews" | "orders";
  current: number;
  previous: number;
  deltaPct: number | null;
};

export type VisitorTrend = {
  days: TrendDay[];
  metrics: TrendMetric[];
};

const ANALYTICS_TZ = "America/New_York";

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANALYTICS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** UTC instant → "YYYY-MM-DD" in ANALYTICS_TZ. */
function localDate(d: Date): string {
  return isoFmt.format(d);
}

/** Step an ISO date string by n days without tripping over DST. */
function shiftIso(iso: string, n: number): string {
  const t = new Date(`${iso}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Weekday label for an ISO date string (noon UTC dodges any zone edge). */
function isoDow(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getVisitorTrend(days = 14): Promise<VisitorTrend> {
  const lookbackDays = days + 2;
  const since = new Date(Date.now() - lookbackDays * 86_400_000);

  // Bot-flagged cookies are hidden from visitor/pageview counts.
  const botRows = await db.visitor.findMany({
    where: { isLikelyBot: true },
    select: { visitorId: true },
  });
  const botIds = new Set(botRows.map((v) => v.visitorId));

  const [newRows, viewRows, orderRows] = await Promise.all([
    db.visitor.findMany({
      where: { isLikelyBot: false, firstSeen: { gte: since } },
      select: { firstSeen: true },
    }),
    db.pageView.findMany({
      where: { at: { gte: since } },
      select: { at: true, visitorId: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, paidAt: true },
    }),
  ]);

  const todayIso = localDate(new Date());
  const dayList: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayList.push(shiftIso(todayIso, -i));
  const inWindow = new Set(dayList);

  const newByDay = new Map<string, number>();
  for (const v of newRows) {
    const d = localDate(v.firstSeen);
    if (inWindow.has(d)) newByDay.set(d, (newByDay.get(d) ?? 0) + 1);
  }

  const viewsByDay = new Map<string, number>();
  const sessionsByDay = new Map<string, Set<string>>();
  for (const p of viewRows) {
    if (p.visitorId && botIds.has(p.visitorId)) continue;
    const d = localDate(p.at);
    if (!inWindow.has(d)) continue;
    viewsByDay.set(d, (viewsByDay.get(d) ?? 0) + 1);
    if (p.visitorId) {
      let set = sessionsByDay.get(d);
      if (!set) sessionsByDay.set(d, (set = new Set()));
      set.add(p.visitorId);
    }
  }

  const ordersByDay = new Map<string, number>();
  const paidByDay = new Map<string, number>();
  for (const o of orderRows) {
    const d = localDate(o.createdAt);
    if (!inWindow.has(d)) continue;
    ordersByDay.set(d, (ordersByDay.get(d) ?? 0) + 1);
    if (o.paidAt) paidByDay.set(d, (paidByDay.get(d) ?? 0) + 1);
  }

  const series: TrendDay[] = dayList.map((day) => ({
    day,
    dow: isoDow(day),
    newVisitors: newByDay.get(day) ?? 0,
    visitors: sessionsByDay.get(day)?.size ?? 0,
    pageviews: viewsByDay.get(day) ?? 0,
    orders: ordersByDay.get(day) ?? 0,
    paidOrders: paidByDay.get(day) ?? 0,
    partial: day === todayIso,
  }));

  const complete = series.filter((d) => !d.partial);
  const current = complete.slice(-7);
  const previous = complete.slice(-14, -7);
  const sum = (list: TrendDay[], key: TrendMetric["key"]) => list.reduce((n, d) => n + d[key], 0);

  const metrics: TrendMetric[] = (
    [
      ["New visitors", "newVisitors"],
      ["Visitors", "visitors"],
      ["Pageviews", "pageviews"],
      ["Orders", "orders"],
    ] as const
  ).map(([label, key]) => {
    const cur = sum(current, key);
    const prev = sum(previous, key);
    return { label, key, current: cur, previous: prev, deltaPct: pctChange(cur, prev) };
  });

  return { days: series, metrics };
}
