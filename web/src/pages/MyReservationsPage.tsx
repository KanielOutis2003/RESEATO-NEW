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
  MessageSquare,
  Receipt,
  Download,
  Send,
} from "lucide-react";
import {
  listMyReservationsSupabase,
  cancelReservationSupabase,
  ReservationWithRestaurant,
} from "../lib/api/reservations.supabase";

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

function statusPillClass(status: string) {
  const s = normalizeStatus(status);

  if (s === "confirmed") return "bg-[#e6f7ef] text-[#227a4c] border-[#bfe6d0]";
  if (s === "completed") return "bg-[#eaf4ff] text-[#1d5f93] border-[#bdd8f2]";
  if (s === "cancelled") return "bg-[#ffecec] text-[#a63d3d] border-[#f4c3c3]";

  return "bg-[#fff5e5] text-[#9a6a19] border-[#f0d5a5]";
}

function paymentPillClass(paymentStatus: string) {
  if (paymentStatus === "paid") return "bg-[#e6f7ef] text-[#227a4c] border-[#bfe6d0]";
  if (paymentStatus === "processing") return "bg-[#eaf4ff] text-[#1d5f93] border-[#bdd8f2]";
  if (paymentStatus === "failed") return "bg-[#ffecec] text-[#a63d3d] border-[#f4c3c3]";
  if (paymentStatus === "cancelled") return "bg-[#f8eef2] text-[#7f3a41] border-[#e8ccd5]";
  return "bg-[#fff5e5] text-[#9a6a19] border-[#f0d5a5]";
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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-md rounded-[24px] border border-[#e8e2e3] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#fff5f5] text-[#d14d5b]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1f2937]">Cancel Reservation</h3>
                <p className="text-sm text-[#667085]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-[#475467]">
              Are you sure you want to cancel your reservation at{" "}
              <span className="font-semibold text-[#1f2937]">{restaurantName}</span>?
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-xl border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#475467] transition hover:bg-[#f8fafc]"
              >
                No, keep it
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="rounded-xl bg-[#d14d5b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#be3a48] disabled:opacity-60"
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

function HelpModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (subject: string, message: string) => Promise<boolean>;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when modal re-opens
  useEffect(() => {
    if (open) {
      setSubject("");
      setMessage("");
      setSent(false);
      setSending(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const ok = await onSubmit(subject.trim(), message.trim());
      if (ok) {
        setSent(true);
      } else {
        setError("Failed to send report. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again later.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-lg rounded-[24px] border border-[#e8e2e3] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.18)] md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-[#e5e7eb] bg-[#f8fafc] text-[#6b7280] transition hover:bg-[#f1f1f3]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f8ecee] text-[#8b3d4a]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-[#1f2937]">Help &amp; Support</h2>
            </div>

            {sent ? (
              <div className="mt-6 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#ecfdf3] text-[#16a34a]">
                  <Send className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#1f2937]">Report Sent!</h3>
                <p className="mt-2 text-sm text-[#667085]">
                  Our admin team will review your report and get back to you via email.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(146,63,74,0.24)] hover:brightness-105"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <p className="text-sm text-[#667085]">
                  Having an issue? Send a report to our admin team and we&apos;ll help you out.
                </p>

                {error && (
                  <div className="rounded-xl border border-[#f0cdd4] bg-[#fff6f7] px-3 py-2 text-sm text-[#9f1239]">
                    {error}
                  </div>
                )}

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-[#4b5563]">Subject</span>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={sending}
                    className="w-full rounded-xl border border-[#ddd8da] bg-white px-3 py-2.5 text-sm text-[#111827] disabled:opacity-60"
                  >
                    <option value="">Select a topic...</option>
                    <option value="Reservation Issue">Reservation Issue</option>
                    <option value="Payment Problem">Payment Problem</option>
                    <option value="Restaurant Complaint">Restaurant Complaint</option>
                    <option value="Account Issue">Account Issue</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-[#4b5563]">Message</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    disabled={sending}
                    placeholder="Describe your issue in detail..."
                    className="w-full resize-none rounded-xl border border-[#ddd8da] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] disabled:opacity-60"
                  />
                </label>

                <button
                  type="submit"
                  disabled={!subject.trim() || !message.trim() || sending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(146,63,74,0.24)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Report
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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

  const paymentStatus = String(reservation.payment_status ?? "unpaid").toLowerCase();
  const isPaid = paymentStatus === "paid";

  function handleDownload() {
    if (!reservation) return;
    const r = reservation;
    const lines = [
      "===================================",
      "         RESEATO - RECEIPT         ",
      "===================================",
      "",
      `Booking ID:    ${r.id}`,
      `Restaurant:    ${r.restaurant?.name ?? "N/A"}`,
      `Location:      ${r.restaurant?.location ?? "N/A"}`,
      `Date:          ${r.date}`,
      `Time:          ${to12Hour(r.time)}`,
      `Guests:        ${r.guests}`,
      `Status:        ${r.status?.toUpperCase()}`,
      `Payment:       ${paymentStatus.toUpperCase()}`,
      "",
      "===================================",
      `Generated:     ${new Date().toLocaleString()}`,
      "Thank you for dining with RESEATO!",
      "===================================",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RESEATO-Receipt-${r.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-md rounded-[24px] border border-[#e8e2e3] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-[#e5e7eb] bg-[#f8fafc] text-[#6b7280] transition hover:bg-[#f1f1f3]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f8ecee] text-[#8b3d4a]">
                <Receipt className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-[#1f2937]">Receipt</h2>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-[#ece8e9] bg-[#fafafa] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Restaurant</span>
                <span className="font-medium text-[#1f2937]">{reservation.restaurant?.name ?? "N/A"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Booking ID</span>
                <span className="font-mono text-xs text-[#374151]">{reservation.id.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Date</span>
                <span className="font-medium text-[#1f2937]">{reservation.date}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Time</span>
                <span className="font-medium text-[#1f2937]">{to12Hour(reservation.time)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Guests</span>
                <span className="font-medium text-[#1f2937]">{reservation.guests}</span>
              </div>
              <div className="h-px bg-[#ece8e9]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Status</span>
                <span className="font-semibold uppercase text-[#1f2937]">{reservation.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Payment</span>
                <span className={`font-semibold uppercase ${isPaid ? "text-[#16a34a]" : "text-[#9a6a19]"}`}>
                  {paymentStatus}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#475467] transition hover:bg-[#f8fafc]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(146,63,74,0.24)] hover:brightness-105"
              >
                <Download className="h-4 w-4" />
                Download
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
  const [showHelp, setShowHelp] = useState(false);
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
    } catch (e: any) {
      setMsg(e?.message ?? "Cancel failed");
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  }

  async function onHelpSubmit(subject: string, message: string): Promise<boolean> {
    try {
      const { supabase } = await import("../lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        email: user.email,
        subject,
        message,
        status: "open",
      });
      return !error;
    } catch {
      return false;
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
    <HelpModal
      open={showHelp}
      onClose={() => setShowHelp(false)}
      onSubmit={onHelpSubmit}
    />
    <ReceiptModal
      open={Boolean(receiptTarget)}
      onClose={() => setReceiptTarget(null)}
      reservation={receiptTarget}
    />
    <div className="relative w-full bg-[#f3f3f4] text-[#1f2937]">
      <section className="mx-auto max-w-5xl px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-[#ddd7d9] bg-white px-4 py-2 text-sm text-[#6b7280] shadow-[0_6px_16px_rgba(15,23,42,0.06)] transition hover:text-[#7b2f3b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#d8c0c6] bg-white px-4 py-2 text-sm font-medium text-[#7b2f3b] shadow-[0_6px_16px_rgba(15,23,42,0.06)] transition hover:bg-[#f8ecee]"
          >
            <MessageSquare className="h-4 w-4" />
            Help &amp; Support
          </button>
        </div>

        <div className="mt-5 flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#8b3e46] to-[#6a2f35] text-white shadow-lg">
            <CalendarDays className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#1f2937]">
              My Reservations
            </h1>
            <p className="mt-1 text-[15px] text-[#667085]">
              Manage your restaurant bookings
            </p>
          </div>
        </div>

        {msg && (
          <div className="mt-6 rounded-2xl border border-[#f0cdd4] bg-[#fff6f7] px-4 py-3 text-sm text-[#9f1239]">
            {msg}
          </div>
        )}

        <div className="mt-7 rounded-3xl border border-[#e8e2e3] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 text-base font-semibold text-[#1f2937]">
              <Filter className="h-4 w-4 text-[#8b3e46]" />
              Filter by Status
            </div>
            <div className="text-sm text-[#667085]">
              {visibleItems.length} reservation
              {visibleItems.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const isActive = statusFilter === filter.key;

              return (
                <button
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    isActive
                      ? "border-[#c98d98] bg-[#8b3d4a] text-white shadow-[0_6px_18px_rgba(139,62,70,0.18)]"
                      : "border-[#e6e1e3] bg-[#faf7f8] text-[#5b6374] hover:bg-[#f5eff1]"
                  }`}
                >
                  {filter.label}
                  {filter.key !== "all" ? ` (${statusCount[filter.key]})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <h2 className="mt-8 text-3xl font-semibold tracking-tight text-[#1f2937]">
          {sectionTitle}
        </h2>

        {loading ? (
          <div className="mt-5 rounded-3xl border border-[#e8e2e3] bg-white p-6 text-[#6b7280] shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
            Loading reservations...
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-[#e8e2e3] bg-white p-6 text-[#6b7280] shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
            No reservations found for this status.
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {visibleItems.map((row) => {
              const status = normalizeStatus(row.status);
              const paymentStatus = normalizePaymentStatus(row.payment_status ?? null);
              const canPay =
                status !== "cancelled" &&
                status !== "completed" &&
                paymentStatus !== "paid";

              return (
                <article
                  key={row.id}
                  className="rounded-3xl border border-[#e8e2e3] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-[#1f2937]">
                        {row.restaurant?.name ?? `Restaurant ${row.restaurant_id}`}
                      </h3>
                      {row.restaurant?.rating != null && Number(row.restaurant.rating) > 0 && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#f0d5a5] bg-[#fff9ef] px-2.5 py-0.5 text-xs font-semibold text-[#9a6a19]">
                          <Star className="h-3 w-3 fill-[#f59e0b] text-[#f59e0b]" />
                          {Number(row.restaurant.rating).toFixed(1)}
                        </div>
                      )}
                      <p className="mt-1 text-sm text-[#6b7280]">
                        Booking ID: {row.id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusPillClass(status)}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-2 text-xs text-[#6b7280]">
                        <CalendarDays className="h-3.5 w-3.5 text-[#8b3e46]" />
                        Date
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[#1f2937]">
                        {toPrettyDate(row.date)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-2 text-xs text-[#6b7280]">
                        <Clock3 className="h-3.5 w-3.5 text-[#8b3e46]" />
                        Time
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[#1f2937]">
                        {to12Hour(row.time)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-2 text-xs text-[#6b7280]">
                        <UsersRound className="h-3.5 w-3.5 text-[#8b3e46]" />
                        Guests
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[#1f2937]">
                        {row.guests} {row.guests === 1 ? "Person" : "People"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-2 text-xs text-[#6b7280]">
                        <MapPin className="h-3.5 w-3.5 text-[#8b3e46]" />
                        Location
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-[#374151]">
                        {row.restaurant?.location ?? "Location not available"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-[#6b7280]">Payment</span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${paymentPillClass(paymentStatus)}`}
                      >
                        {paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {canPay && (
                      <Link
                        to={`/payment/${row.id}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d8c0c6] bg-[#f8ecee] px-4 py-2.5 text-sm font-medium text-[#7b2f3b] transition hover:bg-[#f2dde2]"
                      >
                        <CreditCard className="h-4 w-4" />
                        Pay Reservation Fee
                      </Link>
                    )}

                    <button
                      onClick={() => setCancelTarget(row)}
                      disabled={status !== "pending"}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d8c0c6] px-4 py-2.5 text-sm font-medium text-[#7b2f3b] transition hover:bg-[#f8ecee] disabled:cursor-not-allowed disabled:border-[#ece8e9] disabled:text-[#9ca3af] disabled:hover:bg-transparent"
                    >
                      <X className="h-4 w-4" />
                      Cancel Reservation
                    </button>

                    {paymentStatus === "paid" && (
                      <button
                        onClick={() => setReceiptTarget(row)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#bdd8f2] bg-[#eaf4ff] px-4 py-2.5 text-sm font-medium text-[#1d5f93] transition hover:bg-[#dbeafe]"
                      >
                        <Receipt className="h-4 w-4" />
                        View Receipt
                      </button>
                    )}
                  </div>

                  <div className="mt-4 border-t border-[#ece8e9] pt-3 text-sm text-[#667085]">
                    <div className="flex items-center justify-between">
                      <span>Restaurant</span>
                      <span className="font-medium text-[#1f2937]">
                        {row.restaurant?.name ?? "Unavailable"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Location</span>
                      <span className="font-medium text-[#1f2937]">
                        {row.restaurant?.location ?? "Unavailable"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-12 h-16 bg-[#ebecef]" />

      <footer className="border-t border-[#e8e2e3] bg-white text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <h3 className="text-3xl font-semibold tracking-wide">RESEATO</h3>
              <p className="mt-4 max-w-xs text-sm text-[#667085] leading-relaxed">
                Making restaurant reservations simple and elegant for Cebu's
                best dining spots.
              </p>
            </div>

            <div>
              <h4 className="text-xl font-semibold">Quick Links</h4>
              <div className="mt-4 space-y-2 text-sm text-[#667085]">
                <Link to="/restaurants" className="block hover:text-[#7b2f3b]">
                  Browse Restaurants
                </Link>
                <Link to="/my-reservations" className="block hover:text-[#7b2f3b]">
                  My Reservations
                </Link>
                <Link to="/" className="block hover:text-[#7b2f3b]">
                  Home
                </Link>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold">Contact</h4>
              <div className="mt-4 space-y-2 text-sm text-[#667085]">
                <p>SM Seaside, Cebu City</p>
                <p>support@reseato.com</p>
                <p>+63 123 456 7890</p>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-[#ece8e9] pt-6 text-center text-sm text-[#98a2b3]">
            � 2026 RESEATO. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}

