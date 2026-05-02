import { Link } from "react-router-dom";
import {
  Facebook,
  Instagram,
  Send,
  Star,
  Twitter,
  UtensilsCrossed,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LuxuryFooter() {
  const { t } = useTranslation();
  return (
    <footer
      className="pt-16 pb-10 sm:pt-20"
      style={{
        background: "#0a0507",
        borderTop: "1px solid rgba(201,160,122,0.12)",
      }}
    >
      <div className="mx-auto max-w-[1480px] px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12 mb-12 sm:mb-16">
          {/* Brand */}
          <div className="flex flex-col gap-6">
            <Link to="/restaurants" className="flex items-center gap-3 group w-fit">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #b46d73, #923f4a)" }}
              >
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <span
                className="text-xl tracking-[0.15em] font-light"
                style={{ color: "#f5ede4", fontFamily: "'Cormorant Garamond', serif" }}
              >
                RESEATO
              </span>
            </Link>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: "rgba(245,237,228,0.5)", fontFamily: "'Jost', sans-serif" }}
            >
              {t("footer.brandDescription")}
            </p>
            <div className="flex items-center gap-4">
              {[
                { Icon: Instagram, href: "#" },
                { Icon: Facebook, href: "#" },
                { Icon: Twitter, href: "#" },
              ].map(({ Icon, href }, idx) => (
                <a
                  key={idx}
                  href={href}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(245,237,228,0.5)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4
              className="text-xs tracking-[0.2em] uppercase mb-6 font-semibold"
              style={{ color: "#c9a07a", fontFamily: "'Jost', sans-serif" }}
            >
              {t("footer.explore")}
            </h4>
            <ul className="flex flex-col gap-4">
              <li>
                <Link
                  to="/restaurants"
                  className="text-sm transition-colors hover:text-white"
                  style={{ color: "rgba(245,237,228,0.6)", fontFamily: "'Jost', sans-serif" }}
                >
                  {t("nav.restaurants")}
                </Link>
              </li>
              <li>
                <Link
                  to="/my-reservations"
                  className="text-sm transition-colors hover:text-white"
                  style={{ color: "rgba(245,237,228,0.6)", fontFamily: "'Jost', sans-serif" }}
                >
                  {t("nav.myReservations")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4
              className="text-xs tracking-[0.2em] uppercase mb-6 font-semibold"
              style={{ color: "#c9a07a", fontFamily: "'Jost', sans-serif" }}
            >
              {t("footer.legal")}
            </h4>
            <ul className="flex flex-col gap-4">
              <li>
                <span
                  className="text-sm"
                  style={{ color: "rgba(245,237,228,0.6)", fontFamily: "'Jost', sans-serif" }}
                >
                  {t("footer.termsAndConditions")}
                </span>
              </li>
              <li>
                <span
                  className="text-sm"
                  style={{ color: "rgba(245,237,228,0.6)", fontFamily: "'Jost', sans-serif" }}
                >
                  {t("footer.privacyPolicy")}
                </span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4
              className="text-xs tracking-[0.2em] uppercase mb-6 font-semibold"
              style={{ color: "#c9a07a", fontFamily: "'Jost', sans-serif" }}
            >
              {t("footer.newsletter")}
            </h4>
            <p
              className="text-sm mb-4"
              style={{ color: "rgba(245,237,228,0.5)", fontFamily: "'Jost', sans-serif" }}
            >
              {t("footer.newsletterDescription")}
            </p>
            <div className="relative">
              <input
                type="email"
                placeholder={t("footer.emailPlaceholder")}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(201,160,122,0.18)",
                  color: "#f5ede4",
                  fontFamily: "'Jost', sans-serif",
                }}
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#fff",
                }}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(201,160,122,0.10)" }}
        >
          <p
            className="text-[11px] tracking-wider uppercase text-center sm:text-left"
            style={{ color: "rgba(245,237,228,0.3)", fontFamily: "'Jost', sans-serif" }}
          >
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <div
            className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase"
            style={{ color: "rgba(245,237,228,0.25)", fontFamily: "'Jost', sans-serif" }}
          >
            {t("footer.craftedInCebu")}{" "}
            <Star
              className="h-3 w-3"
              style={{ color: "rgba(201,160,122,0.4)", fill: "rgba(201,160,122,0.2)" }}
            />{" "}
            {t("footer.inCebu")}
          </div>
        </div>
      </div>
    </footer>
  );
}
