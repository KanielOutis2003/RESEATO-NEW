import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Code2, Github, Linkedin } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const developers = [
  {
    name: "John Jecu Noval Cutanda",
    role: "Full-Stack Developer",
    initials: "JC",
    gradient: "from-[#8b3d4a] to-[#b46d73]",
  },
  {
    name: "Christian Earl James Boyles",
    role: "Full-Stack Developer",
    initials: "CB",
    gradient: "from-[#3d5a8b] to-[#6d8fb4]",
  },
];

export default function Footer() {
  const [devModalOpen, setDevModalOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-[#e8e2e3] bg-white text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <h3 className="text-3xl font-semibold tracking-wide">RESEATO</h3>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#667085]">
                Making restaurant reservations simple and elegant for Cebu's best dining spots.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold">Quick Links</h4>
              <div className="mt-4 space-y-2 text-sm text-[#667085]">
                <Link to="/restaurants" className="block hover:text-[#7b2f3b]">Browse Restaurants</Link>
                <Link to="/my-reservations" className="block hover:text-[#7b2f3b]">My Reservations</Link>
                <Link to="/" className="block hover:text-[#7b2f3b]">Home</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xl font-semibold">Contact</h4>
              <div className="mt-4 space-y-2 text-sm text-[#667085]">
                <p>SM Seaside, Cebu City</p>
                <p>support@reseato.com</p>
                <p>+63 123 456 7890</p>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#ece8e9] pt-6">
            <p className="text-sm text-[#98a2b3]">&copy; 2026 RESEATO. All rights reserved.</p>
            <button
              type="button"
              onClick={() => setDevModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-4 py-1.5 text-xs font-semibold text-[#667085] transition hover:border-[#c98d98] hover:bg-[#fdf2f4] hover:text-[#7b2f3b]"
            >
              <Code2 className="h-3.5 w-3.5" />
              Developers
            </button>
          </div>
        </div>
      </footer>

      {/* Developer Modal */}
      <AnimatePresence>
        {devModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
            onClick={() => setDevModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.22 }}
              className="relative w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-[0_28px_60px_rgba(15,23,42,0.22)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#8b3d4a] to-[#b46d73] px-6 py-5 text-center text-white">
                <Code2 className="mx-auto mb-2 h-8 w-8 opacity-80" />
                <h2 className="text-xl font-bold tracking-wide">Meet the Developers</h2>
                <p className="mt-1 text-sm opacity-80">The team behind RESEATO</p>
              </div>

              <button
                type="button"
                onClick={() => setDevModalOpen(false)}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Developer Cards */}
              <div className="space-y-4 p-6">
                {developers.map((dev) => (
                  <div
                    key={dev.initials}
                    className="flex items-center gap-4 rounded-2xl border border-[#ece8e9] bg-gradient-to-br from-[#fdfbfc] to-[#faf5f7] p-4 transition hover:shadow-md"
                  >
                    <div className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br ${dev.gradient} text-lg font-bold text-white shadow-md`}>
                      {dev.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold text-[#1f2937]">{dev.name}</div>
                      <div className="text-sm text-[#667085]">{dev.role}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-[#ece8e9] px-6 py-4 text-center">
                <p className="text-xs text-[#98a2b3]">Built with passion for Cebu's dining community</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
