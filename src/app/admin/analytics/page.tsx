import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Eye,
  ExternalLink,
  Globe,
  Link2,
  Mail,
  MapPin,
  Monitor,
  PieChart,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Users2,
} from "lucide-react";
import { db } from "@/lib/db/client";
import { getVisitorTrend } from "@/lib/visitor-trend";
import { DailyComparisonChart } from "@/components/admin/daily-comparison-chart";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { deltaPct } from "@/lib/analytics";
import { formatCents as formatPrice } from "@/lib/utils";
import { countryName } from "@/lib/country-names";
import {
  PERIODS,
  type Period,
  getActiveVisitors,
  getBrowserBreakdown,
  getDeviceBreakdown,
  getExtendedKpis,
  getGeoBreakdown,
  getMostOrderedProducts,
  getOrdersByCity,
  getOrdersByCountry,
  getOsBreakdown,
  getQuickStats,
  getRecentCartActivity,
  getRecentOrdersExtended,
  getReferrerBreakdown,
  getTrafficChannelsFromViews,
  getTrafficSeries,
  getCampaignPerformance,
  getTopProducts,
} from "@/lib/analyticsAggregations";
import { AnalyticsTrafficChart } from "@/components/admin/analytics/analytics-traffic-chart";
import { DonutChart, DONUT_PALETTE } from "@/components/admin/analytics/donut-chart";
import { flushForAdminView } from "@/lib/analytics-buffer";

export const dynamic = "force-dynamic";

function isPeriod(v: string | undefined): v is Period {
  return v === "24h" || v === "7d" || v === "30d" || v === "90d";
}

// ────────────────────────────────────────────────────────────────────────────
// Email campaign attribution — lifetime first-touch, keyed off the Visitor row.
// UTM attribution is sticky (set on the visitor's first hit and never
// overwritten), so this is an all-time view, not period-scoped. Three grouped
// aggregates on the Visitor table (no per-row scans, no N+1) merged in JS.
// ────────────────────────────────────────────────────────────────────────────

type CampaignSourceRow = {
  source: string;
  visitors: number;
  pageviews: number;
  buyers: number;
  subs: number;
};
type CampaignAttrRow = {
  campaign: string;
  visitors: number;
  pageviews: number;
  buyers: number;
  subs: number;
  sources: CampaignSourceRow[];
};

