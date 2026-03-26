import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Loader2,
  Settings2,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import {
  getVendorCharts,
  getVendorOverview,
  listVendorBestSellers,
  listVendorRestaurants,
  VendorBestSeller,
  VendorChartsResponse,
  VendorOverview,
  VendorRestaurant,
} from "../lib/api/vendor.api";
import { ApiError } from "../lib/api/client";
import { useAuth } from "../lib/auth/useAuth";
import VendorPageReveal from "../components/vendor/VendorPageReveal";

type ChartPreset = "7d" | "30d" | "90d" | "custom";

type TrendPoint = VendorChartsResponse["days"][number];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload as { message?: string } | undefined;
    return payload?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function toCurrency(minor: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format((Number(minor) || 0) / 100);
}

function csvCell(value: string | number | boolean) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | boolean>>) {
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map((value) => csvCell(value)).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function dateInputFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateInput(value: string, deltaDays: number) {
  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  dt.setDate(dt.getDate() + deltaDays);
  return dateInputFromDate(dt);
}

function formatDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getPresetDays(preset: ChartPreset) {
  if (preset === "7d") return 7;
  if (preset === "90d") return 90;
  return 30;
}

type TrendTooltipState = {
  x: number;
  y: number;
  point: TrendPoint;
};

function VendorLineChart({ points }: { points: TrendPoint[] }) {
  const width = 980;
  const height = 320;
  const padX = 42;
  const padY = 26;
  const [tooltip, setTooltip] = useState<TrendTooltipState | null>(null);

  const chart = useMemo(() => {
    if (!points.length) return null;

    const values = points.map((point) => Number(point.total ?? 0));
    const maxValue = Math.max(1, ...values);
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const baselineY = padY + innerH;
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

    const coords = points.map((point, index) => {
      const value = Number(point.total ?? 0);
      return {
        point,
        x: padX + index * stepX,
        y: baselineY - (value / maxValue) * innerH,
      };
    });

    const path = coords
      .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`)
      .join(" ");

    const areaPath = `${path} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`;

    return {
      coords,
      path,
      areaPath,
      maxValue,
      labelStep: Math.max(1, Math.floor(points.length / 10)),
      tickValues: Array.from({ length: 5 }, (_, index) =>
        Math.round((maxValue * (4 - index)) / 4),
      ),
      baselineY,
      innerH,
    };
  }, [points]);

  if (!chart) {
    return (
      <div className="grid h-[320px] place-items-center rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] text-sm text-[#6b7280]">
        No bookings in selected range.
      </div>
    );
  }

  const tooltipWidth = 210;
  const tooltipHeight = 172;
  const tooltipX = tooltip
    ? Math.min(width - tooltipWidth / 2 - 8, Math.max(tooltipWidth / 2 + 8, tooltip.x))
    : 0;
  const preferredTooltipY = tooltip
    ? tooltip.y > height * 0.55
      ? tooltip.y - tooltipHeight - 12
      : tooltip.y + 12
    : 0;
  const tooltipY = tooltip
    ? Math.min(height - tooltipHeight - 8, Math.max(8, preferredTooltipY))
    : 0;

  function handleSvgMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;

    setTooltip((prev) => (prev ? { ...prev, x, y } : prev));
  }

  return (
    <div
      className="relative rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd]"
      onMouseLeave={() => setTooltip(null)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full" onMouseMove={handleSvgMouseMove}>
        <defs>
          <linearGradient id="vendorArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bf6f7a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#bf6f7a" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {chart.tickValues.map((tick, tickIndex) => {
          const y = chart.baselineY - (tick / chart.maxValue) * chart.innerH;
          return (
            <g key={`tick-${tick}-${tickIndex}`}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(100,116,139,0.2)" strokeDasharray="4 5" />
              <text x={10} y={y + 4} fontSize="11" fill="rgba(71,85,105,0.7)">{tick}</text>
            </g>
          );
        })}

        <path d={chart.areaPath} fill="url(#vendorArea)" />
        <path d={chart.path} fill="none" stroke="#8b3d4a" strokeWidth="3" strokeLinecap="round" />

        {chart.coords.map((coord) => (
          <circle
            key={coord.point.date}
            cx={coord.x}
            cy={coord.y}
            r="4"
            fill="#f8e7ea"
            stroke="#8b3d4a"
            strokeWidth="1.2"
            onMouseEnter={() => setTooltip({ x: coord.x, y: coord.y, point: coord.point })}
          >
            <title>{`${coord.point.date}: ${coord.point.total} bookings`}</title>
          </circle>
        ))}

        {chart.coords.map((coord, index) => {
          if (index !== 0 && index !== chart.coords.length - 1 && index % chart.labelStep !== 0) {
            return null;
          }

          return (
            <text key={`label-${coord.point.date}`} x={coord.x} y={height - 8} textAnchor="middle" fontSize="10" fill="rgba(71,85,105,0.72)">
              {formatDayLabel(coord.point.date)}
            </text>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 min-w-[190px] -translate-x-1/2 rounded-xl border border-[#d9c3c8] bg-[rgba(255,255,255,0.96)] px-3 py-2 text-xs text-[#475467] shadow-xl"
          style={{
            left: `${(tooltipX / width) * 100}%`,
            top: `${(tooltipY / height) * 100}%`,
          }}
        >
          <div className="font-semibold text-[#1f2937]">{formatDayLabel(tooltip.point.date)}</div>
          <div className="mt-1">Total: {tooltip.point.total}</div>
          <div>Pending: {tooltip.point.pending}</div>
          <div>Confirmed: {tooltip.point.confirmed}</div>
          <div>Completed: {tooltip.point.completed}</div>
          <div>Cancelled: {tooltip.point.cancelled}</div>
          <div>Paid: {tooltip.point.paid}</div>
          <div>Revenue: {toCurrency(tooltip.point.revenueMinor)}</div>
        </div>
      )}
    </div>
  );
}

const EMPTY_OVERVIEW: VendorOverview = {
  restaurantCount: 0,
  reservationCount: 0,
  pendingCount: 0,
  confirmedCount: 0,
  completedCount: 0,
  paidCount: 0,
  totalPaidAmountMinor: 0,
};

export default function VendorDashboardPage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<VendorOverview | null>(null);
  const [restaurants, setRestaurants] = useState<VendorRestaurant[]>([]);
  const [bestSellers, setBestSellers] = useState<VendorBestSeller[]>([]);
  const [chartData, setChartData] = useState<VendorChartsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [chartPreset, setChartPreset] = useState<ChartPreset>("30d");
  const [chartTo, setChartTo] = useState(() => dateInputFromDate(new Date()));
  const [chartFrom, setChartFrom] = useState(() => shiftDateInput(dateInputFromDate(new Date()), -29));

  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySnapshot, setDaySnapshot] = useState<{ total: number; pending: number; confirmed: number; completed: number; cancelled: number; paid: number; revenueMinor: number } | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    if (chartPreset === "custom") return;
    const days = getPresetDays(chartPreset);
    const to = dateInputFromDate(new Date());
    setChartTo(to);
    setChartFrom(shiftDateInput(to, -(days - 1)));
  }, [chartPreset]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!isAuthed) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setMessage(null);

        const [overviewResult, restaurantsResult, bestSellersResult] = await Promise.allSettled([
          getVendorOverview(),
          listVendorRestaurants(),
          listVendorBestSellers({ limit: 120, active: "all" }),
        ]);

        if (!alive) return;

        setOverview(overviewResult.status === "fulfilled" ? overviewResult.value : EMPTY_OVERVIEW);
        setRestaurants(restaurantsResult.status === "fulfilled" ? restaurantsResult.value : []);
        setBestSellers(bestSellersResult.status === "fulfilled" ? bestSellersResult.value : []);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [isAuthed]);

  useEffect(() => {
    let alive = true;

    async function loadCharts() {
      if (!isAuthed) return;
      try {
        setChartLoading(true);
        const data = await getVendorCharts({ from: chartFrom, to: chartTo });
        if (!alive) return;
        setChartData(data);
      } catch (error) {
        if (!alive) return;
        setMessage(getErrorMessage(error, "Failed to load chart data."));
      } finally {
        if (alive) setChartLoading(false);
      }
    }

    loadCharts();
    return () => {
      alive = false;
    };
  }, [chartFrom, chartTo, isAuthed]);

  useEffect(() => {
    let alive = true;
    if (!selectedDate || !isAuthed) { setDaySnapshot(null); return; }

    async function loadDay() {
      try {
        setDayLoading(true);
        const data = await getVendorCharts({ from: selectedDate!, to: selectedDate! });
        if (!alive) return;
        const day = data.days?.[0];
        if (day) {
          setDaySnapshot({ total: day.total, pending: day.pending, confirmed: day.confirmed, completed: day.completed, cancelled: day.cancelled, paid: day.paid, revenueMinor: day.revenueMinor });
        } else {
          setDaySnapshot({ total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, paid: 0, revenueMinor: 0 });
        }
      } catch {
        if (alive) setDaySnapshot(null);
      } finally {
        if (alive) setDayLoading(false);
      }
    }

    loadDay();
    return () => { alive = false; };
  }, [selectedDate, isAuthed]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: Array<{ day: number; dateStr: string } | null> = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(calMonth + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      cells.push({ day: d, dateStr: `${calYear}-${mm}-${dd}` });
    }
    return cells;
  }, [calMonth, calYear]);

  const cards = useMemo(() => {
    const data = overview ?? EMPTY_OVERVIEW;
    return [
      { key: "reservations", label: "Reservations", value: data.reservationCount, icon: CalendarClock },
      { key: "completed", label: "Completed", value: data.completedCount, icon: CircleDollarSign },
      { key: "pending", label: "Pending", value: data.pendingCount, icon: Clock3 },
      { key: "confirmed", label: "Confirmed", value: data.confirmedCount, icon: CheckCircle2 },
    ];
  }, [overview]);

  const topBestSellers = useMemo(() => [...bestSellers].sort((a, b) => b.soldCount - a.soldCount), [bestSellers]);

  const inventoryValueMinor = useMemo(() => topBestSellers.reduce((sum, item) => sum + item.priceMinor * item.stockQuantity, 0), [topBestSellers]);

  function handleExportTrendsCsv() {
    if (!chartData?.days?.length) return;

    const rows = chartData.days.map((day) => [
      day.date,
      day.total,
      day.pending,
      day.confirmed,
      day.completed,
      day.cancelled,
      day.paid,
      day.revenueMinor,
      (day.revenueMinor / 100).toFixed(2),
    ]);

    downloadCsv(`vendor-booking-trends-${chartData.from}-to-${chartData.to}.csv`, ["date", "total", "pending", "confirmed", "completed", "cancelled", "paid", "revenue_minor", "revenue_php"], rows);
  }

  function handleExportInventoryCsv() {
    if (!topBestSellers.length) return;
    const rows = topBestSellers.map((item) => [item.restaurantName ?? "", item.name, item.priceMinor, (item.priceMinor / 100).toFixed(2), item.stockQuantity, item.soldCount, ((item.priceMinor * item.soldCount) / 100).toFixed(2)]);
    downloadCsv(`vendor-inventory-${new Date().toISOString().slice(0, 10)}.csv`, ["restaurant", "item", "price_minor", "price_php", "stock", "sold", "estimated_sales_php"], rows);
  }

  const firstRestaurant = restaurants[0] ?? null;

  if (authLoading) {
    return <div className="min-h-screen w-full bg-[#f5f3f4] text-[#1f2937]" />;
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen w-full bg-[#f5f3f4] p-7 text-[#1f2937]">
        Login is required to access the vendor portal.
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full text-[#1f2937]">
      <div className="p-7">
        {/* Topbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-[32px] font-extrabold text-[#1f2937]">Vendor Dashboard</h2>
            <p className="text-sm text-[#667085]">Refined reservation management for premium hospitality operations.</p>
          </div>
        </div>

        {message && <div className="mb-5 rounded-2xl border border-[#f2cccf] bg-[#fff6f7] px-4 py-3 text-sm text-[#9f1239]">{message}</div>}

        {loading ? (
          <div className="rounded-[22px] border border-[#e7e3e5] bg-white p-6 text-[#5b6374] shadow-[0_18px_40px_rgba(15,23,42,0.08)]"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <VendorPageReveal>
            {/* Stats Grid */}
            <section className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4 mb-5">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.key} className="rounded-[22px] border border-[#e7e3e5] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="text-xs font-semibold uppercase tracking-[1px] text-[#667085]">{card.label}</div>
                    <div className="mt-2.5 text-[34px] font-extrabold text-[#1f2937]">{card.value}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#1f7a4d]">
                      <Icon className="h-3.5 w-3.5" />
                      Active this month
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Panel Grid: Featured Restaurant + Mini Cards */}
            <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr] mb-5">
              {/* Featured Restaurant / Calendar Panel */}
              <article className="rounded-[24px] border border-[#e7e3e5] bg-white p-[22px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-[18px]">
                  <div>
                    <h3 className="text-[22px] font-extrabold text-[#1f2937]">Featured Restaurant</h3>
                    <p className="text-[13px] text-[#667085]">Main assigned restaurant and quick management controls.</p>
                  </div>
                  <Link to="/vendor/tables" className="rounded-[14px] border border-[#ead3d8] bg-[#f8ecee] px-3.5 py-2.5 text-sm font-bold text-[#8f3d56] transition hover:bg-[#f4dfe3]">
                    Manage Tables
                  </Link>
                </div>

                {/* Restaurant Feature Card */}
                <div className="grid gap-4 rounded-[20px] border border-[#f0dde1] bg-[linear-gradient(180deg,#fffafc_0%,#fff5f6_100%)] p-4 md:grid-cols-[120px_1fr_auto] md:items-center">
                  {firstRestaurant?.imageUrl ? (
                    <img src={firstRestaurant.imageUrl} alt={firstRestaurant.name} className="h-[110px] w-full rounded-[18px] object-cover md:w-[120px]" />
                  ) : (
                    <div className="grid h-[110px] w-full place-items-center rounded-[18px] bg-[linear-gradient(135deg,#f7ebee,#f5f7fb)] text-[#8b3d4a] md:w-[120px]">
                      <UtensilsCrossed className="h-7 w-7" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-2xl font-extrabold text-[#1f2937]">{firstRestaurant?.name ?? "No Restaurant"}</h4>
                      {firstRestaurant?.rating != null && Number(firstRestaurant.rating) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#f0d5a5] bg-[#fff9ef] px-2.5 py-1 text-xs font-bold text-[#9a6a19]">
                          <Star className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                          {Number(firstRestaurant.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] leading-[1.7] text-[#667085]">
                      {firstRestaurant?.cuisine ?? "Restaurant"} &bull; Cebu City, Philippines
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f8ecee] px-2.5 py-[7px] text-xs font-bold text-[#8f3d56]">Best Sellers Enabled</span>
                      <span className="rounded-full bg-[#f8ecee] px-2.5 py-[7px] text-xs font-bold text-[#8f3d56]">Premium Listing</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/vendor/tables" className="rounded-[14px] border border-[#ead3d8] bg-[#f8ecee] px-3 py-2.5 text-sm font-bold text-[#8f3d56]">Edit Info</Link>
                    <Link to="/vendor/tables" className="rounded-[14px] border border-[#ead3d8] bg-[#f8ecee] px-3 py-2.5 text-sm font-bold text-[#8f3d56]">Best Sellers</Link>
                  </div>
                </div>
              </article>

              {/* Stack of Mini Cards */}
              <div className="grid gap-[14px]">
                <article className="rounded-[20px] border border-[#e7e3e5] bg-[linear-gradient(180deg,#fffaf9_0%,#fffdfd_100%)] p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[1px] text-[#667085]">Paid Reservations</div>
                  <div className="mt-2 text-[28px] font-extrabold text-[#1f2937]">{overview?.paidCount ?? 0}</div>
                  <div className="text-xs text-[#667085]">Guests who completed payments</div>
                </article>
                <article className="rounded-[20px] border border-[#e7e3e5] bg-[linear-gradient(180deg,#fffaf9_0%,#fffdfd_100%)] p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[1px] text-[#667085]">Collected Fees</div>
                  <div className="mt-2 text-[28px] font-extrabold text-[#1f2937]">{toCurrency(overview?.totalPaidAmountMinor ?? 0)}</div>
                  <div className="text-xs text-[#667085]">Estimated monthly revenue</div>
                </article>
                <article className="rounded-[20px] border border-[#e7e3e5] bg-[linear-gradient(180deg,#fffaf9_0%,#fffdfd_100%)] p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[1px] text-[#667085]">Inventory Value</div>
                  <div className="mt-2 text-[28px] font-extrabold text-[#1f2937]">{toCurrency(inventoryValueMinor)}</div>
                  <div className="text-xs text-[#667085]">Current restaurant stock estimate</div>
                </article>
              </div>
            </section>

            {/* Calendar + Revenue Snapshot Row */}
            <section className="grid gap-5 lg:grid-cols-2 mb-5">
              {/* Calendar + Booking Trends */}
              <article className="rounded-[24px] border border-[#e7e3e5] bg-white p-[22px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-[18px]">
                  <div>
                    <h3 className="text-[22px] font-extrabold text-[#1f2937]">Calendar</h3>
                    <p className="text-[13px] text-[#667085]">Click a date to view day snapshot.</p>
                  </div>
                  <button type="button" onClick={handleExportTrendsCsv} className="rounded-[14px] border border-[#ead3d8] bg-[#f8ecee] px-3.5 py-2.5 text-sm font-bold text-[#8f3d56] transition hover:bg-[#f4dfe3]">
                    <Download className="mr-1.5 inline-block h-3.5 w-3.5" />Export
                  </button>
                </div>

                {/* Month/Year nav */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <button type="button" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd8da] bg-white text-[#4b5563] hover:bg-[#f3f4f6]"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="min-w-[80px] text-center text-sm font-medium text-[#1f2937]">{new Date(calYear, calMonth).toLocaleDateString(undefined, { month: "long" })}</span>
                  <button type="button" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd8da] bg-white text-[#4b5563] hover:bg-[#f3f4f6]"><ChevronRight className="h-4 w-4" /></button>
                  <span className="mx-1 text-[#d1d5db]">|</span>
                  <button type="button" onClick={() => setCalYear((y) => y - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd8da] bg-white text-[#4b5563] hover:bg-[#f3f4f6]"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="min-w-[48px] text-center text-sm font-medium text-[#1f2937]">{calYear}</span>
                  <button type="button" onClick={() => setCalYear((y) => y + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#ddd8da] bg-white text-[#4b5563] hover:bg-[#f3f4f6]"><ChevronRight className="h-4 w-4" /></button>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 text-center text-xs font-medium text-[#8b97a8]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map((cell, idx) => {
                    if (!cell) return <div key={`empty-${idx}`} />;
                    const isToday = cell.dateStr === dateInputFromDate(new Date());
                    const isSelected = cell.dateStr === selectedDate;
                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(isSelected ? null : cell.dateStr)}
                        className={`mx-auto my-0.5 grid h-9 w-9 place-items-center rounded-lg text-sm transition ${
                          isSelected
                            ? "bg-[#8b3d4a] font-semibold text-white"
                            : isToday
                              ? "border border-[#c98d98] font-semibold text-[#7b2f3b]"
                              : "text-[#374151] hover:bg-[#f7f3f4]"
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
                {selectedDate && (
                  <div className="mt-3 rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] px-3 py-2 text-xs text-[#6b7280]">
                    Selected: <span className="font-medium text-[#1f2937]">{formatDayLabel(selectedDate)}</span>
                  </div>
                )}

                {/* Booking Trends Line Graph */}
                <div className="mt-5 border-t border-[#e8e2e3] pt-5">
                  <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                    <h4 className="text-lg font-bold text-[#1f2937]">Booking Trends</h4>
                    <div className="flex flex-wrap items-end gap-2">
                      <select value={chartPreset} onChange={(event) => setChartPreset(event.target.value as ChartPreset)} className="rounded-lg border border-[#ddd8da] bg-white px-2 py-1 text-xs text-[#1f2937]"><option value="7d">7d</option><option value="30d">30d</option><option value="90d">90d</option><option value="custom">Custom</option></select>
                      <input type="date" value={chartFrom} onChange={(event) => { setChartPreset("custom"); setChartFrom(event.target.value); }} className="rounded-lg border border-[#ddd8da] bg-white px-2 py-1 text-xs text-[#1f2937]" />
                      <input type="date" value={chartTo} onChange={(event) => { setChartPreset("custom"); setChartTo(event.target.value); }} className="rounded-lg border border-[#ddd8da] bg-white px-2 py-1 text-xs text-[#1f2937]" />
                    </div>
                  </div>
                  <div>{chartLoading ? <div className="grid h-[260px] place-items-center rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] text-sm text-[#5b6374]"><Loader2 className="h-4 w-4 animate-spin" /></div> : <VendorLineChart points={chartData?.days ?? []} />}</div>
                </div>
              </article>

              {/* Revenue Snapshot */}
              <article className="rounded-[24px] border border-[#e7e3e5] bg-white p-[22px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-[18px]">
                  <div>
                    <h3 className="text-[22px] font-extrabold text-[#1f2937]">Revenue Snapshot</h3>
                    <p className="text-[13px] text-[#667085]">
                      {selectedDate && daySnapshot ? formatDayLabel(selectedDate) : selectedDate && dayLoading ? "Loading..." : "All time overview"}
                    </p>
                  </div>
                  <Link to="/vendor/reservations" className="rounded-[14px] border border-[#ead3d8] bg-[#f8ecee] px-3.5 py-2.5 text-sm font-bold text-[#8f3d56] transition hover:bg-[#f4dfe3]">
                    Open List
                  </Link>
                </div>

                {dayLoading ? (
                  <div className="grid place-items-center py-14"><Loader2 className="h-5 w-5 animate-spin text-[#8b3d4a]" /></div>
                ) : selectedDate && daySnapshot ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Total", value: daySnapshot.total },
                        { label: "Pending", value: daySnapshot.pending },
                        { label: "Confirmed", value: daySnapshot.confirmed },
                        { label: "Completed", value: daySnapshot.completed },
                        { label: "Cancelled", value: daySnapshot.cancelled },
                        { label: "Paid", value: daySnapshot.paid },
                      ].map((item) => (
                        <div key={item.label} className="rounded-[18px] border border-[#e7e3e5] bg-[#fcfafb] p-4">
                          <div className="text-xs text-[#667085]">{item.label}</div>
                          <div className="mt-1 text-xl font-extrabold text-[#1f2937]">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-[18px] border border-[#e7e3e5] bg-[#fcfafb] p-4">
                      <div className="text-[#667085]">Revenue</div>
                      <div className="mt-2 text-3xl font-extrabold text-[#7b2f3b]">{toCurrency(daySnapshot.revenueMinor)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-[14px]">
                    {[
                      { label: "Reservations Today", value: String(overview?.reservationCount ?? 0), sub: "Total active bookings" },
                      { label: "Pending Requests", value: String(overview?.pendingCount ?? 0), sub: "Needs response" },
                      { label: "Collected Fees", value: toCurrency(overview?.totalPaidAmountMinor ?? 0), sub: "Estimated monthly" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[18px] border border-[#e7e3e5] bg-[#fcfafb] p-4">
                        <div className="flex items-center justify-between text-[#667085]"><span>{item.label}</span></div>
                        <div className="mt-2 text-2xl font-extrabold text-[#1f2937]">{item.value}</div>
                        <div className="mt-1 text-xs text-[#667085]">{item.sub}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 space-y-2">
                  <Link to="/vendor/reservations" className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#c98d98] bg-[#f8ecee] px-4 py-2.5 text-sm font-bold text-[#7b2f3b]"><Settings2 className="h-4 w-4" />Open Reservation List</Link>
                  <Link to="/vendor/tables" className="flex w-full items-center justify-center rounded-[14px] border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-bold text-[#374151]">Manage Tables & Best Sellers</Link>
                </div>
              </article>
            </section>

            {/* Best Sellers Table Panel */}
            <section className="rounded-[24px] border border-[#e7e3e5] bg-white p-[22px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-[22px] font-extrabold text-[#1f2937]">Best Sellers</h3>
                  <p className="text-[13px] text-[#667085]">Top performing menu items across your restaurant.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleExportInventoryCsv} className="rounded-[14px] border border-[#ead3d8] bg-[#f8ecee] px-3.5 py-2.5 text-sm font-bold text-[#8f3d56]"><Download className="mr-1 inline-block h-3.5 w-3.5" />Export</button>
                  <Link to="/vendor/tables" className="rounded-[14px] border border-[#d8dbe2] bg-white px-3.5 py-2.5 text-sm font-bold text-[#374151]"><Settings2 className="mr-1 inline-block h-3.5 w-3.5" />Manage</Link>
                </div>
              </div>

              {topBestSellers.length === 0 ? (
                <div className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 text-sm text-[#5b6374]">No best sellers added yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-[#e7e3e5] px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-[1px] text-[#8d8d98]">Item</th>
                        <th className="border-b border-[#e7e3e5] px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-[1px] text-[#8d8d98]">Restaurant</th>
                        <th className="border-b border-[#e7e3e5] px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-[1px] text-[#8d8d98]">Price</th>
                        <th className="border-b border-[#e7e3e5] px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-[1px] text-[#8d8d98]">Sold</th>
                        <th className="border-b border-[#e7e3e5] px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-[1px] text-[#8d8d98]">Stock</th>
                        <th className="border-b border-[#e7e3e5] px-3 py-3.5 text-left text-xs font-semibold uppercase tracking-[1px] text-[#8d8d98]">Est. Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBestSellers.slice(0, 10).map((item) => (
                        <tr key={item.id}>
                          <td className="border-b border-[#efedf0] px-3 py-4 text-sm font-bold text-[#1f2937]">{item.name}</td>
                          <td className="border-b border-[#efedf0] px-3 py-4 text-sm text-[#667085]">{item.restaurantName || "—"}</td>
                          <td className="border-b border-[#efedf0] px-3 py-4 text-sm text-[#1f2937]">{toCurrency(item.priceMinor)}</td>
                          <td className="border-b border-[#efedf0] px-3 py-4 text-sm font-bold text-[#1f2937]">{item.soldCount}</td>
                          <td className="border-b border-[#efedf0] px-3 py-4 text-sm text-[#1f2937]">{item.stockQuantity}</td>
                          <td className="border-b border-[#efedf0] px-3 py-4 text-sm font-bold text-[#7b2f3b]">{toCurrency(item.priceMinor * item.soldCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </VendorPageReveal>
        )}
      </div>
    </div>
  );
}


