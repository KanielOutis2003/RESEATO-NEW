import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  Filter,
  MapPin,
  Star,
  UsersRound,
  X,
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  Receipt,
  Download,
  CheckCircle,
} from "lucide-react";
import LuxuryNavbar from "../components/layouts/LuxuryNavbar";
import LuxuryFooter from "../components/layouts/LuxuryFooter";
import {
  listMyReservationsSupabase,
  cancelReservationSupabase,
  ReservationWithRestaurant,
} from "../lib/api/reservations.supabase";

const GOLD = "#d4b58a";
const CREAM = "#faf4ea";
const DARK_BG = "#130a0d";
const CARD_BG = "rgba(36,22,26,0.85)";
const CARD_BORDER = "1px solid rgba(212,181,138,0.22)";
const GOLD_BORDER = "1px solid rgba(212,181,138,0.35)";
const TEXT_MUTED = "rgba(250,244,234,0.72)";
const TEXT_DIM = "rgba(250,244,234,0.55)";
const SERIF = "'Cormorant Garamond', serif";
const SANS = "'Jost', sans-serif";

type StatusFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled" | "receipts";

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "receipts", label: "Receipts" },
];

function normalizeStatus(status: string | undefined) {
  return (status ?? "pending").toLowerCase();
}

function normalizePaymentStatus(status: string | undefined | null) {
  const value = String(status ?? "unpaid").toLowerCase();
  if (value === "processing") return "processing";
  if (value === "paid") return "paid";
  if (value === "failed") return "failed";
  if (value === "cancelled") return "cancelled";
  return "unpaid";
}

function toTimeLabel(raw: string) {
  return String(raw).slice(0, 5);
}

