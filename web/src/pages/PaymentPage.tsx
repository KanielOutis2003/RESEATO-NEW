import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import LuxuryNavbar from "../components/layouts/LuxuryNavbar";
import LuxuryFooter from "../components/layouts/LuxuryFooter";
import {
  createCheckoutSession,
  getReservationPaymentDetails,
  ReservationPaymentDetails,
} from "../lib/api/payments.api";

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
    return { bg: "rgba(76,175,115,0.15)", color: "#9ef2c1", border: "1px solid rgba(158,242,193,0.35)" };
  }
  if (value === "processing") {
    return { bg: "rgba(85,145,215,0.15)", color: "#9ec6f0", border: "1px solid rgba(158,198,240,0.35)" };
  }
  if (value === "failed") {
    return { bg: "rgba(215,85,95,0.15)", color: "#f0a5ac", border: "1px solid rgba(240,165,172,0.35)" };
  }
  return { bg: "rgba(215,170,85,0.15)", color: "#f0d9a5", border: "1px solid rgba(240,217,165,0.35)" };
}

function downloadReceiptAsImage(config: {
  provider: { accent: string; logo: string; label: string };
  amount: string | null;
  refNo: string;
  restaurant: string;
  dateLabel: string;
  timeLabel: string;
  guests: number;
  bookingId: string;
  txnDate: string;
}) {
  const { provider, amount, refNo, restaurant, dateLabel, timeLabel, guests, bookingId, txnDate } = config;
  const W = 440;
  const H = 760;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(2, 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = provider.accent;
  ctx.fillRect(0, 0, W, 150);

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(W / 2, 50, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(provider.logo, W / 2, 51);

  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(provider.label, W / 2, 100);

  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Payment Receipt", W / 2, 125);

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

  ctx.fillStyle = "#6b7280";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("AMOUNT PAID", W / 2, 200);

  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(amount ?? "—", W / 2, 235);

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

  function dashedLine(y: number) {
    ctx!.strokeStyle = "#e5e7eb";
    ctx!.lineWidth = 2;
    ctx!.setLineDash([6, 6]);
    ctx!.beginPath();
    ctx!.moveTo(30, y);
    ctx!.lineTo(W - 30, y);
    ctx!.stroke();
    ctx!.setLineDash([]);
    ctx!.fillStyle = "#ffffff";
    ctx!.beginPath();
    ctx!.arc(0, y, 12, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.beginPath();
    ctx!.arc(W, y, 12, 0, Math.PI * 2);
    ctx!.fill();
  }
  dashedLine(310);

  const rows: Array<[string, string]> = [
    ["Ref. No.", refNo],
    ["Paid To", "RESEATO"],
    ["Restaurant", restaurant],
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

  ctx.fillStyle = "#6b7280";
  ctx.font = "italic 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Thank you for dining with RESEATO!", W / 2, y + 40);

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

const METHOD_META: Record<Method, { label: string; sub: string; accent: string; logo: string }> = {
  gcash: { label: "GCash", sub: "E-wallet", accent: "#007dfe", logo: "G" },
  paymaya: { label: "Maya", sub: "E-wallet", accent: "#00b900", logo: "M" },
  gotyme: { label: "GoTyme", sub: "Digital bank", accent: "#ff6b00", logo: "GT" },
};

export default function PaymentPage() {
  const { t } = useTranslation();
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
    if (!details) return formatAmount(20);
    return formatAmount(details.paymentAmount);
  }, [details]);

  async function onPayNow() {
    if (!reservationId || !details) return;
    if (!agreed) {
      setMessage(t("payment.acceptTermsFirst"));
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

  const pageBg = `radial-gradient(ellipse at top, #1a0d12 0%, ${DARK_BG} 50%, #08040a 100%)`;

  if (!reservationId) {
    return (
      <div className="relative min-h-screen w-full" style={{ background: pageBg, fontFamily: SANS }}>
        <LuxuryNavbar />
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div
            className="rounded-2xl p-6"
            style={{ background: CARD_BG, border: CARD_BORDER, color: "#f0a5ac" }}
          >
            {t("payment.invalidReservation")}
          </div>
        </section>
        <LuxuryFooter />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden" style={{ background: pageBg, fontFamily: SANS }}>
        <LuxuryNavbar />
        <div className="pointer-events-none absolute -left-20 top-40 h-64 w-64 rounded-full blur-3xl" style={{ background: "rgba(146,63,74,0.25)" }} />
        <div className="pointer-events-none absolute -right-16 top-80 h-72 w-72 rounded-full blur-3xl" style={{ background: "rgba(201,160,122,0.15)" }} />

        <section className="relative mx-auto max-w-5xl px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-8 flex items-center gap-3"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
              className="grid h-11 w-11 place-items-center rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #b46d73, #923f4a)", boxShadow: "0 10px 22px rgba(146,63,74,0.4)" }}
            >
              <UtensilsCrossed className="h-5 w-5" />
            </motion.div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>
                RESEATO
              </div>
              <div className="text-xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>
                {t("payment.preparingPayment")}
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {[0, 1].map((idx) => (
              <motion.div
                key={idx}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.7, delay: idx * 0.2 }}
                className="rounded-3xl p-6 backdrop-blur-md"
                style={{ background: CARD_BG, border: CARD_BORDER }}
              >
                <div className="h-8 w-56 rounded-xl" style={{ background: "rgba(212,181,138,0.1)" }} />
                <div className="mt-4 h-12 w-full rounded-2xl" style={{ background: "rgba(146,63,74,0.15)" }} />
                <div className="mt-3 h-12 w-full rounded-2xl" style={{ background: "rgba(212,181,138,0.08)" }} />
                <div className="mt-3 h-12 w-full rounded-2xl" style={{ background: "rgba(212,181,138,0.08)" }} />
                <div className="mt-6 h-11 w-full rounded-2xl" style={{ background: "rgba(146,63,74,0.15)" }} />
              </motion.div>
            ))}
          </div>

          <div className="mt-6 inline-flex items-center gap-2 text-sm" style={{ color: TEXT_DIM }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("payment.loadingPaymentDetails")}
          </div>
        </section>
        <LuxuryFooter />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="relative min-h-screen w-full" style={{ background: pageBg, fontFamily: SANS }}>
        <LuxuryNavbar />
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div
            className="rounded-2xl p-6"
            style={{ background: CARD_BG, border: CARD_BORDER, color: "#f0a5ac" }}
          >
            <p>{message ?? "Reservation payment details are not available."}</p>
            <Link
              to="/my-reservations"
              className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-medium transition hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #b46d73, #923f4a)",
                color: "#fff",
                border: GOLD_BORDER,
              }}
            >
              {t("payment.goToMyReservations")}
            </Link>
          </div>
        </section>
        <LuxuryFooter />
      </div>
    );
  }

  const paymentDone = details.paymentStatus === "paid";
  const paymentLocked = paymentDone || submitting;
  const statusTone = paymentStatusTone(details.paymentStatus);

  return (
    <div className="relative min-h-screen w-full" style={{ background: pageBg, fontFamily: SANS }}>
      <LuxuryNavbar />

      {/* Ambient glows */}
      <div className="pointer-events-none absolute left-0 top-32 h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(146,63,74,0.18)" }} />
      <div className="pointer-events-none absolute right-0 top-96 h-96 w-96 rounded-full blur-3xl" style={{ background: "rgba(201,160,122,0.1)" }} />

      <section className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition hover:brightness-110"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: GOLD_BORDER,
            color: CREAM,
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Header */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2.5 text-xs tracking-[0.3em] uppercase" style={{ color: GOLD }}>
            <span className="h-px w-8" style={{ background: GOLD }} />
            {t("payment.securePayment")}
            <span className="h-px w-8" style={{ background: GOLD }} />
          </div>
          <h1
            className="mt-4 text-4xl font-light sm:text-5xl lg:text-6xl"
            style={{ color: CREAM, fontFamily: SERIF, letterSpacing: "-0.01em" }}
          >
            {t("payment.securePayment")}
          </h1>
          <p className="mt-3 text-sm" style={{ color: TEXT_DIM }}>
            {t("payment.completePaymentSubtitle")}
          </p>
        </div>

        {message && (
          <div
            className="mt-8 rounded-2xl px-4 py-3 text-sm"
            style={
              message.toLowerCase().includes("successful") || message.toLowerCase().includes("confirmed")
                ? { background: "rgba(76,175,115,0.12)", border: "1px solid rgba(158,242,193,0.3)", color: "#9ef2c1" }
                : { background: "rgba(215,85,95,0.12)", border: "1px solid rgba(240,165,172,0.3)", color: "#f0a5ac" }
            }
          >
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Payment Card */}
          <section
            className="rounded-3xl p-6 backdrop-blur-md sm:p-8"
            style={{
              background: CARD_BG,
              border: CARD_BORDER,
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: "rgba(16,8,10,0.5)", border: "1px solid rgba(212,181,138,0.15)" }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{
                  background: "linear-gradient(135deg, rgba(180,109,115,0.25), rgba(146,63,74,0.2))",
                  borderBottom: "1px solid rgba(212,181,138,0.18)",
                }}
              >
                <span className="text-sm tracking-wider uppercase" style={{ color: TEXT_MUTED }}>
                  {t("payment.reservationFee")}
                </span>
                <span
                  className="text-3xl font-light sm:text-4xl"
                  style={{ color: GOLD, fontFamily: SERIF, letterSpacing: "-0.01em" }}
                >
                  {feeLabel}
                </span>
              </div>

              <div className="space-y-6 p-5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                    {t("payment.selectPaymentMethod")}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(Object.keys(METHOD_META) as Method[]).map((key) => {
                      const meta = METHOD_META[key];
                      const isActive = selectedMethod === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedMethod(key)}
                          disabled={paymentLocked}
                          className="rounded-2xl p-4 text-left transition disabled:opacity-60"
                          style={
                            isActive
                              ? {
                                  background: "linear-gradient(135deg, rgba(180,109,115,0.35), rgba(146,63,74,0.25))",
                                  border: "1px solid rgba(212,181,138,0.5)",
                                  boxShadow: "0 10px 24px rgba(146,63,74,0.3)",
                                }
                              : {
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(212,181,138,0.15)",
                                }
                          }
                        >
                          <Wallet className="h-5 w-5" style={{ color: meta.accent }} />
                          <div className="mt-3 text-sm font-medium" style={{ color: CREAM }}>
                            {meta.label}
                          </div>
                          <div className="text-xs" style={{ color: TEXT_DIM }}>
                            {meta.sub === "E-wallet" ? t("payment.eWallet") : t("payment.digitalBank")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="rounded-2xl p-4 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(212,181,138,0.12)",
                    color: TEXT_MUTED,
                  }}
                >
                  {t("payment.paymentInstructions")}
                </div>

                <label className="inline-flex items-start gap-3 text-sm" style={{ color: TEXT_MUTED }}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded"
                    style={{ accentColor: GOLD }}
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    disabled={paymentLocked}
                  />
                  <span>
                    {t("payment.agreeTerms")}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={onPayNow}
                  disabled={paymentLocked || !agreed}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-lg font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #b46d73, #923f4a)",
                    border: "1px solid rgba(212,181,138,0.4)",
                    boxShadow: "0 16px 32px rgba(146,63,74,0.35)",
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("payment.processing")}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      {t("payment.pay", { amount: feeLabel })}
                    </>
                  )}
                </button>

                <div className="inline-flex w-full items-center justify-center gap-2 text-xs tracking-wider uppercase" style={{ color: "#9ef2c1" }}>
                  <BadgeCheck className="h-4 w-4" />
                  Secure encrypted transaction
                </div>
              </div>
            </div>
          </section>

          {/* Reservation Details */}
          <aside
            className="rounded-3xl p-6 backdrop-blur-md sm:p-8"
            style={{
              background: CARD_BG,
              border: CARD_BORDER,
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}
          >
            <h2
              className="text-2xl font-light sm:text-3xl"
              style={{ color: CREAM, fontFamily: SERIF, letterSpacing: "-0.01em" }}
            >
              Reservation Details
            </h2>
            <div className="mt-5 space-y-3 text-sm">
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,181,138,0.12)" }}
              >
                <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                  Restaurant
                </div>
                <div className="mt-1 text-base font-medium" style={{ color: CREAM }}>
                  {details.restaurantName}
                </div>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,181,138,0.12)" }}
              >
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  Date and Time
                </div>
                <div className="mt-1 text-base font-medium" style={{ color: CREAM }}>
                  {prettyDate(details.date)} at {to12Hour(details.time)}
                </div>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,181,138,0.12)" }}
              >
                <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                  Guests
                </div>
                <div className="mt-1 text-base font-medium" style={{ color: CREAM }}>
                  {details.guests}
                </div>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,181,138,0.12)" }}
              >
                <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                  Payment Status
                </div>
                <div className="mt-2">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                    style={statusTone}
                  >
                    {details.paymentStatus}
                  </span>
                </div>
              </div>

              {paymentDone && (
                <div
                  className="rounded-xl p-4 text-sm"
                  style={{
                    background: "rgba(76,175,115,0.12)",
                    border: "1px solid rgba(158,242,193,0.3)",
                    color: "#9ef2c1",
                  }}
                >
                  Payment received. Your reservation is now secured.
                </div>
              )}

              <Link
                to="/my-reservations"
                className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition hover:brightness-110"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: GOLD_BORDER,
                  color: CREAM,
                }}
              >
                View My Reservations
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <LuxuryFooter />

      {/* ── Payment Receipt Modal (Light GCash style) ── */}
      <AnimatePresence>
        {showReceipt && details && (() => {
          const methodThemes: Record<Method, { bg: string; accent: string; logo: string; label: string }> = {
            gcash: { bg: "bg-[#007dfe]", accent: "#007dfe", logo: "G", label: "GCash" },
            paymaya: { bg: "bg-[#00b900]", accent: "#00b900", logo: "M", label: "Maya" },
            gotyme: { bg: "bg-[#ff6b00]", accent: "#ff6b00", logo: "GT", label: "GoTyme" },
          };
          const theme = methodThemes[selectedMethod];
          const refNo = `RS${reservationId?.slice(0, 8).toUpperCase() ?? "00000000"}`;
          const txnDate = new Date().toLocaleString("en-PH", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
          const amountStr = formatAmount(details.paymentAmount);

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-sm"
              style={{ background: "rgba(5,2,3,0.75)" }}
              onClick={() => setShowReceipt(false)}
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
                  <div className="mt-1 text-3xl font-bold text-gray-900">{amountStr}</div>
                  <div className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">
                    Successful
                  </div>
                </div>

                {/* Tear Divider */}
                <div className="relative my-4">
                  <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#130a0d]" />
                  <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#130a0d]" />
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
                      {details.restaurantName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date & Time</span>
                    <span className="font-medium text-gray-900">
                      {prettyDate(details.date)}, {to12Hour(details.time)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Guests</span>
                    <span className="font-medium text-gray-900">{details.guests}</span>
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

                {/* Tear Divider */}
                <div className="relative my-4">
                  <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#130a0d]" />
                  <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#130a0d]" />
                  <div className="mx-5 border-t-2 border-dashed border-gray-200" />
                </div>

                {/* Buttons */}
                <div className="space-y-2.5 px-6 pb-5">
                  <button
                    type="button"
                    onClick={() =>
                      downloadReceiptAsImage({
                        provider: { accent: theme.accent, logo: theme.logo, label: theme.label },
                        amount: amountStr,
                        refNo,
                        restaurant: details.restaurantName,
                        dateLabel: prettyDate(details.date),
                        timeLabel: to12Hour(details.time),
                        guests: details.guests,
                        bookingId: reservationId,
                        txnDate,
                      })
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:brightness-110"
                    style={{ background: theme.accent }}
                  >
                    <Download className="h-4 w-4" />
                    Download Receipt
                  </button>
                  <Link
                    to="/my-reservations"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <Receipt className="h-4 w-4" />
                    My Reservations
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowReceipt(false)}
                    className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
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
