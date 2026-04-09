import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Beef,
  CookingPot,
  Drumstick,
  Fish,
  Globe2,
  Leaf,
  MapPin,
  Pizza,
  Search,
  Shell,
  Soup,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { Restaurant } from "../lib/types/restaurants";
import { listRestaurants } from "../lib/api/restaurants.api";
import { useSession } from "../lib/auth/useSession";
import { getPostAuthRedirect } from "../lib/auth/roleRedirect";
import LuxuryNavbar from "../components/layouts/LuxuryNavbar";
import LuxuryFooter from "../components/layouts/LuxuryFooter";

type Category = {
  key: string;
  label: string;
  icon: LucideIcon;
  matches: (cuisine: string) => boolean;
};

function hasAnyCuisine(cuisine: string, keywords: string[]) {
  const value = cuisine.toLowerCase();
  return keywords.some((keyword) => value.includes(keyword));
}

const CATEGORIES: Category[] = [
  { key: "all", label: "All", icon: UtensilsCrossed, matches: () => true },
  {
    key: "asian",
    label: "Asian",
    icon: Globe2,
    matches: (c) =>
      hasAnyCuisine(c, [
        "asian",
        "vietnamese",
        "filipino",
        "cebuano",
        "korean",
        "japanese",
        "chinese",
        "thai",
        "ramen",
        "sushi",
      ]),
  },
  {
    key: "vietnamese",
    label: "Vietnamese",
    icon: Soup,
    matches: (c) => hasAnyCuisine(c, ["vietnamese", "pho"]),
  },
  {
    key: "filipino",
    label: "Filipino",
    icon: CookingPot,
    matches: (c) => hasAnyCuisine(c, ["filipino", "cebuano", "bisaya"]),
  },
  {
    key: "korean",
    label: "Korean",
    icon: Beef,
    matches: (c) => hasAnyCuisine(c, ["korean", "samgyeopsal", "kimchi"]),
  },
  {
    key: "japanese",
    label: "Japanese",
    icon: Fish,
    matches: (c) => hasAnyCuisine(c, ["japanese", "sushi", "ramen", "izakaya"]),
  },
  {
    key: "western",
    label: "Western",
    icon: Pizza,
    matches: (c) =>
      hasAnyCuisine(c, [
        "western",
        "american",
        "italian",
        "french",
        "steak",
        "burger",
        "pasta",
        "grill",
      ]),
  },
  {
    key: "chinese",
    label: "Chinese",
    icon: Drumstick,
    matches: (c) =>
      hasAnyCuisine(c, ["chinese", "cantonese", "sichuan", "szechuan", "dim sum"]),
  },
  {
    key: "thai",
    label: "Thai",
    icon: Leaf,
    matches: (c) => hasAnyCuisine(c, ["thai", "tom yum", "pad thai"]),
  },
  {
    key: "seafood",
    label: "Seafood",
    icon: Shell,
    matches: (c) => hasAnyCuisine(c, ["seafood", "fish", "crab", "shrimp"]),
  },
];

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";

const PRICE_LABELS: Record<number, string> = {
  1: "Budget Friendly",
  2: "Moderate",
  3: "Upscale",
  4: "Fine Dining",
};

