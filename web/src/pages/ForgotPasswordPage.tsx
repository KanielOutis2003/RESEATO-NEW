import { Mail, ArrowLeft, UtensilsCrossed, Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { requestPasswordReset } from "../lib/api/auth.api";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractErrorMessage(error: any) {
  const payloadMessage =
    typeof error?.payload === "object" && error?.payload && "message" in error.payload
      ? String((error.payload as Record<string, unknown>).message ?? "")
      : "";

  return payloadMessage || String(error?.message ?? "Unable to send reset email.");
}

const SERIF = "'Cormorant Garamond', serif";
const SANS = "'Jost', sans-serif";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const prefillEmail =
    typeof (location.state as Record<string, unknown> | null)?.email === "string"
      ? String((location.state as Record<string, unknown>).email)
      : "";

  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const normalized = useMemo(() => normalizeEmail(email), [email]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isValidEmail(normalized)) {
      setErrorMsg(t("forgotPassword.invalidEmail"));
      return;
    }

    try {
      setLoading(true);
      const redirectTo = `${window.location.origin}/reset-password`;
      const response = await requestPasswordReset(normalized, redirectTo);
      setSuccessMsg(response.message || "Password reset email sent.");
    } catch (error: any) {
      setErrorMsg(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #1a0e12 0%, #0a0507 55%, #05030a 100%)",
        color: "#f5ede4",
        fontFamily: SANS,
      }}
    >
      {/* Decorative gold ornaments */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(212,181,138,0.08), transparent 40%), radial-gradient(circle at 85% 80%, rgba(180,109,115,0.10), transparent 45%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            to="/log-in-sign-up"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5"
            style={{
              border: "1px solid rgba(212,181,138,0.35)",
              background: "rgba(36,22,26,0.6)",
              color: "#d4b58a",
              backdropFilter: "blur(8px)",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("nav.backToSignIn")}
          </Link>
        </div>

        <div className="grid min-h-[calc(100vh-150px)] place-items-center">
          <section
            className="w-full max-w-[540px] rounded-[28px] p-8 md:p-10"
            style={{
              border: "1px solid rgba(212,181,138,0.28)",
              background: "rgba(26,14,18,0.85)",
              backdropFilter: "blur(14px)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,181,138,0.15)",
            }}
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #b46d73, #923f4a)",
                boxShadow:
                  "0 18px 30px rgba(146,63,74,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <UtensilsCrossed className="h-7 w-7 text-[#faf4ea]" />
            </div>

            {/* Gold ornament line */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="h-px w-10" style={{ background: "rgba(212,181,138,0.4)" }} />
              <span
                className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: "#d4b58a" }}
              >
                RESEATO
              </span>
              <span className="h-px w-10" style={{ background: "rgba(212,181,138,0.4)" }} />
            </div>

            <h1
              className="mt-4 text-center text-4xl font-semibold tracking-tight"
              style={{ fontFamily: SERIF, color: "#faf4ea" }}
            >
              {t("forgotPassword.title")}
            </h1>
            <p
              className="mt-2 text-center text-sm"
              style={{ color: "#c9b99d" }}
            >
              {t("forgotPassword.subtitle")}
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-4">
              <label className="block space-y-1.5">
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "#d4b58a" }}
                >
                  {t("forgotPassword.emailLabel")}
                </div>
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-3"
                  style={{
                    border: "1px solid rgba(212,181,138,0.3)",
                    background: "rgba(10,5,7,0.55)",
                  }}
                >
                  <span style={{ color: "#d4b58a" }}>
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@email.com"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: "#f5ede4" }}
                  />
                </div>
              </label>

              {errorMsg && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    border: "1px solid rgba(225,93,93,0.35)",
                    background: "rgba(70,20,25,0.5)",
                    color: "#f5c6ca",
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    border: "1px solid rgba(134,191,150,0.35)",
                    background: "rgba(18,52,32,0.5)",
                    color: "#c8eecf",
                  }}
                >
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#faf4ea",
                  boxShadow:
                    "0 16px 30px rgba(146,63,74,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {loading ? t("forgotPassword.sending") : t("forgotPassword.sendResetLink")}
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
