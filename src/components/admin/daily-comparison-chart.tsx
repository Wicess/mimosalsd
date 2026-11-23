import type { TrendDay } from "@/lib/visitor-trend";

/**
 * Orders vs pageviews vs visitors, per day, on one set of axes.
 *
 * The point is the SHAPE, not the magnitudes: pageviews run in the hundreds
 * while orders run in single digits, so plotting them on a shared scale would
 * flatten orders into the axis and show nothing. Each series is therefore
 * normalised against its own peak — the question this answers is "did the day
 * traffic spiked also convert?", which is a question about correlation, and
 * correlation is visible in shape alone.
 *
 * Rendered as plain divs and an inline SVG rather than a chart library: this is
 * three small series, and pulling recharts onto an admin page for it would cost
 * more bundle than the feature is worth.
 */

const SERIES = [
  { key: "visitors", label: "Visitors", color: "#146ff8", dot: "bg-[#146ff8]" },
  { key: "pageviews", label: "Pageviews", color: "#a1a1aa", dot: "bg-zinc-400" },
  { key: "orders", label: "Orders", color: "#059669", dot: "bg-emerald-600" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

export function DailyComparisonChart({ days }: { days: TrendDay[] }) {
  if (days.length === 0) return null;

  const W = 720;
  const H = 180;
  const PAD_X = 6;
  const PAD_Y = 10;

  const peaks: Record<SeriesKey, number> = {
    visitors: Math.max(1, ...days.map((d) => d.visitors)),
    pageviews: Math.max(1, ...days.map((d) => d.pageviews)),
    orders: Math.max(1, ...days.map((d) => d.orders)),
  };

  const x = (i: number) =>
    PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, days.length - 1);
  const y = (v: number, peak: number) =>
    H - PAD_Y - (v / peak) * (H - PAD_Y * 2);

  const path = (key: SeriesKey) =>
    days
      .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key], peaks[key]).toFixed(1)}`)
      .join(" ");

  const totals: Record<SeriesKey, number> = {
    visitors: days.reduce((n, d) => n + d.visitors, 0),
    pageviews: days.reduce((n, d) => n + d.pageviews, 0),
    orders: days.reduce((n, d) => n + d.orders, 0),
  };
  const paidTotal = days.reduce((n, d) => n + d.paidOrders, 0);

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-zinc-900">Orders vs traffic, per day</h2>
        <p className="text-[11px] text-muted-foreground">
          {days.length} days · each line scaled to its own peak, so the shapes compare
        </p>
      </div>

      {/* Legend doubles as the totals row. */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden />
            <span className="text-[11px] font-semibold text-zinc-600">{s.label}</span>
            <span className="text-[11px] font-bold tabular-nums text-zinc-900">
              {totals[s.key].toLocaleString()}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-300" aria-hidden />
          <span className="text-[11px] font-semibold text-zinc-600">of which paid</span>
          <span className="text-[11px] font-bold tabular-nums text-emerald-700">
            {paidTotal.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[180px] w-full min-w-[520px]"
          role="img"
          aria-label={`Daily comparison over ${days.length} days: ${totals.visitors} visitors, ${totals.pageviews} pageviews, ${totals.orders} orders.`}
        >
          {/* Weekend bands — the single biggest driver of the shape, so name it
              visually instead of leaving the reader to guess at the dips. */}
          {days.map((d, i) =>
            d.dow === "Sat" || d.dow === "Sun" ? (
              <rect
                key={d.day}
                x={x(i) - (W - PAD_X * 2) / Math.max(1, days.length - 1) / 2}
                y={0}
                width={(W - PAD_X * 2) / Math.max(1, days.length - 1)}
                height={H}
                fill="#f4f4f5"
              />
            ) : null,
          )}
          {SERIES.map((s) => (
            <path
              key={s.key}
              d={path(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.key === "orders" ? 2.5 : 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.key === "pageviews" ? 0.7 : 1}
            />
          ))}
          {/* Order markers — with single-digit counts the line alone is easy to
              lose against the other two. */}
          {days.map((d, i) =>
            d.orders > 0 ? (
              <circle key={d.day} cx={x(i)} cy={y(d.orders, peaks.orders)} r={3} fill="#059669" />
            ) : null,
          )}
        </svg>
      </div>

      {/* Day axis */}
      <div className="mt-1 flex gap-[2px]">
        {days.map((d) => (
          <span
            key={d.day}
            className={`min-w-0 flex-1 text-center text-[8px] font-bold uppercase tracking-wide sm:text-[9px] ${
              d.dow === "Sat" || d.dow === "Sun" ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            {d.dow.slice(0, 2)}
          </span>
        ))}
      </div>

      <p className="mt-3 rounded-lg bg-zinc-50 p-2.5 text-[11px] leading-relaxed text-zinc-600">
        Peaks: {peaks.visitors} visitors, {peaks.pageviews} pageviews, {peaks.orders} orders in a
        day. Where the green line rises with the blue, traffic converted; where blue rises alone,
        it did not.
      </p>
    </section>
  );
}
