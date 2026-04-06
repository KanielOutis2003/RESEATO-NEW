import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UtensilsCrossed, X, Info, FileText, Code2, 
  ChevronDown, Star, MapPin, Instagram, 
  Facebook, Twitter, Mail, Send 
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
   Divider ornament used inside modals
───────────────────────────────────────── */
function OrnamentDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #b46d73)" }} />
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="6" y="0" width="2" height="14" fill="#b46d73" />
        <rect x="0" y="6" width="14" height="2" fill="#b46d73" />
        <rect x="4" y="4" width="6" height="6" fill="#b46d73" opacity="0.4" />
      </svg>
      <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, #b46d73)" }} />
    </div>
  );
}

/* ─────────────────────────────────────────
   ABOUT MODAL
───────────────────────────────────────── */
function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <ModalBackdrop onClose={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg overflow-hidden"
            style={{
              borderRadius: "20px",
              background: "linear-gradient(160deg, #1c0d10 0%, #14080b 100%)",
              border: "1px solid rgba(180,109,115,0.22)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,109,115,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Maroon top accent bar */}
            <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #b46d73 30%, #923f4a 70%, transparent)" }} />

            {/* Header */}
            <div className="px-8 pt-7 pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-[0.25em] uppercase mb-1.5" style={{ color: "#b46d73" }}>Our Story</p>
                  <h2 className="text-2xl font-semibold" style={{ color: "#f5ede4", fontFamily: "'Georgia', serif", letterSpacing: "-0.01em" }}>
                    About RESEATO
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-1 grid h-8 w-8 place-items-center rounded-full transition"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(180,109,115,0.2)", color: "#b46d73" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <OrnamentDivider />
            </div>

            {/* Body */}
            <div className="px-8 pb-8">
              <p className="leading-relaxed text-sm" style={{ color: "#c4a898" }}>
                RESEATO helps you book the best tables at top‑rated restaurants in SM City and SM Seaside Cebu. Skip the line, enjoy the dine — and suggest what's best.
              </p>
              <p className="mt-3 leading-relaxed text-sm" style={{ color: "#c4a898" }}>
                Our platform connects diners with their favourite restaurants, providing seamless online reservations with secure payment processing. Whether you're planning a casual lunch or a special celebration, RESEATO makes it effortless.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="mt-7 w-full py-3 text-sm font-semibold tracking-widest uppercase transition hover:brightness-110"
                style={{
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#fff",
                  letterSpacing: "0.12em",
                  boxShadow: "0 8px 24px rgba(146,63,74,0.4)",
                }}
              >
                Close
              </button>
            </div>
          </motion.div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────
   TERMS MODAL
───────────────────────────────────────── */
function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <ModalBackdrop onClose={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl overflow-hidden"
            style={{
              borderRadius: "20px",
              background: "linear-gradient(160deg, #1c0d10 0%, #14080b 100%)",
              border: "1px solid rgba(180,109,115,0.22)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,109,115,0.15)",
              maxHeight: "88vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #b46d73 30%, #923f4a 70%, transparent)" }} />

            <div className="px-8 pt-7 pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-[0.25em] uppercase mb-1.5" style={{ color: "#b46d73" }}>Legal</p>
                  <h2 className="text-2xl font-semibold" style={{ color: "#f5ede4", fontFamily: "'Georgia', serif" }}>
                    Terms & Conditions
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-1 grid h-8 w-8 place-items-center rounded-full transition"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(180,109,115,0.2)", color: "#b46d73" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <OrnamentDivider />
              <p className="text-xs leading-relaxed mb-4" style={{ color: "#9e7a6b" }}>
                By ticking the agreement box and proceeding with payment, you acknowledge that you have read, understood, and agreed to the following Terms and Conditions.
              </p>
            </div>

            <div className="overflow-y-auto px-8 pb-8" style={{ maxHeight: "52vh" }}>
              <ol className="space-y-3 list-decimal list-outside pl-5">
                {[
                  ["Acceptance of Terms", "By using RESEATO and completing a reservation, you agree to comply with all policies stated herein."],
                  ["Payment Policy", "All reservation payments made through RESEATO are considered final and non-refundable once successfully processed."],
                  ["No Cancellation Policy", "Once payment has been successfully processed, the reservation is confirmed and cannot be canceled, transferred, or rescheduled."],
                  ["Limitation of Liability", "RESEATO utilizes third-party payment gateway providers. RESEATO shall not be held liable for any data breach, unauthorized access, or compromise of payment details."],
                  ["Accuracy of Information", "Customers are responsible for providing accurate and complete personal and payment information."],
                  ["Restaurant Responsibility", "RESEATO acts as a reservation platform only. The partnered restaurant is solely responsible for food quality, service delivery, and dining experience."],
                  ["Force Majeure", "RESEATO shall not be held liable for failure to fulfil reservations due to events beyond reasonable control."],
                  ["System Availability", "We do not guarantee uninterrupted access due to possible maintenance, updates, or technical issues."],
                  ["Amendments", "RESEATO reserves the right to modify these Terms and Conditions at any time."],
                  ["No-Show Policy", "Payment will be forfeited if the customer fails to appear at the reserved time."],
                  ["Chargeback Protection", "Customers agree not to initiate fraudulent chargebacks."],
                  ["Privacy Policy", "Personal data is collected, stored, and protected in accordance with our privacy practices."],
                  ["User Conduct", "No fraudulent bookings or misuse of the platform is permitted."],
                  ["Time Allowance Policy", "Reservation automatically expires if the customer arrives late (15–30 minutes grace period)."],
                ].map(([title, body]) => (
                  <li key={title} className="text-sm leading-relaxed" style={{ color: "#c4a898" }}>
                    <span className="font-semibold" style={{ color: "#e8cdb8" }}>{title}. </span>
                    {body}
                  </li>
                ))}
              </ol>
            </div>

            <div className="px-8 pb-8 pt-4" style={{ borderTop: "1px solid rgba(180,109,115,0.1)" }}>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 text-sm font-semibold tracking-widest uppercase transition hover:brightness-110"
                style={{
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#fff",
                  letterSpacing: "0.12em",
                  boxShadow: "0 8px 24px rgba(146,63,74,0.4)",
                }}
              >
                Close
              </button>
            </div>
          </motion.div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────
   DEVELOPERS MODAL
───────────────────────────────────────── */
function DevelopersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const devs = [
    { name: "John Jecu Noval Cutanda", role: "Full-Stack Developer", initials: "JC" },
    { name: "Christian Earl James Boyles", role: "Full-Stack Developer", initials: "CB" },
  ];
  return (
    <AnimatePresence>
      {open && (
        <ModalBackdrop onClose={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden"
            style={{
              borderRadius: "20px",
              background: "linear-gradient(160deg, #1c0d10 0%, #14080b 100%)",
              border: "1px solid rgba(180,109,115,0.22)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,109,115,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #b46d73 30%, #923f4a 70%, transparent)" }} />

            <div className="px-8 pt-7 pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-[0.25em] uppercase mb-1.5" style={{ color: "#b46d73" }}>The Team</p>
                  <h2 className="text-2xl font-semibold" style={{ color: "#f5ede4", fontFamily: "'Georgia', serif" }}>
                    Our Developers
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-1 grid h-8 w-8 place-items-center rounded-full transition"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(180,109,115,0.2)", color: "#b46d73" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <OrnamentDivider />
            </div>

            <div className="px-8 pb-2 space-y-4">
              {devs.map((d) => (
                <div
                  key={d.initials}
                  className="flex items-center gap-5 p-4 rounded-2xl"
                  style={{
                    background: "rgba(180,109,115,0.06)",
                    border: "1px solid rgba(180,109,115,0.14)",
                  }}
                >
                  <div
                    className="h-14 w-14 flex-shrink-0 rounded-full grid place-items-center text-base font-bold"
                    style={{
                      background: "linear-gradient(135deg, #b46d73, #923f4a)",
                      color: "#f5ede4",
                      boxShadow: "0 4px 16px rgba(146,63,74,0.45)",
                      fontFamily: "'Georgia', serif",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {d.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "#f0ddd0" }}>{d.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#b46d73" }}>{d.role}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-8 py-5 mt-1 text-center" style={{ borderTop: "1px solid rgba(180,109,115,0.1)" }}>
              <p className="text-xs tracking-wider uppercase" style={{ color: "#6b4535", letterSpacing: "0.15em" }}>
                Crafted with passion · Cebu, Philippines
              </p>
            </div>
          </motion.div>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
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
          transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s;
        }
        .card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 60px rgba(146,63,74,0.22), 0 0 0 1px rgba(180,109,115,0.18) !important;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f0608; }
        ::-webkit-scrollbar-thumb { background: #4a1c24; border-radius: 3px; }
      `}</style>

      <AboutModal open={showAboutModal} onClose={() => setShowAboutModal(false)} />
      <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
      <DevelopersModal open={showDevModal} onClose={() => setShowDevModal(false)} />

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
              Get Started
            </motion.button>

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
                style={{ color: "#c9a07a", fontFamily: "'Jost', sans-serif", letterSpacing: "0.28em" }}
              >
                Fine Dining · Cebu City
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
                Cebu's Finest<br />
                <em style={{ color: "#c9a07a", fontStyle: "italic" }}>Dining Reserved</em><br />
                for You
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
                Book the best tables at top‑rated restaurants in SM City & SM Seaside.
                Skip the line — enjoy the dine.
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
                  onClick={scrollToFeatured}
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
                  Explore Restaurants
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
                <span className="text-[10px] tracking-[0.3em] uppercase">Explore</span>
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </div>
          )}

          {/* Bottom mobile nav links (visible only on mobile) */}
          <div className="relative z-10 pb-5 sm:hidden">
            <div className="flex items-center justify-center gap-5">
              <button type="button" className="nav-link text-[0.7rem]" onClick={() => setShowAboutModal(true)}>About</button>
              <span style={{ color: "rgba(180,109,115,0.3)" }}>·</span>
              <button type="button" className="nav-link text-[0.7rem]" onClick={() => setShowTermsModal(true)}>Terms</button>
              <span style={{ color: "rgba(180,109,115,0.3)" }}>·</span>
              <button type="button" className="nav-link text-[0.7rem]" onClick={() => setShowDevModal(true)}>Developers</button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════
            FEATURED RESTAURANTS
        ══════════════════════════════ */}
        {featured.length > 0 && (
          <section
            id="featured-section"
            className="relative px-6 py-20 sm:py-28"
            style={{ background: "linear-gradient(180deg, #0a0507 0%, #fdfcfb 25%, #ffffff 100%)" }}
          >
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#b46d73", fontFamily: "'Jost', sans-serif" }}>
                Curated Selection
              </p>
              <h2
                className="font-light"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
                  color: "#1c0d10",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                Featured Restaurants
              </h2>
              <div className="flex items-center justify-center gap-4 mt-5">
                <div className="h-px w-12" style={{ background: "linear-gradient(to right, transparent, #b46d73)" }} />
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <rect x="3" y="0" width="2" height="8" fill="#b46d73" />
                  <rect x="0" y="3" width="8" height="2" fill="#b46d73" />
                </svg>
                <div className="h-px w-12" style={{ background: "linear-gradient(to left, transparent, #b46d73)" }} />
              </div>
              <p className="mt-4 text-sm font-light" style={{ color: "#6b7280", fontFamily: "'Jost', sans-serif" }}>
                Hand‑picked dining experiences from Cebu's finest establishments
              </p>
            </motion.div>

            {/* Cards */}
            <div className="mx-auto max-w-[1200px] grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  onClick={onGetStarted}
                  className="card-hover cursor-pointer overflow-hidden"
                  style={{
                    borderRadius: "16px",
                    background: "#fff",
                    boxShadow: "0 8px 32px rgba(10,5,7,0.12), 0 0 0 1px rgba(146,63,74,0.08)",
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
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,5,7,0.72) 0%, transparent 55%)" }} />

                    {/* Rating */}
                    <div
                      className="absolute left-3 top-3 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold"
                      style={{
                        borderRadius: "20px",
                        background: "rgba(255,255,255,0.92)",
                        color: "#1f2937",
                        backdropFilter: "blur(8px)",
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      <Star className="h-3 w-3" style={{ fill: "#d97706", color: "#d97706" }} />
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
                      }}
                    >
                      {PRICE_LABELS[Math.min(4, Math.max(1, r.priceLevel))] ?? "Budget Friendly"}
                    </div>

                    {/* Name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-[10px] tracking-[0.2em] uppercase mb-0.5" style={{ color: "#b46d73", fontFamily: "'Jost', sans-serif" }}>{r.cuisine}</p>
                      <h3 className="text-lg font-light" style={{ color: "#f5ede4", fontFamily: "'Cormorant Garamond', serif", fontSize: "1.35rem" }}>{r.name}</h3>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderTop: "1px solid rgba(146,63,74,0.08)" }}>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9b7a6d", fontFamily: "'Jost', sans-serif" }}>
                      <MapPin className="h-3 w-3" style={{ color: "#923f4a" }} />
                      <span className="truncate">{r.location}</span>
                    </div>
                    <span
                      className="text-xs font-medium tracking-wider uppercase"
                      style={{ color: "#b46d73", fontFamily: "'Jost', sans-serif", letterSpacing: "0.1em" }}
                    >
                      View & Book →
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
                Browse All Restaurants
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
                <h4 className="text-xs tracking-[0.2em] uppercase mb-6 text-[#b46d73] font-semibold">Explore</h4>
                <ul className="flex flex-col gap-4">
                  <li><button onClick={() => setShowAboutModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Our Story</button></li>
                  <li><button onClick={onGetStarted} className="text-sm text-white/60 hover:text-white transition-colors">Restaurants</button></li>
                  <li><button onClick={() => setShowDevModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Developers</button></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-6 text-[#b46d73] font-semibold">Legal</h4>
                <ul className="flex flex-col gap-4">
                  <li><button onClick={() => setShowTermsModal(true)} className="text-sm text-white/60 hover:text-white transition-colors">Terms & Conditions</button></li>
                  <li><button className="text-sm text-white/60 hover:text-white transition-colors">Privacy Policy</button></li>
                </ul>
              </div>

              {/* Newsletter */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-6 text-[#b46d73] font-semibold">Newsletter</h4>
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
