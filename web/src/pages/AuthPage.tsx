import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { Eye, EyeOff, Mail, Lock, User, Phone, CheckCircle2, Circle, UtensilsCrossed, Check, ArrowLeft, X, Info, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPostAuthRedirect } from "../lib/auth/roleRedirect";
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup";
type Role = "customer" | "vendor";

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

function getStrengthLabel(score: number) {
  if (score <= 1) return "Weak";
  if (score === 2) return "Fair";
  if (score === 3) return "Good";
  return "Strong";
}

function getStrengthBarClass(score: number) {
  if (score <= 1) return "bg-red-500";
  if (score === 2) return "bg-amber-500";
  if (score === 3) return "bg-yellow-400";
  return "bg-emerald-500";
}

function getStrengthTextClass(score: number) {
  if (score <= 1) return "text-[#be123c]";
  if (score === 2) return "text-[#b45309]";
  if (score === 3) return "text-[#a16207]";
  return "text-[#166534]";
}

function getStrengthBadgeClass(score: number) {
  if (score <= 1) return "border-[#f5c2c7] bg-[#fff1f2] text-[#be123c]";
  if (score === 2) return "border-[#f8d9a5] bg-[#fff7ed] text-[#b45309]";
  if (score === 3) return "border-[#f6e2b3] bg-[#fffbeb] text-[#a16207]";
  return "border-[#b7e4c7] bg-[#ecfdf3] text-[#166534]";
}

