import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CheckCheck,
  Clock3,
  CreditCard,
  Eye,
  Loader2,
  Phone,
  Receipt,
  User,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import {
  decideVendorReservation,
  listVendorReservations,
  listVendorRestaurants,
  VendorReservation,
  VendorRestaurant,
} from "../lib/api/vendor.api";
import { ApiError } from "../lib/api/client";
import { useAuth } from "../lib/auth/useAuth";
import VendorPageReveal from "../components/vendor/VendorPageReveal";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload as { message?: string } | undefined;
    return payload?.message ?? fallback;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

function toPrettyDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function toPesoFromMinor(minor: number | null | undefined) {
  const value = Number(minor ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function to12Hour(raw: string) {
  const hhmm = String(raw).slice(0, 5);
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function normalizeStatus(status: string) {
  return String(status || "pending").toLowerCase();
}

function normalizePaymentStatus(status: string | null | undefined) {
  return String(status || "unpaid").toLowerCase();
}

function statusClass(status: string) {
  const value = normalizeStatus(status);

  if (value === "confirmed") return "border-[#b7e4c7] bg-[#ecfdf3] text-[#166534]";
  if (value === "declined") return "border-[#f5c2c7] bg-[#fff1f2] text-[#be123c]";
  if (value === "cancelled") return "border-[#e4d5d8] bg-[#faf6f7] text-[#6b5561]";
  if (value === "completed") return "border-[#c4def3] bg-[#eef7ff] text-[#1d4f7a]";

  return "border-[#f8d9a5] bg-[#fff7ed] text-[#b45309]";
}

function paymentStatusClass(status: string) {
  const value = normalizePaymentStatus(status);

  if (value === "paid") return "border-[#b7e4c7] bg-[#ecfdf3] text-[#166534]";
  if (value === "processing") return "border-[#f8d9a5] bg-[#fff7ed] text-[#b45309]";
  if (value === "failed") return "border-[#f5c2c7] bg-[#fff1f2] text-[#be123c]";
  if (value === "cancelled") return "border-[#e4d5d8] bg-[#faf6f7] text-[#6b5561]";

  return "border-[#d6dbe6] bg-[#f8fafc] text-[#475467]";
}

export default function VendorReservationsPage() {
  const { isAuthed, loading: authLoading } = useAuth();

  const [restaurants, setRestaurants] = useState<VendorRestaurant[]>([]);
  const [reservations, setReservations] = useState<VendorReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("No available table");
  const [restaurantIdFilter, setRestaurantIdFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }

    listVendorRestaurants()
      .then((data) => setRestaurants(Array.isArray(data) ? data : []))
      .catch((error) =>
        setMessage({ text: getErrorMessage(error, "Unable to load restaurants filter."), type: "error" }),
      );
  }, [isAuthed]);

  useEffect(() => {
    let alive = true;

    async function loadReservations() {
      if (!isAuthed) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setMessage(null);

        const data = await listVendorReservations({
          restaurantId: restaurantIdFilter || undefined,
          status: statusFilter,
          date: dateFilter || undefined,
        });

        if (!alive) return;
        setReservations(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!alive) return;
        setMessage({ text: getErrorMessage(error, "Unable to load reservations."), type: "error" });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadReservations();

    return () => {
      alive = false;
    };
  }, [dateFilter, isAuthed, restaurantIdFilter, statusFilter]);

  const pendingCount = useMemo(
    () => reservations.filter((reservation) => normalizeStatus(reservation.status) === "pending").length,
    [reservations],
  );

  async function handleDecision(
    reservationId: string,
    action: "approve" | "decline" | "complete",
  ) {
    if (action === "decline") {
      setDeclineTarget(reservationId);
      setDeclineReason("No available table");
      return;
    }

    try {
      setActingId(reservationId);
      setMessage(null);

      const result = await decideVendorReservation(reservationId, action);
      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === reservationId ? result.reservation : reservation,
        ),
      );
      setViewingId(null);
      setMessage({ text: result.message, type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ text: getErrorMessage(error, `Failed to ${action} reservation.`), type: "error" });
    } finally {
      setActingId(null);
    }
  }

  async function handleConfirmDecline() {
    if (!declineTarget) return;
    const id = declineTarget;
    setDeclineTarget(null);

    try {
      setActingId(id);
      setMessage(null);

      const result = await decideVendorReservation(id, "decline", declineReason || undefined);
      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === id ? result.reservation : reservation,
        ),
      );
      setViewingId(null);
      setMessage({ text: result.message, type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ text: getErrorMessage(error, "Failed to decline reservation."), type: "error" });
    } finally {
      setActingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="inline-flex items-center gap-2 text-[#5b6374]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking session...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="rounded-3xl border border-[#e8e2e3] bg-white p-6 text-[#4b5563]">
            Login is required to access vendor reservations.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b3d4a]">
            Vendor Portal
          </p>
          <h1 className="mt-2 text-5xl text-[#1f2937]">Reservation List</h1>
          <p className="mt-1 text-sm text-[#5b6374]">
            Approve or decline incoming reservations from your restaurants.
          </p>
        </header>

        {message && (
          <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-[#b7e4c7] bg-[#ecfdf3] text-[#166534]"
              : "border-[#f2cccf] bg-[#fff6f7] text-[#9f1239]"
          }`}>
            {message.text}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-[#e8e2e3] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm text-[#4b5563]">
              Restaurant
              <select
                value={restaurantIdFilter}
                onChange={(event) => setRestaurantIdFilter(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#ddd8da] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none"
              >
                <option value="">All restaurants</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[#4b5563]">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#ddd8da] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="declined">Declined</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className="text-sm text-[#4b5563]">
              Date
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#ddd8da] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none"
              />
            </label>

            <div className="rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] px-3 py-2.5 text-sm text-[#4b5563]">
              <div className="text-xs uppercase tracking-wide text-[#8b97a8]">
                Pending decisions
              </div>
              <div className="mt-1 text-2xl font-semibold text-[#1f2937]">{pendingCount}</div>
            </div>
          </div>
        </section>

        <section className="mt-5">
          {loading ? (
            <div className="rounded-3xl border border-[#e8e2e3] bg-white p-6 text-[#5b6374] shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading reservations...
              </div>
            </div>
          ) : (
            <VendorPageReveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {reservations.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-[#e8e2e3] bg-white p-6 text-[#6b7280] shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
              No reservations found.
            </div>
          ) : (
            reservations.map((reservation) => {
              const status = normalizeStatus(reservation.status);
              const isPending = status === "pending";
              const isActing = actingId === reservation.id;
              const paymentStatus = normalizePaymentStatus(reservation.payment_status);

              return (
                <article
                  key={reservation.id}
                  className="flex flex-col rounded-2xl border border-[#e8e2e3] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                >
                  {/* Status badges */}
                  <div className="flex items-center justify-between gap-2 px-4 pt-4">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusClass(status)}`}>
                      {status}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(paymentStatus)}`}>
                      {paymentStatus}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="flex-1 px-4 pt-3 pb-2">
                    <h3 className="truncate text-base font-semibold text-[#1f2937]">
                      {reservation.restaurant?.name ?? reservation.restaurant_id}
                    </h3>
                    <p className="mt-1 text-sm text-[#6b7280]">
                      {toPrettyDate(reservation.date)}
                    </p>
                    <p className="text-sm font-medium text-[#374151]">
                      {to12Hour(reservation.time)}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-[#ece8e9] bg-[#fafafa] px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-[#8b97a8]">Guest</div>
                        <div className="mt-0.5 truncate text-xs font-medium text-[#1f2937]">{reservation.name}</div>
                      </div>
                      <div className="rounded-lg border border-[#ece8e9] bg-[#fafafa] px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-[#8b97a8]">Guests</div>
                        <div className="mt-0.5 text-xs font-medium text-[#1f2937]">{reservation.guests}</div>
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 border-t border-[#ece8e9] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setViewingId(reservation.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d8dbe2] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#f3f4f6]"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>

                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDecision(reservation.id, "approve")}
                          disabled={isActing}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#b7e4c7] bg-[#ecfdf3] px-3 py-1.5 text-xs font-semibold text-[#166534] hover:bg-[#ddf8e8] disabled:opacity-50"
                        >
                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(reservation.id, "decline")}
                          disabled={isActing}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#f5c2c7] bg-[#fff1f2] px-3 py-1.5 text-xs font-semibold text-[#be123c] hover:bg-[#ffe4e8] disabled:opacity-50"
                        >
                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                          Decline
                        </button>
                      </>
                    )}

                    {status === "confirmed" && (
                      <button
                        type="button"
                        onClick={() => handleDecision(reservation.id, "complete")}
                        disabled={isActing}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#c4def3] bg-[#eef7ff] px-3 py-1.5 text-xs font-semibold text-[#1d4f7a] hover:bg-[#dceeff] disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                        Done
                      </button>
                    )}
                  </div>
                </article>
              );
            })
              )}
            </VendorPageReveal>
          )}
        </section>

        {/* Reservation Detail Modal */}
        {viewingId && (() => {
          const reservation = reservations.find((r) => r.id === viewingId);
          if (!reservation) return null;
          const status = normalizeStatus(reservation.status);
          const isPending = status === "pending";
          const isActing = actingId === reservation.id;
          const paymentStatus = normalizePaymentStatus(reservation.payment_status);

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setViewingId(null)}>
              <div className="mx-4 w-full max-w-lg rounded-2xl border border-[#e8dfe2] bg-white shadow-[0_22px_48px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-[#ece8e9] px-5 py-4">
                  <h3 className="text-lg font-semibold text-[#1f2937]">Reservation Details</h3>
                  <button type="button" onClick={() => setViewingId(null)} className="grid h-8 w-8 place-items-center rounded-lg text-[#6b7280] transition hover:bg-[#f3f4f6]">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal body */}
                <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-semibold text-[#1f2937]">{reservation.restaurant?.name ?? reservation.restaurant_id}</h4>
                    <div className="flex gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusClass(status)}`}>{status}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusClass(paymentStatus)}`}>{paymentStatus}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-1.5 text-xs text-[#8b97a8]"><User className="h-3 w-3" />Guest Name</div>
                      <div className="mt-1 text-sm font-medium text-[#1f2937]">{reservation.name}</div>
                    </div>
                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-1.5 text-xs text-[#8b97a8]"><Phone className="h-3 w-3" />Phone</div>
                      <div className="mt-1 text-sm font-medium text-[#1f2937]">{reservation.phone}</div>
                    </div>
                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-1.5 text-xs text-[#8b97a8]"><CalendarDays className="h-3 w-3" />Date</div>
                      <div className="mt-1 text-sm font-medium text-[#1f2937]">{toPrettyDate(reservation.date)}</div>
                    </div>
                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-1.5 text-xs text-[#8b97a8]"><Clock3 className="h-3 w-3" />Time</div>
                      <div className="mt-1 text-sm font-medium text-[#1f2937]">{to12Hour(reservation.time)}</div>
                    </div>
                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-1.5 text-xs text-[#8b97a8]"><UsersRound className="h-3 w-3" />Guests</div>
                      <div className="mt-1 text-sm font-medium text-[#1f2937]">{reservation.guests}</div>
                    </div>
                    <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                      <div className="inline-flex items-center gap-1.5 text-xs text-[#8b97a8]"><CreditCard className="h-3 w-3" />Amount</div>
                      <div className="mt-1 text-sm font-medium text-[#1f2937]">{toPesoFromMinor(reservation.payment_amount)}</div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8b97a8]"><Receipt className="h-3 w-3" />Transaction Reference</div>
                    <div className="mt-1 break-all text-sm text-[#374151]">{reservation.payment_reference || "Not available yet"}</div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#ece8e9] bg-[#fafafa] p-3">
                    <div className="text-xs text-[#8b97a8]">Reservation ID</div>
                    <div className="mt-1 break-all font-mono text-xs text-[#374151]">{reservation.id}</div>
                  </div>

                  {reservation.decline_reason && (
                    <div className="mt-3 rounded-xl border border-[#f2cccf] bg-[#fff6f7] px-3 py-2 text-sm text-[#9f1239]">
                      Decline reason: {reservation.decline_reason}
                    </div>
                  )}

                  {/* View Receipt button */}
                  {normalizePaymentStatus(reservation.payment_status) === "paid" && (
                    <button
                      type="button"
                      onClick={() => setReceiptId(reservation.id)}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#c4def3] bg-[#eef7ff] px-4 py-2.5 text-sm font-semibold text-[#1d4f7a] transition hover:bg-[#dceeff]"
                    >
                      <Receipt className="h-4 w-4" />
                      View Receipt
                    </button>
                  )}
                </div>

                {/* Modal footer */}
                {isPending && (
                  <div className="flex items-center gap-3 border-t border-[#ece8e9] px-5 py-4">
                    <button
                      type="button"
                      onClick={() => handleDecision(reservation.id, "approve")}
                      disabled={isActing}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#b7e4c7] bg-[#ecfdf3] px-4 py-2.5 text-sm font-semibold text-[#166534] hover:bg-[#ddf8e8] disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(reservation.id, "decline")}
                      disabled={isActing}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-4 py-2.5 text-sm font-semibold text-[#be123c] hover:bg-[#ffe4e8] disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Decline
                    </button>
                  </div>
                )}

                {status === "confirmed" && (
                  <div className="flex items-center gap-3 border-t border-[#ece8e9] px-5 py-4">
                    <button
                      type="button"
                      onClick={() => handleDecision(reservation.id, "complete")}
                      disabled={isActing}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#c4def3] bg-[#eef7ff] px-4 py-2.5 text-sm font-semibold text-[#1d4f7a] hover:bg-[#dceeff] disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                      Mark as Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Receipt Modal */}
        {receiptId && (() => {
          const reservation = reservations.find((r) => r.id === receiptId);
          if (!reservation) return null;
          const refNo = `RS${reservation.id.slice(0, 8).toUpperCase()}`;
          const paidAt = reservation.payment_paid_at
            ? new Date(reservation.payment_paid_at).toLocaleString("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : "N/A";
          const provider = reservation.payment_provider ?? "N/A";
          const providerThemes: Record<string, { bg: string; logo: string; label: string }> = {
            gcash: { bg: "bg-[#007dfe]", logo: "G", label: "GCash" },
            paymaya: { bg: "bg-[#00b900]", logo: "M", label: "Maya" },
            gotyme: { bg: "bg-[#ff6b00]", logo: "GT", label: "GoTyme" },
          };
          const theme = providerThemes[provider.toLowerCase()] ?? { bg: "bg-[#8b3d4a]", logo: "R", label: provider };

          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setReceiptId(null)}>
              <div className="mx-4 w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white shadow-[0_28px_60px_rgba(0,0,0,0.4)]" onClick={(e) => e.stopPropagation()}>
                {/* Provider Header */}
                <div className={`${theme.bg} px-6 py-5 text-center text-white`}>
                  <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/25 text-lg font-extrabold">{theme.logo}</div>
                  <div className="text-lg font-bold tracking-wide">{theme.label}</div>
                  <div className="mt-1 text-sm opacity-90">Payment Receipt</div>
                </div>

                {/* Success Badge */}
                <div className="flex justify-center -mt-4">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[#22c55e] text-white shadow-md ring-4 ring-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>

                {/* Amount */}
                <div className="mt-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">Amount Paid</div>
                  <div className="mt-1 text-3xl font-bold text-gray-900">{toPesoFromMinor(reservation.payment_amount)}</div>
                  <div className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">Successful</div>
                </div>

                {/* Tear Divider */}
                <div className="relative my-4">
                  <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black/60" />
                  <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-black/60" />
                  <div className="mx-5 border-t-2 border-dashed border-gray-200" />
                </div>

                {/* Details */}
                <div className="space-y-2.5 px-6 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Ref. No.</span><span className="font-mono text-xs font-semibold text-gray-900">{refNo}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Restaurant</span><span className="max-w-[180px] truncate text-right font-medium text-gray-900">{reservation.restaurant?.name ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Guest</span><span className="font-medium text-gray-900">{reservation.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium text-gray-900">{toPrettyDate(reservation.date)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium text-gray-900">{to12Hour(reservation.time)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Guests</span><span className="font-medium text-gray-900">{reservation.guests}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Paid At</span><span className="font-medium text-gray-900">{paidAt}</span></div>
                  {reservation.payment_reference && (
                    <div className="flex justify-between"><span className="text-gray-500">Txn Ref</span><span className="max-w-[180px] truncate text-right font-mono text-xs font-semibold text-gray-900">{reservation.payment_reference}</span></div>
                  )}
                </div>

                {/* Close button */}
                <div className="px-6 py-4 mt-2">
                  <button type="button" onClick={() => setReceiptId(null)} className="w-full rounded-xl bg-[#f3f4f6] py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-[#e5e7eb]">Close</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Decline Reason Modal */}
        {declineTarget && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeclineTarget(null)}>
            <div className="mx-4 w-full max-w-[400px] rounded-[20px] bg-white shadow-[0_28px_60px_rgba(0,0,0,0.25)]" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-2">
                <h3 className="text-base font-bold text-[#1f2937]">Decline Reservation</h3>
                <p className="mt-1 text-sm text-[#6b7280]">Provide a reason for declining (optional).</p>
              </div>
              <div className="px-6 py-3">
                <input
                  type="text"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. No available table"
                  className="w-full rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-sm text-[#1f2937] outline-none focus:border-[#b76a73] focus:ring-1 focus:ring-[#b76a73] transition"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDecline(); }}
                />
              </div>
              <div className="flex items-center gap-3 px-6 pb-5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeclineTarget(null)}
                  className="flex-1 rounded-xl bg-[#f3f4f6] py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-[#e5e7eb]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDecline}
                  className="flex-1 rounded-xl bg-[#be123c] py-2.5 text-sm font-semibold text-white transition hover:bg-[#9f1239]"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

