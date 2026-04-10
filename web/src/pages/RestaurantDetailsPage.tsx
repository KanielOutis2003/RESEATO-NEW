import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import {
  getRestaurant,
  RestaurantDetails,
} from "../lib/api/restaurantDetails.api";
import { createReservation, getSlots, Slot } from "../lib/api/reservations.api";
import { useAuth } from "../lib/auth/useAuth";
import { ApiError } from "../lib/api/client";
import LuxuryNavbar from "../components/layouts/LuxuryNavbar";
import LuxuryFooter from "../components/layouts/LuxuryFooter";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Phone,
  Star,
  UtensilsCrossed,
  X,
} from "lucide-react";

const GOLD = "#c9a07a";
const CREAM = "#f5ede4";
const DARK_BG = "#0a0507";
const CARD_BG = "rgba(16,8,10,0.75)";
const CARD_BORDER = "1px solid rgba(201,160,122,0.18)";
const GOLD_BORDER = "1px solid rgba(201,160,122,0.28)";
const SERIF = "'Cormorant Garamond', serif";
const SANS = "'Jost', sans-serif";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatPrettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function to12Hour(raw: string) {
  const hhmm = String(raw).slice(0, 5);
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const RESTAURANT_MAP_QUERIES: Record<string, string> = {
  "sachi ramen": "Sachi Ramen SM City Cebu",
  "somac korean": "Somac Korean Restaurant SM Seaside Cebu",
  "boy belly": "Boy Belly SM Seaside Cebu",
  "seafood & ribs warehouse": "Seafood & Ribs Warehouse SM Seaside Cebu",
  "kuya j": "Kuya J SM Seaside City Cebu",
  "cabalen": "Cabalen SM Seaside City Cebu",
  "chika-an": "Chika-an Cebuano Kitchen SM City Cebu",
  "mesa restaurant": "Mesa Restaurant Philippines SM Seaside Cebu",
  "seoul black": "Seoul Black SM Seaside City Cebu",
  "superbowl of china": "Superbowl of China SM City Cebu",
};

function getMapQuery(restaurantName: string): string {
  const lower = restaurantName.toLowerCase();
  for (const [key, value] of Object.entries(RESTAURANT_MAP_QUERIES)) {
    if (lower.includes(key)) return value;
  }
  return `${restaurantName} Cebu`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload as { message?: string } | undefined;
    return payload?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

const PRICE_LABELS: Record<number, string> = {
  1: "Budget Friendly",
  2: "Moderate",
  3: "Upscale",
  4: "Fine Dining",
};

function priceLabel(level: number | undefined) {
  if (!level) return "";
  return PRICE_LABELS[level] ?? "";
}

/* ── Gallery Lightbox ── */
function GalleryLightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const prev = useCallback(() => setIdx((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, next, prev]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-sm"
      style={{ background: "rgba(5,2,3,0.85)" }}
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 grid h-9 w-9 place-items-center rounded-full shadow-lg transition hover:brightness-110"
          style={{ background: CREAM, color: DARK_BG, border: GOLD_BORDER }}
        >
          <X className="h-4 w-4" />
        </button>
        <img src={images[idx]} alt={`Gallery ${idx + 1}`} className="max-h-[85vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl" style={{ border: GOLD_BORDER }} />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full backdrop-blur transition hover:brightness-125"
              style={{ background: "rgba(16,8,10,0.8)", color: GOLD, border: GOLD_BORDER }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full backdrop-blur transition hover:brightness-125"
              style={{ background: "rgba(16,8,10,0.8)", color: GOLD, border: GOLD_BORDER }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs backdrop-blur"
              style={{ background: "rgba(16,8,10,0.8)", color: CREAM, border: GOLD_BORDER, fontFamily: SANS }}
            >
              {idx + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RestaurantDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthed, user, loading: authLoading } = useAuth();
  const { id } = useParams();

  const [data, setData] = useState<RestaurantDetails | null>(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [namePrefilled, setNamePrefilled] = useState(false);
  const [guests, setGuests] = useState(2);
  const [note, setNote] = useState("");
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const heroUrl =
    data?.imageUrl ??
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2400&q=80&sat=-10";
  const gallery = data?.galleryImages ?? [];

  // Pre-fill name from user profile
  useEffect(() => {
    if (!user || namePrefilled) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName =
      (typeof meta.full_name === "string" ? meta.full_name.trim() : "") ||
      [typeof meta.first_name === "string" ? meta.first_name.trim() : "", typeof meta.last_name === "string" ? meta.last_name.trim() : ""].filter(Boolean).join(" ");
    if (fullName) {
      setName(fullName);
      setNamePrefilled(true);
    }
    const userPhone = typeof meta.phone === "string" ? meta.phone.trim() : "";
    if (userPhone && !phone) {
      setPhone(userPhone);
    }
  }, [user, namePrefilled, phone]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    async function loadRestaurant() {
      setLoadingRestaurant(true);
      setMsg(null);
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const details = await getRestaurant(id!);
          if (!alive) return;
          setData(details);
          return;
        } catch (error) {
          if (!alive) return;
          if (attempt === 2) {
            setData(null);
            setMsg(getErrorMessage(error, "Unable to load restaurant details."));
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (alive) setLoadingRestaurant(false);
    }
    loadRestaurant().finally(() => { if (alive) setLoadingRestaurant(false); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoadingSlots(true);
    setMsg(null);

    async function fetchSlots(retries: number) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const r = await getSlots(id!, date, guests);
          if (!alive) return;
          setSlots(r.slots);
          const first = r.slots.find((s) => s.available)?.time ?? "";
          setTime(first);
          return;
        } catch (error) {
          if (!alive) return;
          if (attempt === retries) {
            setSlots([]);
            setTime("");
            setMsg(getErrorMessage(error, "Unable to load available slots."));
          }
          // wait before retrying
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    fetchSlots(2).finally(() => { if (alive) setLoadingSlots(false); });
    return () => { alive = false; };
  }, [id, date, guests]);

  const availableTimes = useMemo(() => slots.filter((s) => {
    if (!s.available) return false;
    if (s.remainingTables != null && s.remainingTables <= 0) return false;
    return true;
  }), [slots]);

  function decGuests() { setGuests((g) => Math.max(1, g - 1)); }
  function incGuests() { setGuests((g) => Math.min(50, g + 1)); }

  // Reset time selection when guest count makes current slot unavailable
  useEffect(() => {
    if (!time) return;
    const slot = slots.find((s) => s.time === time);
    if (slot && slot.remainingGuests != null && slot.remainingGuests < guests) {
      const fallback = slots.find((s) => s.available && (s.remainingGuests == null || s.remainingGuests >= guests))?.time ?? "";
      setTime(fallback);
    }
  }, [guests, slots, time]);

  async function onReserve() {
    if (!id) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await createReservation({ restaurantId: id, name, phone, date, time, guests });
      setBookingOpen(false);
      navigate(`/payment/${res.id}`);
    } catch (e: any) {
      setMsg(e?.payload?.message ?? e?.message ?? "Reservation failed");
    } finally {
      setSubmitting(false);
    }
  }

  /* Loading state */
  if (loadingRestaurant) {
    return (
      <div
        className="relative min-h-screen w-full"
        style={{
          background: `radial-gradient(ellipse at top, rgba(180,109,115,0.08), transparent 60%), ${DARK_BG}`,
          color: CREAM,
          fontFamily: SANS,
        }}
      >
        <LuxuryNavbar />
        <div className="mx-auto flex min-h-[70vh] max-w-[1480px] flex-col justify-center px-6 sm:px-10 lg:px-14 py-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6 flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
              className="grid h-12 w-12 place-items-center rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #b46d73, #923f4a)", boxShadow: "0 18px 40px rgba(146,63,74,0.35)" }}
            >
              <UtensilsCrossed className="h-5 w-5" />
            </motion.div>
            <div>
              <div className="text-xs tracking-[0.3em] uppercase" style={{ color: GOLD }}>RESEATO</div>
              <div className="text-lg font-light" style={{ color: CREAM, fontFamily: SERIF }}>Preparing restaurant details...</div>
            </div>
          </motion.div>
          <motion.div
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="rounded-[28px] p-6"
            style={{ background: CARD_BG, border: CARD_BORDER, backdropFilter: "blur(12px)" }}
          >
            <div className="h-8 w-64 rounded-xl" style={{ background: "rgba(201,160,122,0.12)" }} />
            <div className="mt-4 h-4 w-[520px] max-w-full rounded-lg" style={{ background: "rgba(201,160,122,0.08)" }} />
            <div className="mt-2 h-4 w-[460px] max-w-full rounded-lg" style={{ background: "rgba(201,160,122,0.08)" }} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="h-24 rounded-2xl" style={{ background: "rgba(201,160,122,0.1)" }} />
              <div className="h-24 rounded-2xl" style={{ background: "rgba(201,160,122,0.1)" }} />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="relative min-h-screen w-full"
        style={{
          background: `radial-gradient(ellipse at top, rgba(180,109,115,0.08), transparent 60%), ${DARK_BG}`,
          color: CREAM,
          fontFamily: SANS,
        }}
      >
        <LuxuryNavbar />
        <div className="mx-auto max-w-[1480px] px-6 sm:px-10 lg:px-14 py-10">
          <div
            className="rounded-2xl px-5 py-4 text-sm"
            style={{
              background: "rgba(201,74,85,0.10)",
              border: "1px solid rgba(232,139,147,0.3)",
              color: "#e88b93",
            }}
          >
            {msg ?? "Unable to load restaurant details."}
          </div>
        </div>
      </div>
    );
  }

  const ratingStars = Array.from({ length: 5 }, (_, i) => i < Math.round(Number(data.rating)));

  return (
    <div
      className="relative min-h-screen w-full"
      style={{
        background: `radial-gradient(ellipse at top, rgba(180,109,115,0.08), transparent 60%), ${DARK_BG}`,
        color: CREAM,
        fontFamily: SANS,
      }}
    >
      <LuxuryNavbar />

      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1480px] px-6 sm:px-10 lg:px-14 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[0.2em] uppercase transition hover:brightness-125"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: GOLD_BORDER,
            color: GOLD,
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative h-[340px] overflow-hidden rounded-[28px] sm:h-[420px]"
          style={{ border: GOLD_BORDER, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
        >
          <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,5,7,0.3) 0%, rgba(10,5,7,0.55) 50%, rgba(10,5,7,0.92) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 80% 20%, rgba(180,109,115,0.25), transparent 55%)",
            }}
          />

          <div className="relative flex h-full flex-col justify-end px-7 pb-9 sm:px-10">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-[10px] tracking-[0.2em] uppercase backdrop-blur-md"
                style={{ background: "rgba(201,160,122,0.15)", color: GOLD, border: "1px solid rgba(201,160,122,0.4)" }}
              >
                {data.cuisine}
              </span>
              {data.priceLevel && (
                <span
                  className="rounded-full px-3 py-1 text-[10px] tracking-[0.2em] uppercase backdrop-blur-md"
                  style={{ background: "rgba(201,160,122,0.15)", color: GOLD, border: "1px solid rgba(201,160,122,0.4)" }}
                >
                  {priceLabel(data.priceLevel)}
                </span>
              )}
            </div>
            <h1
              className="mt-4 text-4xl font-light leading-none tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: CREAM, fontFamily: SERIF, textShadow: "0 2px 20px rgba(0,0,0,0.7)" }}
            >
              {data.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm" style={{ color: "rgba(245,237,228,0.85)" }}>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" style={{ color: GOLD }} /> {data.location}
              </span>
              <span className="inline-flex items-center gap-1">
                {ratingStars.map((filled, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5"
                    style={filled ? { fill: GOLD, color: GOLD } : { color: "rgba(245,237,228,0.3)" }}
                  />
                ))}
                <span className="ml-1.5 font-semibold" style={{ color: GOLD }}>{Number(data.rating).toFixed(1)}</span>
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Content ── */}
      <section className="mx-auto max-w-[1480px] px-6 sm:px-10 lg:px-14 pb-32">
        {/* Quick info bar */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { Icon: Phone, label: "Phone", value: data.contactPhone || "Not available" },
            { Icon: Mail, label: "Email", value: data.contactEmail || "support@reseato.com" },
            { Icon: Clock, label: "Hours", value: "10:00 AM - 10:00 PM" },
          ].map(({ Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl px-5 py-4"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                backdropFilter: "blur(12px)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
              }}
            >
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                style={{ background: "rgba(201,160,122,0.1)", border: "1px solid rgba(201,160,122,0.3)", color: GOLD }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>{label}</div>
                <div className="truncate text-sm" style={{ color: CREAM }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* About */}
            <div
              className="rounded-3xl p-7"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                backdropFilter: "blur(12px)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>The Story</div>
              <h2 className="text-3xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>About</h2>
              <p className="mt-4 leading-relaxed text-[15px]" style={{ color: "rgba(245,237,228,0.7)" }}>
                {data.description || "A wonderful dining experience awaits you at this restaurant."}
              </p>
            </div>

            {/* Gallery */}
            <div
              className="rounded-3xl p-7"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                backdropFilter: "blur(12px)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>Visual Experience</div>
                  <h2 className="text-3xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>Gallery</h2>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[10px] tracking-[0.2em] uppercase"
                  style={{ background: "rgba(201,160,122,0.1)", border: "1px solid rgba(201,160,122,0.3)", color: GOLD }}
                >
                  {gallery.length} {gallery.length === 1 ? "item" : "items"}
                </span>
              </div>
              {gallery.length === 0 ? (
                <div
                  className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-5 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(201,160,122,0.12)",
                    color: "rgba(245,237,228,0.55)",
                  }}
                >
                  <UtensilsCrossed className="h-5 w-5" style={{ color: GOLD }} />
                  No gallery items available yet.
                </div>
              ) : (
                <div className={cx(
                  "mt-5 grid gap-2.5",
                  gallery.length === 1 && "grid-cols-1",
                  gallery.length === 2 && "grid-cols-2",
                  gallery.length >= 3 && "grid-cols-2 sm:grid-cols-3",
                )}>
                  {gallery.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className={cx(
                        "group relative overflow-hidden rounded-2xl",
                        i === 0 && gallery.length >= 3 && "col-span-2 sm:col-span-1",
                      )}
                      style={{ border: "1px solid rgba(201,160,122,0.2)" }}
                    >
                      <img
                        src={url}
                        alt={`${data.name} gallery ${i + 1}`}
                        className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 transition-colors duration-300 group-hover:bg-black/20" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location Map */}
            <div
              className="rounded-3xl p-7"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                backdropFilter: "blur(12px)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>Find Us</div>
                  <h2 className="text-3xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>Location</h2>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getMapQuery(data.name))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase transition hover:brightness-125"
                  style={{ background: "rgba(201,160,122,0.1)", border: "1px solid rgba(201,160,122,0.3)", color: GOLD }}
                >
                  <MapPin className="h-3 w-3" /> Open in Maps
                </a>
              </div>
              <div className="mt-5 overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(201,160,122,0.2)" }}>
                <iframe
                  title="Restaurant Location"
                  width="100%"
                  height="280"
                  style={{ border: 0, filter: "grayscale(0.3) brightness(0.85)" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(getMapQuery(data.name))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  allowFullScreen
                />
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* House Rules */}
            <div
              className="rounded-3xl p-6"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                backdropFilter: "blur(12px)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>Etiquette</div>
              <h3 className="text-2xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>House Rules</h3>
              <ul className="mt-4 space-y-3 text-sm" style={{ color: "rgba(245,237,228,0.7)" }}>
                {[
                  "Please arrive 10 minutes before your reservation",
                  "Reservations may be released after a 15-min grace period",
                  "Special requests are subject to availability",
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: GOLD }} />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* Rating card */}
            <div
              className="rounded-3xl p-6"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                backdropFilter: "blur(12px)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>Acclaim</div>
              <h3 className="text-2xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>Rating</h3>
              <div className="mt-4 flex items-center gap-4">
                <div className="text-5xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>
                  {Number(data.rating).toFixed(1)}
                </div>
                <div>
                  <div className="flex gap-0.5">
                    {ratingStars.map((filled, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4"
                        style={filled ? { fill: GOLD, color: GOLD } : { color: "rgba(245,237,228,0.25)" }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(245,237,228,0.5)" }}>
                    Restaurant rating
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LuxuryFooter />

      {/* ── Floating Book Button ── */}
      <motion.button
        type="button"
        onClick={() => setBookingOpen(true)}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-xs font-semibold tracking-[0.2em] uppercase text-white transition-all hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #b46d73, #923f4a)",
          border: "1px solid rgba(201,160,122,0.45)",
          boxShadow: "0 18px 44px rgba(146,63,74,0.5)",
          fontFamily: SANS,
        }}
      >
        <CalendarDays className="h-4 w-4" />
        Book a Table
      </motion.button>

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && gallery.length > 0 && (
        <GalleryLightbox images={gallery} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      {/* ── Book a Table Modal ── */}
      <AnimatePresence>
        {bookingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm px-4"
            style={{ background: "rgba(5,2,3,0.75)" }}
            onClick={() => setBookingOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-7"
              style={{
                background: "rgba(16,8,10,0.98)",
                border: GOLD_BORDER,
                boxShadow: "0 28px 80px rgba(0,0,0,0.7)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setBookingOpen(false)}
                className="absolute top-4 right-4 rounded-full p-2 transition hover:brightness-125"
                style={{ background: "rgba(255,255,255,0.04)", border: GOLD_BORDER, color: CREAM }}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="pr-10">
                <div className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>Reservation</div>
                <h2 className="text-3xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>Book a Table</h2>
                <p className="mt-1 text-sm" style={{ color: "rgba(245,237,228,0.55)" }}>
                  {data?.name ?? "Restaurant"} &middot; {formatPrettyDate(date)}
                </p>
              </div>

              {authLoading ? (
                <p className="mt-4" style={{ color: "rgba(245,237,228,0.55)" }}>Checking session...</p>
              ) : !isAuthed ? (
                <div
                  className="mt-5 rounded-2xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(201,160,122,0.15)",
                  }}
                >
                  <p className="text-sm" style={{ color: "rgba(245,237,228,0.7)" }}>
                    You must be logged in to make a reservation.
                  </p>
                  <Link
                    to="/log-in-sign-up"
                    state={{ from: location.pathname }}
                    className="mt-3 inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-xs font-semibold tracking-[0.2em] uppercase transition hover:brightness-110"
                    style={{
                      background: "linear-gradient(135deg, #b46d73, #923f4a)",
                      color: "#fff",
                      border: "1px solid rgba(201,160,122,0.4)",
                    }}
                  >
                    Login / Sign up
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-5">
                    <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>Select date</div>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                      style={{
                        background: "rgba(10,5,7,0.7)",
                        border: GOLD_BORDER,
                        color: CREAM,
                        colorScheme: "dark",
                      }}
                    />
                  </div>

                  <div className="mt-5">
                    <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>Number of guests</div>
                    <div
                      className="mt-2 flex items-center justify-between rounded-2xl px-4 py-3"
                      style={{ background: "rgba(10,5,7,0.7)", border: GOLD_BORDER }}
                    >
                      <button
                        type="button"
                        onClick={decGuests}
                        className="h-10 w-10 rounded-full transition hover:brightness-125"
                        style={{ background: "rgba(201,160,122,0.1)", border: "1px solid rgba(201,160,122,0.3)", color: GOLD }}
                      >
                        -
                      </button>
                      <div className="text-center">
                        <div className="text-3xl font-light" style={{ color: CREAM, fontFamily: SERIF }}>{guests}</div>
                        <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: "rgba(245,237,228,0.5)" }}>Guests</div>
                      </div>
                      <button
                        type="button"
                        onClick={incGuests}
                        className="h-10 w-10 rounded-full transition hover:brightness-125"
                        style={{ background: "rgba(201,160,122,0.1)", border: "1px solid rgba(201,160,122,0.3)", color: GOLD }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>Select time slot</div>
                    <div
                      className="mt-2 overflow-hidden rounded-2xl"
                      style={{ border: GOLD_BORDER, background: "rgba(10,5,7,0.7)" }}
                    >
                      {loadingSlots ? (
                        <div className="px-4 py-6 text-center text-sm" style={{ color: "rgba(245,237,228,0.55)" }}>
                          Loading slots...
                        </div>
                      ) : availableTimes.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm" style={{ color: "rgba(245,237,228,0.55)" }}>
                          No available slots for this date.
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(201,160,122,0.18)", background: "rgba(201,160,122,0.05)" }}>
                              <th className="px-3 py-2.5 text-left text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>Period</th>
                              <th className="px-3 py-2.5 text-left text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>Time</th>
                              <th className="px-3 py-2.5 text-center text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>Tables</th>
                              <th className="px-3 py-2.5 text-center text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slots.map((s) => {
                              const hour = Number(s.time.slice(0, 2));
                              const period = hour < 12 ? "AM" : "PM";
                              const canFit = s.available && (s.remainingTables == null || s.remainingTables > 0);
                              const isSelected = time === s.time && canFit;
                              return (
                                <tr
                                  key={s.time}
                                  onClick={() => canFit && setTime(s.time)}
                                  className={cx(
                                    "transition",
                                    canFit ? "cursor-pointer" : "cursor-default opacity-40",
                                  )}
                                  style={{
                                    borderBottom: "1px solid rgba(201,160,122,0.08)",
                                    background: isSelected
                                      ? "rgba(201,160,122,0.12)"
                                      : "transparent",
                                  }}
                                >
                                  <td className="px-3 py-2.5">
                                    <span
                                      className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium"
                                      style={
                                        hour < 12
                                          ? { background: "rgba(201,160,122,0.1)", border: "1px solid rgba(201,160,122,0.3)", color: GOLD }
                                          : { background: "rgba(99,155,224,0.1)", border: "1px solid rgba(168,200,234,0.3)", color: "#a8c8ea" }
                                      }
                                    >
                                      {period}
                                    </span>
                                  </td>
                                  <td
                                    className="px-3 py-2.5 font-medium"
                                    style={{ color: isSelected ? GOLD : CREAM, fontFamily: SERIF }}
                                  >
                                    {to12Hour(s.time)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {s.remainingTables != null ? (
                                      <span
                                        className="text-[11px] font-medium"
                                        style={{
                                          color:
                                            s.remainingTables === 0
                                              ? "#e88b93"
                                              : s.remainingTables <= 2
                                                ? "#e0b87a"
                                                : "#7dd9a6",
                                        }}
                                      >
                                        {s.remainingTables} table{s.remainingTables !== 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="text-[11px]" style={{ color: "rgba(245,237,228,0.4)" }}>—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {!canFit ? (
                                      <span
                                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                                        style={{
                                          background: "rgba(201,74,85,0.12)",
                                          border: "1px solid rgba(232,139,147,0.35)",
                                          color: "#e88b93",
                                        }}
                                      >
                                        Full
                                      </span>
                                    ) : isSelected ? (
                                      <span
                                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                        style={{
                                          background: "rgba(201,160,122,0.15)",
                                          border: "1px solid rgba(201,160,122,0.45)",
                                          color: GOLD,
                                        }}
                                      >
                                        Selected
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                                        style={{
                                          background: "rgba(76,175,115,0.1)",
                                          border: "1px solid rgba(125,217,166,0.3)",
                                          color: "#7dd9a6",
                                        }}
                                      >
                                        Open
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div className="mt-2 text-[10px] tracking-wider" style={{ color: "rgba(245,237,228,0.4)" }}>
                      Click on a row to select your preferred time slot.
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>Your name</div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className="mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{
                          background: "rgba(10,5,7,0.7)",
                          border: GOLD_BORDER,
                          color: CREAM,
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>Phone</div>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09xxxxxxxxx"
                        className="mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{
                          background: "rgba(10,5,7,0.7)",
                          border: GOLD_BORDER,
                          color: CREAM,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GOLD }}>Special requests</div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g., birthday celebration, window seat..."
                      className="mt-2 min-h-[80px] w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{
                        background: "rgba(10,5,7,0.7)",
                        border: GOLD_BORDER,
                        color: CREAM,
                      }}
                    />
                  </div>

                  {msg && (
                    <div
                      className="mt-4 rounded-2xl px-4 py-3 text-sm"
                      style={{
                        background: "rgba(201,74,85,0.10)",
                        border: "1px solid rgba(232,139,147,0.3)",
                        color: "#e88b93",
                      }}
                    >
                      {msg}
                    </div>
                  )}

                  <button
                    onClick={onReserve}
                    disabled={submitting || !time || availableTimes.length === 0 || !name.trim() || !phone.trim()}
                    className="mt-6 w-full rounded-2xl px-6 py-3.5 text-xs font-semibold tracking-[0.2em] uppercase text-white transition hover:brightness-110 disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #b46d73, #923f4a)",
                      border: "1px solid rgba(201,160,122,0.45)",
                      boxShadow: "0 14px 32px rgba(146,63,74,0.4)",
                    }}
                  >
                    {submitting ? "Reserving..." : "Proceed to Payment"}
                  </button>
                  <div className="mt-2 text-center text-[10px] tracking-wider" style={{ color: "rgba(245,237,228,0.4)" }}>
                    Reservation payment is required to secure your slot.
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
