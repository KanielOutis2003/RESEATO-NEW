import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  getVendorCharts,
  getVendorOverview,
  listVendorRestaurants,
} from "../lib/api/vendor.api";
import type {
  VendorChartsResponse,
  VendorOverview,
  VendorRestaurant,
} from "../lib/api/vendor.api";
import VendorPageReveal from "../components/vendor/VendorPageReveal";

/* ── helpers ── */

function toCurrency(minor: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format((Number(minor) || 0) / 100);
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function shiftDate(base: string, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type RangePreset = "7d" | "30d" | "90d";

const PRESETS: { key: RangePreset; label: string; days: number }[] = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "90 Days", days: 90 },
];

/* ── mini bar chart ── */

function MiniBar({
  data,
  color,
  label,
}: {
  data: number[];
  color: string;
  label: string;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[#6b7280]">{label}</p>
      <div className="flex items-end gap-[2px]" style={{ height: 48 }}>
        {data.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-300"
            style={{
              height: `${Math.max((v / max) * 100, 4)}%`,
              backgroundColor: color,
              opacity: 0.25 + (i / data.length) * 0.75,
            }}
            title={`${v}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── stat card ── */

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ece8e9] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ backgroundColor: accent + "18" }}
        >
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-[#1f2937]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#6b7280]">{sub}</p>}
    </div>
  );
}

/* ── status breakdown row ── */

function StatusRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const ratio = total > 0 ? count / total : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#374151] font-medium">{label}</span>
        <span className="text-[#6b7280]">
          {count} ({pct(ratio)})
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#f3f4f6]">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ── main page ── */

export default function VendorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [charts, setCharts] = useState<VendorChartsResponse | null>(null);
  const [overview, setOverview] = useState<VendorOverview | null>(null);
  const [restaurants, setRestaurants] = useState<VendorRestaurant[]>([]);

  /* fetch data */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const days = PRESETS.find((p) => p.key === preset)!.days;
    const to = todayKey();
    const from = shiftDate(to, -(days - 1));

    Promise.all([
      getVendorCharts({ from, to }),
      getVendorOverview(),
      listVendorRestaurants(),
    ])
      .then(([c, o, r]) => {
        if (!alive) return;
        setCharts(c);
        setOverview(o);
        setRestaurants(r);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message ?? "Failed to load analytics.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [preset]);

  const summary = charts?.summary;
  const days = useMemo(() => charts?.days ?? [], [charts?.days]);

  /* daily arrays for mini charts */
  const dailyTotal = useMemo(() => days.map((d) => d.total), [days]);
  const dailyRevenue = useMemo(() => days.map((d) => d.revenueMinor), [days]);
  const dailyCompleted = useMemo(() => days.map((d) => d.completed), [days]);
  const dailyCancelled = useMemo(() => days.map((d) => d.cancelled), [days]);

  /* peak day */
  const peakDay = useMemo(() => {
    if (!days.length) return null;
    return days.reduce((best, d) => (d.total > best.total ? d : best), days[0]);
  }, [days]);

  /* avg per day */
  const avgPerDay = useMemo(() => {
    if (!days.length) return 0;
    const total = days.reduce((s, d) => s + d.total, 0);
    return total / days.length;
  }, [days]);

  if (loading) {
    return (
      <VendorPageReveal className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8b3d4a]" />
      </VendorPageReveal>
    );
  }

  if (error) {
    return (
      <VendorPageReveal className="flex-1 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          {error}
        </div>
      </VendorPageReveal>
    );
  }

  return (
    <VendorPageReveal className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1f2937] flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#8b3d4a]" />
            Analytics &amp; Reports
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Track your restaurant performance across {restaurants.length} restaurant{restaurants.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Range picker */}
        <div className="flex rounded-xl border border-[#e5e7eb] bg-white p-1 shadow-sm">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                preset === p.key
                  ? "bg-[#8b3d4a] text-white shadow-sm"
                  : "text-[#6b7280] hover:text-[#1f2937]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<CalendarClock className="h-5 w-5 text-[#8b3d4a]" />}
          label="Total Reservations"
          value={summary?.totalReservations ?? 0}
          sub={`~${avgPerDay.toFixed(1)} per day`}
          accent="#8b3d4a"
        />
        <StatCard
          icon={<CircleDollarSign className="h-5 w-5 text-[#16a34a]" />}
          label="Revenue"
          value={toCurrency(summary?.totalRevenueMinor ?? 0)}
          sub={`${summary?.totalPaid ?? 0} paid reservations`}
          accent="#16a34a"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-[#2563eb]" />}
          label="Completion Rate"
          value={pct(summary?.completionRate ?? 0)}
          sub={`${summary?.totalCompleted ?? 0} completed`}
          accent="#2563eb"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-[#dc2626]" />}
          label="Cancellation Rate"
          value={pct(summary?.cancellationRate ?? 0)}
          sub={`${summary?.totalCancelled ?? 0} cancelled`}
          accent="#dc2626"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#ece8e9] bg-white p-5 shadow-sm">
          <MiniBar data={dailyTotal} color="#8b3d4a" label="Daily Reservations" />
        </div>
        <div className="rounded-2xl border border-[#ece8e9] bg-white p-5 shadow-sm">
          <MiniBar data={dailyRevenue} color="#16a34a" label="Daily Revenue (centavos)" />
        </div>
        <div className="rounded-2xl border border-[#ece8e9] bg-white p-5 shadow-sm">
          <MiniBar data={dailyCompleted} color="#2563eb" label="Daily Completed" />
        </div>
        <div className="rounded-2xl border border-[#ece8e9] bg-white p-5 shadow-sm">
          <MiniBar data={dailyCancelled} color="#dc2626" label="Daily Cancelled" />
        </div>
      </div>

      {/* Status breakdown + insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status breakdown */}
        <div className="rounded-2xl border border-[#ece8e9] bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[#1f2937]">Status Breakdown</h2>
          <StatusRow
            label="Pending"
            count={summary?.totalPending ?? 0}
            total={summary?.totalReservations ?? 0}
            color="#f59e0b"
          />
          <StatusRow
            label="Confirmed"
            count={summary?.totalConfirmed ?? 0}
            total={summary?.totalReservations ?? 0}
            color="#3b82f6"
          />
          <StatusRow
            label="Completed"
            count={summary?.totalCompleted ?? 0}
            total={summary?.totalReservations ?? 0}
            color="#16a34a"
          />
          <StatusRow
            label="Paid"
            count={summary?.totalPaid ?? 0}
            total={summary?.totalReservations ?? 0}
            color="#8b5cf6"
          />
          <StatusRow
            label="Cancelled / Declined"
            count={summary?.totalCancelled ?? 0}
            total={summary?.totalReservations ?? 0}
            color="#ef4444"
          />
        </div>

        {/* Insights */}
        <div className="rounded-2xl border border-[#ece8e9] bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[#1f2937]">Quick Insights</h2>

          <div className="space-y-3">
            {/* Peak day */}
            {peakDay && peakDay.total > 0 && (
              <div className="flex items-start gap-3 rounded-xl bg-[#faf8f9] p-4">
                <TrendingUp className="mt-0.5 h-5 w-5 text-[#16a34a]" />
                <div>
                  <p className="text-sm font-semibold text-[#1f2937]">Busiest Day</p>
                  <p className="text-xs text-[#6b7280]">
                    {new Date(peakDay.date + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    — {peakDay.total} reservation{peakDay.total !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Revenue insight */}
            {(summary?.totalRevenueMinor ?? 0) > 0 && (
              <div className="flex items-start gap-3 rounded-xl bg-[#faf8f9] p-4">
                <CircleDollarSign className="mt-0.5 h-5 w-5 text-[#8b5cf6]" />
                <div>
                  <p className="text-sm font-semibold text-[#1f2937]">Avg Revenue per Paid</p>
                  <p className="text-xs text-[#6b7280]">
                    {toCurrency(
                      summary!.totalPaid > 0
                        ? Math.round(summary!.totalRevenueMinor / summary!.totalPaid)
                        : 0,
                    )}{" "}
                    per transaction
                  </p>
                </div>
              </div>
            )}

            {/* Cancellation warning */}
            {(summary?.cancellationRate ?? 0) > 0.2 && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
                <TrendingDown className="mt-0.5 h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-700">High Cancellation Rate</p>
                  <p className="text-xs text-red-600">
                    {pct(summary!.cancellationRate)} of reservations were cancelled. Consider following up with guests.
                  </p>
                </div>
              </div>
            )}

            {/* Current overview */}
            {overview && (
              <div className="flex items-start gap-3 rounded-xl bg-[#faf8f9] p-4">
                <Users className="mt-0.5 h-5 w-5 text-[#8b3d4a]" />
                <div>
                  <p className="text-sm font-semibold text-[#1f2937]">Current Overview</p>
                  <p className="text-xs text-[#6b7280]">
                    {overview.pendingCount} pending · {overview.confirmedCount} confirmed · {overview.completedCount} completed
                  </p>
                </div>
              </div>
            )}

            {/* Restaurants summary */}
            {restaurants.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl bg-[#faf8f9] p-4">
                <Clock3 className="mt-0.5 h-5 w-5 text-[#f59e0b]" />
                <div>
                  <p className="text-sm font-semibold text-[#1f2937]">
                    {restaurants.length} Restaurant{restaurants.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-[#6b7280]">
                    {restaurants.map((r) => r.name).join(", ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </VendorPageReveal>
  );
}
