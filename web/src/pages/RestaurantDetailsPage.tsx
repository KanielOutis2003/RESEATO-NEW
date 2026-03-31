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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#1f2937] shadow-lg transition hover:bg-white">
          <X className="h-4 w-4" />
        </button>
        <img src={images[idx]} alt={`Gallery ${idx + 1}`} className="max-h-[85vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl" />
        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">
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
  const { isAuthed, loading: authLoading } = useAuth();
  const { id } = useParams();

  const [data, setData] = useState<RestaurantDetails | null>(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
  const bestSellers = data?.bestSellers ?? [];
  const gallery = data?.galleryImages ?? [];

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
      <div className="relative min-h-[calc(100vh-72px)] w-full overflow-hidden bg-[#f3f3f4] text-[#1f2937]">
        <div className="pointer-events-none absolute -left-20 -top-16 h-64 w-64 rounded-full bg-[#f2dde2] blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-28 h-72 w-72 rounded-full bg-[#f8ecee] blur-3xl" />
        <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl flex-col justify-center px-6 py-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6 flex items-center gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }} className="grid h-11 w-11 place-items-center rounded-xl bg-[#8b3d4a] text-white shadow-[0_10px_22px_rgba(139,61,74,0.26)]">
              <UtensilsCrossed className="h-5 w-5" />
            </motion.div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8b3d4a]">RESEATO</div>
              <div className="text-lg font-medium text-[#374151]">Preparing restaurant details...</div>
            </div>
          </motion.div>
          <motion.div animate={{ opacity: [0.55, 1, 0.55] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} className="rounded-[28px] border border-[#e8e2e3] bg-white p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
            <div className="h-8 w-64 rounded-xl bg-[#f3ecef]" />
            <div className="mt-4 h-4 w-[520px] max-w-full rounded-lg bg-[#f4eff1]" />
            <div className="mt-2 h-4 w-[460px] max-w-full rounded-lg bg-[#f4eff1]" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="h-24 rounded-2xl bg-[#f2e5e8]" />
              <div className="h-24 rounded-2xl bg-[#f2e5e8]" />
            </div>
          </motion.div>
          <div className="mt-6 text-sm text-[#7b8498]">Loading restaurant...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="rounded-2xl border border-[#f0cdd4] bg-[#fff6f7] px-4 py-3 text-sm text-[#9f1239]">
            {msg ?? "Unable to load restaurant details."}
          </div>
        </div>
      </div>
    );
  }

  const ratingStars = Array.from({ length: 5 }, (_, i) => i < Math.round(Number(data.rating)));

  return (
    <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
      {/* ── Hero (contained card like RestaurantsPage) ── */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ddd7d9] bg-white px-4 py-2 text-sm text-[#6b7280] shadow-[0_6px_16px_rgba(15,23,42,0.06)] transition hover:text-[#7b2f3b]">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative h-[280px] overflow-hidden rounded-[28px] sm:h-[320px]"
        >
          <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/40" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(0,0,0,0.4),transparent_58%)]" />

          <div className="relative flex h-full flex-col justify-end px-6 pb-7 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md border border-white/10">{data.cuisine}</span>
              {data.priceLevel && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md border border-white/10">
                  {priceLabel(data.priceLevel)}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>{data.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/90">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {data.location}</span>
              <span className="inline-flex items-center gap-1">
                {ratingStars.map((filled, i) => (
                  <Star key={i} className={cx("h-3.5 w-3.5", filled ? "fill-amber-400 text-amber-400" : "text-white/40")} />
                ))}
                <span className="ml-1 font-semibold">{Number(data.rating).toFixed(1)}</span>
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Content ── */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* Quick info bar */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f8ecee] text-[#8b3d4a]"><Phone className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#98a2b3]">Phone</div>
              <div className="truncate text-sm font-medium text-[#1f2937]">{data.contactPhone || "Not available"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f8ecee] text-[#8b3d4a]"><Mail className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#98a2b3]">Email</div>
              <div className="truncate text-sm font-medium text-[#1f2937]">{data.contactEmail || "support@reseato.com"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f8ecee] text-[#8b3d4a]"><Clock className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#98a2b3]">Hours</div>
              <div className="truncate text-sm font-medium text-[#1f2937]">10:00 AM - 10:00 PM</div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* About */}
            <div className="rounded-3xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-bold text-[#1f2937]">About</h2>
              <p className="mt-3 leading-relaxed text-[#475467]">{data.description || "A wonderful dining experience awaits you at this restaurant."}</p>
            </div>

            {/* Gallery */}
            <div className="rounded-3xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#1f2937]">Gallery</h2>
                <span className="rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#6b7280]">
                  {gallery.length} {gallery.length === 1 ? "item" : "items"}
                </span>
              </div>
              {gallery.length === 0 ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#ece8e9] bg-[#fafafa] px-4 py-5 text-sm text-[#667085]">
                  <UtensilsCrossed className="h-5 w-5 text-[#c9b5b9]" />
                  No gallery items available yet.
                </div>
              ) : (
                <div className={cx(
                  "mt-4 grid gap-2",
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
                        "group relative overflow-hidden rounded-2xl border border-[#ece8e9]",
                        i === 0 && gallery.length >= 3 && "col-span-2 sm:col-span-1",
                      )}
                    >
                      <img
                        src={url}
                        alt={`${data.name} gallery ${i + 1}`}
                        className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Best Sellers */}
            <div className="rounded-3xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-[#1f2937]">Best Sellers</h2>
                <span className="rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#6b7280]">
                  {bestSellers.length} item{bestSellers.length === 1 ? "" : "s"}
                </span>
              </div>

              {bestSellers.length === 0 ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#ece8e9] bg-[#fafafa] px-4 py-5 text-sm text-[#667085]">
                  <UtensilsCrossed className="h-5 w-5 text-[#c9b5b9]" />
                  No best-seller items available yet.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {bestSellers.map((item, idx) => (
                    <article
                      key={item.id}
                      className="group relative overflow-hidden rounded-2xl border border-[#ece8e9] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(139,61,74,0.1)]"
                    >
                      <div className="relative h-40 overflow-hidden">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#f7ebee] to-[#f0e4f0] text-[#8b3d4a]">
                            <UtensilsCrossed className="h-8 w-8 opacity-50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        {idx < 3 && (
                          <div className="absolute left-2.5 top-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                            #{idx + 1} Popular
                          </div>
                        )}
                        <div className="absolute bottom-2.5 left-3 right-3">
                          <div className="text-base font-bold text-white drop-shadow-md">{item.name}</div>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs leading-relaxed text-[#667085]">A must-try dish loved by our guests.</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Location Map */}
            <div className="rounded-3xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#1f2937]">Location</h2>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getMapQuery(data.name))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#7b2f3b] hover:underline"
                >
                  <MapPin className="h-3 w-3" /> Open in Maps
                </a>
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#ece8e9]">
                <iframe
                  title="Restaurant Location"
                  width="100%"
                  height="260"
                  style={{ border: 0 }}
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
            <div className="rounded-3xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] p-6 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <h3 className="text-base font-bold text-[#1f2937]">House Rules</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#667085]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c98d98]" />
                  Please arrive 10 minutes before your reservation
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c98d98]" />
                  Reservations may be released after a 15-min grace period
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c98d98]" />
                  Special requests are subject to availability
                </li>
              </ul>
            </div>

            {/* Rating card */}
            <div className="rounded-3xl border border-[#e8e2e3] bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] p-6 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <h3 className="text-base font-bold text-[#1f2937]">Rating</h3>
              <div className="mt-3 flex items-center gap-3">
                <div className="text-4xl font-bold text-[#1f2937]">{Number(data.rating).toFixed(1)}</div>
                <div>
                  <div className="flex gap-0.5">
                    {ratingStars.map((filled, i) => (
                      <Star key={i} className={cx("h-4 w-4", filled ? "fill-amber-400 text-amber-400" : "text-[#d1d5db]")} />
                    ))}
                  </div>
                  <div className="mt-0.5 text-xs text-[#98a2b3]">Restaurant rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Floating Book Button ── */}
      <motion.button
        type="button"
        onClick={() => setBookingOpen(true)}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 rounded-2xl border border-[#d5bcc2] bg-[linear-gradient(135deg,#9b4b56,#7f3a41)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(139,61,74,0.35)] transition-all hover:scale-105 hover:shadow-[0_16px_40px_rgba(139,61,74,0.45)]"
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setBookingOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-[#e8e2e3] bg-white p-7 shadow-[0_28px_60px_rgba(15,23,42,0.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => setBookingOpen(false)} className="absolute top-4 right-4 rounded-full border border-[#e8e2e3] p-2 text-[#6b7280] transition hover:bg-[#f8f8f8] hover:text-[#1f2937]">
                <X className="h-4 w-4" />
              </button>

              <div className="pr-8">
                <h2 className="text-xl font-bold text-[#1f2937] sm:text-2xl">Book a Table</h2>
                <p className="mt-1 text-sm text-[#6b7280]">{data?.name ?? "Restaurant"} &middot; {formatPrettyDate(date)}</p>
              </div>

              {authLoading ? (
                <p className="mt-4 text-[#6b7280]">Checking session...</p>
              ) : !isAuthed ? (
                <div className="mt-4 rounded-2xl border border-[#e8e2e3] bg-[#fafafa] p-4">
                  <p className="text-sm text-[#475467]">You must be logged in to make a reservation.</p>
                  <Link to="/log-in-sign-up" state={{ from: location.pathname }} className="mt-3 inline-flex w-full justify-center rounded-xl border border-[#d8c0c6] bg-[#f8ecee] px-4 py-2 text-sm font-medium text-[#7b2f3b] transition hover:bg-[#f2dde2]">
                    Login / Sign up
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-wider text-[#7b8498]">Select date</div>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 w-full rounded-2xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]" />
                  </div>

                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-wider text-[#7b8498]">Number of guests</div>
                    <div className="mt-2 flex items-center justify-between rounded-2xl border border-[#ece8e9] bg-[#fafafa] px-4 py-3">
                      <button type="button" onClick={decGuests} className="h-10 w-10 rounded-full border border-[#ddd8da] bg-white text-[#1f2937] transition hover:bg-[#f5f2f3]">-</button>
                      <div className="text-center">
                        <div className="text-2xl font-semibold text-[#1f2937]">{guests}</div>
                        <div className="text-xs text-[#667085]">Guests</div>
                      </div>
                      <button type="button" onClick={incGuests} className="h-10 w-10 rounded-full border border-[#ddd8da] bg-white text-[#1f2937] transition hover:bg-[#f5f2f3]">+</button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-wider text-[#7b8498]">Select time slot</div>
                    <div className="mt-2 overflow-hidden rounded-2xl border border-[#ece8e9]">
                      {loadingSlots ? (
                        <div className="bg-[#fafafa] px-4 py-6 text-center text-sm text-[#667085]">Loading slots...</div>
                      ) : availableTimes.length === 0 ? (
                        <div className="bg-[#fafafa] px-4 py-6 text-center text-sm text-[#667085]">No available slots for this date.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#ece8e9] bg-[#f8fafc]">
                              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#7b8498]">Period</th>
                              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#7b8498]">Time</th>
                              <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[#7b8498]">Tables Left</th>
                              <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[#7b8498]">Status</th>
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
                                    "border-b border-[#f1f5f9] transition",
                                    canFit ? "cursor-pointer" : "cursor-default opacity-50",
                                    isSelected ? "bg-[#f8ecee]" : canFit ? "hover:bg-[#faf7f8]" : "bg-[#fafafa]",
                                  )}
                                >
                                  <td className="px-3 py-2.5">
                                    <span className={cx("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium", hour < 12 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200")}>{period}</span>
                                  </td>
                                  <td className={cx("px-3 py-2.5 font-medium", isSelected ? "text-[#7b2f3b]" : "text-[#374151]")}>{to12Hour(s.time)}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    {s.remainingTables != null ? (
                                      <span className={cx("text-[11px] font-medium", s.remainingTables === 0 ? "text-[#be123c]" : s.remainingTables <= 2 ? "text-amber-600" : "text-emerald-700")}>
                                        {s.remainingTables} table{s.remainingTables !== 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-[#98a2b3]">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {!canFit ? (
                                      <span className="inline-flex rounded-full border border-[#f0cdd4] bg-[#fff6f7] px-2 py-0.5 text-[11px] font-medium text-[#be123c]">Full</span>
                                    ) : isSelected ? (
                                      <span className="inline-flex rounded-full border border-[#c98d98] bg-[#f8ecee] px-2 py-0.5 text-[11px] font-semibold text-[#7b2f3b]">Selected</span>
                                    ) : (
                                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Open</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div className="mt-2 text-[11px] text-[#98a2b3]">Click on a row to select your preferred time slot.</div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[#7b8498]">Your name</div>
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="mt-2 w-full rounded-2xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#98a2b3] outline-none focus:border-[#b46d73]" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[#7b8498]">Phone</div>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" className="mt-2 w-full rounded-2xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#98a2b3] outline-none focus:border-[#b46d73]" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-wider text-[#7b8498]">Special requests</div>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., birthday celebration, window seat..." className="mt-2 min-h-[80px] w-full resize-none rounded-2xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#98a2b3] outline-none focus:border-[#b46d73]" />
                  </div>

                  {msg && (
                    <div className="mt-4 rounded-2xl border border-[#f0cdd4] bg-[#fff6f7] px-4 py-3 text-sm text-[#9f1239]">{msg}</div>
                  )}

                  <button
                    onClick={onReserve}
                    disabled={submitting || !time || availableTimes.length === 0 || !name.trim() || !phone.trim()}
                    className="mt-5 w-full rounded-2xl border border-[#d5bcc2] bg-gradient-to-r from-[#9b4b56] to-[#7f3a41] px-6 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    {submitting ? "Reserving..." : "Proceed to Payment"}
                  </button>
                  <div className="mt-2 text-center text-[11px] text-[#98a2b3]">Reservation payment is required to secure your slot.</div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