function to12Hour(raw: string) {
  const hhmm = String(raw).slice(0, 5);
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function toPrettyDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function toDateOnly(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function sortByDateTime(rows: ReservationWithRestaurant[]) {
  return [...rows].sort((a, b) => {
    const da = new Date(`${a.date}T${toTimeLabel(a.time)}:00`).getTime();
    const db = new Date(`${b.date}T${toTimeLabel(b.time)}:00`).getTime();
    return da - db;
  });
}

function statusPillStyle(status: string): React.CSSProperties {
  const s = normalizeStatus(status);
  if (s === "confirmed")
    return { background: "rgba(94,210,140,0.18)", color: "#9ef2c1", border: "1px solid rgba(158,242,193,0.45)" };
  if (s === "completed")
    return { background: "rgba(120,175,240,0.18)", color: "#c4dcf6", border: "1px solid rgba(196,220,246,0.45)" };
  if (s === "cancelled")
    return { background: "rgba(224,105,115,0.18)", color: "#f5a7ad", border: "1px solid rgba(245,167,173,0.45)" };
  return { background: "rgba(212,181,138,0.18)", color: GOLD, border: "1px solid rgba(212,181,138,0.45)" };
}

function paymentPillStyle(paymentStatus: string): React.CSSProperties {
  if (paymentStatus === "paid")
    return { background: "rgba(94,210,140,0.18)", color: "#9ef2c1", border: "1px solid rgba(158,242,193,0.45)" };
  if (paymentStatus === "processing")
    return { background: "rgba(120,175,240,0.18)", color: "#c4dcf6", border: "1px solid rgba(196,220,246,0.45)" };
  if (paymentStatus === "failed")
    return { background: "rgba(224,105,115,0.18)", color: "#f5a7ad", border: "1px solid rgba(245,167,173,0.45)" };
  if (paymentStatus === "cancelled")
    return { background: "rgba(160,92,100,0.22)", color: "#e6bfc4", border: "1px solid rgba(230,191,196,0.4)" };
  return { background: "rgba(212,181,138,0.18)", color: GOLD, border: "1px solid rgba(212,181,138,0.45)" };
}

/* ── Canvas-based receipt image download ── */
function downloadReceiptAsImage(config: {
  provider: { accent: string; logo: string; label: string };
  amount: string | null;
  refNo: string;
  restaurant: string;
  location: string;
  dateLabel: string;
  timeLabel: string;
  guests: number;
  bookingId: string;
  txnDate: string;
}) {
  const { provider, amount, refNo, restaurant, location, dateLabel, timeLabel, guests, bookingId, txnDate } = config;
  const W = 440;
  const H = 780;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Provider header
  ctx.fillStyle = provider.accent;
  ctx.fillRect(0, 0, W, 150);

  // Logo circle
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(W / 2, 50, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(provider.logo, W / 2, 51);

  // Provider label
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(provider.label, W / 2, 100);

  // "Payment Receipt"
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Payment Receipt", W / 2, 125);

  // Success check badge
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(W / 2, 155, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 8, 155);
  ctx.lineTo(W / 2 - 2, 162);
  ctx.lineTo(W / 2 + 10, 148);
  ctx.stroke();

  // Amount paid label
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("AMOUNT PAID", W / 2, 200);

  // Amount
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(amount ?? "—", W / 2, 235);

  // Successful badge
  const badgeW = 96;
  const badgeH = 24;
  const badgeX = W / 2 - badgeW / 2;
  const badgeY = 260;
  ctx.fillStyle = "#dcfce7";
  ctx.beginPath();
  const r = 12;
  ctx.moveTo(badgeX + r, badgeY);
  ctx.lineTo(badgeX + badgeW - r, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH);
  ctx.lineTo(badgeX + r, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
  ctx.lineTo(badgeX, badgeY + r);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
  ctx.fill();
  ctx.fillStyle = "#16a34a";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("Successful", W / 2, badgeY + badgeH / 2 + 1);

  // Dashed divider
  function dashedLine(y: number) {
    ctx!.strokeStyle = "#e5e7eb";
    ctx!.lineWidth = 2;
    ctx!.setLineDash([6, 6]);
    ctx!.beginPath();
    ctx!.moveTo(30, y);
    ctx!.lineTo(W - 30, y);
    ctx!.stroke();
    ctx!.setLineDash([]);
    // side notches
    ctx!.fillStyle = "#f3f3f4";
    ctx!.beginPath();
    ctx!.arc(0, y, 12, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.beginPath();
    ctx!.arc(W, y, 12, 0, Math.PI * 2);
    ctx!.fill();
  }
  dashedLine(310);

  // Details rows
  const rows: Array<[string, string]> = [
    ["Ref. No.", refNo],
    ["Paid To", "RESEATO"],
    ["Restaurant", restaurant],
    ["Location", location.length > 30 ? location.slice(0, 30) + "..." : location],
    ["Date & Time", `${dateLabel}, ${timeLabel}`],
    ["Guests", String(guests)],
    ["Payment Method", provider.label],
    ["Transaction Date", txnDate],
    ["Booking ID", bookingId.slice(0, 18) + (bookingId.length > 18 ? "..." : "")],
  ];
  let y = 345;
  ctx.textBaseline = "middle";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  for (const [label, value] of rows) {
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "left";
    ctx.fillText(label, 32, y);
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "right";
    if (label === "Payment Method") {
      ctx.fillStyle = provider.accent;
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    } else {
      ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    }
    ctx.fillText(value, W - 32, y);
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    y += 28;
  }

  dashedLine(y + 8);

  // Thank you
  ctx.fillStyle = "#6b7280";
  ctx.font = "italic 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Thank you for dining with RESEATO!", W / 2, y + 40);

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${provider.label}-Receipt-${refNo}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function CancelConfirmModal({
  open,
  restaurantName,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  restaurantName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-sm"
          style={{ background: "rgba(5,2,3,0.75)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-md rounded-[24px] p-6"
            style={{
              background: "rgba(16,8,10,0.96)",
              border: GOLD_BORDER,
              boxShadow: "0 28px 60px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
                style={{ background: "rgba(201,74,85,0.15)", color: "#e88b93", border: "1px solid rgba(232,139,147,0.35)" }}
              >
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>
                  Cancel Reservation
                </h3>
                <p className="text-xs tracking-wider uppercase" style={{ color: "rgba(250,244,234,0.5)", fontFamily: SANS }}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm" style={{ color: "rgba(250,244,234,0.7)", fontFamily: SANS }}>
              Are you sure you want to cancel your reservation at{" "}
              <span className="font-semibold" style={{ color: GOLD }}>{restaurantName}</span>?
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-xl px-4 py-2.5 text-sm font-medium transition hover:brightness-110"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: GOLD_BORDER,
                  color: CREAM,
                  fontFamily: SANS,
                }}
              >
                No, keep it
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#fff",
                  fontFamily: SANS,
                }}
              >
                {loading ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const providerThemes: Record<string, { bg: string; accent: string; logo: string; label: string }> = {
  gcash: { bg: "bg-[#007dfe]", accent: "#007dfe", logo: "G", label: "GCash" },
  paymaya: { bg: "bg-[#00b900]", accent: "#00b900", logo: "M", label: "Maya" },
  maya: { bg: "bg-[#00b900]", accent: "#00b900", logo: "M", label: "Maya" },
  gotyme: { bg: "bg-[#ff6b00]", accent: "#ff6b00", logo: "GT", label: "GoTyme" },
};
const defaultTheme = { bg: "bg-[#8b3d4a]", accent: "#923f4a", logo: "R", label: "RESEATO" };

function ReceiptModal({
  open,
  onClose,
  reservation,
}: {
  open: boolean;
  onClose: () => void;
  reservation: ReservationWithRestaurant | null;
}) {
  if (!open || !reservation) return null;

  const provider = String(reservation.payment_provider ?? "").toLowerCase();
  const theme = providerThemes[provider] ?? defaultTheme;
  const refNo = `RS${reservation.id.slice(0, 8).toUpperCase()}`;
  const txnDate = reservation.payment_paid_at
    ? new Date(reservation.payment_paid_at).toLocaleString("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleString("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const amount = reservation.payment_amount != null
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(Number(reservation.payment_amount) / 100)
    : null;

  function handleDownload() {
    if (!reservation) return;
    downloadReceiptAsImage({
      provider: { accent: theme.accent, logo: theme.logo, label: theme.label },
      amount,
      refNo,
      restaurant: reservation.restaurant?.name ?? "N/A",
      location: reservation.restaurant?.location ?? "N/A",
      dateLabel: reservation.date,
      timeLabel: to12Hour(reservation.time),
      guests: reservation.guests,
      bookingId: reservation.id,
      txnDate,
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-sm"
          style={{ background: "rgba(5,2,3,0.75)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white"
            style={{ boxShadow: "0 28px 60px rgba(0,0,0,0.4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Provider Header */}
            <div className={`${theme.bg} px-6 py-5 text-center text-white`}>
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/25 text-lg font-extrabold">
                {theme.logo}
              </div>
              <div className="text-lg font-bold tracking-wide">{theme.label}</div>
              <div className="mt-1 text-sm opacity-90">Payment Receipt</div>
            </div>

            {/* Success Badge */}
            <div className="flex justify-center -mt-4">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#22c55e] text-white shadow-md ring-4 ring-white">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>

            {/* Amount */}
            <div className="mt-3 text-center">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">Amount Paid</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">{amount ?? "—"}</div>
              <div className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">
                Successful
              </div>
            </div>

            {/* Tear line */}
            <div className="relative my-4">
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
              <div className="mx-5 border-t-2 border-dashed border-gray-200" />
            </div>

            {/* Details */}
            <div className="space-y-2.5 px-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Ref. No.</span>
                <span className="font-mono text-xs font-semibold text-gray-900">{refNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Paid To</span>
                <span className="font-medium text-gray-900">RESEATO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Restaurant</span>
                <span className="max-w-[180px] truncate text-right font-medium text-gray-900">
                  {reservation.restaurant?.name ?? "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date & Time</span>
                <span className="font-medium text-gray-900">
                  {reservation.date}, {to12Hour(reservation.time)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Guests</span>
                <span className="font-medium text-gray-900">{reservation.guests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-semibold" style={{ color: theme.accent }}>
                  {theme.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Transaction Date</span>
                <span className="text-xs text-gray-900">{txnDate}</span>
              </div>
            </div>

            {/* Tear line */}
            <div className="relative my-4">
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
              <div className="mx-5 border-t-2 border-dashed border-gray-200" />
            </div>

            {/* Buttons */}
            <div className="space-y-2.5 px-6 pb-5">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:brightness-110"
                style={{ background: theme.accent }}
              >
                <Download className="mr-2 inline h-4 w-4" />
                Download Receipt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function MyReservationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReservationWithRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancelTarget, setCancelTarget] = useState<ReservationWithRestaurant | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<ReservationWithRestaurant | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await listMyReservationsSupabase();
        if (!alive) return;
        setItems(data);
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message ?? "Failed to load reservations");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const statusCount = useMemo(() => {
    return items.reduce<Record<StatusFilter, number>>(
      (acc, row) => {
        const s = normalizeStatus(row.status) as StatusFilter;
        if (s in acc) acc[s] += 1;
        acc.all += 1;
        const ps = normalizePaymentStatus(row.payment_status ?? null);
        if (ps === "paid") acc.receipts += 1;
        return acc;
      },
      { all: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, receipts: 0 },
    );
  }, [items]);

  const visibleItems = useMemo(() => {
    if (statusFilter === "receipts") {
      return sortByDateTime(
        items.filter((row) => normalizePaymentStatus(row.payment_status ?? null) === "paid"),
      );
    }

    const byStatus =
      statusFilter === "all"
        ? items
        : items.filter((row) => normalizeStatus(row.status) === statusFilter);

    if (statusFilter !== "all") return sortByDateTime(byStatus);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sortByDateTime(
      byStatus.filter((row) => {
        const s = normalizeStatus(row.status);
        if (s === "completed" || s === "cancelled") return false;

        const d = toDateOnly(row.date);
        if (!d) return true;
        return d >= today;
      }),
    );
  }, [items, statusFilter]);

  const sectionTitle =
    statusFilter === "all"
      ? "Upcoming Reservations"
      : statusFilter === "receipts"
        ? "Paid Receipts"
        : `${statusFilter[0].toUpperCase()}${statusFilter.slice(1)} Reservations`;

  async function onCancelConfirm() {
    if (!cancelTarget) return;
    setCancelling(true);
    setMsg(null);

    try {
      const updated = await cancelReservationSupabase(cancelTarget.id);
      setItems((prev) => prev.map((row) => (row.id === cancelTarget.id ? updated : row)));
      setCancelTarget(null);
      setMsg("Reservation cancelled successfully.");
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg(e?.message ?? "Cancel failed");
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <CancelConfirmModal
        open={Boolean(cancelTarget)}
        restaurantName={cancelTarget?.restaurant?.name ?? "this restaurant"}
        loading={cancelling}
        onConfirm={onCancelConfirm}
        onCancel={() => setCancelTarget(null)}
      />
      <ReceiptModal
        open={Boolean(receiptTarget)}
        onClose={() => setReceiptTarget(null)}
        reservation={receiptTarget}
      />

      <div
        className="relative min-h-screen w-full"
        style={{
          background: `radial-gradient(ellipse at top, rgba(180,109,115,0.08), transparent 60%), ${DARK_BG}`,
          color: CREAM,
          fontFamily: SANS,
        }}
      >
        <LuxuryNavbar />

        <section className="mx-auto max-w-[1480px] px-6 sm:px-10 lg:px-14 py-10 sm:py-14">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[0.2em] uppercase transition hover:brightness-125"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: GOLD_BORDER,
              color: GOLD,
              fontFamily: SANS,
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="mt-8 flex items-start gap-5">
            <div
              className="grid h-16 w-16 place-items-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #b46d73, #923f4a)",
                boxShadow: "0 18px 40px rgba(146,63,74,0.35)",
              }}
            >
              <CalendarDays className="h-8 w-8 text-white" />
            </div>

            <div>
              <div
                className="text-[11px] tracking-[0.3em] uppercase mb-2"
                style={{ color: GOLD }}
              >
                Your Journey
              </div>
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-light leading-none"
                style={{ color: CREAM, fontFamily: SERIF, letterSpacing: "-0.01em" }}
              >
                My Reservations
              </h1>
              <p
                className="mt-3 text-sm"
                style={{ color: "rgba(250,244,234,0.55)" }}
              >
                Manage your curated dining experiences
              </p>
            </div>
          </div>

          {msg && (
            <div
              className="mt-8 rounded-2xl px-5 py-3.5 text-sm"
              style={
                msg.toLowerCase().includes("success")
                  ? {
                      background: "rgba(76,175,115,0.10)",
                      border: "1px solid rgba(125,217,166,0.3)",
                      color: "#9be3bb",
                    }
                  : {
                      background: "rgba(201,74,85,0.10)",
                      border: "1px solid rgba(232,139,147,0.3)",
                      color: "#e88b93",
                    }
              }
            >
              {msg}
            </div>
          )}

          {/* Filter Card */}
          <div
            className="mt-10 rounded-3xl p-6 sm:p-7"
            style={{
              background: CARD_BG,
              border: CARD_BORDER,
              backdropFilter: "blur(12px)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="inline-flex items-center gap-2.5 text-sm tracking-[0.2em] uppercase"
                style={{ color: GOLD }}
              >
                <Filter className="h-4 w-4" />
                Filter by Status
              </div>
              <div className="text-xs tracking-wider uppercase" style={{ color: "rgba(250,244,234,0.5)" }}>
                {visibleItems.length} reservation{visibleItems.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const isActive = statusFilter === filter.key;

                return (
                  <button
                    key={filter.key}
                    onClick={() => setStatusFilter(filter.key)}
                    className="rounded-full px-4 py-2 text-xs tracking-[0.15em] uppercase transition hover:brightness-125"
                    style={
                      isActive
                        ? {
                            background: "linear-gradient(135deg, #b46d73, #923f4a)",
                            color: "#fff",
                            border: "1px solid rgba(201,160,122,0.4)",
                            boxShadow: "0 10px 24px rgba(146,63,74,0.3)",
                          }
                        : {
                            background: "rgba(255,255,255,0.03)",
                            color: "rgba(250,244,234,0.65)",
                            border: "1px solid rgba(201,160,122,0.15)",
                          }
                    }
                  >
                    {filter.label}
                    {filter.key !== "all" ? ` (${statusCount[filter.key]})` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-12 mb-6 flex items-center gap-4">
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(201,160,122,0.3), transparent)" }} />
            <h2
              className="text-3xl sm:text-4xl font-light tracking-tight"
              style={{ color: CREAM, fontFamily: SERIF }}
            >
              {sectionTitle}
            </h2>
            <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(201,160,122,0.3), transparent)" }} />
          </div>

          {loading ? (
            <div
              className="rounded-3xl p-8 text-center text-sm"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                color: "rgba(250,244,234,0.55)",
              }}
            >
              Loading reservations...
            </div>
          ) : visibleItems.length === 0 ? (
            <div
              className="rounded-3xl p-8 text-center text-sm"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                color: "rgba(250,244,234,0.55)",
              }}
            >
              No reservations found for this status.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {visibleItems.map((row) => {
                const status = normalizeStatus(row.status);
                const paymentStatus = normalizePaymentStatus(row.payment_status ?? null);
                const canPay =
                  status !== "cancelled" &&
                  status !== "completed" &&
                  paymentStatus !== "paid";

                return (
                  <motion.article
                    key={row.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="rounded-3xl p-6"
                    style={{
                      background: CARD_BG,
                      border: CARD_BORDER,
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-2xl sm:text-[28px] font-light leading-tight truncate"
                          style={{ color: CREAM, fontFamily: SERIF }}
                        >
                          {row.restaurant?.name ?? `Restaurant ${row.restaurant_id}`}
                        </h3>
                        {row.restaurant?.rating != null && Number(row.restaurant.rating) > 0 && (
                          <div
                            className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{
                              background: "rgba(201,160,122,0.12)",
                              border: "1px solid rgba(201,160,122,0.35)",
                              color: GOLD,
                            }}
                          >
                            <Star className="h-3 w-3" style={{ fill: GOLD, color: GOLD }} />
                            {Number(row.restaurant.rating).toFixed(1)}
                          </div>
                        )}
                        <p
                          className="mt-2 text-[11px] tracking-wider uppercase truncate"
                          style={{ color: "rgba(250,244,234,0.4)" }}
                        >
                          Booking ID · {row.id}
                        </p>
                      </div>

                      <span
                        className="shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
                        style={statusPillStyle(status)}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,160,122,0.12)" }}
                      >
                        <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>
                          <CalendarDays className="h-3.5 w-3.5" />
                          Date
                        </div>
                        <div className="mt-1 text-lg font-light" style={{ color: CREAM, fontFamily: SERIF }}>
                          {toPrettyDate(row.date)}
                        </div>
                      </div>

                      <div
                        className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,160,122,0.12)" }}
                      >
                        <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>
                          <Clock3 className="h-3.5 w-3.5" />
                          Time
                        </div>
                        <div className="mt-1 text-lg font-light" style={{ color: CREAM, fontFamily: SERIF }}>
                          {to12Hour(row.time)}
                        </div>
                      </div>

                      <div
                        className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,160,122,0.12)" }}
                      >
                        <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>
                          <UsersRound className="h-3.5 w-3.5" />
                          Guests
                        </div>
                        <div className="mt-1 text-lg font-light" style={{ color: CREAM, fontFamily: SERIF }}>
                          {row.guests} {row.guests === 1 ? "Person" : "People"}
                        </div>
                      </div>

                      <div
                        className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,160,122,0.12)" }}
                      >
                        <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>
                          <MapPin className="h-3.5 w-3.5" />
                          Location
                        </div>
                        <div className="mt-1 truncate text-sm" style={{ color: CREAM }}>
                          {row.restaurant?.location ?? "Location not available"}
                        </div>
                      </div>
                    </div>

                    <div
                      className="mt-4 rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,160,122,0.12)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                          Payment
                        </span>
                        <span
                          className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
                          style={paymentPillStyle(paymentStatus)}
                        >
                          {paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      {canPay && (
                        <Link
                          to={`/payment/${row.id}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-[0.15em] uppercase transition hover:brightness-110"
                          style={{
                            background: "linear-gradient(135deg, #b46d73, #923f4a)",
                            color: "#fff",
                            border: "1px solid rgba(201,160,122,0.4)",
                            boxShadow: "0 10px 24px rgba(146,63,74,0.3)",
                          }}
                        >
                          <CreditCard className="h-4 w-4" />
                          Pay Fee
                        </Link>
                      )}

                      <button
                        onClick={() => setCancelTarget(row)}
                        disabled={status !== "pending"}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-[0.15em] uppercase transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: GOLD_BORDER,
                          color: CREAM,
                        }}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>

                      {paymentStatus === "paid" && (
                        <button
                          onClick={() => setReceiptTarget(row)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-[0.15em] uppercase transition hover:brightness-125"
                          style={{
                            background: "rgba(201,160,122,0.1)",
                            border: "1px solid rgba(201,160,122,0.4)",
                            color: GOLD,
                          }}
                        >
                          <Receipt className="h-4 w-4" />
                          View Receipt
                        </button>
                      )}
                    </div>

                    <div
                      className="mt-5 pt-4 text-xs"
                      style={{ borderTop: "1px solid rgba(201,160,122,0.12)", color: "rgba(250,244,234,0.5)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="tracking-wider uppercase">Restaurant</span>
                        <span style={{ color: CREAM }}>
                          {row.restaurant?.name ?? "Unavailable"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="tracking-wider uppercase">Location</span>
                        <span className="truncate max-w-[60%] text-right" style={{ color: CREAM }}>
                          {row.restaurant?.location ?? "Unavailable"}
                        </span>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>

        <LuxuryFooter />
      </div>
    </>
  );
}
