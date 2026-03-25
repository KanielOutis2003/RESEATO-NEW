import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, X, Info, FileText } from "lucide-react";
import { useSession } from "../lib/auth/useSession";
import { getPostAuthRedirect } from "../lib/auth/roleRedirect";

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

function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
              <li><strong className="text-[#1f2937]">Acceptance of Terms.</strong> By using RESEATO and completing a reservation, you agree to comply with all policies stated herein.</li>
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

export default function HomePage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    let alive = true;

    async function redirectAuthedUser() {
      if (loading || !session) return;

      const target = await getPostAuthRedirect(session);
      if (!alive) return;

      if (target !== "/") {
        navigate(target, { replace: true });
      }
    }

    void redirectAuthedUser();

    return () => {
      alive = false;
    };
  }, [loading, navigate, session]);

  async function onGetStarted() {
    if (session) {
      const target = await getPostAuthRedirect(session);
      navigate(target, { replace: true });
      return;
    }
    navigate("/log-in-sign-up");
  }

  if (loading) {
    return <div className="h-screen bg-black" />;
  }

  if (session) {
    return null;
  }

  return (
    <>
    <AboutModal open={showAboutModal} onClose={() => setShowAboutModal(false)} />
    <TermsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
    <div className="relative h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2400&q=90"
          alt="Restaurant interior"
          className="hero-bg-motion h-full w-full object-cover"
        />
      </div>

      <div className="absolute inset-0 bg-black/58" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(43,16,20,0.58)_0%,rgba(16,11,12,0.44)_48%,rgba(14,10,10,0.74)_100%)]" />

      <div className="relative z-10 flex h-screen flex-col">
        <header className="mx-auto flex w-full max-w-[1520px] items-center justify-between gap-2 px-4 pt-4 sm:px-9 sm:pt-5 lg:px-10">
          <Link to="/" className="group flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(44,42,47,0.85)] ring-1 ring-white/10 backdrop-blur transition-all duration-300 group-hover:bg-[rgba(70,52,56,0.92)] sm:h-11 sm:w-11 sm:rounded-2xl">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <span className="whitespace-nowrap text-[clamp(1.28rem,5.5vw,2rem)] leading-none font-semibold tracking-tight text-white max-[380px]:text-[1.12rem]">
              RESEATO
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onGetStarted}
              className="shrink-0 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#b46d73] to-[#923f4a] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(116,43,53,0.42)] hover:brightness-105 max-[380px]:px-2.5 max-[380px]:text-[0.78rem] sm:px-[1.22rem] sm:py-[0.48rem] sm:text-[clamp(0.88rem,0.88vw,1.1rem)]"
            >
              Get Started
            </button>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-[1520px] flex-1 items-center justify-center px-6 text-center sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-[760px]"
          >
            <h1 className="text-[clamp(1.95rem,3vw,3rem)] leading-[1.1] font-semibold tracking-tight text-white drop-shadow-[0_8px_16px_rgba(0,0,0,0.38)]">
              Restaurants in Cebu City
            </h1>

            <p className="mx-auto mt-3 max-w-[740px] text-[clamp(0.98rem,1.35vw,1.45rem)] leading-[1.32] font-medium text-white/95 drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]">
              Book the Best Tables at Top Rated Restaurants, Skip the Line,
              Enjoy the Dine and Suggest What&apos;s Best.
            </p>
          </motion.div>
        </section>

        <footer className="pb-5">
          <div className="mx-auto flex w-full max-w-[1520px] items-center justify-center gap-4 text-[clamp(0.9rem,0.9vw,1.08rem)] text-white/90">
            <button type="button" onClick={() => setShowAboutModal(true)} className="hover:text-white">
              About
            </button>
            <span className="text-white/50">|</span>
            <button type="button" onClick={() => setShowTermsModal(true)} className="hover:text-white">
              Terms and Conditions
            </button>
          </div>
        </footer>
      </div>
    </div>
    </>
  );
}
