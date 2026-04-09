import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Bell,
  CalendarDays,
  Camera,
  CheckCheck,
  Headphones,
  ImagePlus,
  Loader2,
  LogOut,
  Mail,
  PencilLine,
  Phone,
  Send,
  Shield,
  User as UserIcon,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/auth/useSession";
import {
  AppNotification,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../lib/api/notifications.api";

function deriveFullName(
  email: string,
  metadata: Record<string, unknown> | undefined,
) {
  if (!metadata) return email.split("@")[0];
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  if (fullName) return fullName;
  const firstName =
    typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
  const lastName =
    typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";
  const combined = `${firstName} ${lastName}`.trim();
  return combined || email.split("@")[0];
}

function normalizeRole(raw: unknown) {
  return String(raw ?? "customer").trim().toLowerCase();
}

function formatNotificationTime(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LuxuryNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session } = useSession();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [role, setRole] = useState("customer");
  const [profileFullName, setProfileFullName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Help / Customer Service modal state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSubject, setHelpSubject] = useState("Reservation Issue");
  const [helpMessage, setHelpMessage] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [helpAttachment, setHelpAttachment] = useState<File | null>(null);
  const [helpAttachmentPreview, setHelpAttachmentPreview] = useState<string | null>(null);
  const helpFileRef = useRef<HTMLInputElement | null>(null);

  // Profile modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDetails, setProfileDetails] = useState<{
    fullName: string;
    email: string;
    phone: string;
    role: string;
    memberSince: string;
    avatarUrl: string;
  } | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUploadingAvatar, setProfileUploadingAvatar] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const email = session?.user?.email ?? "";
  const fullName = useMemo(
    () =>
      deriveFullName(
        email,
        session?.user?.user_metadata as Record<string, unknown> | undefined,
      ),
    [email, session?.user?.user_metadata],
  );
  const metadataAvatarUrl = useMemo(() => {
    const value = session?.user?.user_metadata?.avatar_url;
    return typeof value === "string" ? value.trim() : "";
  }, [session?.user?.user_metadata]);
  const displayFullName = profileFullName || fullName;
  const displayAvatarUrl = metadataAvatarUrl || profileAvatarUrl;
  const initial = (displayFullName || email).charAt(0).toUpperCase() || "U";
  const shouldShowAvatar = Boolean(displayAvatarUrl) && !avatarLoadError;

  const firstName = displayFullName.split(" ")[0] || "Customer";
  const roleLabel = firstName.toUpperCase();

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  useEffect(() => {
    setNotifOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }
    if (notifOpen || profileOpen) {
      document.addEventListener("pointerdown", onPointerDown);
    }
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notifOpen, profileOpen]);

  useEffect(() => {
    let alive = true;

    async function loadProfileContext() {
      if (!session?.user) {
        setRole("customer");
        setProfileFullName("");
        setProfileAvatarUrl("");
        setAvatarLoadError(false);
        return;
      }
      const metadataRole = normalizeRole(session.user.user_metadata?.role);
      const metadataAvatar =
        typeof session.user.user_metadata?.avatar_url === "string"
          ? session.user.user_metadata.avatar_url.trim()
          : "";
      if (alive) {
        setRole(metadataRole || "customer");
        setProfileAvatarUrl(metadataAvatar);
        setAvatarLoadError(false);
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!alive || error || !data) return;
      if (data.role) setRole(normalizeRole(data.role));
      if (typeof data.full_name === "string" && data.full_name.trim()) {
        setProfileFullName(data.full_name.trim());
      }
      if (typeof data.avatar_url === "string") {
        setProfileAvatarUrl(data.avatar_url.trim());
        setAvatarLoadError(false);
      }
    }

    loadProfileContext();
    return () => {
      alive = false;
    };
  }, [session?.user]);

  // Poll notifications every 15s
  useEffect(() => {
    let alive = true;
    async function loadNotifications() {
      if (!session) return;
      try {
        if (notifOpen) setLoadingNotifications(true);
        const items = await listMyNotifications();
        if (!alive) return;
        setNotifications(items);
      } catch {
        if (!alive) return;
      } finally {
        if (!alive) return;
        setLoadingNotifications(false);
      }
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 15_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [notifOpen, session]);

  // Auto-logout after 5 minutes of inactivity
  useEffect(() => {
    if (!session) return;
    const IDLE_TIMEOUT = 5 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/log-in-sign-up");
      }, IDLE_TIMEOUT);
    }
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [session, navigate]);

  async function logout() {
    await supabase.auth.signOut();
    setProfileOpen(false);
    navigate("/log-in-sign-up");
  }

  function openProfilePage() {
    setProfileOpen(false);
    setProfileModalOpen(true);
  }

  // Load profile data when modal opens
  useEffect(() => {
    if (!profileModalOpen || !session?.user) return;
    let alive = true;
    const user = session.user;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const firstNameMeta = typeof meta.first_name === "string" ? meta.first_name : "";
    const lastNameMeta = typeof meta.last_name === "string" ? meta.last_name : "";
    const fbRole = typeof meta.role === "string" ? meta.role : "customer";
    const fbPhone = typeof meta.phone === "string" ? meta.phone : "";
    const fbAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url : "";
    const fbName =
      `${firstNameMeta} ${lastNameMeta}`.trim() ||
      (typeof meta.full_name === "string" ? meta.full_name : "") ||
      (user.email ? user.email.split("@")[0] : "Customer");
    const cap = (v: string) => (v ? v[0].toUpperCase() + v.slice(1).toLowerCase() : "");
    const fmtDate = (d: string) => {
      const dt = new Date(d);
      return Number.isNaN(dt.getTime())
        ? "-"
        : dt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    };

    const fallback = {
      fullName: fbName,
      email: user.email ?? "",
      phone: fbPhone,
      role: cap(fbRole),
      memberSince: fmtDate(user.created_at || ""),
      avatarUrl: fbAvatar,
    };
    if (alive) {
      setProfileDetails(fallback);
      setProfileForm({ fullName: fallback.fullName, phone: fallback.phone });
      setProfileMsg(null);
    }

    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!alive) return;
      if (error) {
        setProfileMsg("Using account metadata.");
        return;
      }
      const p = data as {
        id: string;
        full_name?: string | null;
        role?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
        created_at?: string | null;
      } | null;
      if (!p) return;
      const pRole = p.role?.trim().toLowerCase() || "";
      const resolvedRole =
        pRole && pRole !== "customer"
          ? pRole
          : fbRole.toLowerCase() !== "customer"
            ? fbRole.toLowerCase()
            : pRole || fbRole.toLowerCase() || "customer";
      const merged = {
        fullName: p.full_name?.trim() || fbName,
        email: user.email ?? "",
        phone: p.phone?.trim() || fbPhone,
        role: cap(resolvedRole),
        memberSince: fmtDate(p.created_at || user.created_at || ""),
        avatarUrl: p.avatar_url?.trim() || fbAvatar,
      };
      if (alive) {
        setProfileDetails(merged);
        setProfileForm({ fullName: merged.fullName, phone: merged.phone });
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileModalOpen, session?.user]);

  async function onProfileAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !session?.user || !profileDetails) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setProfileMsg("Please use JPG, PNG, or WEBP.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg("Max size is 5MB.");
      event.target.value = "";
      return;
    }
    setProfileUploadingAvatar(true);
    setProfileMsg(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      const avatarUrl = supabase.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;
      await supabase
        .from("profiles")
        .upsert(
          {
            id: session.user.id,
            full_name: profileDetails.fullName,
            phone: profileDetails.phone || null,
            avatar_url: avatarUrl,
          },
          { onConflict: "id" },
        );
      const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
      await supabase.auth.updateUser({ data: { ...meta, avatar_url: avatarUrl } });
      setProfileDetails((p) => (p ? { ...p, avatarUrl } : p));
      setProfileAvatarUrl(avatarUrl);
      setProfileMsg("Profile photo updated.");
    } catch (err: any) {
      setProfileMsg(err?.message ?? "Failed to upload photo.");
    } finally {
      setProfileUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function onProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!session?.user || !profileDetails) return;
    const cleanName = profileForm.fullName.trim();
    const cleanPhone = profileForm.phone.trim();
    if (!cleanName) {
      setProfileMsg("Full name is required.");
      return;
    }
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const up = await supabase
        .from("profiles")
        .upsert(
          {
            id: session.user.id,
            full_name: cleanName,
            phone: cleanPhone || null,
            avatar_url: profileDetails.avatarUrl || null,
          },
          { onConflict: "id" },
        )
        .select("*")
        .single();
      const prof = up.error
        ? null
        : (up.data as {
            full_name?: string | null;
            phone?: string | null;
            role?: string | null;
            avatar_url?: string | null;
          });
      const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
      const parts = cleanName.split(" ").map((p) => p.trim()).filter(Boolean);
      await supabase.auth.updateUser({
        data: {
          ...meta,
          full_name: cleanName,
          first_name: parts[0] ?? "",
          last_name: parts.slice(1).join(" "),
          phone: cleanPhone,
          avatar_url: profileDetails.avatarUrl,
        },
      });
      const cap = (v: string) => (v ? v[0].toUpperCase() + v.slice(1).toLowerCase() : "");
      const merged = {
        fullName: prof?.full_name?.trim() || cleanName,
        email: session.user.email ?? "",
        phone: prof?.phone?.trim() || cleanPhone,
        role: cap(prof?.role?.trim() || profileDetails.role),
        memberSince: profileDetails.memberSince,
        avatarUrl: prof?.avatar_url?.trim() || profileDetails.avatarUrl,
      };
      setProfileDetails(merged);
      setProfileForm({ fullName: merged.fullName, phone: merged.phone });
      setProfileEditOpen(false);
      setProfileMsg("Profile updated.");
      setProfileFullName(merged.fullName);
      setProfileAvatarUrl(merged.avatarUrl);
    } catch (err: any) {
      setProfileMsg(err?.message ?? "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  function closeProfileModal() {
    setProfileModalOpen(false);
    setProfileEditOpen(false);
    setProfileMsg(null);
  }

  async function handleNotificationClick(item: AppNotification) {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id);
      } catch {
        /* ignore */
      }
      setNotifications((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)),
      );
    }
    setNotifOpen(false);
    if (item.link) navigate(item.link);
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      /* ignore */
    }
  }

  function onHelpFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setHelpError("Only JPG, PNG, WEBP, or GIF images allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setHelpError("Max file size is 5 MB.");
      e.target.value = "";
      return;
    }
    setHelpAttachment(file);
    setHelpError(null);
    const reader = new FileReader();
    reader.onload = () => setHelpAttachmentPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleHelpSubmit() {
    if (!helpMessage.trim()) return;
    setHelpSending(true);
    setHelpError(null);
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        setHelpError("You must be logged in.");
        return;
      }
      let attachmentUrl: string | null = null;
      if (helpAttachment) {
        const ext = helpAttachment.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `tickets/${currentUser.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("support-attachments")
          .upload(path, helpAttachment, { upsert: true, contentType: helpAttachment.type });
        if (upErr) throw upErr;
        attachmentUrl = supabase.storage.from("support-attachments").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("support_tickets").insert({
        user_id: currentUser.id,
        email: currentUser.email,
        subject: helpSubject,
        message: helpMessage.trim(),
        attachment_url: attachmentUrl,
        status: "open",
      });
      if (error) throw error;
      setHelpSent(true);
    } catch (err: any) {
      setHelpError(err?.message ?? "Failed to submit ticket.");
    } finally {
      setHelpSending(false);
    }
  }

  const isRestaurants = pathname === "/restaurants";
  const isReservations = pathname === "/my-reservations";
  // keep role var to suppress unused warnings when not used
  void role;

  // ── dark luxury shared styles
  const GOLD = "#c9a07a";
  const CREAM = "#f5ede4";
  const DARK_BG = "rgba(16,8,10,0.96)";
  const DARK_INPUT_BG = "rgba(10,5,7,0.7)";
  const GOLD_BORDER = "1px solid rgba(201,160,122,0.28)";

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-md"
        style={{
          background: "rgba(10,5,7,0.78)",
          borderBottom: "1px solid rgba(201,160,122,0.18)",
        }}
      >
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 px-4 py-4 sm:px-8 lg:px-14">
          {/* Logo */}
          <Link to="/restaurants" className="flex items-center gap-2.5 group shrink-0">
            <div
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #b46d73, #923f4a)",
                boxShadow: "0 4px 18px rgba(146,63,74,0.45)",
              }}
            >
              <UtensilsCrossed className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <span
                className="text-[1.2rem] sm:text-[1.45rem] leading-none font-light"
                style={{
                  color: CREAM,
                  fontFamily: "'Cormorant Garamond', serif",
                  letterSpacing: "0.22em",
                }}
              >
                RESEATO
              </span>
              <div
                className="h-px mt-0.5"
                style={{ background: "linear-gradient(to right, #c9a07a, transparent)" }}
              />
            </div>
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/restaurants"
              className="text-xs font-medium uppercase tracking-[0.18em] transition-colors"
              style={{
                color: isRestaurants ? GOLD : "rgba(245,237,228,0.7)",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              Restaurants
            </Link>
            <Link
              to="/my-reservations"
              className="text-xs font-medium uppercase tracking-[0.18em] transition-colors"
              style={{
                color: isReservations ? GOLD : "rgba(245,237,228,0.7)",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              My Reservations
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {session ? (
              <>
                {/* Name pill (desktop) */}
                <div
                  className="hidden lg:inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-[0.18em]"
                  style={{
                    background: "rgba(28,13,16,0.6)",
                    border: "1px solid rgba(201,160,122,0.35)",
                    color: GOLD,
                    fontFamily: "'Jost', sans-serif",
                  }}
                >
                  {roleLabel}
                </div>

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen((prev) => !prev);
                      setProfileOpen(false);
                    }}
                    aria-label="Notifications"
                    className="relative grid h-9 w-9 place-items-center rounded-full transition hover:brightness-110"
                    style={{
                      background: "rgba(28,13,16,0.6)",
                      border: "1px solid rgba(201,160,122,0.35)",
                      color: GOLD,
                    }}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span
                        className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                        style={{
                          background: "linear-gradient(135deg, #b46d73, #923f4a)",
                          boxShadow: "0 4px 12px rgba(146,63,74,0.45)",
                        }}
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div
                      className="fixed left-3 right-3 top-[5rem] z-50 overflow-hidden rounded-2xl backdrop-blur-md sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96"
                      style={{
                        background: DARK_BG,
                        border: GOLD_BORDER,
                        boxShadow:
                          "0 22px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,160,122,0.08)",
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      <div
                        className="flex items-center justify-between px-5 py-4"
                        style={{ borderBottom: "1px solid rgba(201,160,122,0.18)" }}
                      >
                        <div
                          className="text-base font-semibold"
                          style={{
                            color: CREAM,
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: "1.15rem",
                          }}
                        >
                          Notifications
                        </div>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] transition hover:brightness-110"
                            style={{
                              background: "rgba(28,13,16,0.6)",
                              border: "1px solid rgba(201,160,122,0.25)",
                              color: GOLD,
                            }}
                          >
                            <CheckCheck className="h-3 w-3" />
                            Mark all
                          </button>
                        )}
                      </div>

                      {loadingNotifications ? (
                        <div
                          className="px-6 py-6 text-sm"
                          style={{ color: "rgba(245,237,228,0.55)" }}
                        >
                          Loading notifications...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
                          <div
                            className="grid h-12 w-12 place-items-center rounded-full"
                            style={{
                              background: "rgba(201,160,122,0.10)",
                              border: "1px solid rgba(201,160,122,0.28)",
                              color: GOLD,
                            }}
                          >
                            <Bell className="h-5 w-5" />
                          </div>
                          <p className="text-sm" style={{ color: "rgba(245,237,228,0.55)" }}>
                            No notifications yet
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-[60vh] sm:max-h-[380px] overflow-y-auto">
                          {notifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleNotificationClick(item)}
                              className="w-full px-4 py-3 text-left transition"
                              style={{
                                borderBottom: "1px solid rgba(201,160,122,0.12)",
                                background: item.is_read
                                  ? "transparent"
                                  : "rgba(201,160,122,0.06)",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "rgba(201,160,122,0.10)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = item.is_read
                                  ? "transparent"
                                  : "rgba(201,160,122,0.06)")
                              }
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className="text-sm font-semibold leading-snug"
                                  style={{ color: CREAM }}
                                >
                                  {item.title}
                                </p>
                                <span
                                  className="shrink-0 text-[10px] sm:text-[11px] mt-0.5"
                                  style={{ color: "rgba(201,160,122,0.7)" }}
                                >
                                  {formatNotificationTime(item.created_at)}
                                </span>
                              </div>
                              <p
                                className="mt-1 text-xs leading-relaxed"
                                style={{ color: "rgba(245,237,228,0.6)" }}
                              >
                                {item.body}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Customer Service */}
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen(true);
                    setHelpSent(false);
                    setHelpMessage("");
                    setHelpError(null);
                    setHelpAttachment(null);
                    setHelpAttachmentPreview(null);
                  }}
                  aria-label="Customer Support"
                  title="Customer Service"
                  className="grid h-9 w-9 place-items-center rounded-full transition hover:brightness-110"
                  style={{
                    background: "rgba(28,13,16,0.6)",
                    border: "1px solid rgba(201,160,122,0.35)",
                    color: GOLD,
                  }}
                >
                  <Headphones className="h-4 w-4" />
                </button>

                {/* Avatar + dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen((prev) => !prev);
                      setNotifOpen(false);
                    }}
                    aria-label="Open account menu"
                    className="grid h-9 w-9 place-items-center overflow-hidden rounded-full text-[11px] font-bold transition hover:brightness-110"
                    style={{
                      background: "rgba(28,13,16,0.6)",
                      border: "1px solid rgba(201,160,122,0.45)",
                      color: GOLD,
                      fontFamily: "'Jost', sans-serif",
                    }}
                  >
                    {shouldShowAvatar ? (
                      <img
                        src={displayAvatarUrl}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarLoadError(true)}
                      />
                    ) : (
                      initial
                    )}
                  </button>

                  {profileOpen && (
                    <div
                      className="absolute right-0 mt-3 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-2xl backdrop-blur-md sm:w-72"
                      style={{
                        background: DARK_BG,
                        border: GOLD_BORDER,
                        boxShadow:
                          "0 22px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,160,122,0.08)",
                        color: CREAM,
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      <div
                        className="px-4 py-4"
                        style={{ borderBottom: "1px solid rgba(201,160,122,0.18)" }}
                      >
                        <p className="truncate text-base font-semibold" style={{ color: CREAM }}>
                          {displayFullName}
                        </p>
                        <p
                          className="truncate text-sm"
                          style={{ color: "rgba(245,237,228,0.6)" }}
                        >
                          {email}
                        </p>
                        <p
                          className="mt-2 text-xs font-semibold uppercase tracking-[0.18em]"
                          style={{ color: GOLD }}
                        >
                          {roleLabel}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={openProfilePage}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition"
                        style={{ color: "rgba(245,237,228,0.85)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "rgba(201,160,122,0.08)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <UserIcon className="h-4 w-4" style={{ color: GOLD }} />
                        My Profile
                      </button>

                      <div style={{ height: "1px", background: "rgba(201,160,122,0.18)" }} />

                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setShowLogoutConfirm(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition"
                        style={{ color: "#e8a5ad" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "rgba(180,109,115,0.12)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/log-in-sign-up"
                className="rounded-full px-4 py-2 text-xs tracking-[0.18em] uppercase transition hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  color: "#fff",
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile nav strip */}
        <div
          className="md:hidden flex items-center justify-center gap-6 px-4 py-2"
          style={{ borderTop: "1px solid rgba(201,160,122,0.12)" }}
        >
          <Link
            to="/restaurants"
            className="text-[10px] font-medium uppercase tracking-[0.18em]"
            style={{
              color: isRestaurants ? GOLD : "rgba(245,237,228,0.6)",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            Restaurants
          </Link>
          <Link
            to="/my-reservations"
            className="text-[10px] font-medium uppercase tracking-[0.18em]"
            style={{
              color: isReservations ? GOLD : "rgba(245,237,228,0.6)",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            My Reservations
          </Link>
        </div>

        {/* Thin gold accent line */}
        <div
          className="mx-4 sm:mx-8 lg:mx-14"
          style={{
            height: "1px",
            background:
              "linear-gradient(to right, transparent, rgba(201,160,122,0.35), transparent)",
          }}
        />
      </header>

      {/* ── Customer Service Modal ── */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: "rgba(5,2,3,0.72)", backdropFilter: "blur(6px)" }}
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-[22px] p-6"
            style={{
              background:
                "linear-gradient(180deg, rgba(28,13,16,0.98) 0%, rgba(14,6,8,0.99) 100%)",
              border: GOLD_BORDER,
              boxShadow:
                "0 32px 72px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,160,122,0.08)",
              fontFamily: "'Jost', sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full transition hover:brightness-110"
              style={{
                background: "rgba(28,13,16,0.6)",
                border: "1px solid rgba(201,160,122,0.25)",
                color: GOLD,
              }}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  boxShadow: "0 4px 18px rgba(146,63,74,0.45)",
                }}
              >
                <Headphones className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3
                  className="text-xl font-light"
                  style={{ color: CREAM, fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Customer Service
                </h3>
                <p className="text-xs tracking-[0.18em] uppercase" style={{ color: GOLD }}>
                  We're here to help
                </p>
              </div>
            </div>

            {helpSent ? (
              <div className="mt-6 text-center">
                <div
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full"
                  style={{
                    background: "rgba(201,160,122,0.14)",
                    border: "1px solid rgba(201,160,122,0.35)",
                    color: GOLD,
                  }}
                >
                  <CheckCheck className="h-7 w-7" />
                </div>
                <h4
                  className="mt-4 text-xl font-light"
                  style={{ color: CREAM, fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Ticket Submitted
                </h4>
                <p className="mt-2 text-sm" style={{ color: "rgba(245,237,228,0.6)" }}>
                  Our team will review your request and get back to you via email.
                </p>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="mt-5 w-full rounded-xl px-4 py-2.5 text-xs tracking-[0.18em] uppercase text-white transition hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, #b46d73, #923f4a)",
                    boxShadow: "0 8px 24px rgba(146,63,74,0.45)",
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: GOLD }}
                  >
                    Topic
                    <select
                      value={helpSubject}
                      onChange={(e) => setHelpSubject(e.target.value)}
                      className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
                      style={{
                        background: DARK_INPUT_BG,
                        border: "1px solid rgba(201,160,122,0.22)",
                        color: CREAM,
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      <option>Reservation Issue</option>
                      <option>Payment Problem</option>
                      <option>Restaurant Complaint</option>
                      <option>Account Issue</option>
                      <option>Bug Report</option>
                      <option>Other</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: GOLD }}
                  >
                    Message
                    <textarea
                      value={helpMessage}
                      onChange={(e) => setHelpMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      className="mt-2 min-h-[100px] w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
                      style={{
                        background: DARK_INPUT_BG,
                        border: "1px solid rgba(201,160,122,0.22)",
                        color: CREAM,
                        fontFamily: "'Jost', sans-serif",
                      }}
                    />
                  </label>
                </div>

                {/* Attachment */}
                <div className="mt-4">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: GOLD }}
                  >
                    Attachment (optional)
                  </label>
                  <input
                    ref={helpFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={onHelpFileChange}
                  />
                  {helpAttachmentPreview ? (
                    <div className="relative mt-2 inline-block">
                      <img
                        src={helpAttachmentPreview}
                        alt="Attachment preview"
                        className="h-24 w-auto rounded-xl object-cover"
                        style={{ border: "1px solid rgba(201,160,122,0.25)" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHelpAttachment(null);
                          setHelpAttachmentPreview(null);
                        }}
                        className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full text-white shadow"
                        style={{ background: "linear-gradient(135deg, #b46d73, #923f4a)" }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => helpFileRef.current?.click()}
                      className="mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition hover:brightness-110"
                      style={{
                        background: DARK_INPUT_BG,
                        border: "1px dashed rgba(201,160,122,0.35)",
                        color: "rgba(245,237,228,0.7)",
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      <ImagePlus className="h-4 w-4" style={{ color: GOLD }} /> Add screenshot or photo
                    </button>
                  )}
                </div>

                {helpError && (
                  <div
                    className="mt-3 rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: "rgba(180,109,115,0.18)",
                      border: "1px solid rgba(180,109,115,0.4)",
                      color: "#f1c6ca",
                    }}
                  >
                    {helpError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleHelpSubmit}
                  disabled={helpSending || !helpMessage.trim()}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #b46d73, #923f4a)",
                    boxShadow: "0 8px 24px rgba(146,63,74,0.45)",
                    fontFamily: "'Jost', sans-serif",
                  }}
                >
                  {helpSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Submit Ticket
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Profile Modal ── */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: "rgba(5,2,3,0.72)", backdropFilter: "blur(6px)" }}
          onClick={closeProfileModal}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[22px] p-7"
            style={{
              background:
                "linear-gradient(180deg, rgba(28,13,16,0.98) 0%, rgba(14,6,8,0.99) 100%)",
              border: GOLD_BORDER,
              boxShadow:
                "0 32px 72px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,160,122,0.08)",
              fontFamily: "'Jost', sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] tracking-[0.28em] uppercase" style={{ color: GOLD }}>
                  Reseato
                </p>
                <h2
                  className="text-3xl font-light"
                  style={{ color: CREAM, fontFamily: "'Cormorant Garamond', serif" }}
                >
                  My Profile
                </h2>
                <p className="mt-1 text-sm" style={{ color: "rgba(245,237,228,0.55)" }}>
                  View and manage your account details
                </p>
              </div>
              <button
                type="button"
                onClick={closeProfileModal}
                className="grid h-8 w-8 place-items-center rounded-full transition hover:brightness-110"
                style={{
                  background: "rgba(28,13,16,0.6)",
                  border: "1px solid rgba(201,160,122,0.25)",
                  color: GOLD,
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileMsg && (
              <div
                className="mb-5 rounded-2xl px-4 py-3 text-sm"
                style={{
                  background: profileMsg.toLowerCase().includes("updated") || profileMsg.toLowerCase().includes("photo")
                    ? "rgba(201,160,122,0.12)"
                    : "rgba(180,109,115,0.14)",
                  border: profileMsg.toLowerCase().includes("updated") || profileMsg.toLowerCase().includes("photo")
                    ? "1px solid rgba(201,160,122,0.35)"
                    : "1px solid rgba(180,109,115,0.4)",
                  color: profileMsg.toLowerCase().includes("updated") || profileMsg.toLowerCase().includes("photo")
                    ? GOLD
                    : "#f1c6ca",
                }}
              >
                {profileMsg}
              </div>
            )}

            {!profileDetails ? (
              <div className="py-10 text-center" style={{ color: "rgba(245,237,228,0.55)" }}>
                Loading profile...
              </div>
            ) : !profileEditOpen ? (
              <div className="space-y-5">
                {/* Avatar + Name card */}
                <div
                  className="flex items-center gap-5 rounded-2xl p-5"
                  style={{
                    background: "rgba(10,5,7,0.55)",
                    border: GOLD_BORDER,
                  }}
                >
                  <div className="relative shrink-0">
                    {profileDetails.avatarUrl ? (
                      <img
                        src={profileDetails.avatarUrl}
                        alt="Profile"
                        className="h-20 w-20 rounded-full object-cover"
                        style={{ border: "3px solid rgba(201,160,122,0.45)" }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="grid h-20 w-20 place-items-center rounded-full text-2xl font-semibold text-white"
                        style={{
                          background: "linear-gradient(135deg, #b46d73, #923f4a)",
                          boxShadow: "0 8px 22px rgba(146,63,74,0.45)",
                        }}
                      >
                        {(profileDetails.fullName || profileDetails.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => profileAvatarInputRef.current?.click()}
                      disabled={profileUploadingAvatar}
                      className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg, #b46d73, #923f4a)",
                        border: "2px solid #0a0507",
                      }}
                    >
                      <Camera className="h-3 w-3" />
                    </button>
                    <input
                      ref={profileAvatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={onProfileAvatarSelected}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3
                      className="text-2xl font-light"
                      style={{ color: CREAM, fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {profileDetails.fullName}
                    </h3>
                    <p className="text-sm" style={{ color: "rgba(245,237,228,0.55)" }}>
                      {profileDetails.email}
                    </p>
                    <span
                      className="mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase"
                      style={{
                        background: "rgba(201,160,122,0.12)",
                        border: "1px solid rgba(201,160,122,0.35)",
                        color: GOLD,
                      }}
                    >
                      {profileDetails.role}
                    </span>
                    {profileUploadingAvatar && (
                      <p className="mt-1 text-xs" style={{ color: "rgba(245,237,228,0.55)" }}>
                        Uploading...
                      </p>
                    )}
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-3">
                  {[
                    { Icon: Mail, label: "Email Address", value: profileDetails.email },
                    { Icon: Phone, label: "Phone Number", value: profileDetails.phone || "Not provided" },
                    { Icon: Shield, label: "Account Role", value: profileDetails.role },
                    { Icon: CalendarDays, label: "Member Since", value: profileDetails.memberSince },
                  ].map(({ Icon, label, value }) => (
                    <div
                      key={label}
                      className="rounded-2xl p-4"
                      style={{
                        background: "rgba(10,5,7,0.55)",
                        border: GOLD_BORDER,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-11 w-11 place-items-center rounded-xl"
                          style={{
                            background: "rgba(201,160,122,0.10)",
                            border: "1px solid rgba(201,160,122,0.28)",
                            color: GOLD,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                            style={{ color: GOLD }}
                          >
                            {label}
                          </div>
                          <div className="truncate text-sm font-medium" style={{ color: CREAM }}>
                            {value}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setProfileEditOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-110"
                    style={{
                      background: "linear-gradient(135deg, #b46d73, #923f4a)",
                      boxShadow: "0 8px 24px rgba(146,63,74,0.45)",
                    }}
                  >
                    <PencilLine className="h-4 w-4" /> Edit Details
                  </button>
                </div>
              </div>
            ) : (
              /* Edit form */
              <form onSubmit={onProfileSave} className="space-y-4">
                <label className="block">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: GOLD }}
                  >
                    Full Name
                  </div>
                  <input
                    value={profileForm.fullName}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, fullName: e.target.value }))
                    }
                    className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{
                      background: DARK_INPUT_BG,
                      border: "1px solid rgba(201,160,122,0.25)",
                      color: CREAM,
                      fontFamily: "'Jost', sans-serif",
                    }}
                    placeholder="Your full name"
                    required
                  />
                </label>
                <label className="block">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: GOLD }}
                  >
                    Phone Number
                  </div>
                  <input
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{
                      background: DARK_INPUT_BG,
                      border: "1px solid rgba(201,160,122,0.25)",
                      color: CREAM,
                      fontFamily: "'Jost', sans-serif",
                    }}
                    placeholder="09XXXXXXXXX"
                  />
                </label>
                <label className="block">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: GOLD }}
                  >
                    Account Role
                  </div>
                  <input
                    value={profileDetails.role}
                    readOnly
                    className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{
                      background: "rgba(10,5,7,0.4)",
                      border: "1px solid rgba(201,160,122,0.18)",
                      color: "rgba(245,237,228,0.55)",
                      fontFamily: "'Jost', sans-serif",
                    }}
                  />
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "rgba(245,237,228,0.45)" }}
                  >
                    Account role is managed by admin.
                  </p>
                </label>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setProfileEditOpen(false)}
                    className="rounded-full px-5 py-2 text-xs tracking-[0.18em] uppercase transition"
                    style={{
                      background: "rgba(28,13,16,0.6)",
                      border: "1px solid rgba(201,160,122,0.25)",
                      color: "rgba(245,237,228,0.7)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="rounded-full px-5 py-2 text-xs tracking-[0.18em] uppercase text-white transition hover:brightness-110 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #b46d73, #923f4a)",
                      boxShadow: "0 8px 24px rgba(146,63,74,0.45)",
                    }}
                  >
                    {profileSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Sign Out Confirmation ── */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: "rgba(5,2,3,0.72)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-[22px] p-6"
            style={{
              background:
                "linear-gradient(180deg, rgba(28,13,16,0.98) 0%, rgba(14,6,8,0.99) 100%)",
              border: GOLD_BORDER,
              boxShadow:
                "0 32px 72px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,160,122,0.08)",
              fontFamily: "'Jost', sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  boxShadow: "0 4px 18px rgba(146,63,74,0.45)",
                }}
              >
                <LogOut className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3
                  className="text-xl font-light"
                  style={{ color: CREAM, fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Sign Out
                </h3>
                <p className="text-sm" style={{ color: "rgba(245,237,228,0.6)" }}>
                  Are you sure you want to sign out?
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition"
                style={{
                  background: "rgba(28,13,16,0.6)",
                  border: "1px solid rgba(201,160,122,0.25)",
                  color: "rgba(245,237,228,0.75)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="flex-1 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #b46d73, #923f4a)",
                  boxShadow: "0 8px 24px rgba(146,63,74,0.45)",
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