export default function RestaurantsPage() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  const [items, setItems] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    let alive = true;

    async function ensureAccess() {
      if (sessionLoading) return;

      if (!session) {
        if (alive) setAccessChecked(true);
        return;
      }

      const target = await getPostAuthRedirect(session);
      if (!alive) return;

      if (target !== "/restaurants") {
        navigate(target, { replace: true });
        return;
      }

      setAccessChecked(true);
    }

    void ensureAccess();

    return () => {
      alive = false;
    };
  }, [navigate, session, sessionLoading]);

  useEffect(() => {
    if (!accessChecked) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listRestaurants();
        if (!alive) return;
        setItems(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load restaurants");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [accessChecked]);

  const normalizedQuery = useMemo(
    () => query.replace(/\s+/g, " ").trim().toLowerCase(),
    [query],
  );

  const activeCat = useMemo(
    () => CATEGORIES.find((c) => c.key === activeCategory) ?? CATEGORIES[0],
    [activeCategory],
  );

  const filtered = useMemo(() => {
    return items.filter((r) => {
      const name = String(r.name ?? "").toLowerCase();
      const location = String(r.location ?? "").toLowerCase();
      const cuisine = String(r.cuisine ?? "").toLowerCase();

      const matchesQuery =
        normalizedQuery.length === 0 ||
        name.includes(normalizedQuery) ||
        location.includes(normalizedQuery) ||
        cuisine.includes(normalizedQuery);

      const matchesCategory = activeCat.matches(cuisine);
      return matchesQuery && matchesCategory;
    });
  }, [items, normalizedQuery, activeCat]);

  const pageStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');

      .reseato-card {
        transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s, border-color 0.4s;
      }
      .reseato-card:hover {
        transform: translateY(-6px);
        box-shadow:
          0 0 0 1px rgba(201,160,122,0.55),
          0 18px 50px rgba(201,160,122,0.28),
          0 0 80px rgba(201,160,122,0.22),
          inset 0 1px 0 rgba(245,237,228,0.06) !important;
        border-color: rgba(201,160,122,0.55) !important;
      }

      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { scrollbar-width: none; }
    `}</style>
  );

  if (!accessChecked) {
    return (
      <>
        {pageStyles}
        <div style={{ background: "#0a0507", color: "#f5ede4", fontFamily: "'Jost', sans-serif" }}>
          <LuxuryNavbar />
          <div className="relative min-h-[60vh] w-full">
            <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center px-6 py-8">
              <div
                className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm"
                style={{
                  background: "rgba(28,13,16,0.65)",
                  border: "1px solid rgba(201,160,122,0.22)",
                  color: "rgba(245,237,228,0.7)",
                }}
              >
                <UtensilsCrossed className="h-4 w-4" style={{ color: "#c9a07a" }} />
                Checking access...
              </div>
            </div>
          </div>
          <LuxuryFooter />
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {pageStyles}
        <div style={{ background: "#0a0507", color: "#f5ede4", fontFamily: "'Jost', sans-serif" }}>
        <LuxuryNavbar />
        <div
          className="relative min-h-[60vh] w-full overflow-hidden"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(146,63,74,0.18) 0%, transparent 55%)",
            }}
          />
          <div className="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl flex-col justify-center px-6 py-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-6 flex items-center gap-3"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                className="grid h-11 w-11 place-items-center rounded-xl text-white"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  boxShadow: "0 10px 22px rgba(146,63,74,0.45)",
                }}
              >
                <UtensilsCrossed className="h-5 w-5" />
              </motion.div>
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-[0.28em]"
                  style={{ color: "#c9a07a" }}
                >
                  RESEATO
                </div>
                <div
                  className="text-lg font-light"
                  style={{ color: "#f5ede4", fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Preparing restaurants for you...
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="rounded-[20px] p-6"
              style={{
                background:
                  "linear-gradient(180deg, rgba(28,13,16,0.85) 0%, rgba(18,7,9,0.95) 100%)",
                border: "1px solid rgba(201,160,122,0.22)",
              }}
            >
              <div className="h-6 w-48 rounded-xl" style={{ background: "rgba(201,160,122,0.12)" }} />
              <div className="mt-3 h-4 w-80 max-w-full rounded-lg" style={{ background: "rgba(201,160,122,0.08)" }} />
              <div className="mt-2 h-4 w-72 max-w-full rounded-lg" style={{ background: "rgba(201,160,122,0.08)" }} />
              <div className="mt-5 h-11 w-[420px] max-w-full rounded-2xl" style={{ background: "rgba(146,63,74,0.18)" }} />
            </motion.div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <motion.div
                  key={idx}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.7, delay: idx * 0.2 }}
                  className="overflow-hidden rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(28,13,16,0.85) 0%, rgba(18,7,9,0.95) 100%)",
                    border: "1px solid rgba(201,160,122,0.22)",
                  }}
                >
                  <div className="h-36" style={{ background: "rgba(201,160,122,0.08)" }} />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-40 rounded-lg" style={{ background: "rgba(201,160,122,0.10)" }} />
                    <div className="h-4 w-56 max-w-full rounded-lg" style={{ background: "rgba(201,160,122,0.06)" }} />
                    <div className="h-8 w-20 rounded-xl" style={{ background: "rgba(146,63,74,0.18)" }} />
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 text-sm" style={{ color: "rgba(245,237,228,0.5)" }}>
              Loading restaurants...
            </div>
          </div>
        </div>
        <LuxuryFooter />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {pageStyles}
        <div style={{ background: "#0a0507", color: "#f5ede4", fontFamily: "'Jost', sans-serif" }}>
          <LuxuryNavbar />
          <div className="relative min-h-[60vh] w-full">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(146,63,74,0.12)",
                  border: "1px solid rgba(180,109,115,0.4)",
                  color: "#f5ede4",
                }}
              >
                {error}
              </div>
            </div>
          </div>
          <LuxuryFooter />
        </div>
      </>
    );
  }

  return (
    <>
      {pageStyles}
      <div
        className="relative w-full"
        style={{ background: "#0a0507", color: "#f5ede4", fontFamily: "'Jost', sans-serif" }}
      >
        <LuxuryNavbar />
        {/* ── HERO ── */}
        <section
          className="relative px-6 py-20 sm:py-24 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(146,63,74,0.18) 0%, transparent 55%), linear-gradient(180deg, #0a0507 0%, #120709 50%, #0a0507 100%)",
          }}
        >
          {/* Decorative top accent line */}
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 h-px w-[60%] max-w-[640px]"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(180,109,115,0.45), transparent)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-center"
          >
            <p
              className="text-xs tracking-[0.32em] uppercase mb-4"
              style={{ color: "#c9a07a" }}
            >
              Browse Restaurants
            </p>
            <h1
              className="font-light"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(1.4rem, 2.6vw, 2.2rem)",
                fontStyle: "italic",
                color: "#c9a07a",
                letterSpacing: "0.005em",
                lineHeight: 1.4,
                maxWidth: "46ch",
                marginLeft: "auto",
                marginRight: "auto",
                textAlign: "center",
              }}
            >
              “Welcome. Indulge in Cebu’s finest dining experiences, carefully selected for your pleasure.”
            </h1>
            <div className="flex items-center justify-center gap-4 mt-6">
              <div
                className="h-px w-20"
                style={{
                  background:
                    "linear-gradient(to right, transparent, rgba(201,160,122,0.85))",
                }}
              />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="4" y="0" width="2" height="10" fill="#c9a07a" />
                <rect x="0" y="4" width="10" height="2" fill="#c9a07a" />
              </svg>
              <div
                className="h-px w-20"
                style={{
                  background:
                    "linear-gradient(to left, transparent, rgba(201,160,122,0.85))",
                }}
              />
            </div>
            <p
              className="mt-5 text-sm font-light"
              style={{ color: "rgba(245,237,228,0.6)" }}
            >
              “Step into a world of exceptional flavors—experience the best restaurants Cebu has to offer.”
            </p>

            {/* Search */}
            <div className="mt-8 mx-auto max-w-[480px]">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "rgba(201,160,122,0.7)" }}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search restaurants..."
                  className="w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none transition-colors"
                  style={{
                    background: "rgba(28,13,16,0.7)",
                    border: "1px solid rgba(201,160,122,0.22)",
                    color: "#f5ede4",
                    fontFamily: "'Jost', sans-serif",
                  }}
                />
              </label>
            </div>
          </motion.div>
        </section>

        {/* ── CATEGORY PILLS ── */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
          >
            {CATEGORIES.map((c) => {
              const active = c.key === activeCategory;
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  onClick={() => setActiveCategory(c.key)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-all duration-200"
                  style={
                    active
                      ? {
                          background:
                            "linear-gradient(135deg, #b46d73 0%, #923f4a 60%, #8b3d4a 100%)",
                          color: "#fff",
                          border: "1px solid transparent",
                          boxShadow: "0 8px 24px rgba(146,63,74,0.45)",
                          fontFamily: "'Jost', sans-serif",
                        }
                      : {
                          background: "rgba(28,13,16,0.55)",
                          color: "rgba(245,237,228,0.7)",
                          border: "1px solid rgba(201,160,122,0.18)",
                          fontFamily: "'Jost', sans-serif",
                        }
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              );
            })}
          </motion.div>
        </div>

        {/* ── CARDS ── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 pt-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p
                className="text-[10px] tracking-[0.32em] uppercase mb-2"
                style={{ color: "#c9a07a", fontFamily: "'Jost', sans-serif" }}
              >
                Curated Selection
              </p>
              <h2
                className="font-light"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                  color: "#c9a07a",
                  lineHeight: 1.1,
                }}
              >
                Recommended Restaurants
              </h2>
              <p
                className="mt-2 text-sm font-light"
                style={{ color: "rgba(245,237,228,0.55)" }}
              >
                Top-rated dining spots picked for you
              </p>
            </div>
            <p
              className="text-xs"
              style={{ color: "rgba(245,237,228,0.45)" }}
            >
              Showing {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                background: "rgba(28,13,16,0.55)",
                border: "1px solid rgba(201,160,122,0.18)",
              }}
            >
              <div
                className="text-base font-light"
                style={{
                  color: "rgba(245,237,228,0.7)",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.4rem",
                }}
              >
                No restaurants found
              </div>
              <p
                className="mt-2 text-sm"
                style={{ color: "rgba(245,237,228,0.4)" }}
              >
                Try adjusting your filters or search term
              </p>
            </div>
          ) : (
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r, idx) => {
                const priceLevel = Math.min(
                  4,
                  Math.max(1, Number((r as any).priceLevel) || 1),
                );
                const rating = Number((r as any).rating ?? 0);
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: Math.min(idx * 0.04, 0.25),
                      ease: "easeOut",
                    }}
                    onClick={() => navigate(`/restaurants/${r.id}`)}
                    className="reseato-card group cursor-pointer overflow-hidden"
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
                        src={(r as any).imageUrl || FALLBACK_IMG}
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
                        <Star
                          className="h-3 w-3"
                          style={{ fill: "#d4a373", color: "#d4a373" }}
                        />
                        {rating.toFixed(1)}
                      </div>

                      {/* Price */}
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
                        {PRICE_LABELS[priceLevel]}
                      </div>

                      {/* Name overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p
                          className="text-[10px] tracking-[0.22em] uppercase mb-1"
                          style={{ color: "#c9a07a", fontFamily: "'Jost', sans-serif" }}
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

                    {/* Footer */}
                    <div
                      className="px-4 py-3.5 flex items-center justify-between"
                      style={{ borderTop: "1px solid rgba(201,160,122,0.18)" }}
                    >
                      <div
                        className="flex items-center gap-1.5 text-xs min-w-0"
                        style={{
                          color: "rgba(245,237,228,0.55)",
                          fontFamily: "'Jost', sans-serif",
                        }}
                      >
                        <MapPin
                          className="h-3 w-3 flex-shrink-0"
                          style={{ color: "#c9a07a" }}
                        />
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
                        View & Book →
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
        <LuxuryFooter />
      </div>
    </>
  );
}
