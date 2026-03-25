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

function RequirementItem(props: { ok: boolean; text: string }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
        props.ok
          ? "border-[#cfe8d8] bg-[#ecfdf3] text-[#166534]"
          : "border-[#e6e5e6] bg-[#fafafa] text-[#4b5563]"
      }`}
    >
      {props.ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[24px] border border-[#e8e2e3] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.18)] md:p-8"
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
                <Info className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold text-[#1f2937]">About RESEATO</h2>
            </div>

            <p className="mt-4 leading-relaxed text-[#475467]">
              RESEATO helps you book the best tables at top rated restaurants in SM
              City and SM Seaside Cebu. Skip the line, enjoy the dine—and suggest
              what&apos;s best.
            </p>
            <p className="mt-3 leading-relaxed text-[#475467]">
              Our platform connects diners with their favorite restaurants, providing
              seamless online reservations with secure payment processing. Whether
              you&apos;re planning a casual lunch or a special celebration, RESEATO
              makes it easy.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(146,63,74,0.24)] hover:brightness-105"
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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-[#e8e2e3] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.18)] md:p-8"
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
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold text-[#1f2937]">Terms and Conditions</h2>
            </div>

            <p className="mt-4 text-sm text-[#667085]">
              By ticking the agreement box and proceeding with payment, you
              acknowledge that you have read, understood, and agreed to the following
              Terms and Conditions.
            </p>

            <ol className="mt-5 list-decimal list-outside space-y-4 pl-5 text-sm leading-relaxed text-[#475467]">
              <li><strong className="text-[#1f2937]">Acceptance of Terms.</strong> By using RESEATO and completing a reservation, you agree to comply with all policies stated herein. If you do not agree with these terms, you must not proceed with the reservation or payment.</li>
              <li><strong className="text-[#1f2937]">Payment Policy.</strong> All reservation payments made through RESEATO are considered final and non-refundable once successfully processed.</li>
              <li><strong className="text-[#1f2937]">No Cancellation Policy.</strong> Once payment has been successfully processed, the reservation is confirmed and cannot be canceled, transferred, or rescheduled.</li>
              <li><strong className="text-[#1f2937]">Limitation of Liability.</strong> RESEATO utilizes third-party payment gateway providers. RESEATO shall not be held liable for any data breach, unauthorized access, or compromise of payment details.</li>
              <li><strong className="text-[#1f2937]">Accuracy of Information.</strong> Customers are responsible for providing accurate and complete personal and payment information.</li>
              <li><strong className="text-[#1f2937]">Restaurant Responsibility.</strong> RESEATO acts as a reservation platform only. The partnered restaurant is solely responsible for food quality, service delivery, and dining experience.</li>
              <li><strong className="text-[#1f2937]">Force Majeure.</strong> RESEATO shall not be held liable for failure to fulfill reservations due to events beyond reasonable control.</li>
              <li><strong className="text-[#1f2937]">System Availability.</strong> We do not guarantee uninterrupted access due to possible maintenance, updates, or technical issues.</li>
              <li><strong className="text-[#1f2937]">Amendments.</strong> RESEATO reserves the right to modify these Terms and Conditions at any time.</li>
              <li><strong className="text-[#1f2937]">No-Show Policy.</strong> Payment will be forfeited if the customer fails to appear at the reserved time.</li>
              <li><strong className="text-[#1f2937]">Chargeback Protection.</strong> Customers agree not to initiate fraudulent chargebacks.</li>
              <li><strong className="text-[#1f2937]">Privacy Policy.</strong> Personal data is collected, stored, and protected in accordance with our privacy practices.</li>
              <li><strong className="text-[#1f2937]">User Conduct.</strong> No fraudulent bookings or misuse of the platform is permitted.</li>
              <li><strong className="text-[#1f2937]">Time Allowance Policy.</strong> Reservation automatically expires if the customer arrives late (15-30 minutes grace period).</li>
            </ol>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#475467] transition hover:bg-[#f8fafc]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(146,63,74,0.24)] hover:brightness-105"
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

        if (error) throw error;

        if (data.session) {
          setMsgType("success");
          setMsg("Account created. You are now logged in.");
          setShowResendConfirmation(false);
          const target = await resolveRedirect(data.session);
          navigate(target, { replace: true });
          return;
        }

        const identities = data.user?.identities ?? [];
        if (Array.isArray(identities) && identities.length === 0) {
          setMode("login");
          setMsg("This email is already registered. If not confirmed yet, resend the confirmation email below.");
          setShowResendConfirmation(true);
          return;
        }

        setMsg(null);
        setConfirmationCardMsg(null);
        setShowResendConfirmation(false);
        setSignupConfirmationEmail(cleanEmail);
      }
    } catch (err: any) {
      const parsed = parseAuthError(err, "Auth failed");

      if (parsed.lower.includes("invalid login credentials") || parsed.lower.includes("invalid credentials")) {
        setMsg("Incorrect email or password. Please check your credentials and try again.");
      } else if (parsed.lower.includes("email not confirmed")) {
        setMsg("Email not confirmed yet. Check your inbox, or resend the confirmation link below.");
        setShowResendConfirmation(true);
      } else if (parsed.lower.includes("rate limit")) {
        setMsg("Too many attempts. Please wait a moment before trying again.");
        setShowResendConfirmation(false);
      } else if (parsed.lower.includes("error sending confirmation email")) {
        const resent = await resendConfirmationEmail(cleanEmail, "form");
        if (!resent) {
          setShowResendConfirmation(true);
        }
      } else if (parsed.lower.includes("user already registered")) {
        setMsg("This email is already registered. If not confirmed yet, resend the confirmation email below.");
        setShowResendConfirmation(true);
      } else if (parsed.lower.includes("user not found") || parsed.lower.includes("no user found")) {
        setMsg("No account found with this email. Please sign up first.");
      } else if (parsed.lower.includes("network") || parsed.lower.includes("fetch")) {
        setMsg("Unable to connect. Please check your internet connection and try again.");
      } else {
        setMsg("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (signupConfirmationEmail) {
    return (
      <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#f2f2f5] px-6 py-10">
        <div className="mx-auto mb-6 flex max-w-6xl justify-start">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#ded7d9] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#cdb8bd] hover:text-[#7b2f3b]"
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
            className="w-full max-w-[520px] rounded-[28px] border border-black/5 bg-white px-8 py-9 text-center shadow-[0_28px_60px_rgba(15,23,42,0.14)]"
          >
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#d8f3df] text-[#169c46]">
              <Mail className="h-11 w-11" />
            </div>
            <h1 className="mt-7 text-[34px] font-semibold tracking-tight text-[#1c2233] sm:text-[40px]">
              Confirm your registration
            </h1>

            <p className="mx-auto mt-4 max-w-[410px] text-[21px] leading-tight text-[#4f5870]">
              We&apos;ve sent a confirmation link to
            </p>
            <p className="mx-auto mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-1 text-[clamp(17px,2.4vw,27px)] font-semibold leading-tight text-[#111827]">
              {signupConfirmationEmail}
            </p>
            <p className="mx-auto mt-2 max-w-[430px] text-[21px] leading-tight text-[#4f5870]">
              Please check your email and click the link to activate your account.
            </p>

            {confirmationCardMsg && (
              <div className="mx-auto mt-4 max-w-[430px] rounded-xl border border-black/10 bg-[#f8fafc] px-4 py-3 text-sm text-[#334155]">
                {confirmationCardMsg}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                void resendConfirmationEmail(signupConfirmationEmail, "card");
              }}
              disabled={resendingConfirmation}
              className="mt-5 w-full rounded-2xl border border-[#d6dbe6] bg-white px-4 py-3 text-[18px] font-semibold text-[#334155] transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
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
              className="mt-8 w-full rounded-2xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-4 py-3.5 text-[22px] font-semibold text-white shadow-[0_12px_24px_rgba(146,63,74,0.35)] transition-transform hover:scale-[1.01] hover:brightness-105"
            >
              Back to Sign In
            </button>

            <p className="mx-auto mt-5 max-w-[430px] text-[16px] leading-snug text-[#7c8599]">
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
    <div className="fixed inset-0 overflow-hidden bg-[#f3f3f4] px-6 text-[#1f2937]">
      <div className="mx-auto flex h-full max-w-6xl flex-col py-6">
        <div className="z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#ded7d9] bg-white px-4 py-2.5 text-sm font-medium text-[#6b7280] shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#cdb8bd] hover:text-[#7b2f3b]"
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8b3d4a] shadow-sm shadow-[#e8ccd1] transition-all duration-300 group-hover:bg-[#7b2f3b]">
                  <UtensilsCrossed className="h-6 w-6 text-white" />
                </div>
                <span className="text-3xl font-bold tracking-tight text-neutral-900">RESEATO</span>
              </Link>
            </div>

            <div className="rounded-[24px] border border-[#e8e2e3] bg-white/85 p-8 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="text-xl font-semibold">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </div>
              <p className="mt-3 text-[18px] text-[#5b6374]">
                {mode === "login"
                  ? "Sign in to manage reservations and book faster."
                  : "Sign up to reserve tables, track bookings, and access exclusive features."}
              </p>

              <ul className="mt-7 space-y-3 text-[#1f2937]">
                <li className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f8ecee] text-[#7b2f3b]"><Check className="h-4 w-4" /></span><span className="text-lg">Reserve tables in seconds</span></li>
                <li className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f8ecee] text-[#7b2f3b]"><Check className="h-4 w-4" /></span><span className="text-lg">Skip the waiting lines</span></li>
                <li className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f8ecee] text-[#7b2f3b]"><Check className="h-4 w-4" /></span><span className="text-lg">Manage all your bookings</span></li>
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
            className={`rounded-[24px] border border-[#e6e2e4] bg-white p-6 md:p-10 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${
              mode === "signup" ? "max-h-[78vh] overflow-y-auto" : ""
            }`}
          >
            <div className="flex rounded-2xl border border-[#dccfd2] bg-[#f6edef] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setMsg(null);
                  setShowResendConfirmation(false);
                }}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  mode === "login"
                    ? "bg-[#8b3d4a] text-white shadow-[0_8px_16px_rgba(139,61,74,0.28)]"
                    : "text-[#7b2f3b] hover:bg-[#f3e6e9]"
                }`}
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
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  mode === "signup"
                    ? "bg-[#8b3d4a] text-white shadow-[0_8px_16px_rgba(139,61,74,0.28)]"
                    : "text-[#7b2f3b] hover:bg-[#f3e6e9]"
                }`}
              >
                Sign up
              </button>
            </div>

            <div className="mt-6">
              <h1 className="text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h1>
              <p className="mt-1 text-sm text-[#6b7280]">
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
                      className={`rounded-xl border px-4 py-3 text-left ${
                        role === "customer"
                          ? "border-[#c98d98] bg-[#f8ecee]"
                          : "border-[#e3dde0] bg-white hover:bg-[#faf6f7]"
                      }`}
                    >
                      <div className="text-sm font-medium">Customer</div>
                      <div className="text-xs text-[#6b7280]">Reserve tables</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("vendor")}
                      className={`rounded-xl border px-4 py-3 text-left ${
                        role === "vendor"
                          ? "border-[#c98d98] bg-[#f8ecee]"
                          : "border-[#e3dde0] bg-white hover:bg-[#faf6f7]"
                      }`}
                    >
                      <div className="text-sm font-medium">Restaurant Owner</div>
                      <div className="text-xs text-[#6b7280]">Manage bookings</div>
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
                      className="h-4 w-4 shrink-0 rounded border-[#d6c8cc] bg-white text-[#8b3d4a]"
                    />
                    <span className="text-xs text-[#4b5563] leading-none">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    state={{ email: email.trim() }}
                    className="text-xs font-semibold text-[#7b2f3b] hover:text-[#923f4a]"
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

                  <div className="rounded-2xl border border-[#e8d8dc] bg-[#fff9fa] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.15em] text-[#8b3d4a]">Password Health</p>
                        <p className={`text-sm font-semibold ${getStrengthTextClass(passwordStrengthScore)}`}>
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

                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#ede7e8]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrengthBarClass}`}
                        style={{ width: `${passwordStrengthPercent}%` }}
                      />
                    </div>

                    <div className="mt-2 text-[11px] text-[#6b7280]">
                      Requires uppercase, number, and special character to enable signup.
                    </div>

                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      <RequirementItem ok={passwordChecks.uppercase} text="Uppercase letter" />
                      <RequirementItem ok={passwordChecks.number} text="Number" />
                      <RequirementItem ok={passwordChecks.special} text="Special character" />
                      <RequirementItem ok={passwordChecks.minLength} text="At least 6 characters" />
                      <RequirementItem ok={passwordChecks.matches} text="Passwords match" />
                    </ul>

                    <div className="mt-2 text-[11px] text-[#8b97a8]">
                      {passwordStrengthPercent.toFixed(0)}% strength
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className={`inline-flex items-center gap-2 cursor-pointer transition ${
                  termsError && !agreed
                    ? "rounded-lg border border-[#f0a0a8] bg-[#fff5f6] px-2 py-1.5"
                    : ""
                }`}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      if (e.target.checked) { setTermsError(false); setFieldErrors((p) => { const n = { ...p }; delete n.terms; return n; }); }
                    }}
                    className="h-4 w-4 shrink-0 rounded border-[#d6c8cc] bg-white text-[#8b3d4a]"
                  />
                  <span className="text-xs text-[#4b5563] leading-none">
                    I have read and agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="font-semibold text-[#7b2f3b] underline underline-offset-2 hover:text-[#923f4a]"
                    >
                      Terms and Conditions
                    </button>
                  </span>
                </label>
                {termsError && !agreed && (
                  <p className="mt-1 pl-6 text-xs font-medium text-[#be123c]">
                    You must accept the Terms and Conditions to proceed.
                  </p>
                )}
              </div>

              {msg && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${
                  msgType === "success"
                    ? "border-[#b7e4c7] bg-[#ecfdf3] text-[#166534]"
                    : msgType === "info"
                      ? "border-[#bdd8f2] bg-[#eaf4ff] text-[#1d5f93]"
                      : "border-[#ead9dd] bg-[#fff7f8] text-[#7b2f3b]"
                }`}>
                  {msg}
                </div>
              )}

              {showResendConfirmation && (
                <div className="rounded-xl border border-[#ead9dd] bg-[#fff7f8] px-4 py-3">
                  <div className="text-xs text-[#6b7280]">
                    Need another confirmation email for
                    <span className="ml-1 font-medium text-[#111827]">
                      {(email.trim() || lastAuthEmail || "your account")}
                    </span>
                    ?
                  </div>
                  <button
                    type="button"
                    onClick={() => resendConfirmationEmail(email.trim() || lastAuthEmail)}
                    disabled={loading || resendingConfirmation}
                    className="mt-2 rounded-lg border border-[#d6c8cc] bg-white px-3 py-1.5 text-xs font-medium text-[#7b2f3b] hover:bg-[#fdf3f5] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendingConfirmation ? "Sending..." : "Resend confirmation email"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(146,63,74,0.24)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Please wait..." : mode === "login" ? (<>Sign In <span aria-hidden="true">&rarr;</span></>) : "Create account"}
              </button>

              <p className="mt-1 text-center text-sm text-[#6b7280]">
                {mode === "login" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("signup"); setMsg(null); setShowResendConfirmation(false); }}
                      className="font-semibold text-[#7b2f3b] hover:text-[#923f4a]"
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
                      className="font-semibold text-[#7b2f3b] hover:text-[#923f4a]"
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
    <label className="block space-y-1">
      <div className="text-sm text-[#4b5563]">{props.label}</div>
      <div className={`auth-field flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 ${
        props.error ? "border-[#e11d48] ring-1 ring-[#e11d48]/20" : "border-[#ddd8da]"
      }`}>
        <span className="text-[#9ca3af]">{props.icon}</span>
        <input
          type={props.type ?? "text"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="auth-input w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af]"
        />
      </div>
      {props.error && <p className="text-xs text-[#be123c]">{props.error}</p>}
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
    <label className="block space-y-1">
      <div className="text-sm text-[#4b5563]">{props.label}</div>
      <div className={`auth-field flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 ${
        props.error ? "border-[#e11d48] ring-1 ring-[#e11d48]/20" : "border-[#ddd8da]"
      }`}>
        <span className="text-[#9ca3af]">{props.icon}</span>
        <input
          type={props.show ? "text" : "password"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="auth-input w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af]"
          placeholder="********"
        />
        <button
          type="button"
          onClick={props.toggleShow}
          className="text-[#9ca3af] hover:text-[#6b7280]"
        >
          {props.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {props.error && <p className="text-xs text-[#be123c]">{props.error}</p>}
    </label>
  );
}
