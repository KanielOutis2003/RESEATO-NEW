import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldX,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  getVendorCharts,
  getVendorOverview,
  listVendorRestaurants,
  listVendorReservations,
} from "../lib/api/vendor.api";
import type {
  VendorChartsResponse,
  VendorOverview,
  VendorReservation,
  VendorRestaurant,
} from "../lib/api/vendor.api";
import VendorPageReveal from "../components/vendor/VendorPageReveal";

/* ── helpers ── */

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

const SERIES = [
  { key: "total" as const, label: "Reservations", color: "#8b3d4a" },
  { key: "completed" as const, label: "Completed", color: "#2563eb" },
  { key: "cancelled" as const, label: "Cancelled", color: "#dc2626" },
];

/* ── grouped bar chart ── */

function GroupedBarChart({
  days,
  preset,
}: {
  days: { date: string; total: number; completed: number; cancelled: number }[];
  preset: RangePreset;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const max = useMemo(() => Math.max(...days.map((d) => d.total), 1), [days]);

  // Y-axis grid lines
  const gridLines = useMemo(() => {
    const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 100 ? 10 : Math.ceil(max / 5 / 10) * 10;
    const lines: number[] = [];
    for (let v = step; v <= max; v += step) lines.push(v);
    return lines;
  }, [max]);

  // Format date label based on preset density
  function fmtDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    if (preset === "7d") return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    if (preset === "30d") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // Show every Nth label to avoid overlap
  const labelEvery = preset === "7d" ? 1 : preset === "30d" ? 3 : 7;

  // Trend vs previous period
  const halfLen = Math.floor(days.length / 2);
  const recentTotal = days.slice(halfLen).reduce((s, d) => s + d.total, 0);
  const prevTotal = days.slice(0, halfLen).reduce((s, d) => s + d.total, 0);
  const trendPct = prevTotal > 0 ? ((recentTotal - prevTotal) / prevTotal) * 100 : 0;
  const trendUp = trendPct >= 0;

  return (
    <div className="rounded-2xl border border-[#ece8e9] bg-white p-5 shadow-sm">
      {/* Chart header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#1f2937]">Daily Overview</h3>
          <p className="text-xs text-[#9ca3af] mt-0.5">Reservations, completed &amp; cancelled per day</p>
        </div>
        <div className="flex items-center gap-1.5">
          {trendPct !== 0 && (
            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${trendUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trendUp ? "+" : ""}{trendPct.toFixed(0)}% vs prev {halfLen}d
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] font-medium text-[#6b7280]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="relative" ref={chartRef}>
        {/* Y-axis grid */}
        <div className="absolute inset-0" style={{ bottom: 28 }}>
          {gridLines.map((v) => (
            <div key={v} className="absolute w-full flex items-center" style={{ bottom: `${(v / max) * 100}%` }}>
              <span className="absolute -left-1 -translate-x-full text-[10px] text-[#9ca3af] tabular-nums">{v}</span>
              <div className="w-full border-t border-dashed border-[#e5e7eb]" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="flex items-end gap-[2px] sm:gap-1" style={{ height: 220, paddingLeft: 32, paddingBottom: 28 }}>
          {days.map((d, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <div
                key={d.date}
                className="relative flex-1 flex items-end justify-center gap-[1px] cursor-pointer"
                style={{ height: "100%" }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Bars for each series */}
                {SERIES.map((s) => {
                  const val = d[s.key];
                  const h = max > 0 ? Math.max((val / max) * 100, val > 0 ? 3 : 0) : 0;
                  return (
                    <div
                      key={s.key}
                      className="flex-1 rounded-t-sm transition-all duration-200 relative"
                      style={{
                        height: `${h}%`,
                        backgroundColor: s.color,
                        opacity: isHovered ? 1 : 0.8,
                        maxWidth: 18,
                      }}
                    >
                      {/* Value on bar (only show on 7d or when hovered) */}
                      {val > 0 && (preset === "7d" || isHovered) && (
                        <span
                          className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold tabular-nums"
                          style={{ color: s.color }}
                        >
                          {val}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* X-axis label */}
                {(i % labelEvery === 0 || isHovered) && (
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-[#9ca3af] whitespace-nowrap tabular-nums">
                    {fmtDate(d.date)}
                  </span>
                )}

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 shadow-lg whitespace-nowrap">
                    <p className="text-[11px] font-bold text-[#374151] mb-1">
                      {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    {SERIES.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 text-[11px]">
                        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                        <span className="text-[#6b7280]">{s.label}:</span>
                        <span className="font-bold text-[#1f2937]">{d[s.key]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  const [declinedList, setDeclinedList] = useState<VendorReservation[]>([]);

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
      listVendorReservations({ status: "declined" }),
    ])
      .then(([c, o, r, declined]) => {
        if (!alive) return;
        setCharts(c);
        setOverview(o);
        setRestaurants(r);
        setDeclinedList(Array.isArray(declined) ? declined : []);
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

  function csvCell(v: string | number) {
    const t = String(v ?? "");
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }

  function handleExportCsv() {
    if (!days.length || !charts) return;
    const restoNames = restaurants.map((r) => r.name).join(", ") || "All Restaurants";
    const generatedAt = new Date().toLocaleString();
    const headers = ["date", "total", "pending", "confirmed", "completed", "cancelled", "paid", "completion_rate_pct", "cancellation_rate_pct"];
    const rows = days.map((d) => {
      const t = d.total || 0;
      return [d.date, t, d.pending, d.confirmed, d.completed, d.cancelled, d.paid, t > 0 ? ((d.completed / t) * 100).toFixed(2) : "0", t > 0 ? ((d.cancelled / t) * 100).toFixed(2) : "0"];
    });
    const meta = [
      "RESEATO - Vendor Analytics Report",
      `Restaurant: ${restoNames}`,
      `Report Period: ${charts.from} to ${charts.to}`,
      `Generated: ${generatedAt}`,
      `Total Reservations: ${summary?.totalReservations ?? 0}`,
      "",
    ];
    const csv = [...meta.map(csvCell), headers.map(csvCell).join(","), ...rows.map((r) => r.map((c) => csvCell(c as string | number)).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RESEATO-Vendor-Analytics-${charts.from}-to-${charts.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportExcel() {
    if (!days.length || !charts) return;
    const restoNames = restaurants.map((r) => r.name).join(", ") || "All Restaurants";
    const generatedAt = new Date().toLocaleString();
    const headers = ["Date", "Total", "Pending", "Confirmed", "Completed", "Cancelled", "Paid", "Completion %", "Cancellation %"];
    const colWidths = [90, 60, 70, 80, 80, 75, 55, 95, 105];
    const rows = days.map((d) => {
      const t = d.total || 0;
      return [d.date, t, d.pending, d.confirmed, d.completed, d.cancelled, d.paid, t > 0 ? Number(((d.completed / t) * 100).toFixed(2)) : 0, t > 0 ? Number(((d.cancelled / t) * 100).toFixed(2)) : 0];
    });
    const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '<Styles>';
    xml += '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#8b3d4a"/></Style>';
    xml += '<Style ss:ID="meta"><Font ss:Size="11" ss:Color="#667085"/></Style>';
    xml += '<Style ss:ID="metaBold"><Font ss:Bold="1" ss:Size="11" ss:Color="#374151"/></Style>';
    xml += '<Style ss:ID="hdr"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF"/><Interior ss:Color="#8b3d4a" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>';
    xml += '<Style ss:ID="sum"><Font ss:Bold="1" ss:Size="10"/><Interior ss:Color="#FFF1F2" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>';
    xml += '<Style ss:ID="cell"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>';
    xml += '<Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>';
    xml += '<Style ss:ID="dateCell"><Alignment ss:Horizontal="Left"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>';
    xml += '</Styles>\n';
    xml += '<Worksheet ss:Name="Analytics Report">\n<Table>\n';
    for (const w of colWidths) xml += `<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`;
    xml += '\n';
    xml += `<Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">RESEATO - Vendor Analytics Report</Data></Cell></Row>\n`;
    xml += `<Row><Cell ss:StyleID="meta" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Restaurant: ${esc(restoNames)}</Data></Cell></Row>\n`;
    xml += `<Row><Cell ss:StyleID="meta" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Report Period: ${esc(charts.from)} to ${esc(charts.to)}</Data></Cell></Row>\n`;
    xml += `<Row><Cell ss:StyleID="meta" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Generated: ${esc(generatedAt)}</Data></Cell></Row>\n`;
    xml += `<Row><Cell ss:StyleID="metaBold" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Total Reservations: ${summary?.totalReservations ?? 0}  |  Completion: ${(summary?.completionRate ?? 0).toFixed(1)}%  |  Cancellation: ${(summary?.cancellationRate ?? 0).toFixed(1)}%</Data></Cell></Row>\n`;
    xml += "<Row></Row>\n";
    xml += "<Row>";
    for (const h of headers) xml += `<Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(h)}</Data></Cell>`;
    xml += "</Row>\n";
    for (const row of rows) {
      const cells = row.map((c, i) => {
        if (i === 0) return `<Cell ss:StyleID="dateCell"><Data ss:Type="String">${esc(c)}</Data></Cell>`;
        if (i >= headers.length - 2) return `<Cell ss:StyleID="num"><Data ss:Type="Number">${esc(c)}</Data></Cell>`;
        return `<Cell ss:StyleID="cell"><Data ss:Type="Number">${esc(c)}</Data></Cell>`;
      }).join("");
      xml += `<Row>${cells}</Row>\n`;
    }
    xml += "</Table>\n</Worksheet>\n</Workbook>";
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RESEATO-Vendor-Analytics-${charts.from}-to-${charts.to}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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
    <VendorPageReveal className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
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

        {/* Range picker + Export */}
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExportCsv} className="inline-flex items-center gap-1.5 rounded-xl border border-[#ead3d8] bg-[#f8ecee] px-3.5 py-2 text-sm font-bold text-[#8f3d56] transition hover:bg-[#f4dfe3]">
              <Download className="h-3.5 w-3.5" />CSV
            </button>
            <button type="button" onClick={handleExportExcel} className="inline-flex items-center gap-1.5 rounded-xl border border-[#ead3d8] bg-[#f8ecee] px-3.5 py-2 text-sm font-bold text-[#8f3d56] transition hover:bg-[#f4dfe3]">
              <FileSpreadsheet className="h-3.5 w-3.5" />Excel
            </button>
          </div>
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
          icon={<CheckCircle2 className="h-5 w-5 text-[#2563eb]" />}
          label="Completion Rate"
          value={`${(summary?.completionRate ?? 0).toFixed(1)}%`}
          sub={`${summary?.totalCompleted ?? 0} completed`}
          accent="#2563eb"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-[#dc2626]" />}
          label="Cancellation Rate"
          value={`${(summary?.cancellationRate ?? 0).toFixed(1)}%`}
          sub={`${summary?.totalCancelled ?? 0} cancelled`}
          accent="#dc2626"
        />
        <StatCard
          icon={<ShieldX className="h-5 w-5 text-[#9f1239]" />}
          label="Declined Rate"
          value={`${(summary?.declinedRate ?? 0).toFixed(1)}%`}
          sub={`${summary?.totalDeclined ?? 0} declined`}
          accent="#9f1239"
        />
      </div>

      {/* Grouped bar chart */}
      <GroupedBarChart days={days} preset={preset} />

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
            label="Cancelled"
            count={summary?.totalCancelled ?? 0}
            total={summary?.totalReservations ?? 0}
            color="#ef4444"
          />
          <StatusRow
            label="Declined"
            count={summary?.totalDeclined ?? 0}
            total={summary?.totalReservations ?? 0}
            color="#9f1239"
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

            {/* Cancellation warning */}
            {(summary?.cancellationRate ?? 0) > 20 && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
                <TrendingDown className="mt-0.5 h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-700">High Cancellation Rate</p>
                  <p className="text-xs text-red-600">
                    {(summary!.cancellationRate).toFixed(1)}% of reservations were cancelled. Consider following up with guests.
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

      {/* Declined Reservations */}
      <div className="rounded-2xl border border-[#ece8e9] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldX className="h-5 w-5 text-[#dc2626]" />
          <h2 className="text-base font-bold text-[#1f2937]">Declined Reservations</h2>
          <span className="ml-auto rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">{declinedList.length}</span>
        </div>

        {declinedList.length === 0 ? (
          <p className="text-sm text-[#9ca3af] py-4 text-center">No declined reservations.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="pb-2 pr-4">Guest</th>
                  <th className="pb-2 pr-4">Restaurant</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Guests</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {declinedList.map((r) => (
                  <tr key={r.id} className="border-b border-[#f3f4f6] last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-[#1f2937]">{r.name}</td>
                    <td className="py-2.5 pr-4 text-[#6b7280]">{r.restaurant?.name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-[#6b7280] whitespace-nowrap">
                      {new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-2.5 pr-4 text-[#6b7280] whitespace-nowrap">
                      {(() => { const [h, m] = r.time.split(":").map(Number); const s = h >= 12 ? "PM" : "AM"; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${s}`; })()}
                    </td>
                    <td className="py-2.5 pr-4 text-[#6b7280]">{r.guests}</td>
                    <td className="py-2.5 text-[#9f1239] text-xs">{r.decline_reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </VendorPageReveal>
  );
}
