import { Clock, MapPin, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Restaurant } from "../lib/types/restaurants";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";

export default function RestaurantCard({ r }: { r: Restaurant }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const price = (level: number) => {
    const normalized = Math.min(4, Math.max(1, Number(level) || 1));
    return t(`priceLabels.${normalized}`);
  };
  const ratingLabel = Number.isFinite(r.rating) ? r.rating.toFixed(1) : "0.0";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/restaurants/${r.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          navigate(`/restaurants/${r.id}`);
        }
      }}
      className="
        group relative w-full min-w-0 max-w-full overflow-hidden rounded-[20px]
        bg-[#1a1215]
        shadow-[0_8px_30px_rgba(30,10,15,0.18)]
        transition-all duration-500 ease-out
        hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(30,10,15,0.28)]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b46d73]
        cursor-pointer
      "
    >
      {/* ── Image area ── */}
      <div className="relative h-[200px] w-full overflow-hidden">
        <img
          src={r.imageUrl || FALLBACK_IMG}
          alt={r.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1215] via-[#1a1215]/40 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-90" />

        {/* Top badges */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/10">
            {price(r.priceLevel)}
          </span>
        </div>

        {/* Rating - top left with glow */}
        <div className="absolute top-3 left-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_2px_12px_rgba(245,158,11,0.4)]">
            <Star className="h-3 w-3 fill-white text-white" />
            {ratingLabel}
          </div>
        </div>

        {/* Restaurant name overlay on image */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <span className="mb-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md border border-white/10">
            {r.cuisine}
          </span>
          <h3 className="text-[22px] font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
            {r.name}
          </h3>
        </div>
      </div>

      {/* ── Info area ── */}
      <div className="relative bg-gradient-to-br from-[#fdfbfc] via-[#faf5f7] to-[#f5ecef] px-4 py-3.5">
        {/* Decorative top accent line */}
        <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#d4878f]/40 to-transparent" />

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[12px] text-[#7b6d70]">
              <MapPin className="h-3 w-3 shrink-0 text-[#b46d73]" />
              <span className="truncate">{r.location}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#9b8e91]">
              <Clock className="h-3 w-3 shrink-0 text-[#c49098]" />
              <span>10:00 - 21:00</span>
            </div>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/restaurants/${r.id}`);
            }}
            className="
              shrink-0 rounded-xl
              bg-gradient-to-br from-[#8b3d4a] to-[#6b2a35]
              px-4 py-2 text-xs font-bold text-white
              shadow-[0_4px_14px_rgba(139,61,74,0.35)]
              transition-all duration-300
              hover:shadow-[0_6px_20px_rgba(139,61,74,0.5)] hover:brightness-110
              active:scale-95
            "
          >
            {t("common.viewAndBook")}
          </button>
        </div>
      </div>
    </div>
  );
}