async function getEmailCampaignAttribution(): Promise<CampaignAttrRow[]> {
  // This project does not keep sticky first-touch UTM attribution on the
  // Visitor row (no firstUtm*, orderCount or newsletterSubAt columns), so
  // there is no lifetime campaign-attribution to compute. Returned empty so the
  // section renders with its empty state, matching WHAM's layout exactly.
  return [];
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; exclude?: string }>;
}) {
  // Land any analytics events still queued in Redis before reading them.
  await flushForAdminView();
  const sp = await searchParams;
  const period: Period = isPeriod(sp.period) ? sp.period : "7d";
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "7 days";
  // Opt-in admin/test-account exclusion via ?exclude=internal. Off by default
  // — admin can flip it via a toggle (rendered below) when they want a
  // customer-only view without the noise of their own test orders.
  const excludeInternal = sp.exclude === "internal";

  const [
    activeNow,
    quick,
    kpis,
    series,
    devices,
    browsers,
    os,
    geo,
    channels,
    referrers,
    campaigns,
    topProducts,
    mostOrdered,
    ordersByCountry,
    ordersByCity,
    recentOrders,
    cartActivity,
    totalOrdersAllTime,
    emailAttribution,
  ] = await Promise.all([
    getActiveVisitors(),
    getQuickStats(),
    getExtendedKpis(period),
    getTrafficSeries(period),
    getDeviceBreakdown(period),
    getBrowserBreakdown(period),
    getOsBreakdown(period),
    getGeoBreakdown(period),
    getTrafficChannelsFromViews(period),
    getReferrerBreakdown(period),
    getCampaignPerformance(period),
    getTopProducts(period),
    getMostOrderedProducts(period),
    getOrdersByCountry(period),
    getOrdersByCity(period),
    getRecentOrdersExtended(8),
    getRecentCartActivity(8),
    db.order.count(),
    getEmailCampaignAttribution(),
  ]);

  // Daily series for the orders-vs-traffic comparison. Shares the bucketing
  // (US Eastern, team traffic excluded) used by the Visitors page, so the two
  // pages can never disagree about what happened on a given day.
  const trend = await getVisitorTrend(14);

  return (
    <div className="space-y-6 bg-zinc-50 p-6 sm:p-8">
      <AutoRefresh intervalSeconds={30} />
      <Header period={period} excludeInternal={excludeInternal} />

      <LiveBanner activeNow={activeNow} today={quick.today} yesterday={quick.yesterday} allTime={quick.allTime} />

      <DailyComparisonChart days={trend.days} />

      {/* KPI strip — 5 cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={<Eye className="size-4" />}
          tint="bg-indigo-50 text-indigo-600"
          label="Page Views"
          value={kpis.pageViews.toLocaleString()}
          sub={`Last ${periodLabel}`}
          today={`${kpis.pageViewsToday} today`}
          delta={deltaPct(kpis.pageViews, kpis.pageViewsPrev)}
        />
        <KpiCard
          icon={<Users2 className="size-4" />}
          tint="bg-emerald-50 text-emerald-600"
          label="Unique Visitors"
          value={kpis.uniqueVisitors.toLocaleString()}
          sub={`Last ${periodLabel}`}
          today={`${kpis.uniqueVisitorsToday} today`}
          delta={deltaPct(kpis.uniqueVisitors, kpis.uniqueVisitorsPrev)}
        />
        <KpiCard
          icon={<Sparkles className="size-4" />}
          tint="bg-violet-50 text-violet-600"
          label="Product Views"
          value={kpis.productViews.toLocaleString()}
          sub={`Last ${periodLabel}`}
          today={`${kpis.productViewsToday} today`}
          delta={deltaPct(kpis.productViews, kpis.productViewsPrev)}
        />
        <KpiCard
          icon={<ShoppingBag className="size-4" />}
          tint="bg-amber-50 text-amber-600"
          label="Orders"
          value={kpis.orders.toLocaleString()}
          sub={`Last ${periodLabel}`}
          today={`${kpis.ordersToday} today`}
          delta={deltaPct(kpis.orders, kpis.ordersPrev)}
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          tint="bg-sky-50 text-sky-600"
          label="Conversion"
          value={`${kpis.conversion.toFixed(1)}%`}
          sub={`${kpis.uniqueCustomers} customers`}
          today={`${kpis.uniqueCustomers} customers`}
          delta={deltaPct(kpis.conversion, kpis.conversionPrev)}
        />
      </section>

      {/* Traffic chart */}
      <Collapsible
        title="Traffic Over Time"
        icon={<Activity className="size-4 text-violet-600" />}
        badge={periodLabel}
        defaultOpen
      >
        <div className="h-72 px-6 pb-6 pt-4">
          <AnalyticsTrafficChart data={series} />
        </div>
      </Collapsible>

      {/* Devices / Browsers / OS row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Collapsible
          title="Devices"
          icon={<Smartphone className="size-4 text-violet-600" />}
          badge={kpis.pageViews.toLocaleString()}
          defaultOpen
        >
          <DevicePanel rows={devices} />
        </Collapsible>
        <Collapsible
          title="Browsers"
          icon={<Globe className="size-4 text-violet-600" />}
          badge={kpis.pageViews.toLocaleString()}
          defaultOpen
        >
          <BarList rows={browsers} />
        </Collapsible>
        <Collapsible
          title="Operating Systems"
          icon={<Monitor className="size-4 text-violet-600" />}
          badge={kpis.pageViews.toLocaleString()}
          defaultOpen
        >
          <BarList rows={os} />
        </Collapsible>
      </section>

      {/* Geo + Channels */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Collapsible
          title="Visitors by Country"
          icon={<MapPin className="size-4 text-violet-600" />}
          badge={geo.length.toLocaleString()}
        >
          <GeoList rows={geo} />
        </Collapsible>
        <Collapsible
          title="Traffic Channels"
          icon={<PieChart className="size-4 text-violet-600" />}
          badge={channels.reduce((a, b) => a + b.count, 0).toLocaleString()}
        >
          <BarList rows={channels} />
        </Collapsible>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Collapsible
          title="Traffic Sources"
          icon={<ExternalLink className="size-4 text-violet-600" />}
          badge={referrers.reduce((a, b) => a + b.count, 0).toLocaleString()}
        >
          <BarList rows={referrers} />
        </Collapsible>
        <Collapsible
          title="Top Viewed Products"
          icon={<Eye className="size-4 text-violet-600" />}
          badge={topProducts.length.toLocaleString()}
        >
          <TopProductsList rows={topProducts} />
        </Collapsible>
      </section>

      <Collapsible
        title="Tracked Links"
        icon={<Link2 className="size-4 text-violet-600" />}
        badge={campaigns.length.toLocaleString()}
      >
        <CampaignTable rows={campaigns} />
      </Collapsible>

      <Collapsible
        title="Email Campaign Attribution"
        icon={<Mail className="size-4 text-violet-600" />}
        badge={emailAttribution.length.toLocaleString()}
        defaultOpen
      >
        <EmailCampaignPanel rows={emailAttribution} />
      </Collapsible>

      {/* Orders mega-card */}
      <Collapsible
        title="Orders"
        icon={<ShoppingBag className="size-4 text-violet-600" />}
        badge={kpis.orders.toLocaleString()}
        defaultOpen
      >
        <OrdersPanel
          totalOrders={totalOrdersAllTime}
          periodOrders={kpis.orders}
          uniqueCustomers={kpis.uniqueCustomers}
          mostOrdered={mostOrdered}
          byCountry={ordersByCountry}
          byCity={ordersByCity}
          recentOrders={recentOrders}
          cartActivity={cartActivity}
        />
      </Collapsible>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header + Live banner
// ────────────────────────────────────────────────────────────────────────────

function Header({
  period,
  excludeInternal,
}: {
  period: Period;
  excludeInternal: boolean;
}) {
  const baseQuery = (extra: Record<string, string>) => {
    const params = new URLSearchParams({ period });
    if (excludeInternal) params.set("exclude", "internal");
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return `/admin/analytics?${params.toString()}`;
  };
  // Toggle URL: flip exclude state, preserve current period.
  const toggleHref = excludeInternal
    ? `/admin/analytics?period=${period}`
    : `/admin/analytics?period=${period}&exclude=internal`;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Analytics</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Store performance &amp; visitor insights
          {excludeInternal && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
              internal traffic hidden
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={toggleHref}
          aria-label={excludeInternal ? "Show all traffic" : "Hide internal test traffic"}
          title={
            excludeInternal
              ? "Currently hiding admin/test traffic across visitors, page views, and orders — click to show all"
              : "Currently showing all traffic — click to hide admin/test visitors, page views, and orders"
          }
          className={
            excludeInternal
              ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
              : "inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-900"
          }
        >
          {excludeInternal ? "Internal hidden" : "Hide internal"}
        </Link>
        <Link
          href={baseQuery({})}
          aria-label="Refresh"
          className="grid size-9 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-900"
        >
          <RefreshCw className="size-4" />
        </Link>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={baseQuery({ period: p.key })}
              className={
                period === p.key
                  ? "rounded-md bg-zinc-900 px-3 py-1 text-xs font-bold text-white"
                  : "rounded-md px-3 py-1 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              }
            >
              {p.key}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function LiveBanner({
  activeNow,
  today,
  yesterday,
  allTime,
}: {
  activeNow: number;
  today: number;
  yesterday: number;
  allTime: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-900/40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 px-6 py-4 text-white shadow-md">
      <div className="absolute -top-12 right-20 size-40 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative grid size-9 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Activity className="size-4 text-emerald-300" />
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]">
              <span className="absolute inset-0 size-2 animate-ping rounded-full bg-emerald-400" />
            </span>
          </span>
          <div>
            <p className="text-sm font-bold">
              {activeNow.toLocaleString()}
              <span className="ml-1.5 text-xs font-normal text-zinc-400">active now</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 sm:gap-10">
          <LiveStat label="Today" value={today} />
          <LiveStat label="Yesterday" value={yesterday} />
          <LiveStat label="All Time" value={allTime} />
        </div>
      </div>
    </div>
  );
}

function LiveStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cards / panels
// ────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  tint,
  label,
  value,
  sub,
  today,
  delta,
}: {
  icon: ReactNode;
  tint: string;
  label: string;
  value: string;
  sub: string;
  today: string;
  delta: number;
}) {
  const up = delta >= 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-9 place-items-center rounded-lg ${tint}`}>{icon}</span>
        <span
          className={
            up
              ? "inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700"
              : "inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-700"
          }
        >
          {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-zinc-900 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-700">{label}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{today || sub}</p>
    </div>
  );
}

function Collapsible({
  title,
  icon,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] [&[open]>summary>svg.chev]:rotate-180"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-zinc-50/50">
        <span className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-violet-50">{icon}</span>
          <span className="text-base font-bold text-zinc-900">{title}</span>
          {badge !== undefined && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown className="chev size-4 text-zinc-400 transition-transform duration-200" />
      </summary>
      <div className="border-t border-zinc-100">{children}</div>
    </details>
  );
}

function DevicePanel({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div className="grid gap-6 px-6 py-6 sm:grid-cols-[200px_1fr]">
      <div className="h-44">
        <DonutChart data={rows} />
      </div>
      <ul className="self-center space-y-2 text-sm">
        {rows.slice(0, 6).map((r, i) => {
          const pct = total === 0 ? 0 : Math.round((r.count / total) * 100);
          return (
            <li key={r.label} className="flex items-center gap-2 text-zinc-700">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }}
              />
              <span className="truncate capitalize">{r.label}</span>
              <span className="ml-auto tabular-nums font-semibold text-zinc-900">
                {r.count.toLocaleString()}
              </span>
              <span className="w-10 text-right text-xs tabular-nums text-zinc-400">{pct}%</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-zinc-400">No data</li>}
      </ul>
    </div>
  );
}

function BarList({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const palette = ["#7c3aed", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#a855f7", "#22c55e", "#ef4444"];
  return (
    <ul className="divide-y divide-zinc-100">
      {rows.length === 0 ? (
        <li className="px-6 py-6 text-sm text-zinc-400">No data in this period.</li>
      ) : (
        rows.map((r, i) => {
          const pct = total === 0 ? 0 : (r.count / total) * 100;
          return (
            <li key={`${r.label}-${i}`} className="px-6 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate text-zinc-700">
                  <span
                    className="mr-2 inline-block size-2.5 rounded-full align-middle"
                    style={{ background: palette[i % palette.length] }}
                  />
                  {r.label}
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {r.count.toLocaleString()}
                  </span>
                  <span className="w-10 text-right tabular-nums text-zinc-400">
                    {pct.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: palette[i % palette.length] }}
                />
              </div>
            </li>
          );
        })
      )}
    </ul>
  );
}

function GeoList({ rows }: { rows: { country: string; city: string; visitors: number }[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-6 py-6 text-sm text-zinc-400">
        No geo data — country/city are populated by Vercel edge headers in production.
      </p>
    );
  }
  const max = rows[0]?.visitors ?? 1;
  return (
    <ul className="divide-y divide-zinc-100">
      {rows.map((r, i) => (
        <li key={`${r.country}-${r.city}-${i}`} className="flex items-center gap-3 px-6 py-2.5">
          <span className="w-32 truncate text-sm font-semibold text-zinc-700">{countryName(r.country)}</span>
          <span className="w-32 truncate text-xs text-zinc-500">{r.city || "—"}</span>
          <div className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${(r.visitors / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="w-10 text-right text-sm font-bold tabular-nums text-zinc-900">
            {r.visitors.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TopProductsList({
  rows,
}: {
  rows: { productId: string; title: string; units: number; revenueCents: number }[];
}) {
  if (rows.length === 0) {
    return <p className="px-6 py-6 text-sm text-zinc-400">No paid orders this period.</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100">
      {rows.map((r, i) => (
        <li key={r.productId} className="flex items-center gap-3 px-6 py-3 text-sm">
          <span className="w-5 text-center text-xs font-bold tabular-nums text-zinc-400">
            {i + 1}
          </span>
          <span className="flex-1 truncate font-semibold text-zinc-800">{r.title}</span>
          <span className="text-xs tabular-nums text-zinc-500">{r.units} units</span>
          <span className="w-20 text-right text-sm font-bold tabular-nums text-zinc-900">
            {formatPrice(r.revenueCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CampaignTable({
  rows,
}: {
  rows: { id: string; slug: string; name: string; clicks: number; orders: number; revenueCents: number }[];
}) {
  if (rows.length === 0) {
    return <p className="px-6 py-6 text-sm text-zinc-400">No tracked-link activity this period.</p>;
  }
  return (
    <>
      {/* Mobile: campaign cards */}
      <div className="space-y-3 p-4 md:hidden">
        {rows.map((c) => {
          const cvr = c.clicks > 0 ? (c.orders / c.clicks) * 100 : 0;
          return (
            <div
              key={c.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/admin/campaigns/${c.id}`}
                  className="truncate font-semibold text-zinc-900 hover:text-violet-600"
                >
                  {c.name}
                </Link>
                <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
                  {cvr.toFixed(1)}% CVR
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-400">/r/{c.slug}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Clicks</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{c.clicks}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Orders</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{c.orders}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Revenue</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{formatPrice(c.revenueCents)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-6 py-2">Campaign</th>
              <th className="px-6 py-2 text-right">Clicks</th>
              <th className="px-6 py-2 text-right">Orders</th>
              <th className="px-6 py-2 text-right">Revenue</th>
              <th className="px-6 py-2 text-right">CVR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((c) => {
              const cvr = c.clicks > 0 ? (c.orders / c.clicks) * 100 : 0;
              return (
                <tr key={c.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-2.5">
                    <Link href={`/admin/campaigns/${c.id}`} className="font-semibold hover:text-violet-600">
                      {c.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-400">/r/{c.slug}</p>
                  </td>
                  <td className="px-6 py-2.5 text-right tabular-nums">{c.clicks}</td>
                  <td className="px-6 py-2.5 text-right tabular-nums">{c.orders}</td>
                  <td className="px-6 py-2.5 text-right font-bold tabular-nums">{formatPrice(c.revenueCents)}</td>
                  <td className="px-6 py-2.5 text-right tabular-nums">{cvr.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EmailCampaignPanel({ rows }: { rows: CampaignAttrRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-6 py-6 text-sm text-zinc-400">
        No campaign-attributed visitors yet. Traffic from links tagged{" "}
        <span className="font-mono text-[11px]">?utm_campaign=…</span> (e.g. the
        newsletter) shows up here once it lands.
      </p>
    );
  }
  const totals = rows.reduce(
    (a, r) => ({
      visitors: a.visitors + r.visitors,
      pageviews: a.pageviews + r.pageviews,
      buyers: a.buyers + r.buyers,
      subs: a.subs + r.subs,
    }),
    { visitors: 0, pageviews: 0, buyers: 0, subs: 0 },
  );
  return (
    <>
      {/* Mobile: campaign cards */}
      <div className="space-y-3 p-4 md:hidden">
        {rows.map((c) => (
          <div
            key={c.campaign}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-600">
                <Mail className="size-3.5" />
              </span>
              <span className="truncate font-semibold text-zinc-900">{c.campaign}</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Visitors</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{c.visitors.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Views</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-700">{c.pageviews.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Buyers</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700">{c.buyers.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Subs</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-700">{c.subs.toLocaleString()}</p>
              </div>
            </div>
            {c.sources.length > 1 && (
              <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-2">
                {c.sources.map((s) => (
                  <li
                    key={`${c.campaign}-${s.source}`}
                    className="flex items-center justify-between gap-2 text-[11px] text-zinc-500"
                  >
                    <span className="truncate">
                      <span className="mr-1 text-zinc-300">↳</span>
                      {s.source}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {s.visitors.toLocaleString()} v · {s.buyers.toLocaleString()} b
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-zinc-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-6 py-2">Campaign / Source</th>
            <th className="px-6 py-2 text-right">Visitors</th>
            <th className="px-6 py-2 text-right">Pageviews</th>
            <th className="px-6 py-2 text-right">Buyers</th>
            <th className="px-6 py-2 text-right">Subs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((c) => (
            <Fragment key={c.campaign}>
              <tr className="bg-white transition-colors hover:bg-zinc-50/50">
                <td className="px-6 py-2.5 font-semibold text-zinc-900">
                  <span className="inline-flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-md bg-violet-50 text-violet-600">
                      <Mail className="size-3.5" />
                    </span>
                    {c.campaign}
                  </span>
                </td>
                <td className="px-6 py-2.5 text-right font-bold tabular-nums text-zinc-900">
                  {c.visitors.toLocaleString()}
                </td>
                <td className="px-6 py-2.5 text-right tabular-nums text-zinc-700">
                  {c.pageviews.toLocaleString()}
                </td>
                <td className="px-6 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                  {c.buyers.toLocaleString()}
                </td>
                <td className="px-6 py-2.5 text-right font-semibold tabular-nums text-amber-700">
                  {c.subs.toLocaleString()}
                </td>
              </tr>
              {c.sources.length > 1 &&
                c.sources.map((s) => (
                  <tr key={`${c.campaign}-${s.source}`} className="text-xs">
                    <td className="py-1.5 pl-16 pr-6 text-zinc-500">
                      <span className="mr-1.5 text-zinc-300">↳</span>
                      {s.source}
                    </td>
                    <td className="px-6 py-1.5 text-right tabular-nums text-zinc-600">
                      {s.visitors.toLocaleString()}
                    </td>
                    <td className="px-6 py-1.5 text-right tabular-nums text-zinc-500">
                      {s.pageviews.toLocaleString()}
                    </td>
                    <td className="px-6 py-1.5 text-right tabular-nums text-zinc-500">
                      {s.buyers.toLocaleString()}
                    </td>
                    <td className="px-6 py-1.5 text-right tabular-nums text-zinc-500">
                      {s.subs.toLocaleString()}
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 bg-zinc-50/60 text-[11px] font-bold text-zinc-600">
            <td className="px-6 py-2.5 uppercase tracking-wider">Total</td>
            <td className="px-6 py-2.5 text-right tabular-nums">
              {totals.visitors.toLocaleString()}
            </td>
            <td className="px-6 py-2.5 text-right tabular-nums">
              {totals.pageviews.toLocaleString()}
            </td>
            <td className="px-6 py-2.5 text-right tabular-nums">
              {totals.buyers.toLocaleString()}
            </td>
            <td className="px-6 py-2.5 text-right tabular-nums">
              {totals.subs.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Orders mega-panel
// ────────────────────────────────────────────────────────────────────────────

type OrderListItem = Awaited<ReturnType<typeof getRecentOrdersExtended>>[number];
type CartListItem = Awaited<ReturnType<typeof getRecentCartActivity>>[number];

function OrdersPanel({
  totalOrders,
  periodOrders,
  uniqueCustomers,
  mostOrdered,
  byCountry,
  byCity,
  recentOrders,
  cartActivity,
}: {
  totalOrders: number;
  periodOrders: number;
  uniqueCustomers: number;
  mostOrdered: { productId: string; title: string; imageUrl: string | null; units: number; orders: number }[];
  byCountry: { country: string; count: number }[];
  byCity: { city: string; country: string; count: number }[];
  recentOrders: OrderListItem[];
  cartActivity: CartListItem[];
}) {
  const maxUnits = Math.max(1, ...mostOrdered.map((p) => p.units));
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total Orders" value={totalOrders} tone="bg-amber-50 text-amber-700 ring-amber-100" />
        <StatTile label="This Period" value={periodOrders} tone="bg-emerald-50 text-emerald-700 ring-emerald-100" />
        <StatTile label="Unique Customers" value={uniqueCustomers} tone="bg-indigo-50 text-indigo-700 ring-indigo-100" />
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          Most Ordered Products
        </p>
        <ul className="mt-3 space-y-2.5">
          {mostOrdered.length === 0 && (
            <li className="text-sm text-zinc-400">No orders this period.</li>
          )}
          {mostOrdered.map((p, i) => {
            const pct = (p.units / maxUnits) * 100;
            return (
              <li key={p.productId} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-center text-xs font-bold tabular-nums text-zinc-400">
                  {i + 1}
                </span>
                <span className="truncate font-semibold text-zinc-800">{p.title}</span>
                <div className="ml-2 flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-amber-100/60">
                    <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="w-28 text-right text-xs text-zinc-500">
                  {p.units} qty · {p.orders} order{p.orders === 1 ? "" : "s"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Orders by Country
          </p>
          <ul className="mt-3 divide-y divide-zinc-100">
            {byCountry.length === 0 && <li className="py-2 text-sm text-zinc-400">—</li>}
            {byCountry.map((c) => (
              <li key={c.country} className="flex items-center justify-between py-2 text-sm">
                <span className="text-zinc-700">{countryName(c.country)}</span>
                <span className="font-bold tabular-nums">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Orders by City
          </p>
          <ul className="mt-3 divide-y divide-zinc-100">
            {byCity.length === 0 && <li className="py-2 text-sm text-zinc-400">—</li>}
            {byCity.map((c) => (
              <li key={`${c.city}-${c.country}`} className="flex items-center justify-between py-2 text-sm">
                <span className="text-zinc-700">
                  {c.city}
                  {c.country && c.country !== "—" && (
                    <span className="text-zinc-400">, {countryName(c.country)}</span>
                  )}
                </span>
                <span className="font-bold tabular-nums">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          Recent Checkout Orders
        </p>
        <ul className="mt-3 space-y-2">
          {recentOrders.map((o) => (
            <li key={o.id}>
              <RecentOrderCard order={o} />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          Recent Cart Activity
        </p>
        <ul className="mt-3 space-y-2">
          {cartActivity.map((it) => (
            <li key={it.id}>
              <CartActivityRow item={it} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl px-5 py-4 ring-1 ${tone}`}>
      <p className="text-center text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 text-center text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function customerName(o: OrderListItem): string {
  if (o.notes) {
    const m = o.notes.match(/^Name:\s*(.+?)$/m);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  const handle = o.email.split("@")[0] ?? "Customer";
  return handle
    .split(/[._-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function paymentLabel(notes: string | null): string | null {
  if (!notes) return null;
  if (/zelle/i.test(notes)) return "Zelle";
  if (/cash[\s-]?app/i.test(notes)) return "Cashapp";
  if (/chime/i.test(notes)) return "Chime";
  if (/crypto/i.test(notes)) return "Crypto";
  return null;
}

function channelChip(channel: string | null) {
  if (!channel) return "via web";
  return `via ${channel.toLowerCase()}`;
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    PAID: "bg-emerald-50 text-emerald-700",
    DELIVERED: "bg-emerald-50 text-emerald-700",
    SHIPPED: "bg-sky-50 text-sky-700",
    PROCESSING: "bg-sky-50 text-sky-700",
    PENDING: "bg-amber-50 text-amber-700",
    AWAITING_PAYMENT: "bg-amber-50 text-amber-700",
    CANCELED: "bg-rose-50 text-rose-700",
    REFUNDED: "bg-rose-50 text-rose-700",
  };
  const label = status === "PAID" ? "confirmed" : status.toLowerCase().replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        map[status] ?? "bg-zinc-100 text-zinc-700"
      }`}
    >
      {label}
    </span>
  );
}

function RecentOrderCard({ order }: { order: OrderListItem }) {
  const name = customerName(order);
  const a = order.shippingAddress;
  // Prefer the IP-derived city/region/country we captured at checkout —
  // present on every order including Fast Orders that have no address.
  // Fall back to shipping address for older orders.
  const city = order.ipCity ?? a?.city ?? null;
  const region = order.ipRegion ?? a?.state ?? null;
  const country = order.ipCountry ?? a?.country ?? null;
  const postal = order.ipPostalCode ?? a?.postalCode ?? null;
  const location = [
    [city, region].filter(Boolean).join(", "),
    countryName(country),
    postal,
  ]
    .filter((s): s is string => Boolean(s) && s !== "Unknown")
    .join(" ");
  const pay = paymentLabel(order.notes);
  const ago = formatDistanceToNowStrict(new Date(order.createdAt));
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="block rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 transition-colors hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
          <ShoppingBag className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold text-zinc-900">
              {name}{" "}
              <span className="ml-1 font-mono text-xs font-normal text-zinc-400">{order.number}</span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {statusPill(order.status)}
              <span className="text-[11px] text-zinc-400">{ago}</span>
            </div>
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{order.email}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {location}
            </span>
            <span>·</span>
            <span>{order.items.length} item{order.items.length === 1 ? "" : "s"}</span>
            {pay && (
              <>
                <span>·</span>
                <span>{pay}</span>
              </>
            )}
            <span>·</span>
            <span className="text-violet-600">{channelChip(order.channel)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

const CART_EVENT_META: Record<
  string,
  { label: string; tone: string; icon: string }
> = {
  ADD: { label: "Added to cart", tone: "bg-emerald-50 text-emerald-700", icon: "＋" },
  REMOVE: { label: "Removed", tone: "bg-rose-50 text-rose-700", icon: "−" },
  QTY_CHANGE: { label: "Qty changed", tone: "bg-sky-50 text-sky-700", icon: "↕" },
  CLEAR: { label: "Cart cleared", tone: "bg-zinc-100 text-zinc-700", icon: "✕" },
  CHECKOUT_STARTED: { label: "Started checkout", tone: "bg-violet-50 text-violet-700", icon: "→" },
  CHECKOUT_ABANDONED: { label: "Abandoned checkout", tone: "bg-amber-50 text-amber-700", icon: "⌛" },
  CHECKOUT_COMPLETED: { label: "Order placed", tone: "bg-emerald-50 text-emerald-700", icon: "✓" },
};

function CartActivityRow({ item }: { item: CartListItem }) {
  const meta = CART_EVENT_META[item.type] ?? {
    label: item.type,
    tone: "bg-zinc-100 text-zinc-700",
    icon: "•",
  };
  const location = [
    [item.city, item.region].filter(Boolean).join(", "),
    item.country ? countryName(item.country) : null,
  ]
    .filter((s): s is string => Boolean(s) && s !== "Unknown")
    .join(" · ");
  const ago = formatDistanceToNowStrict(new Date(item.createdAt));
  const who =
    item.user?.name?.trim() ||
    item.email ||
    (item.sessionId ? `Guest · ${item.sessionId.slice(0, 6)}` : "Anonymous");
  return (
    <div className="flex items-start gap-3 rounded-xl bg-zinc-50/60 p-3 ring-1 ring-zinc-100">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-base font-bold text-zinc-700 ring-1 ring-zinc-200">
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}
          >
            {meta.label}
          </span>
          {item.title && (
            <span className="truncate font-semibold text-zinc-900">{item.title}</span>
          )}
          {item.orderNumber && (
            <Link
              href={`/admin/orders/${item.orderId ?? ""}`}
              className="font-mono text-[11px] font-semibold text-[#146ff8] hover:underline"
            >
              {item.orderNumber}
            </Link>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
          <span className="truncate">{who}</span>
          {item.quantity != null && (
            <>
              <span>·</span>
              <span>{item.quantity}x</span>
            </>
          )}
          {item.priceCents != null && (
            <>
              <span>·</span>
              <span className="font-semibold">{formatPrice(item.priceCents)}</span>
            </>
          )}
          {item.subtotalCents != null && item.itemCount != null && (
            <>
              <span>·</span>
              <span>
                cart {item.itemCount}× / {formatPrice(item.subtotalCents)}
              </span>
            </>
          )}
          {location && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {location}
              </span>
            </>
          )}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-zinc-400">{ago}</span>
    </div>
  );
}

// Used import — silence
void Users;