function getStrengthSegmentClass(score: number, step: number) {
  if (score < step) return "border border-[#e5e7eb] bg-[#f3f4f6]";
  if (score <= 1) return "bg-[#e11d48]";
  if (score === 2) return "bg-[#d97706]";
  if (score === 3) return "bg-[#b45309]";
  return "bg-[#16a34a]";
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

function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: "rgba(10,5,7,0.72)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[24px] p-6 md:p-8"
            style={{
              border: "1px solid rgba(212,181,138,0.28)",
              background: "rgba(26,14,18,0.92)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,181,138,0.15)",
              color: "#f5ede4",
              fontFamily: SANS,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full transition"
              style={{
                border: "1px solid rgba(212,181,138,0.35)",
                background: "rgba(10,5,7,0.5)",
                color: "#d4b58a",
              }}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#faf4ea",
                }}
              >
                <Info className="h-5 w-5" />
              </div>
              <h2
                className="text-3xl font-semibold"
                style={{ fontFamily: SERIF, color: "#faf4ea" }}
              >
                About RESEATO
              </h2>
            </div>

            <p className="mt-4 leading-relaxed" style={{ color: "#c9b99d" }}>
              RESEATO helps you book the best tables at top rated restaurants in SM
              City and SM Seaside Cebu. Skip the line, enjoy the dine—and suggest
              what&apos;s best.
            </p>
            <p className="mt-3 leading-relaxed" style={{ color: "#c9b99d" }}>
              Our platform connects diners with their favorite restaurants, providing
              seamless online reservations with secure payment processing. Whether
              you&apos;re planning a casual lunch or a special celebration, RESEATO
              makes it easy.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01]"
              style={{
                background: "linear-gradient(135deg, #b46d73, #923f4a)",
                color: "#faf4ea",
                boxShadow: "0 16px 30px rgba(146,63,74,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TermsModal({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: "rgba(10,5,7,0.72)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[24px] p-6 md:p-8"
            style={{
              border: "1px solid rgba(212,181,138,0.28)",
              background: "rgba(26,14,18,0.92)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,181,138,0.15)",
              color: "#f5ede4",
              fontFamily: SANS,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full transition"
              style={{
                border: "1px solid rgba(212,181,138,0.35)",
                background: "rgba(10,5,7,0.5)",
                color: "#d4b58a",
              }}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#faf4ea",
                }}
              >
                <FileText className="h-5 w-5" />
              </div>
              <h2
                className="text-3xl font-semibold"
                style={{ fontFamily: SERIF, color: "#faf4ea" }}
              >
                Terms and Conditions
              </h2>
            </div>

            <p className="mt-4 text-sm" style={{ color: "#c9b99d" }}>
              By ticking the agreement box and proceeding with payment, you
              acknowledge that you have read, understood, and agreed to the following
              Terms and Conditions.
            </p>

            <ol
              className="mt-5 list-decimal list-outside space-y-4 pl-5 text-sm leading-relaxed"
              style={{ color: "#c9b99d" }}
            >
              <li><strong style={{ color: "#d4b58a" }}>Acceptance of Terms.</strong> By using RESEATO and completing a reservation, you agree to comply with all policies stated herein. If you do not agree with these terms, you must not proceed with the reservation or payment.</li>
              <li><strong style={{ color: "#d4b58a" }}>Payment Policy.</strong> All reservation payments made through RESEATO are considered final and non-refundable once successfully processed.</li>
              <li><strong style={{ color: "#d4b58a" }}>No Cancellation Policy.</strong> Once payment has been successfully processed, the reservation is confirmed and cannot be canceled, transferred, or rescheduled.</li>
              <li><strong style={{ color: "#d4b58a" }}>Limitation of Liability.</strong> RESEATO utilizes third-party payment gateway providers. RESEATO shall not be held liable for any data breach, unauthorized access, or compromise of payment details.</li>
              <li><strong style={{ color: "#d4b58a" }}>Accuracy of Information.</strong> Customers are responsible for providing accurate and complete personal and payment information.</li>
              <li><strong style={{ color: "#d4b58a" }}>Restaurant Responsibility.</strong> RESEATO acts as a reservation platform only. The partnered restaurant is solely responsible for food quality, service delivery, and dining experience.</li>
              <li><strong style={{ color: "#d4b58a" }}>Force Majeure.</strong> RESEATO shall not be held liable for failure to fulfill reservations due to events beyond reasonable control.</li>
              <li><strong style={{ color: "#d4b58a" }}>System Availability.</strong> We do not guarantee uninterrupted access due to possible maintenance, updates, or technical issues.</li>
              <li><strong style={{ color: "#d4b58a" }}>Amendments.</strong> RESEATO reserves the right to modify these Terms and Conditions at any time.</li>
              <li><strong style={{ color: "#d4b58a" }}>No-Show Policy.</strong> Payment will be forfeited if the customer fails to appear at the reserved time.</li>
              <li><strong style={{ color: "#d4b58a" }}>Chargeback Protection.</strong> Customers agree not to initiate fraudulent chargebacks.</li>
              <li><strong style={{ color: "#d4b58a" }}>Privacy Policy.</strong> Personal data is collected, stored, and protected in accordance with our privacy practices.</li>
              <li><strong style={{ color: "#d4b58a" }}>User Conduct.</strong> No fraudulent bookings or misuse of the platform is permitted.</li>
              <li><strong style={{ color: "#d4b58a" }}>Time Allowance Policy.</strong> Reservation automatically expires if the customer arrives late (15-30 minutes grace period).</li>
            </ol>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.15em] transition"
                style={{
                  border: "1px solid rgba(212,181,138,0.35)",
                  background: "rgba(10,5,7,0.5)",
                  color: "#d4b58a",
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01]"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#faf4ea",
                  boxShadow: "0 16px 30px rgba(146,63,74,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                I Accept
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const requestedPath = (location.state as { from?: string } | null)?.from ?? null;
  const authRedirectUrl = `${window.location.origin}/log-in-sign-up`;

  const resolveRedirect = useCallback(
    async (sessionOverride: Session | null = null) => {
      if (sessionOverride) {
        return getPostAuthRedirect(sessionOverride, requestedPath);
      }

      const { data } = await supabase.auth.getSession();
      return getPostAuthRedirect(data.session, requestedPath);
    },
    [requestedPath],
  );

  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("customer");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("error");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [signupConfirmationEmail, setSignupConfirmationEmail] = useState<string | null>(null);
  const [lastAuthEmail, setLastAuthEmail] = useState("");
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [confirmationCardMsg, setConfirmationCardMsg] = useState<string | null>(null);

  /* auto-dismiss toast after 6 seconds */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    let cancelled = false;

    async function handleAuthCallback() {
      const query = new URLSearchParams(location.search);
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const otpType = query.get("type");
      const errorDescription = query.get("error_description");

      if (errorDescription) {
        const decodedError = decodeURIComponent(errorDescription.replace(/\+/g, " "));
        if (!cancelled) setMsg(decodedError);
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;

        if (error) {
          setMsg(error.message || "Failed to complete email verification.");
          return;
        }

        if (data.session) {
          const target = await resolveRedirect(data.session);
          navigate(target, { replace: true });
          return;
        }
      }

      if (tokenHash && isEmailOtpType(otpType)) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });

        if (cancelled) return;

        if (error) {
          setMsg(error.message || "Verification link is invalid or expired.");
          return;
        }

        if (data.session) {
          const target = await resolveRedirect(data.session);
          navigate(target, { replace: true });
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;

        if (sessionData.session) {
          const target = await resolveRedirect(sessionData.session);
          navigate(target, { replace: true });
          return;
        }

        setMode("login");
        setMsg("Email confirmed. Please sign in.");
        return;
      }

      if (location.hash.includes("access_token=")) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;

        if (sessionData.session) {
          const target = await resolveRedirect(sessionData.session);
          navigate(target, { replace: true });
        }
      }
    }

    void handleAuthCallback();

    return () => {
      cancelled = true;
    };
  }, [location.hash, location.search, navigate, resolveRedirect]);

  const passwordChecks = useMemo(
    () => evaluatePassword(password, confirmPassword),
    [password, confirmPassword],
  );

  const passwordRulePass = useMemo(
    () => passwordChecks.uppercase && passwordChecks.number && passwordChecks.special,
    [passwordChecks],
  );

  const passwordStrengthScore = useMemo(() => {
    let score = 0;
    if (passwordChecks.minLength) score += 1;
    if (passwordChecks.uppercase) score += 1;
    if (passwordChecks.number) score += 1;
    if (passwordChecks.special) score += 1;
    return score;
  }, [passwordChecks]);

  const passwordStrengthPercent = (passwordStrengthScore / 4) * 100;
  const passwordStrengthLabel = getStrengthLabel(passwordStrengthScore);
  const passwordStrengthBarClass = getStrengthBarClass(passwordStrengthScore);

  const canSubmit = useMemo(() => {
    if (!email || !password) return false;
    if (!agreed) return false;

    if (mode === "signup") {
      if (!firstName || !lastName) return false;
      if (!passwordChecks.minLength) return false;
      if (!passwordRulePass) return false;
      if (!passwordChecks.matches) return false;
    }

    return true;
  }, [
    email,
    password,
    agreed,
    mode,
    firstName,
    lastName,
    passwordChecks,
    passwordRulePass,
  ]);

  function parseAuthError(error: any, fallback: string) {
    const message = String(error?.message ?? fallback);
    const lower = message.toLowerCase();
    const status = typeof error?.status === "number" ? error.status : null;
    return { message, lower, status };
  }

  function setResendMessage(surface: "form" | "card", text: string) {
    if (surface === "card") {
      setConfirmationCardMsg(text);
      return;
    }
    setMsg(text);
  }

  async function resendConfirmationEmail(
    emailToSend: string,
    surface: "form" | "card" = "form",
  ): Promise<boolean> {
    const targetEmail = emailToSend.trim();
    if (!targetEmail) {
      setResendMessage(surface, "Enter your email first so we can resend the confirmation link.");
      return false;
    }

    setResendingConfirmation(true);
    if (surface === "card") {
      setConfirmationCardMsg(null);
    } else {
      setMsg(null);
    }

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: authRedirectUrl },
      });

      if (error) throw error;

      setShowResendConfirmation(false);
      setResendMessage(surface, "Confirmation email sent. Please check inbox and spam.");
      return true;
    } catch (err: any) {
      const parsed = parseAuthError(err, "Unable to resend confirmation email.");

      if (parsed.lower.includes("rate limit")) {
        setResendMessage(
          surface,
          "Too many confirmation emails were sent recently. Please wait about a minute and retry.",
        );
      } else if (parsed.lower.includes("error sending confirmation email")) {
        setResendMessage(
          surface,
          "SMTP delivery failed. Check Supabase SMTP sender address, username, and app password, then retry.",
        );
      } else {
        const statusText = parsed.status ? ` (HTTP ${parsed.status})` : "";
        setResendMessage(surface, `${parsed.message}${statusText}`);
      }

      setShowResendConfirmation(true);
      return false;
    } finally {
      setResendingConfirmation(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setMsgType("error");
    setTermsError(false);
    setFieldErrors({});
    setShowResendConfirmation(false);

    const errors: Record<string, string> = {};

    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Please enter a valid email address.";

    if (!password) errors.password = "Password is required.";
    else if (mode === "login" && password.length < 6) errors.password = "Password must be at least 6 characters.";

    if (mode === "signup") {
      if (!firstName.trim()) errors.firstName = "First name is required.";
      if (!lastName.trim()) errors.lastName = "Last name is required.";
      if (password && !passwordChecks.minLength) errors.password = "Password must be at least 6 characters.";
      if (password && !passwordRulePass) errors.password = "Password needs uppercase, number, and special character.";
      if (!confirmPassword) errors.confirmPassword = "Please confirm your password.";
      else if (!passwordChecks.matches) errors.confirmPassword = "Passwords do not match.";
    }

    if (!agreed) {
      errors.terms = "You must accept the Terms and Conditions.";
      setTermsError(true);
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      setMsg(firstError);
      return;
    }

    if (!canSubmit) {
      setMsg("Please complete the form properly.");
      return;
    }

    const cleanEmail = email.trim();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhone = phone.trim();
    const fullName = `${cleanFirstName} ${cleanLastName}`.trim();

    setLastAuthEmail(cleanEmail);
    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        setMsgType("success");
        setMsg("Logged in!");
        setShowResendConfirmation(false);
        const target = await resolveRedirect(data.session);
        navigate(target, { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: authRedirectUrl,
            data: {
              first_name: cleanFirstName,
              last_name: cleanLastName,
              full_name: fullName,
              phone: cleanPhone,
              role,
            },
          },
        });

        if (error) {
          console.error("[Signup Error]", error.message, "status:", error.status);
          throw error;
        }

        // Auto-confirmed (no email verification required)
        if (data.session) {
          setMsgType("success");
          setMsg("Account created. You are now logged in.");
          setShowResendConfirmation(false);
          const target = await resolveRedirect(data.session);
          navigate(target, { replace: true });
          return;
        }

        // Email already registered (identities is empty array)
        const identities = data.user?.identities ?? [];
        if (Array.isArray(identities) && identities.length === 0) {
          setMsgType("error");
          setMode("login");
          setMsg("This email is already registered. Please sign in instead.");
          setShowResendConfirmation(true);
          return;
        }

        // No user returned at all — signup silently failed
        if (!data.user) {
          setMsgType("error");
          setMsg("Signup failed — no account was created. Please try again or contact support.");
          return;
        }

        // Success — email confirmation required, go to confirmation page
        setMsg(null);
        setMsgType("error");
        setConfirmationCardMsg(null);
        setShowResendConfirmation(false);
        setSignupConfirmationEmail(cleanEmail);
      }
    } catch (err: any) {
      const parsed = parseAuthError(err, "Auth failed");
      console.error(`[Auth ${mode}]`, parsed.message, "status:", parsed.status);

      setMsgType("error");
      setShowResendConfirmation(false);

      if (mode === "signup") {
        // Signup errors — never resend, always show clear error
        if (parsed.lower.includes("user already registered")) {
          setMsg("This email is already registered. Please sign in instead.");
          setShowResendConfirmation(true);
        } else if (parsed.lower.includes("rate limit")) {
          setMsg("Too many signup attempts. Please wait a moment and try again.");
        } else if (parsed.lower.includes("error sending confirmation email") || parsed.lower.includes("email")) {
          setMsg("Signup failed — unable to send confirmation email. Check Supabase email/SMTP settings or try again later.");
        } else if (parsed.lower.includes("network") || parsed.lower.includes("fetch")) {
          setMsg("Unable to connect. Please check your internet connection.");
        } else if (parsed.status === 400 || parsed.status === 500) {
          setMsg(`Signup failed: ${parsed.message}`);
        } else {
          setMsg(parsed.message || "Signup failed. Please try again.");
        }
      } else {
        // Login errors
        if (parsed.lower.includes("invalid login credentials") || parsed.lower.includes("invalid credentials")) {
          setMsg("Incorrect email or password. Please check your credentials and try again.");
        } else if (parsed.lower.includes("email not confirmed")) {
          setMsg("Email not confirmed yet. Check your inbox, or resend the confirmation link below.");
          setShowResendConfirmation(true);
        } else if (parsed.lower.includes("rate limit")) {
          setMsg("Too many attempts. Please wait a moment before trying again.");
        } else if (parsed.lower.includes("error sending confirmation email")) {
          const resent = await resendConfirmationEmail(cleanEmail, "form");
          if (!resent) {
            setShowResendConfirmation(true);
          }
        } else if (parsed.lower.includes("user not found") || parsed.lower.includes("no user found")) {
          setMsg("No account found with this email. Please sign up first.");
        } else if (parsed.lower.includes("network") || parsed.lower.includes("fetch")) {
          setMsg("Unable to connect. Please check your internet connection.");
        } else {
          setMsg(parsed.message || "Something went wrong. Please try again.");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (signupConfirmationEmail) {
    return (
      <div
        className="fixed inset-0 z-[120] overflow-y-auto px-6 py-10"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, #1a0e12 0%, #0a0507 55%, #05030a 100%)",
          color: "#f5ede4",
          fontFamily: SANS,
        }}
      >
        <div className="mx-auto mb-6 flex max-w-6xl justify-start">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5"
            style={{
              border: "1px solid rgba(212,181,138,0.35)",
              background: "rgba(36,22,26,0.6)",
              color: "#d4b58a",
              backdropFilter: "blur(8px)",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="mx-auto grid min-h-full max-w-6xl place-items-center">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="w-full max-w-[520px] rounded-[28px] px-8 py-9 text-center"
            style={{
              border: "1px solid rgba(212,181,138,0.28)",
              background: "rgba(26,14,18,0.85)",
              backdropFilter: "blur(14px)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,181,138,0.15)",
            }}
          >
            <div
              className="mx-auto grid h-20 w-20 place-items-center rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(212,181,138,0.25), rgba(180,109,115,0.25))",
                border: "1px solid rgba(212,181,138,0.4)",
                color: "#d4b58a",
              }}
            >
              <Mail className="h-11 w-11" />
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="h-px w-10" style={{ background: "rgba(212,181,138,0.4)" }} />
              <span
                className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: "#d4b58a" }}
              >
                Almost There
              </span>
              <span className="h-px w-10" style={{ background: "rgba(212,181,138,0.4)" }} />
            </div>

            <h1
              className="mt-4 text-[34px] font-semibold tracking-tight sm:text-[40px]"
              style={{ fontFamily: SERIF, color: "#faf4ea" }}
            >
              Confirm your registration
            </h1>

            <p
              className="mx-auto mt-4 max-w-[410px] text-[19px] leading-tight"
              style={{ color: "#c9b99d" }}
            >
              We&apos;ve sent a confirmation link to
            </p>
            <p
              className="mx-auto mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-1 text-[clamp(17px,2.4vw,25px)] font-semibold leading-tight"
              style={{ color: "#d4b58a" }}
            >
              {signupConfirmationEmail}
            </p>
            <p
              className="mx-auto mt-2 max-w-[430px] text-[19px] leading-tight"
              style={{ color: "#c9b99d" }}
            >
              Please check your email and click the link to activate your account.
            </p>

            {confirmationCardMsg && (
              <div
                className="mx-auto mt-4 max-w-[430px] rounded-xl px-4 py-3 text-sm"
                style={{
                  border: "1px solid rgba(212,181,138,0.25)",
                  background: "rgba(10,5,7,0.4)",
                  color: "#c9b99d",
                }}
              >
                {confirmationCardMsg}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                void resendConfirmationEmail(signupConfirmationEmail, "card");
              }}
              disabled={resendingConfirmation}
              className="mt-5 w-full rounded-2xl px-4 py-3 text-[16px] font-semibold uppercase tracking-[0.15em] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                border: "1px solid rgba(212,181,138,0.35)",
                background: "rgba(10,5,7,0.5)",
                color: "#d4b58a",
              }}
            >
              {resendingConfirmation ? "Sending..." : "Resend Email"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSignupConfirmationEmail(null);
                setMode("login");
                setPassword("");
                setConfirmPassword("");
                setMsg(null);
                setConfirmationCardMsg(null);
                setShowResendConfirmation(false);
              }}
              className="mt-6 w-full rounded-2xl px-4 py-3.5 text-[18px] font-semibold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01]"
              style={{
                background: "linear-gradient(135deg, #b46d73, #923f4a)",
                color: "#faf4ea",
                boxShadow:
                  "0 18px 32px rgba(146,63,74,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              Back to Sign In
            </button>

            <p
              className="mx-auto mt-5 max-w-[430px] text-[14px] leading-snug"
              style={{ color: "#8a7666" }}
            >
              Didn&apos;t receive the email? Check your spam folder or try registering again.
            </p>
          </motion.section>
        </div>
      </div>
    );
  }

  return (
    <>
    <AboutModal open={showAboutModal} onClose={() => setShowAboutModal(false)} />
    <TermsModal
      open={showTermsModal}
      onClose={() => setShowTermsModal(false)}
      onAccept={() => {
        setAgreed(true);
        setTermsError(false);
        setShowTermsModal(false);
      }}
    />
    <div
      className="fixed inset-0 overflow-auto px-6"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #1a0e12 0%, #0a0507 55%, #05030a 100%)",
        color: "#f5ede4",
        fontFamily: SANS,
      }}
    >
      {/* Toast popup for errors/success */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-x-0 top-5 z-[200] mx-auto w-fit max-w-md px-4"
          >
            <div
              className="flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium"
              style={
                msgType === "success"
                  ? {
                      border: "1px solid rgba(134,191,150,0.4)",
                      background: "rgba(18,52,32,0.85)",
                      color: "#c8eecf",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                    }
                  : msgType === "info"
                    ? {
                        border: "1px solid rgba(212,181,138,0.4)",
                        background: "rgba(26,14,18,0.85)",
                        color: "#d4b58a",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                      }
                    : {
                        border: "1px solid rgba(225,93,93,0.4)",
                        background: "rgba(70,20,25,0.85)",
                        color: "#f5c6ca",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                      }
              }
            >
              <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                style={{ background: "rgba(10,5,7,0.5)" }}
              >
                {msgType === "success" ? <CheckCircle2 className="h-4 w-4" /> : msgType === "info" ? <Info className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </div>
              <span className="flex-1">{msg}</span>
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="ml-2 rounded-full p-1 transition hover:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col py-6">
        <div className="z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5"
            style={{
              border: "1px solid rgba(212,181,138,0.35)",
              background: "rgba(36,22,26,0.6)",
              color: "#d4b58a",
              backdropFilter: "blur(8px)",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="flex flex-1 items-center">
          <div className="grid w-full gap-10 md:grid-cols-2 md:items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="hidden md:block"
        >
          <div className="space-y-6">
            <div className="shrink-0">
              <Link to="/" className="group flex items-center space-x-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, #b46d73, #923f4a)",
                    boxShadow:
                      "0 16px 28px rgba(146,63,74,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  <UtensilsCrossed className="h-6 w-6 text-[#faf4ea]" />
                </div>
                <span
                  className="text-4xl font-semibold tracking-tight"
                  style={{ fontFamily: SERIF, color: "#faf4ea" }}
                >
                  RESEATO
                </span>
              </Link>
            </div>

            <div
              className="rounded-[24px] p-8"
              style={{
                border: "1px solid rgba(212,181,138,0.25)",
                background: "rgba(26,14,18,0.75)",
                backdropFilter: "blur(14px)",
                boxShadow:
                  "0 28px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,181,138,0.12)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="h-px w-8" style={{ background: "rgba(212,181,138,0.4)" }} />
                <span
                  className="text-[10px] uppercase tracking-[0.3em]"
                  style={{ color: "#d4b58a" }}
                >
                  {mode === "login" ? "Welcome Back" : "Join Us"}
                </span>
              </div>
              <div
                className="mt-3 text-[32px] leading-tight font-semibold"
                style={{ fontFamily: SERIF, color: "#faf4ea" }}
              >
                {mode === "login" ? "Welcome back" : "Create your account"}
              </div>
              <p className="mt-3 text-[17px]" style={{ color: "#c9b99d" }}>
                {mode === "login"
                  ? "Sign in to manage reservations and book faster."
                  : "Sign up to reserve tables, track bookings, and access exclusive features."}
              </p>

              <ul className="mt-7 space-y-3" style={{ color: "#f5ede4" }}>
                <li className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      border: "1px solid rgba(212,181,138,0.35)",
                      background: "rgba(10,5,7,0.5)",
                      color: "#d4b58a",
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-lg">Reserve tables in seconds</span>
                </li>
                <li className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      border: "1px solid rgba(212,181,138,0.35)",
                      background: "rgba(10,5,7,0.5)",
                      color: "#d4b58a",
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-lg">Skip the waiting lines</span>
                </li>
                <li className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      border: "1px solid rgba(212,181,138,0.35)",
                      background: "rgba(10,5,7,0.5)",
                      color: "#d4b58a",
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-lg">Manage all your bookings</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div
            className={`rounded-[24px] p-6 md:p-10 ${
              mode === "signup" ? "max-h-[85vh] overflow-y-auto" : ""
            }`}
            style={{
              border: "1px solid rgba(212,181,138,0.28)",
              background: "rgba(26,14,18,0.85)",
              backdropFilter: "blur(14px)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,181,138,0.15)",
            }}
          >
            <div
              className="flex rounded-2xl p-1.5"
              style={{
                border: "1px solid rgba(212,181,138,0.25)",
                background: "rgba(10,5,7,0.5)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setMsg(null);
                  setShowResendConfirmation(false);
                }}
                className="flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors"
                style={
                  mode === "login"
                    ? {
                        background: "linear-gradient(135deg, #b46d73, #923f4a)",
                        color: "#faf4ea",
                        boxShadow:
                          "0 10px 20px rgba(146,63,74,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                      }
                    : { color: "#d4b58a", background: "transparent" }
                }
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMsg(null);
                  setShowResendConfirmation(false);
                }}
                className="flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors"
                style={
                  mode === "signup"
                    ? {
                        background: "linear-gradient(135deg, #b46d73, #923f4a)",
                        color: "#faf4ea",
                        boxShadow:
                          "0 10px 20px rgba(146,63,74,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                      }
                    : { color: "#d4b58a", background: "transparent" }
                }
              >
                Sign up
              </button>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-3">
                <span className="h-px w-8" style={{ background: "rgba(212,181,138,0.4)" }} />
                <span
                  className="text-[10px] uppercase tracking-[0.3em]"
                  style={{ color: "#d4b58a" }}
                >
                  RESEATO
                </span>
              </div>
              <h1
                className="mt-2 text-[34px] leading-tight font-semibold"
                style={{ fontFamily: SERIF, color: "#faf4ea" }}
              >
                {mode === "login" ? "Sign in" : "Create account"}
              </h1>
              <p className="mt-1 text-sm" style={{ color: "#c9b99d" }}>
                {mode === "login"
                  ? "Enter your credentials to continue."
                  : "Fill up the form to register."}
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("customer")}
                      className="rounded-xl px-4 py-3 text-left transition-colors"
                      style={
                        role === "customer"
                          ? {
                              border: "1px solid rgba(212,181,138,0.55)",
                              background:
                                "linear-gradient(135deg, rgba(212,181,138,0.18), rgba(180,109,115,0.18))",
                              boxShadow: "inset 0 1px 0 rgba(212,181,138,0.2)",
                            }
                          : {
                              border: "1px solid rgba(212,181,138,0.22)",
                              background: "rgba(10,5,7,0.45)",
                            }
                      }
                    >
                      <div
                        className="text-sm font-semibold"
                        style={{ color: role === "customer" ? "#faf4ea" : "#d4b58a" }}
                      >
                        Customer
                      </div>
                      <div className="text-xs" style={{ color: "#c9b99d" }}>
                        Reserve tables
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("vendor")}
                      className="rounded-xl px-4 py-3 text-left transition-colors"
                      style={
                        role === "vendor"
                          ? {
                              border: "1px solid rgba(212,181,138,0.55)",
                              background:
                                "linear-gradient(135deg, rgba(212,181,138,0.18), rgba(180,109,115,0.18))",
                              boxShadow: "inset 0 1px 0 rgba(212,181,138,0.2)",
                            }
                          : {
                              border: "1px solid rgba(212,181,138,0.22)",
                              background: "rgba(10,5,7,0.45)",
                            }
                      }
                    >
                      <div
                        className="text-sm font-semibold"
                        style={{ color: role === "vendor" ? "#faf4ea" : "#d4b58a" }}
                      >
                        Restaurant Owner
                      </div>
                      <div className="text-xs" style={{ color: "#c9b99d" }}>
                        Manage bookings
                      </div>
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="First Name"
                      icon={<User className="h-4 w-4" />}
                      value={firstName}
                      onChange={(v) => { setFirstName(v); setFieldErrors((p) => { const n = { ...p }; delete n.firstName; return n; }); }}
                      placeholder="Christian"
                      error={fieldErrors.firstName}
                    />
                    <Field
                      label="Last Name"
                      icon={<User className="h-4 w-4" />}
                      value={lastName}
                      onChange={(v) => { setLastName(v); setFieldErrors((p) => { const n = { ...p }; delete n.lastName; return n; }); }}
                      placeholder="Boyles"
                      error={fieldErrors.lastName}
                    />
                  </div>

                  <Field
                    label="Phone (optional)"
                    icon={<Phone className="h-4 w-4" />}
                    value={phone}
                    onChange={setPhone}
                    placeholder="09xxxxxxxxx"
                  />
                </>
              )}

              <Field
                label="Email"
                icon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={(v) => { setEmail(v); setFieldErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                placeholder="you@email.com"
                type="email"
                error={fieldErrors.email}
              />

              <PasswordField
                label="Password"
                icon={<Lock className="h-4 w-4" />}
                value={password}
                onChange={(v) => { setPassword(v); setFieldErrors((p) => { const n = { ...p }; delete n.password; return n; }); }}
                show={showPassword}
                toggleShow={() => setShowPassword((s) => !s)}
                error={fieldErrors.password}
              />

              {mode === "login" && (
                <div className="-mt-1 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 shrink-0 rounded"
                      style={{ accentColor: "#d4b58a" }}
                    />
                    <span className="text-xs leading-none" style={{ color: "#c9b99d" }}>
                      Remember me
                    </span>
                  </label>
                  <Link
                    to="/forgot-password"
                    state={{ email: email.trim() }}
                    className="text-xs font-semibold underline-offset-4 hover:underline"
                    style={{ color: "#d4b58a" }}
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {mode === "signup" && (
                <>
                  <PasswordField
                    label="Confirm Password"
                    icon={<Lock className="h-4 w-4" />}
                    value={confirmPassword}
                    onChange={(v) => { setConfirmPassword(v); setFieldErrors((p) => { const n = { ...p }; delete n.confirmPassword; return n; }); }}
                    show={showPassword}
                    toggleShow={() => setShowPassword((s) => !s)}
                    error={fieldErrors.confirmPassword}
                  />

                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                      border: "1px solid rgba(212,181,138,0.25)",
                      background: "rgba(10,5,7,0.4)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p
                          className="text-[11px] uppercase tracking-[0.2em]"
                          style={{ color: "#d4b58a" }}
                        >
                          Password Health
                        </p>
                        <p
                          className={`text-sm font-semibold ${getStrengthTextClass(passwordStrengthScore)}`}
                        >
                          {passwordStrengthLabel}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStrengthBadgeClass(passwordStrengthScore)}`}
                      >
                        {passwordStrengthScore}/4 rules
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={`h-2 rounded-full transition-colors duration-300 ${getStrengthSegmentClass(passwordStrengthScore, step)}`}
                        />
                      ))}
                    </div>

                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: "rgba(212,181,138,0.12)" }}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrengthBarClass}`}
                        style={{ width: `${passwordStrengthPercent}%` }}
                      />
                    </div>

                    <div className="mt-2 text-[11px]" style={{ color: "#c9b99d" }}>
                      Requires uppercase, number, and special character to enable signup.
                    </div>

                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      <RequirementItem ok={passwordChecks.uppercase} text="Uppercase letter" />
                      <RequirementItem ok={passwordChecks.number} text="Number" />
                      <RequirementItem ok={passwordChecks.special} text="Special character" />
                      <RequirementItem ok={passwordChecks.minLength} text="At least 6 characters" />
                      <RequirementItem ok={passwordChecks.matches} text="Passwords match" />
                    </ul>

                    <div className="mt-2 text-[11px]" style={{ color: "#8a7666" }}>
                      {passwordStrengthPercent.toFixed(0)}% strength
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  className="inline-flex items-center gap-2 cursor-pointer transition"
                  style={
                    termsError && !agreed
                      ? {
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid rgba(225,93,93,0.45)",
                          background: "rgba(70,20,25,0.35)",
                        }
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      if (e.target.checked) { setTermsError(false); setFieldErrors((p) => { const n = { ...p }; delete n.terms; return n; }); }
                    }}
                    className="h-4 w-4 shrink-0 rounded"
                    style={{ accentColor: "#d4b58a" }}
                  />
                  <span className="text-xs leading-none" style={{ color: "#c9b99d" }}>
                    I have read and agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="font-semibold underline underline-offset-2"
                      style={{ color: "#d4b58a" }}
                    >
                      Terms and Conditions
                    </button>
                  </span>
                </label>
                {termsError && !agreed && (
                  <p className="mt-1 pl-6 text-xs font-medium" style={{ color: "#f5c6ca" }}>
                    You must accept the Terms and Conditions to proceed.
                  </p>
                )}
              </div>

              {/* error/success popup is rendered as a fixed toast at top */}

              {showResendConfirmation && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    border: "1px solid rgba(212,181,138,0.3)",
                    background: "rgba(10,5,7,0.5)",
                  }}
                >
                  <div className="text-xs" style={{ color: "#c9b99d" }}>
                    Need another confirmation email for
                    <span className="ml-1 font-semibold" style={{ color: "#d4b58a" }}>
                      {(email.trim() || lastAuthEmail || "your account")}
                    </span>
                    ?
                  </div>
                  <button
                    type="button"
                    onClick={() => resendConfirmationEmail(email.trim() || lastAuthEmail)}
                    disabled={loading || resendingConfirmation}
                    className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      border: "1px solid rgba(212,181,138,0.35)",
                      background: "rgba(10,5,7,0.5)",
                      color: "#d4b58a",
                    }}
                  >
                    {resendingConfirmation ? "Sending..." : "Resend confirmation email"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.15em] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#faf4ea",
                  boxShadow:
                    "0 18px 32px rgba(146,63,74,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {loading ? "Please wait..." : mode === "login" ? (<>Sign In <span aria-hidden="true">&rarr;</span></>) : "Create account"}
              </button>

              <p className="mt-1 text-center text-sm" style={{ color: "#c9b99d" }}>
                {mode === "login" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("signup"); setMsg(null); setShowResendConfirmation(false); }}
                      className="font-semibold underline-offset-4 hover:underline"
                      style={{ color: "#d4b58a" }}
                    >
                      Sign up for free
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("login"); setMsg(null); setShowResendConfirmation(false); }}
                      className="font-semibold underline-offset-4 hover:underline"
                      style={{ color: "#d4b58a" }}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>
          </div>
        </motion.div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function Field(props: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "#d4b58a" }}
      >
        {props.label}
      </div>
      <div
        className="auth-field flex items-center gap-2 rounded-xl px-3 py-3"
        style={{
          border: props.error
            ? "1px solid rgba(225,93,93,0.55)"
            : "1px solid rgba(212,181,138,0.3)",
          background: "rgba(10,5,7,0.55)",
          boxShadow: props.error ? "0 0 0 3px rgba(225,93,93,0.12)" : undefined,
        }}
      >
        <span style={{ color: "#d4b58a" }}>{props.icon}</span>
        <input
          type={props.type ?? "text"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="auth-input w-full bg-transparent text-sm outline-none"
          style={{ color: "#f5ede4" }}
        />
      </div>
      {props.error && (
        <p className="text-xs" style={{ color: "#f5c6ca" }}>
          {props.error}
        </p>
      )}
    </label>
  );
}

function PasswordField(props: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "#d4b58a" }}
      >
        {props.label}
      </div>
      <div
        className="auth-field flex items-center gap-2 rounded-xl px-3 py-3"
        style={{
          border: props.error
            ? "1px solid rgba(225,93,93,0.55)"
            : "1px solid rgba(212,181,138,0.3)",
          background: "rgba(10,5,7,0.55)",
          boxShadow: props.error ? "0 0 0 3px rgba(225,93,93,0.12)" : undefined,
        }}
      >
        <span style={{ color: "#d4b58a" }}>{props.icon}</span>
        <input
          type={props.show ? "text" : "password"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="auth-input w-full bg-transparent text-sm outline-none"
          style={{ color: "#f5ede4" }}
          placeholder="********"
        />
        <button
          type="button"
          onClick={props.toggleShow}
          style={{ color: "#d4b58a" }}
        >
          {props.show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
      {props.error && (
        <p className="text-xs" style={{ color: "#f5c6ca" }}>
          {props.error}
        </p>
      )}
    </label>
  );
}
