import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle,
  Download,
  Loader2,
  Receipt,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import {
  createCheckoutSession,
  getReservationPaymentDetails,
  ReservationPaymentDetails,
} from "../lib/api/payments.api";

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function to12Hour(raw: string) {
  const hhmm = String(raw).slice(0, 5);
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function prettyDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

type Method = "gcash" | "paymaya" | "gotyme";

function paymentStatusTone(paymentStatus: string) {
  const value = paymentStatus.trim().toLowerCase();

  if (value === "paid") {
    return "border-[#bfe6d0] bg-[#e6f7ef] text-[#227a4c]";
  }

  if (value === "processing") {
    return "border-[#bdd8f2] bg-[#eaf4ff] text-[#1d5f93]";
  }

  if (value === "failed") {
    return "border-[#f4c3c3] bg-[#ffecec] text-[#a63d3d]";
  }

  return "border-[#f0d5a5] bg-[#fff5e5] text-[#9a6a19]";
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const { reservationId } = useParams<{ reservationId: string }>();
  const [details, setDetails] = useState<ReservationPaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<Method>("gcash");
  const [agreed, setAgreed] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!reservationId) return;

    setLoading(true);
    try {
      const data = await getReservationPaymentDetails(reservationId);
      setDetails(data);
    } catch (error: any) {
      setMessage(error?.payload?.message ?? error?.message ?? "Unable to load payment details.");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const feeLabel = useMemo(() => {
    if (!details) return formatAmount(100);
    return formatAmount(details.paymentAmount);
  }, [details]);

  async function onPayNow() {
    if (!reservationId || !details) return;
    if (!agreed) {
      setMessage("Please accept the terms before continuing.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await createCheckoutSession(reservationId, selectedMethod);
      setMessage("Payment successful! Your reservation is now confirmed.");
      await loadDetails();
      setShowReceipt(true);
    } catch (error: any) {
      setMessage(error?.payload?.message ?? error?.message ?? "Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!reservationId) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border border-[#f0cdd4] bg-[#fff6f7] p-6 text-[#9f1239]">
            Invalid reservation.
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full overflow-hidden bg-[#f3f3f4] text-[#1f2937]">
        <div className="pointer-events-none absolute -left-20 -top-16 h-64 w-64 rounded-full bg-[#f2dde2] blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-28 h-72 w-72 rounded-full bg-[#f8ecee] blur-3xl" />

        <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-5xl flex-col justify-center px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-6 flex items-center gap-3"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
              className="grid h-11 w-11 place-items-center rounded-xl bg-[#8b3d4a] text-white shadow-[0_10px_22px_rgba(139,61,74,0.26)]"
            >
              <UtensilsCrossed className="h-5 w-5" />
            </motion.div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8b3d4a]">RESEATO</div>
              <div className="text-lg font-medium text-[#374151]">Preparing payment portal...</div>
            </div>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {[0, 1].map((idx) => (
              <motion.div
                key={idx}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.7, delay: idx * 0.2 }}
                className="rounded-3xl border border-[#e8e2e3] bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
              >
                <div className="h-8 w-56 rounded-xl bg-[#f3ecef]" />
                <div className="mt-4 h-12 w-full rounded-2xl bg-[#f2e5e8]" />
                <div className="mt-3 h-12 w-full rounded-2xl bg-[#f4eff1]" />
                <div className="mt-3 h-12 w-full rounded-2xl bg-[#f4eff1]" />
                <div className="mt-6 h-11 w-full rounded-2xl bg-[#f2e5e8]" />
              </motion.div>
            ))}
          </div>

          <div className="mt-6 inline-flex items-center gap-2 text-sm text-[#7b8498]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading payment details...
          </div>
        </section>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border border-[#f0cdd4] bg-[#fff6f7] p-6 text-[#9f1239]">
            <p>{message ?? "Reservation payment details are not available."}</p>
            <Link
              to="/my-reservations"
              className="mt-4 inline-flex rounded-xl border border-[#d8c0c6] bg-[#f8ecee] px-4 py-2 text-sm font-medium text-[#7b2f3b] transition hover:bg-[#f2dde2]"
            >
              Go to My Reservations
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const paymentDone = details.paymentStatus === "paid";
  const paymentLocked = paymentDone || submitting;

  return (
    <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-12 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-[#ddd7d9] bg-white px-4 py-2 text-sm text-[#6b7280] shadow-[0_6px_16px_rgba(15,23,42,0.06)] transition hover:text-[#7b2f3b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {message && (
          <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("successful") || message.toLowerCase().includes("confirmed")
              ? "border-[#bfe6d0] bg-[#e6f7ef] text-[#227a4c]"
              : "border-[#f0cdd4] bg-[#fff6f7] text-[#9f1239]"
          }`}>
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-[#e8e2e3] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.1)]">
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-semibold text-[#1f2937]">Secure Payment</h1>
            <p className="mt-1 text-[#667085]">Complete your reservation fee payment</p>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#e8e2e3] bg-[#fafafa]">
              <div className="flex items-center justify-between border-b border-[#e8e2e3] bg-[#f8ecee] px-5 py-4">
                <span className="text-base text-[#374151]">Reservation Fee</span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#8b3d4a]">{feeLabel}</span>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#7b8498]">
                    Select Payment Method
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod("gcash")}
                      disabled={paymentLocked}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedMethod === "gcash"
                          ? "border-[#c98d98] bg-[#f8ecee]"
                          : "border-[#e8e2e3] bg-white hover:bg-[#faf7f8]"
                      } disabled:opacity-60`}
                    >
                      <Wallet className="h-5 w-5 text-[#007dfe]" />
                      <div className="mt-3 text-sm font-medium text-[#1f2937]">GCash</div>
                      <div className="text-xs text-[#6b7280]">E-wallet</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod("paymaya")}
                      disabled={paymentLocked}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedMethod === "paymaya"
                          ? "border-[#c98d98] bg-[#f8ecee]"
                          : "border-[#e8e2e3] bg-white hover:bg-[#faf7f8]"
                      } disabled:opacity-60`}
                    >
                      <Wallet className="h-5 w-5 text-[#00b900]" />
                      <div className="mt-3 text-sm font-medium text-[#1f2937]">PayMaya</div>
                      <div className="text-xs text-[#6b7280]">E-wallet</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod("gotyme")}
                      disabled={paymentLocked}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedMethod === "gotyme"
                          ? "border-[#c98d98] bg-[#f8ecee]"
                          : "border-[#e8e2e3] bg-white hover:bg-[#faf7f8]"
                      } disabled:opacity-60`}
                    >
                      <Wallet className="h-5 w-5 text-[#ff6b00]" />
                      <div className="mt-3 text-sm font-medium text-[#1f2937]">GoTyme</div>
                      <div className="text-xs text-[#6b7280]">Digital bank</div>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#ece8e9] bg-white p-4 text-sm text-[#667085]">
                  Select your preferred payment method and click the button below to confirm payment.
                </div>

                <label className="inline-flex items-start gap-3 text-sm text-[#475467]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[#d5c9cc] text-[#8b3d4a] focus:ring-[#b46d73]"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    disabled={paymentLocked}
                  />
                  <span>
                    I agree that this reservation fee is final and non-refundable based on RESEATO terms.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={onPayNow}
                  disabled={paymentLocked || !agreed}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#d5bcc2] bg-[linear-gradient(135deg,#9b4b56,#7f3a41)] px-5 py-3 text-xl font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Pay {feeLabel}
                    </>
                  )}
                </button>

                <div className="inline-flex w-full items-center justify-center gap-2 text-sm text-[#227a4c]">
                  <BadgeCheck className="h-4 w-4" />
                  Secure encrypted transaction
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-[#e8e2e3] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.1)]">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-[#1f2937]">Reservation Details</h2>
            <div className="mt-5 space-y-3 text-sm text-[#475467]">
              <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-4">
                <div className="text-xs uppercase tracking-wide text-[#7b8498]">Restaurant</div>
                <div className="mt-1 text-base font-medium text-[#1f2937]">{details.restaurantName}</div>
              </div>

              <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-4">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[#7b8498]">
                  <CalendarDays className="h-3.5 w-3.5 text-[#8b3d4a]" />
                  Date and Time
                </div>
                <div className="mt-1 text-base font-medium text-[#1f2937]">
                  {prettyDate(details.date)} at {to12Hour(details.time)}
                </div>
              </div>

              <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-4">
                <div className="text-xs uppercase tracking-wide text-[#7b8498]">Guests</div>
                <div className="mt-1 text-base font-medium text-[#1f2937]">{details.guests}</div>
              </div>

              <div className="rounded-xl border border-[#ece8e9] bg-[#fafafa] p-4">
                <div className="text-xs uppercase tracking-wide text-[#7b8498]">Payment Status</div>
                <div className="mt-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${paymentStatusTone(details.paymentStatus)}`}>
                    {details.paymentStatus}
                  </span>
                </div>
              </div>

              {paymentDone && (
                <div className="rounded-xl border border-[#bfe6d0] bg-[#e6f7ef] p-4 text-[#227a4c]">
                  Payment received. Your reservation is now secured.
                </div>
              )}

              <Link
                to="/my-reservations"
                className="inline-flex w-full items-center justify-center rounded-xl border border-[#d8c0c6] bg-[#f8ecee] px-4 py-2.5 text-sm font-medium text-[#7b2f3b] transition hover:bg-[#f2dde2]"
              >
                View My Reservations
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ── Payment Receipt Modal ── */}
      <AnimatePresence>
        {showReceipt && details && (() => {
          const methodThemes: Record<Method, { bg: string; accent: string; text: string; border: string; logo: string; label: string }> = {
            gcash: { bg: "bg-[#007dfe]", accent: "#007dfe", text: "text-white", border: "border-[#007dfe]", logo: "G", label: "GCash" },
            paymaya: { bg: "bg-[#00b900]", accent: "#00b900", text: "text-white", border: "border-[#00b900]", logo: "M", label: "Maya" },
            gotyme: { bg: "bg-[#ff6b00]", accent: "#ff6b00", text: "text-white", border: "border-[#ff6b00]", logo: "GT", label: "GoTyme" },
          };
          const theme = methodThemes[selectedMethod];
          const refNo = `RS${reservationId?.slice(0, 8).toUpperCase() ?? "00000000"}`;
          const txnDate = new Date().toLocaleString("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
            onClick={() => setShowReceipt(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.22 }}
              className="relative w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white shadow-[0_28px_60px_rgba(15,23,42,0.22)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Provider Header */}
              <div className={`${theme.bg} px-6 py-5 text-center ${theme.text}`}>
                <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/20 text-lg font-extrabold">{theme.logo}</div>
                <div className="text-lg font-bold tracking-wide">{theme.label}</div>
                <div className="mt-1 text-sm opacity-80">Payment Receipt</div>
              </div>

              {/* Success Badge */}
              <div className="flex justify-center -mt-4">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#22c55e] text-white shadow-md">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>

              {/* Amount */}
              <div className="mt-3 text-center">
                <div className="text-xs uppercase tracking-wider text-[#6b7280]">Amount Paid</div>
                <div className="mt-1 text-3xl font-bold text-[#1f2937]">{formatAmount(details.paymentAmount)}</div>
                <div className="mt-1 inline-flex rounded-full bg-[#dcfce7] px-3 py-0.5 text-xs font-semibold text-[#16a34a]">Successful</div>
              </div>

              {/* Dashed Divider (receipt tear line) */}
              <div className="relative my-4">
                <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
                <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
                <div className="border-t-2 border-dashed border-[#e5e7eb] mx-5" />
              </div>

              {/* Details */}
              <div className="px-6 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Ref. No.</span>
                  <span className="font-mono text-xs font-semibold text-[#374151]">{refNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Paid To</span>
                  <span className="font-medium text-[#1f2937]">RESEATO</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Restaurant</span>
                  <span className="max-w-[180px] truncate text-right font-medium text-[#1f2937]">{details.restaurantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Date & Time</span>
                  <span className="font-medium text-[#1f2937]">{prettyDate(details.date)}, {to12Hour(details.time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Guests</span>
                  <span className="font-medium text-[#1f2937]">{details.guests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Payment Method</span>
                  <span className="font-semibold" style={{ color: theme.accent }}>{theme.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b7280]">Transaction Date</span>
                  <span className="text-xs text-[#374151]">{txnDate}</span>
                </div>
              </div>

              {/* Dashed Divider */}
              <div className="relative my-4">
                <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
                <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#f3f3f4]" />
                <div className="border-t-2 border-dashed border-[#e5e7eb] mx-5" />
              </div>

              {/* Footer Buttons */}
              <div className="px-6 pb-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const divider = "════════════════════════════════════";
                    const lines = [
                      divider,
                      `        ${theme.label.toUpperCase()} - PAYMENT RECEIPT`,
                      divider,
                      "",
                      `  Status:          SUCCESSFUL`,
                      `  Ref. No:         ${refNo}`,
                      `  Transaction:     ${txnDate}`,
                      "",
                      `  ─── RESERVATION DETAILS ───`,
                      "",
                      `  Paid To:         RESEATO`,
                      `  Restaurant:      ${details.restaurantName}`,
                      `  Date:            ${prettyDate(details.date)}`,
                      `  Time:            ${to12Hour(details.time)}`,
                      `  Guests:          ${details.guests}`,
                      "",
                      `  ─── PAYMENT DETAILS ───`,
                      "",
                      `  Amount Paid:     ${formatAmount(details.paymentAmount)}`,
                      `  Payment Method:  ${theme.label}`,
                      `  Booking ID:      ${reservationId}`,
                      "",
                      divider,
                      "  Thank you for dining with RESEATO!",
                      divider,
                    ];
                    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${theme.label}-Receipt-${refNo}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-md"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}dd)` }}
                >
                  <Download className="h-4 w-4" />
                  Download Receipt
                </button>
                <Link
                  to="/my-reservations"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-[#f1f1f3]"
                >
                  <Receipt className="h-4 w-4" />
                  My Reservations
                </Link>
                <button
                  type="button"
                  onClick={() => setShowReceipt(false)}
                  className="w-full text-center text-xs text-[#9ca3af] hover:text-[#6b7280]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}


