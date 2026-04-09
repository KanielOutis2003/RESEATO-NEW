import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle2, Circle, Eye, EyeOff, Lock, UtensilsCrossed } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type PasswordChecks = {
  minLength: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
  matches: boolean;
};

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && EMAIL_OTP_TYPES.includes(value as EmailOtpType));
}

function evaluatePassword(password: string, confirmPassword: string): PasswordChecks {
  return {
    minLength: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    matches: password.length > 0 && password === confirmPassword,
  };
}

async function getSessionWithRetry(retries = 8, delayMs = 160): Promise<Session | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;

    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

function parseHashParams(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

function mapRecoveryError(code: string | null, description: string | null) {
  const normalizedCode = String(code ?? "").toLowerCase();
  const normalizedDescription = String(description ?? "").toLowerCase();

  if (normalizedCode === "otp_expired" || normalizedDescription.includes("expired")) {
    return "This reset link has expired. Please request a new password reset email.";
  }

  if (normalizedDescription.includes("invalid")) {
    return "This reset link is invalid. Please request a new password reset email.";
  }

  if (description) {
    return description;
  }

  return "Unable to validate reset link. Please request a new one.";
}

const SERIF = "'Cormorant Garamond', serif";
const SANS = "'Jost', sans-serif";

function RequirementItem(props: { ok: boolean; text: string }) {
  return (
    <li
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors"
      style={
        props.ok
          ? {
              border: "1px solid rgba(134,191,150,0.35)",
              background: "rgba(18,52,32,0.35)",
              color: "#c8eecf",
            }
          : {
              border: "1px solid rgba(212,181,138,0.18)",
              background: "rgba(10,5,7,0.4)",
              color: "#c9b99d",
            }
      }
    >
      {props.ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0" style={{ color: "#8a7666" }} />
      )}
      <span>{props.text}</span>
    </li>
  );
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [readyForReset, setReadyForReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const passwordChecks = useMemo(
    () => evaluatePassword(password, confirmPassword),
    [password, confirmPassword],
  );

  const passwordRulePass =
    passwordChecks.minLength &&
    passwordChecks.uppercase &&
    passwordChecks.number &&
    passwordChecks.special;

  const canSubmit = readyForReset && passwordRulePass && passwordChecks.matches;

  useEffect(() => {
    let alive = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;
      if (!nextSession) return;

      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        setReadyForReset(true);
        setCheckingSession(false);
        setErrorMsg(null);
      }
    });

    async function prepareRecoverySession() {
      try {
        setCheckingSession(true);
        setErrorMsg(null);

        const query = new URLSearchParams(location.search);
        const hashParams = parseHashParams(location.hash);

        const queryErrorCode = query.get("error_code");
        const hashErrorCode = hashParams.get("error_code");
        const queryErrorDescription = query.get("error_description");
        const hashErrorDescription = hashParams.get("error_description");
        const recoveryErrorCode = queryErrorCode || hashErrorCode;
        const recoveryErrorDescription = queryErrorDescription || hashErrorDescription;

        if (recoveryErrorCode || recoveryErrorDescription) {
          setReadyForReset(false);
          setErrorMsg(mapRecoveryError(recoveryErrorCode, recoveryErrorDescription));
          setCheckingSession(false);
          return;
        }

        const code = query.get("code");
        const tokenHash = query.get("token_hash") || hashParams.get("token_hash");
        const legacyToken = query.get("token") || hashParams.get("token");
        const otpType = query.get("type") || hashParams.get("type");
        const emailForOtp = query.get("email") || hashParams.get("email");
        const accessToken = hashParams.get("access_token") || query.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || query.get("refresh_token");
        const hasAccessToken = Boolean(accessToken);
        const hasRefreshToken = Boolean(refreshToken);
        const hasRecoveryType = (otpType ?? "").toLowerCase() === "recovery";

        const hasRecoveryLinkIndicators =
          Boolean(code) ||
          Boolean(tokenHash) ||
          Boolean(legacyToken) ||
          hasAccessToken ||
          hasRefreshToken ||
          hasRecoveryType;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (tokenHash && isEmailOtpType(otpType)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) throw error;
        }

        if (legacyToken && isEmailOtpType(otpType) && emailForOtp) {
          const { error } = await supabase.auth.verifyOtp({
            type: otpType,
            token: legacyToken,
            email: emailForOtp,
          });
          if (error) throw error;
        }

        if (hasAccessToken && hasRefreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: String(accessToken),
            refresh_token: String(refreshToken),
          });
          if (error) throw error;
        }

        const session = await getSessionWithRetry(
          hasRecoveryLinkIndicators ? 24 : 8,
          hasRecoveryLinkIndicators ? 220 : 120,
        );

        if (!alive) return;

        if (session) {
          setReadyForReset(true);
          setErrorMsg(null);
          return;
        }

        if (!hasRecoveryLinkIndicators) {
          setReadyForReset(false);
          setErrorMsg("Reset link is missing. Please open the reset link from your email.");
          return;
        }

        setReadyForReset(false);
        setErrorMsg("Auth session is missing. Please request a new password reset email.");
      } catch (error: any) {
        if (!alive) return;
        setReadyForReset(false);
        setErrorMsg(error?.message ?? "Unable to validate reset link.");
      } finally {
        if (alive) setCheckingSession(false);
      }
    }

    void prepareRecoverySession();

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [location.hash, location.search]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!readyForReset) {
      setErrorMsg("Reset link is not ready. Please request a new one.");
      return;
    }

    if (!passwordChecks.minLength) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    if (!passwordChecks.uppercase || !passwordChecks.number || !passwordChecks.special) {
      setErrorMsg(
        "Password must include at least one uppercase letter, one number, and one special character.",
      );
      return;
    }

    if (!passwordChecks.matches) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setSuccessMsg("Password updated successfully. Redirecting to sign in...");

      await supabase.auth.signOut();
      window.setTimeout(() => {
        navigate("/log-in-sign-up", { replace: true });
      }, 1200);
    } catch (error: any) {
      setErrorMsg(error?.message ?? "Unable to update password.");
    } finally {
      setLoading(false);
    }
  }

  const inputWrapStyle = {
    border: "1px solid rgba(212,181,138,0.3)",
    background: "rgba(10,5,7,0.55)",
  } as const;

  const labelStyle = { color: "#d4b58a" } as const;

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
            Back to Sign In
          </Link>
        </div>

        <div className="grid min-h-[calc(100vh-150px)] place-items-center">
          <section
            className="w-full max-w-[460px] rounded-[28px] p-8 md:p-10"
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
              Reset Password
            </h1>
            <p className="mt-2 text-center text-sm" style={{ color: "#c9b99d" }}>
              Enter your new password below.
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-4">
              <label className="block space-y-1.5">
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={labelStyle}
                >
                  New Password
                </div>
                <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={inputWrapStyle}>
                  <span style={labelStyle}>
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="New password"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: "#f5ede4" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{ color: "#d4b58a" }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block space-y-1.5">
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={labelStyle}
                >
                  Confirm New Password
                </div>
                <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={inputWrapStyle}>
                  <span style={labelStyle}>
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: "#f5ede4" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    style={{ color: "#d4b58a" }}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  border: "1px solid rgba(212,181,138,0.25)",
                  background: "rgba(10,5,7,0.4)",
                }}
              >
                <p
                  className="text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: "#d4b58a" }}
                >
                  Password Requirements
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  <RequirementItem ok={passwordChecks.minLength} text="At least 6 characters" />
                  <RequirementItem ok={passwordChecks.uppercase} text="Uppercase letter" />
                  <RequirementItem ok={passwordChecks.number} text="Number" />
                  <RequirementItem ok={passwordChecks.special} text="Special character" />
                  <RequirementItem ok={passwordChecks.matches} text="Passwords match" />
                </ul>
              </div>

              {checkingSession && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    border: "1px solid rgba(212,181,138,0.25)",
                    background: "rgba(10,5,7,0.4)",
                    color: "#c9b99d",
                  }}
                >
                  Validating reset link...
                </div>
              )}

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

              {!readyForReset && !checkingSession && (
                <Link
                  to="/forgot-password"
                  className="block text-center text-xs font-semibold underline-offset-4 hover:underline"
                  style={{ color: "#d4b58a" }}
                >
                  Request a new reset link
                </Link>
              )}

              <button
                type="submit"
                disabled={loading || checkingSession || !canSubmit}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#faf4ea",
                  boxShadow:
                    "0 16px 30px rgba(146,63,74,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}



