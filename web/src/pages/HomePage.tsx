import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, X,
  ChevronDown, Star, MapPin, Instagram,
  Facebook, Twitter, Send,
  Code2, FileText, Shield, BookOpen
} from "lucide-react";
import { useSession } from "../lib/auth/useSession";
import { getPostAuthRedirect } from "../lib/auth/roleRedirect";
import { listFeaturedRestaurants } from "../lib/api/restaurants.api";

type FeaturedRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  location: string;
  rating: number;
  priceLevel: number;
  description?: string;
  imageUrl?: string;
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";

const PRICE_LABELS: Record<number, string> = {
  1: "Budget Friendly",
  2: "Moderate",
  3: "Upscale",
  4: "Fine Dining",
};

/* ─────────────────────────────────────────
   Shared overlay backdrop
───────────────────────────────────────── */
function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(10,5,7,0.72)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   Shared light modal shell — white body + maroon header
───────────────────────────────────────── */
function LightModalShell({
  open,
  onClose,
  icon,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: string;
  maxWidth?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <ModalBackdrop onClose={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={`relative w-full ${maxWidth} overflow-hidden bg-white`}
            style={{
              borderRadius: "20px",
              boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
              maxHeight: "90vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Maroon header */}
            <div
              className="relative px-8 pt-8 pb-7 text-center"
              style={{
                background: "linear-gradient(135deg, #b46d73 0%, #923f4a 100%)",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/30"
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex justify-center mb-3 text-white">{icon}</div>
              <h2
                className="text-2xl font-semibold"
                style={{
                  color: "#fff",
                  fontFamily: "'Cormorant Garamond', serif",
                  letterSpacing: "0.01em",
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className="mt-1 text-sm"
                  style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'Jost', sans-serif" }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            {/* Body */}
            <div
              className="overflow-y-auto px-6 py-6"
              style={{ maxHeight: "calc(90vh - 240px)", background: "#fff" }}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div
                className="px-6 py-4 text-center"
                style={{ background: "#f7f5f6", borderTop: "1px solid #eee" }}
              >
                <p
                  className="text-xs"
                  style={{ color: "#9a8a92", fontFamily: "'Jost', sans-serif" }}
                >
                  {footer}
                </p>
              </div>
            )}
          </motion.div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────
   ABOUT MODAL
───────────────────────────────────────── */
function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // @ts-ignore - deep type instantiation
  const { t } = useTranslation();
  return (
    <LightModalShell
      open={open}
      onClose={onClose}
      icon={<BookOpen className="h-7 w-7" />}
      title={t("home.aboutTitle")}
      subtitle={t("home.aboutSubtitle")}
      footer={t("home.aboutFooter")}
    >
      <p className="leading-relaxed text-sm" style={{ color: "#5b4751", fontFamily: "'Jost', sans-serif" }}>
        {t("home.aboutBody1")}
      </p>
      <p className="mt-3 leading-relaxed text-sm" style={{ color: "#5b4751", fontFamily: "'Jost', sans-serif" }}>
        {t("home.aboutBody2")}
      </p>
    </LightModalShell>
  );
}

/* ─────────────────────────────────────────
   RESTAURANTS MODAL
───────────────────────────────────────── */
function RestaurantsModal({
  open,
  onClose,
  onGetStarted,
}: {
  open: boolean;
  onClose: () => void;
  onGetStarted: () => void;
}) {
  const { t } = useTranslation();
  return (
    <LightModalShell
      open={open}
      onClose={onClose}
      icon={<UtensilsCrossed className="h-7 w-7" />}
      title={t("home.discoverTitle")}
      subtitle={t("home.discoverSubtitle")}
      footer={t("home.discoverFooter")}
    >
      <p className="leading-relaxed text-sm" style={{ color: "#5b4751", fontFamily: "'Jost', sans-serif" }}>
        {t("home.discoverBody")}
      </p>
      <button
        type="button"
        onClick={() => { onClose(); onGetStarted(); }}
        className="mt-5 w-full py-3 text-sm font-semibold tracking-widest uppercase transition hover:brightness-110"
        style={{
          borderRadius: "10px",
          background: "linear-gradient(135deg, #b46d73, #923f4a)",
          color: "#fff",
          letterSpacing: "0.12em",
          boxShadow: "0 8px 24px rgba(146,63,74,0.35)",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        {t("home.browseRestaurants")}
      </button>
    </LightModalShell>
  );
}

/* ─────────────────────────────────────────
   TERMS MODAL
───────────────────────────────────────── */
function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const termKeys = [
    "acceptance",
    "payment",
    "noCancellation",
    "liability",
    "accuracy",
    "restaurant",
    "forceMajeure",
    "systemAvailability",
    "amendments",
    "noShow",
    "chargeback",
    "privacy",
    "userConduct",
    "timeAllowance",
  ] as const;
  return (
    <LightModalShell
      open={open}
      onClose={onClose}
      icon={<FileText className="h-7 w-7" />}
      title={t("home.termsTitle")}
      subtitle={t("home.termsSubtitle")}
      footer={t("home.termsFooter")}
      maxWidth="max-w-2xl"
    >
      <p className="text-xs leading-relaxed mb-4" style={{ color: "#7a6a72", fontFamily: "'Jost', sans-serif" }}>
        {t("home.termsIntro")}
      </p>
      <ol className="space-y-3 list-decimal list-outside pl-5">
        {termKeys.map((key) => (
          <li key={key} className="text-sm leading-relaxed" style={{ color: "#5b4751", fontFamily: "'Jost', sans-serif" }}>
            <span className="font-semibold" style={{ color: "#923f4a" }}>{t(`home.terms.${key}.0`)}. </span>
            {t(`home.terms.${key}.1`)}
          </li>
        ))}
      </ol>
    </LightModalShell>
  );
}

/* ─────────────────────────────────────────
   PRIVACY POLICY MODAL
───────────────────────────────────────── */
function PrivacyPolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const privacyKeys = [
    "collect",
    "useData",
    "protection",
    "thirdParty",
    "cookies",
    "rights",
    "retention",
    "contact",
  ] as const;
  return (
    <LightModalShell
      open={open}
      onClose={onClose}
      icon={<Shield className="h-7 w-7" />}
      title={t("home.privacyTitle")}
      subtitle={t("home.privacySubtitle")}
      footer={t("home.privacyFooter")}
      maxWidth="max-w-2xl"
    >
      <p className="text-xs leading-relaxed mb-4" style={{ color: "#7a6a72", fontFamily: "'Jost', sans-serif" }}>
        {t("home.privacyIntro")}
      </p>
      <ol className="space-y-3 list-decimal list-outside pl-5">
        {privacyKeys.map((key) => (
          <li key={key} className="text-sm leading-relaxed" style={{ color: "#5b4751", fontFamily: "'Jost', sans-serif" }}>
            <span className="font-semibold" style={{ color: "#923f4a" }}>{t(`home.privacy.${key}.0`)}. </span>
            {t(`home.privacy.${key}.1`)}
          </li>
        ))}
      </ol>
    </LightModalShell>
  );
}

/* ─────────────────────────────────────────
   DEVELOPERS MODAL
───────────────────────────────────────── */
function DevelopersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const devs = [
    { name: "John Jecu Noval Cutanda", role: "Full-Stack Developer", initials: "JC", gradient: "linear-gradient(135deg, #b46d73, #923f4a)" },
    { name: "Christian Earl James Boyles", role: "Full-Stack Developer", initials: "CB", gradient: "linear-gradient(135deg, #5a7bb8, #3d5d9e)" },
  ];
  return (
    <LightModalShell
      open={open}
      onClose={onClose}
      icon={<Code2 className="h-7 w-7" />}
      title={t("home.devsTitle")}
      subtitle={t("home.devsSubtitle")}
      footer={t("home.devsFooter")}
    >
      <div className="space-y-3">
        {devs.map((d) => (
          <div
            key={d.initials}
            className="flex items-center gap-4 p-4 rounded-2xl"
            style={{
              background: "#faf7f8",
              border: "1px solid #eee",
            }}
          >
            <div
              className="h-12 w-12 flex-shrink-0 rounded-full grid place-items-center text-sm font-bold"
              style={{
                background: d.gradient,
                color: "#fff",
                fontFamily: "'Jost', sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              {d.initials}
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "#2d1a22", fontFamily: "'Jost', sans-serif" }}>{d.name}</div>
              <div className="text-xs mt-0.5" style={{ color: "#9a8a92", fontFamily: "'Jost', sans-serif" }}>{d.role}</div>
            </div>
          </div>
        ))}
      </div>
    </LightModalShell>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const { t, i18n } = useTranslation();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [showRestaurantsModal, setShowRestaurantsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [featured, setFeatured] = useState<FeaturedRestaurant[]>([]);

  useEffect(() => {
    let alive = true;
    async function redirectAuthedUser() {
      if (loading || !session) return;
      const target = await getPostAuthRedirect(session);
      if (!alive) return;
      if (target !== "/") navigate(target, { replace: true });
    }
    void redirectAuthedUser();
    return () => { alive = false; };
  }, [loading, navigate, session]);

  useEffect(() => {
    let alive = true;
    if (session) return;
    listFeaturedRestaurants()
      .then((data) => { if (alive) setFeatured(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [session]);

  async function onGetStarted() {
    if (session) {
      const target = await getPostAuthRedirect(session);
      navigate(target, { replace: true });
      return;
    }
    navigate("/log-in-sign-up");
  }

  function scrollToFeatured() {
    const element = document.getElementById("featured-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }

  if (loading) return <div className="h-screen" style={{ background: "#0a0507" }} />;
  if (session) return null;

  return (
    <>
      {/* Global font injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');

        .hero-bg-motion {
          animation: subtleZoom 18s ease-in-out infinite alternate;
        }
        @keyframes subtleZoom {
          from { transform: scale(1); }
          to   { transform: scale(1.06); }
        }
        .gold-shimmer {
          background: linear-gradient(135deg, #b46d73 0%, #923f4a 45%, #8b3d4a 100%);
        }
        .nav-link {
          position: relative;
          font-family: 'Jost', sans-serif;
          font-weight: 400;
          font-size: 0.8rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(245,237,228,0.7);
          transition: color 0.2s;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1px;
          background: #b46d73;
          transition: width 0.3s ease;
        }
        .nav-link:hover { color: #b46d73; }
        .nav-link:hover::after { width: 100%; }

        .card-hover {
          transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s, border-color 0.4s;
        }
        .card-hover:hover {
          transform: translateY(-6px);
          box-shadow:
            0 0 0 1px rgba(201,160,122,0.55),
            0 18px 50px rgba(201,160,122,0.28),
            0 0 80px rgba(201,160,122,0.22),
            inset 0 1px 0 rgba(245,237,228,0.06) !important;
          border-color: rgba(201,160,122,0.55) !important;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f0608; }
        ::-webkit-scrollbar-thumb { background: #4a1c24; border-radius: 3px; }
      `}</style>

      <AboutModal open={showAboutModal} onClose={() => setShowAboutModal(false)} />
      <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
      <DevelopersModal open={showDevModal} onClose={() => setShowDevModal(false)} />
      <RestaurantsModal open={showRestaurantsModal} onClose={() => setShowRestaurantsModal(false)} onGetStarted={onGetStarted} />
      <PrivacyPolicyModal open={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />

      <div style={{ background: "#0a0507", color: "#f5ede4", fontFamily: "'Jost', sans-serif" }}>

        {/* ══════════════════════════════
            HERO
        ══════════════════════════════ */}
        <div className="relative min-h-screen overflow-hidden flex flex-col">

          {/* Background image */}
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2400&q=90"
              alt="Restaurant interior"
              className="hero-bg-motion h-full w-full object-cover"
            />
          </div>

          {/* Layered overlays */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,5,7,0.62) 0%, rgba(10,5,7,0.38) 45%, rgba(10,5,7,0.82) 100%)" }} />
          {/* Subtle vignette */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(10,5,7,0.55) 100%)" }} />

        {/* ── NAVBAR ── */}
        <header className="sticky top-0 z-50 w-full transition-all duration-300 bg-[rgba(10,5,7,0.45)] backdrop-blur-md">
          <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-5 sm:px-10 lg:px-14">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  boxShadow: "0 4px 18px rgba(146,63,74,0.45)",
                }}
              >
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <div>
                <span
                  className="text-[1.45rem] leading-none font-light tracking-[0.18em]"
                  style={{ color: "#f5ede4", fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.22em" }}
                >
                  RESEATO
                </span>
                <div className="h-px mt-0.5" style={{ background: "linear-gradient(to right, #b46d73, transparent)" }} />
              </div>
            </Link>

            <div className="flex items-center gap-3">
              {/* Get Started Button */}
              <motion.button
                type="button"
                onClick={onGetStarted}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-2.5 text-xs font-medium tracking-widest uppercase"
                style={{
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #b46d73 0%, #923f4a 60%, #8b3d4a 100%)",
                  color: "#fff",
                  letterSpacing: "0.14em",
                  boxShadow: "0 8px 24px rgba(146,63,74,0.45)",
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                {t("common.getStarted")}
              </motion.button>

              {/* Language Toggle */}
              <button
                type="button"
                onClick={() => i18n.changeLanguage(i18n.language === "fil" ? "en" : "fil")}
                className="grid h-9 w-9 place-items-center rounded-full text-[10px] font-bold uppercase tracking-wider transition hover:brightness-110"
                style={{
                  background: "rgba(28,13,16,0.6)",
                  border: "1px solid rgba(201,160,122,0.35)",
                  color: "#c9a07a",
                }}
              >
                {i18n.language === "fil" ? "FIL" : "EN"}
              </button>
            </div>
          </div>

          {/* Thin maroon line under nav */}
          <div className="mx-6 sm:mx-10 lg:mx-14" style={{ height: "1px", background: "linear-gradient(to right, transparent, rgba(180,109,115,0.25), transparent)" }} />
        </header>

          {/* ── HERO CONTENT ── */}
          <section className="relative z-10 flex flex-1 items-center justify-center px-6 text-center sm:px-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[700px]"
            >
              {/* Eyebrow */}
              <motion.p
                initial={{ opacity: 0, letterSpacing: "0.1em" }}
                animate={{ opacity: 1, letterSpacing: "0.28em" }}
                transition={{ duration: 0.9, delay: 0.1 }}
                className="text-xs font-light uppercase mb-5"
                style={{ color: "#ffffff", fontFamily: "'Jost', sans-serif", letterSpacing: "0.28em" }}
              >
                {t("home.eyebrow")}
              </motion.p>

              {/* Headline */}
              <h1
                className="leading-[1.08] font-light"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(3rem, 7vw, 5.5rem)",
                  color: "#f5ede4",
                  textShadow: "0 4px 32px rgba(0,0,0,0.5)",
                  letterSpacing: "-0.01em",
                }}
              >
                {t("home.headline1")}<br />
                <em style={{ color: "#c9a07a", fontStyle: "italic" }}>{t("home.headline2")}</em><br />
                {t("home.headline3")}
              </h1>

              {/* Ornament */}
              <div className="flex items-center justify-center gap-4 my-7">
                <div className="h-px w-16" style={{ background: "linear-gradient(to right, transparent, #c9a07a)" }} />
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="4" y="0" width="2" height="10" fill="#c9a07a" />
                  <rect x="0" y="4" width="10" height="2" fill="#c9a07a" />
                </svg>
                <div className="h-px w-16" style={{ background: "linear-gradient(to left, transparent, #c9a07a)" }} />
              </div>

              {/* Sub */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.7 }}
                className="text-base font-light leading-relaxed"
                style={{ color: "rgba(245,237,228,0.72)", fontFamily: "'Jost', sans-serif", fontWeight: 300, letterSpacing: "0.02em" }}
              >
                {t("home.subtitle")}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <motion.button
                  type="button"
                  onClick={featured.length > 0 ? scrollToFeatured : onGetStarted}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="px-9 py-4 text-sm font-medium tracking-widest uppercase"
                  style={{
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #b46d73 0%, #923f4a 55%, #8b3d4a 100%)",
                    color: "#fff",
                    letterSpacing: "0.16em",
                    boxShadow: "0 16px 40px rgba(146,63,74,0.5)",
                    fontFamily: "'Jost', sans-serif",
                    minWidth: "220px",
                  }}
                >
                  {t("home.exploreRestaurants")}
                </motion.button>
              </motion.div>
            </motion.div>
          </section>

          {/* Scroll indicator */}
          {featured.length > 0 && (
            <div className="relative z-10 pb-8 text-center cursor-pointer" onClick={scrollToFeatured}>
              <motion.div
                animate={{ y: [0, 7, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="inline-flex flex-col items-center gap-2"
                style={{ color: "rgba(180,109,115,0.5)" }}
              >
                <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: "#c9a07a" }}>Explore</span>
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </div>
          )}

        </div>

        {/* ══════════════════════════════
            FEATURED RESTAURANTS — unified dark luxury theme
        ══════════════════════════════ */}
        {featured.length > 0 && (
          <section
            id="featured-section"
            className="relative px-6 py-24 sm:py-32"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(146,63,74,0.18) 0%, transparent 55%), linear-gradient(180deg, #0a0507 0%, #120709 50%, #0a0507 100%)",
            }}
          >
            {/* Decorative top accent line — replaces the broken divider */}
            <div
              className="absolute left-1/2 top-0 -translate-x-1/2 h-px w-[60%] max-w-[640px]"
              style={{ background: "linear-gradient(to right, transparent, rgba(180,109,115,0.45), transparent)" }}
            />

            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p
                className="text-xs tracking-[0.32em] uppercase mb-4"
                style={{ color: "#c9a07a", fontFamily: "'Jost', sans-serif" }}
              >
                {t("home.curatedSelection")}
              </p>
              <h2
                className="font-light"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
                  color: "#c9a07a",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                {t("home.featuredRestaurants")}
              </h2>
              <div className="flex items-center justify-center gap-4 mt-6">
                <div
                  className="h-px w-20"
                  style={{ background: "linear-gradient(to right, transparent, rgba(201,160,122,0.85))" }}
                />
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="4" y="0" width="2" height="10" fill="#c9a07a" />
                  <rect x="0" y="4" width="10" height="2" fill="#c9a07a" />
                </svg>
                <div
                  className="h-px w-20"
                  style={{ background: "linear-gradient(to left, transparent, rgba(201,160,122,0.85))" }}
                />
              </div>
              <p
                className="mt-5 text-sm font-light"
                style={{ color: "rgba(245,237,228,0.6)", fontFamily: "'Jost', sans-serif" }}
              >
                {t("home.featuredSubtitle")}
              </p>
            </motion.div>

            {/* Cards */}
            <div className="mx-auto max-w-[1200px] grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  onClick={onGetStarted}
                  className="card-hover group cursor-pointer overflow-hidden"
                  style={{
                    borderRadius: "18px",
                    background:
                      "linear-gradient(180deg, rgba(28,13,16,0.85) 0%, rgba(18,7,9,0.95) 100%)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(201,160,122,0.22)",
                    boxShadow:
                      "0 18px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,160,122,0.10), inset 0 1px 0 rgba(245,237,228,0.04)",
                  }}
                >
                  {/* Image */}
                  <div className="relative h-[220px] overflow-hidden">
                    <img
                      src={r.imageUrl || FALLBACK_IMG}
                      alt={r.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(10,5,7,0.92) 0%, rgba(10,5,7,0.25) 55%, transparent 100%)",
                      }}
                    />

                    {/* Rating */}
                    <div
                      className="absolute left-3 top-3 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold"
                      style={{
                        borderRadius: "20px",
                        background: "rgba(10,5,7,0.72)",
                        color: "#f5ede4",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(180,109,115,0.35)",
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      <Star className="h-3 w-3" style={{ fill: "#d4a373", color: "#d4a373" }} />
                      {r.rating.toFixed(1)}
                    </div>

                    {/* Price badge */}
                    <div
                      className="absolute right-3 top-3 px-2.5 py-1 text-[10px] font-medium tracking-wider uppercase"
                      style={{
                        borderRadius: "20px",
                        background: "linear-gradient(135deg, #b46d73, #923f4a)",
                        color: "#fff",
                        fontFamily: "'Jost', sans-serif",
                        letterSpacing: "0.1em",
                        boxShadow: "0 4px 14px rgba(146,63,74,0.45)",
                      }}
                    >
                      {PRICE_LABELS[Math.min(4, Math.max(1, r.priceLevel))] ?? "Budget Friendly"}
                    </div>

                    {/* Name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p
                        className="text-[10px] tracking-[0.22em] uppercase mb-1"
                        style={{ color: "#b46d73", fontFamily: "'Jost', sans-serif" }}
                      >
                        {r.cuisine}
                      </p>
                      <h3
                        className="font-light"
                        style={{
                          color: "#f5ede4",
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: "1.5rem",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {r.name}
                      </h3>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div
                    className="px-4 py-3.5 flex items-center justify-between"
                    style={{ borderTop: "1px solid rgba(201,160,122,0.18)" }}
                  >
                    <div
                      className="flex items-center gap-1.5 text-xs min-w-0"
                      style={{ color: "rgba(245,237,228,0.55)", fontFamily: "'Jost', sans-serif" }}
                    >
                      <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: "#c9a07a" }} />
                      <span className="truncate">{r.location}</span>
                    </div>
                    <span
                      className="text-xs font-medium tracking-wider uppercase whitespace-nowrap ml-2"
                      style={{
                        color: "#c9a07a",
                        fontFamily: "'Jost', sans-serif",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {t("common.viewAndBook")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-16 text-center"
            >
              <motion.button
                type="button"
                onClick={onGetStarted}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 text-sm font-medium tracking-widest uppercase"
                style={{
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #b46d73 0%, #923f4a 55%, #8b3d4a 100%)",
                  color: "#fff",
                  letterSpacing: "0.16em",
                  boxShadow: "0 16px 40px rgba(146,63,74,0.35)",
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                {t("home.browseAllRestaurants")}
              </motion.button>
            </motion.div>
          </section>
        )}

        {/* ══════════════════════════════
            FOOTER
        ══════════════════════════════ */}
        <footer style={{ background: "#0a0507", borderTop: "1px solid rgba(180,109,115,0.1)" }} className="pt-20 pb-10">
          <div className="mx-auto max-w-[1480px] px-6 sm:px-10 lg:px-14">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
              
              {/* Brand Section */}
              <div className="flex flex-col gap-6">
                <Link to="/" className="flex items-center gap-3 group w-fit">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#b46d73] to-[#923f4a]">
                    <UtensilsCrossed className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xl tracking-[0.15em] font-light" style={{ color: "#f5ede4", fontFamily: "'Cormorant Garamond', serif" }}>
                    RESEATO
                  </span>
                </Link>
                <p className="text-sm leading-relaxed text-white/50 max-w-xs">
                  Elevating your dining experience in Cebu. Book exclusive tables at the city's most coveted restaurants.
                </p>
                <div className="flex items-center gap-4">
                  {[
                    { Icon: Instagram, href: "#" },
                    { Icon: Facebook, href: "#" },
                    { Icon: Twitter, href: "#" }
                  ].map(({ Icon, href }, idx) => (
                    <a 
                      key={idx} 
                      href={href} 
                      className="p-2 rounded-lg bg-white/5 text-white/50 hover:bg-[#b46d73]/20 hover:text-[#b46d73] transition-all"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-6 text-[#c9a07a] font-semibold">Explore</h4>
                <ul className="flex flex-col gap-4">
                  <li><button onClick={() => setShowAboutModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Our Story</button></li>
                  <li><button onClick={() => setShowRestaurantsModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Restaurants</button></li>
                  <li><button onClick={() => setShowDevModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Developers</button></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-6 text-[#c9a07a] font-semibold">Legal</h4>
                <ul className="flex flex-col gap-4">
                  <li><button onClick={() => setShowTermsModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Terms & Conditions</button></li>
                  <li><button onClick={() => setShowPrivacyModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Privacy Policy</button></li>
                </ul>
              </div>

              {/* Newsletter */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-6 text-[#c9a07a] font-semibold">Newsletter</h4>
                <p className="text-sm text-white/50 mb-4">Subscribe for exclusive dining invites and news.</p>
                <div className="relative">
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#b46d73]/50 transition-colors"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#b46d73] text-white hover:brightness-110 transition-all">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-top border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] tracking-wider text-white/30 uppercase">
                © {new Date().getFullYear()} RESEATO · Cebu City, Philippines
              </p>
              <div className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-white/20 uppercase">
                Crafted with <Star className="h-3 w-3 text-[#b46d73]/40 fill-[#b46d73]/20" /> in Cebu
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
