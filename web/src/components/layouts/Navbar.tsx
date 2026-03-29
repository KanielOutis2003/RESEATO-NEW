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
  Menu,
  PencilLine,
  Phone,
  Send,
  Shield,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/auth/useSession";
import {
  AppNotification,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../lib/api/notifications.api";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#f8ecee] text-[#7b2f3b]"
      : "text-[#5b6374] hover:bg-[#f7f3f4] hover:text-[#7b2f3b]"
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#f8ecee] text-[#7b2f3b]"
      : "text-[#4b5563] hover:bg-[#f8f3f5] hover:text-[#7b2f3b]"
  }`;

type RoleKind = "guest" | "customer" | "vendor" | "admin";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

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

function getRoleKind(role: string, hasSession: boolean): RoleKind {
  if (!hasSession) return "guest";
  if (role === "admin") return "admin";
  if (role === "vendor" || role === "owner" || role === "manager") {
    return "vendor";
  }
  return "customer";
}

function getRoleLabel(roleKind: RoleKind) {
  if (roleKind === "vendor") return "Vendor";
  if (roleKind === "admin") return "Admin";
  if (roleKind === "customer") return "Customer";
  return "Guest";
}

function getNavItems(roleKind: RoleKind): NavItem[] {
  if (roleKind === "vendor") {
    return [
      { to: "/vendor", label: "Dashboard", end: true },
      { to: "/vendor/reservations", label: "Reservation List" },
      { to: "/vendor/tables", label: "Tables" },
    ];
  }

  if (roleKind === "admin") {
    return [
      { to: "/admin", label: "Dashboard", end: true },
    ];
  }

  if (roleKind === "customer") {
    return [
      { to: "/restaurants", label: "Restaurants" },
      { to: "/my-reservations", label: "My Reservations" },
    ];
  }

  return [
    { to: "/", label: "Home", end: true },
    { to: "/restaurants", label: "Restaurants" },
  ];
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

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session } = useSession();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [role, setRole] = useState("customer");
  const [profileFullName, setProfileFullName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Help modal state
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
    fullName: string; email: string; phone: string; role: string; memberSince: string; avatarUrl: string;
  } | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUploadingAvatar, setProfileUploadingAvatar] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const roleKind = useMemo(
    () => getRoleKind(role, Boolean(session)),
    [role, session],
  );

  const roleLabel = useMemo(() => getRoleLabel(roleKind), [roleKind]);

  const navItems = useMemo(() => getNavItems(roleKind), [roleKind]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  useEffect(() => {
    setNotifOpen(false);
    setProfileOpen(false);
    setMobileMenuOpen(false);
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

      if (menuRef.current && !menuRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    }

    if (notifOpen || profileOpen || mobileMenuOpen) {
      document.addEventListener("pointerdown", onPointerDown);
    }

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [notifOpen, profileOpen, mobileMenuOpen]);

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

      if (data.role) {
        setRole(normalizeRole(data.role));
      }

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

  useEffect(() => {
    let alive = true;

    async function loadNotifications() {
      if (!session || !notifOpen) return;

      try {
        setLoadingNotifications(true);
        const items = await listMyNotifications();
        if (!alive) return;
        setNotifications(items);
      } catch {
        if (!alive) return;
        setNotifications([]);
      } finally {
        if (!alive) return;
        setLoadingNotifications(false);
      }
    }

    loadNotifications();

    return () => {
      alive = false;
    };
  }, [notifOpen, session]);

  async function logout() {
    await supabase.auth.signOut();
    setProfileOpen(false);
    setMobileMenuOpen(false);
    navigate("/log-in-sign-up");
  }

  function openProfilePage() {
    setProfileOpen(false);
    setMobileMenuOpen(false);
    setProfileModalOpen(true);
  }

  // Load profile data when modal opens
  useEffect(() => {
    if (!profileModalOpen || !session?.user) return;
    let alive = true;
    const user = session.user;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const firstName = typeof meta.first_name === "string" ? meta.first_name : "";
    const lastName = typeof meta.last_name === "string" ? meta.last_name : "";
    const fbRole = typeof meta.role === "string" ? meta.role : "customer";
    const fbPhone = typeof meta.phone === "string" ? meta.phone : "";
    const fbAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url : "";
    const fbName = `${firstName} ${lastName}`.trim() || (typeof meta.full_name === "string" ? meta.full_name : "") || (user.email ? user.email.split("@")[0] : "Customer");
    const cap = (v: string) => v ? v[0].toUpperCase() + v.slice(1).toLowerCase() : "";
    const fmtDate = (d: string) => { const dt = new Date(d); return Number.isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }); };

    const fallback = { fullName: fbName, email: user.email ?? "", phone: fbPhone, role: cap(fbRole), memberSince: fmtDate(user.created_at || ""), avatarUrl: fbAvatar };
    if (alive) { setProfileDetails(fallback); setProfileForm({ fullName: fallback.fullName, phone: fallback.phone }); setProfileMsg(null); }

    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!alive) return;
      if (error) { setProfileMsg("Using account metadata."); return; }
      const p = data as { id: string; full_name?: string | null; role?: string | null; phone?: string | null; avatar_url?: string | null; created_at?: string | null } | null;
      if (!p) return;
      const pRole = p.role?.trim().toLowerCase() || "";
      const resolvedRole = pRole && pRole !== "customer" ? pRole : fbRole.toLowerCase() !== "customer" ? fbRole.toLowerCase() : pRole || fbRole.toLowerCase() || "customer";
      const merged = {
        fullName: p.full_name?.trim() || fbName,
        email: user.email ?? "",
        phone: p.phone?.trim() || fbPhone,
        role: cap(resolvedRole),
        memberSince: fmtDate(p.created_at || user.created_at || ""),
        avatarUrl: p.avatar_url?.trim() || fbAvatar,
      };
      if (alive) { setProfileDetails(merged); setProfileForm({ fullName: merged.fullName, phone: merged.phone }); }
    })();
    return () => { alive = false; };
  }, [profileModalOpen, session?.user]);

  async function onProfileAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !session?.user || !profileDetails) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { setProfileMsg("Please use JPG, PNG, or WEBP."); event.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { setProfileMsg("Max size is 5MB."); event.target.value = ""; return; }
    setProfileUploadingAvatar(true); setProfileMsg(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      const avatarUrl = supabase.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;
      await supabase.from("profiles").upsert({ id: session.user.id, full_name: profileDetails.fullName, phone: profileDetails.phone || null, avatar_url: avatarUrl }, { onConflict: "id" });
      const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
      await supabase.auth.updateUser({ data: { ...meta, avatar_url: avatarUrl } });
      setProfileDetails((p) => p ? { ...p, avatarUrl } : p);
      setProfileMsg("Profile photo updated.");
    } catch (err: any) { setProfileMsg(err?.message ?? "Failed to upload photo."); }
    finally { setProfileUploadingAvatar(false); event.target.value = ""; }
  }

  async function onProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!session?.user || !profileDetails) return;
    const cleanName = profileForm.fullName.trim();
    const cleanPhone = profileForm.phone.trim();
    if (!cleanName) { setProfileMsg("Full name is required."); return; }
    setProfileSaving(true); setProfileMsg(null);
    try {
      const up = await supabase.from("profiles").upsert({ id: session.user.id, full_name: cleanName, phone: cleanPhone || null, avatar_url: profileDetails.avatarUrl || null }, { onConflict: "id" }).select("*").single();
      const prof = up.error ? null : (up.data as { full_name?: string | null; phone?: string | null; role?: string | null; avatar_url?: string | null });
      const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
      const parts = cleanName.split(" ").map((p) => p.trim()).filter(Boolean);
      await supabase.auth.updateUser({ data: { ...meta, full_name: cleanName, first_name: parts[0] ?? "", last_name: parts.slice(1).join(" "), phone: cleanPhone, avatar_url: profileDetails.avatarUrl } });
      const cap = (v: string) => v ? v[0].toUpperCase() + v.slice(1).toLowerCase() : "";
      const merged = {
        fullName: prof?.full_name?.trim() || cleanName,
        email: session.user.email ?? "",
        phone: prof?.phone?.trim() || cleanPhone,
        role: cap(prof?.role?.trim() || profileDetails.role),
        memberSince: profileDetails.memberSince,
        avatarUrl: prof?.avatar_url?.trim() || profileDetails.avatarUrl,
      };
      setProfileDetails(merged); setProfileForm({ fullName: merged.fullName, phone: merged.phone });
      setProfileEditOpen(false); setProfileMsg("Profile updated.");
      // Update navbar display name/avatar
      setProfileFullName(merged.fullName);
      setProfileAvatarUrl(merged.avatarUrl);
    } catch (err: any) { setProfileMsg(err?.message ?? "Failed to update profile."); }
    finally { setProfileSaving(false); }
  }

  function closeProfileModal() {
    setProfileModalOpen(false);
    setProfileEditOpen(false);
    setProfileMsg(null);
  }

  function handleBrandClick() {
    if (roleKind === "admin") {
      navigate("/admin");
      return;
    }

    if (roleKind === "vendor") {
      navigate("/vendor");
      return;
    }

    if (roleKind === "customer") {
      navigate("/restaurants");
      return;
    }

    navigate("/");
  }

  async function handleNotificationClick(item: AppNotification) {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id);
      } catch {
        // Ignore read failure and still navigate.
      }

      setNotifications((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                is_read: true,
              }
            : row,
        ),
      );
    }

    setNotifOpen(false);

    if (item.link) {
      navigate(item.link);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
        })),
      );
    } catch {
      // Ignore for now.
    }
  }

  function onHelpFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { setHelpError("Only JPG, PNG, WEBP, or GIF images allowed."); e.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { setHelpError("Max file size is 5 MB."); e.target.value = ""; return; }
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { setHelpError("You must be logged in."); return; }

      let attachmentUrl: string | null = null;
      if (helpAttachment) {
        const ext = helpAttachment.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `tickets/${currentUser.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("support-attachments").upload(path, helpAttachment, { upsert: true, contentType: helpAttachment.type });
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

  return (
    <>
    <header
      className="
        sticky top-0 z-50
        border-b border-[#e8dfe2]
        bg-[rgba(255,255,255,0.92)]
        backdrop-blur-xl
      "
    >
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4" ref={menuRef}>
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((prev) => !prev);
                setNotifOpen(false);
                setProfileOpen(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#e0d6d8] bg-white text-[#7b2f3b] transition hover:bg-[#f7f3f4] sm:hidden"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <button
              onClick={handleBrandClick}
              className="group inline-flex min-w-0 items-center gap-2 rounded-xl px-1 text-left"
              aria-label="Go to dashboard"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#8b3d4a] shadow-sm shadow-[#e8ccd1] transition-all duration-300 group-hover:bg-[#7b2f3b] sm:h-10 sm:w-10">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </span>
              <span className="truncate text-[18px] font-semibold tracking-tight text-[#1f2937] sm:text-[24px]">
                RESEATO
              </span>
            </button>
          </div>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 sm:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} end={item.end}>
                {item.label}
              </NavLink>
            ))}

            {!session && (
              <NavLink to="/log-in-sign-up" className={linkClass}>
                Login / Sign up
              </NavLink>
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2">

            {session ? (
              <>
                <span className="hidden rounded-full border border-[#dfc8cd] bg-[#f8ecee] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#7b2f3b] md:inline-flex">
                  {roleLabel}
                </span>

                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => {
                      setNotifOpen((prev) => !prev);
                      setProfileOpen(false);
                      setMobileMenuOpen(false);
                    }}
                    className="relative rounded-full border border-[#e0d6d8] bg-white p-2 text-[#7b2f3b] transition hover:bg-[#f7f3f4]"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#d14d5b] px-1 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[#eadde1] bg-white text-[#1f2937] shadow-[0_22px_48px_rgba(15,23,42,0.16)] sm:w-96">
                      <div className="flex items-center justify-between border-b border-[#f0e8ea] px-5 py-4">
                        <div className="text-lg font-semibold">Notifications</div>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#e8dfe2] bg-[#faf7f8] px-2.5 py-1.5 text-xs text-[#5b6374] hover:bg-[#f5eff1]"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      {loadingNotifications ? (
                        <div className="px-6 py-6 text-sm text-[#6b7280]">Loading notifications...</div>
                      ) : notifications.length === 0 ? (
                        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
                          <div className="grid h-12 w-12 place-items-center rounded-full border border-[#eadde1] bg-[#f8ecee] text-[#7b2f3b]">
                            <Bell className="h-5 w-5" />
                          </div>
                          <p className="text-sm text-[#6b7280]">No notifications yet</p>
                        </div>
                      ) : (
                        <div className="max-h-[380px] overflow-y-auto">
                          {notifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleNotificationClick(item)}
                              className={`w-full border-b border-[#f4edf0] px-4 py-3 text-left transition hover:bg-[#faf5f7] ${
                                item.is_read ? "bg-transparent" : "bg-[#fff8fa]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-[#1f2937]">{item.title}</p>
                                <span className="shrink-0 text-[11px] text-[#8b97a8]">
                                  {formatNotificationTime(item.created_at)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#5b6374]">{item.body}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {roleKind === "customer" && (
                  <button
                    type="button"
                    onClick={() => { setHelpOpen(true); setHelpSent(false); setHelpMessage(""); setHelpError(null); setHelpAttachment(null); setHelpAttachmentPreview(null); }}
                    className="rounded-full border border-[#e0d6d8] bg-white p-2 text-[#7b2f3b] transition hover:bg-[#f7f3f4]"
                    aria-label="Customer Service"
                    title="Customer Service"
                  >
                    <Headphones className="h-4 w-4" />
                  </button>
                )}

                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => {
                      setProfileOpen((prev) => !prev);
                      setNotifOpen(false);
                      setMobileMenuOpen(false);
                    }}
                    className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[#d8c0c6] bg-[#f8ecee] text-sm font-semibold text-[#7b2f3b] transition hover:bg-[#f4e0e5]"
                    aria-label="Open account menu"
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
                    <div className="absolute right-0 mt-3 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[#eadde1] bg-white text-[#1f2937] shadow-[0_22px_48px_rgba(15,23,42,0.16)] sm:w-72">
                      <div className="border-b border-[#f0e8ea] px-4 py-4">
                        <p className="truncate text-base font-semibold text-[#1f2937]">
                          {displayFullName}
                        </p>
                        <p className="truncate text-sm text-[#6b7280]">{email}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#8b3d4a]">
                          {roleLabel}
                        </p>
                      </div>

                      <button
                        onClick={openProfilePage}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#374151] transition hover:bg-[#faf5f7]"
                      >
                        <User className="h-4 w-4 text-[#8b3d4a]" />
                        My Profile
                      </button>

                      <div className="h-px bg-[#f0e8ea]" />

                      <button
                        onClick={() => { setProfileOpen(false); setShowLogoutConfirm(true); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#b42336] transition hover:bg-[#fff3f5]"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <NavLink
                to="/log-in-sign-up"
                className="inline-flex rounded-xl border border-[#e0d6d8] px-3 py-2 text-sm font-semibold text-[#7b2f3b] transition hover:bg-[#f8ecee] sm:hidden"
              >
                Login
              </NavLink>
            )}
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-3 border-t border-[#efe8ea] pt-3 sm:hidden">
            <nav className="space-y-1 rounded-2xl border border-[#eadde1] bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={mobileLinkClass}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}

              {!session && (
                <NavLink
                  to="/log-in-sign-up"
                  className={mobileLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login / Sign up
                </NavLink>
              )}

              {session && (
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#8b3d4a]">
                  {roleLabel}
                </div>
              )}
            </nav>
          </div>
        )}
      </div>

    </header>

      {/* Customer Service Modal — rendered outside header to avoid sticky clipping */}
      {helpOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setHelpOpen(false)}>
          <div className="relative w-full max-w-md rounded-3xl border border-[#e8dfe2] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.2)]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setHelpOpen(false)} className="absolute top-4 right-4 rounded-full border border-[#e8dfe2] p-2 text-[#6b7280] transition hover:text-[#1f2937]">
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f8ecee] text-[#7b2f3b]">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1f2937]">Customer Service</h3>
                <p className="text-sm text-[#6b7280]">We're here to help</p>
              </div>
            </div>

            {helpSent ? (
              <div className="mt-6 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#d1fae5] text-[#065f46]">
                  <CheckCheck className="h-7 w-7" />
                </div>
                <h4 className="mt-4 text-lg font-semibold text-[#1f2937]">Ticket Submitted</h4>
                <p className="mt-2 text-sm text-[#6b7280]">Our team will review your request and get back to you via email.</p>
                <button type="button" onClick={() => setHelpOpen(false)} className="mt-5 w-full rounded-xl bg-[#1f2937] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#374151]">Done</button>
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                    Topic
                    <select value={helpSubject} onChange={(e) => setHelpSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]">
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
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                    Message
                    <textarea
                      value={helpMessage}
                      onChange={(e) => setHelpMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      className="mt-2 min-h-[100px] w-full resize-none rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#98a2b3] outline-none focus:border-[#b46d73]"
                    />
                  </label>
                </div>

                {/* Attachment */}
                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Attachment (optional)</label>
                  <input ref={helpFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onHelpFileChange} />
                  {helpAttachmentPreview ? (
                    <div className="relative mt-2 inline-block">
                      <img src={helpAttachmentPreview} alt="Attachment preview" className="h-24 w-auto rounded-xl border border-[#ddd8da] object-cover" />
                      <button type="button" onClick={() => { setHelpAttachment(null); setHelpAttachmentPreview(null); }} className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-[#1f2937] text-white shadow">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => helpFileRef.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#d1d5db] bg-[#faf8f9] px-4 py-2.5 text-sm text-[#6b7280] transition hover:border-[#b46d73] hover:text-[#7b2f3b]">
                      <ImagePlus className="h-4 w-4" /> Add screenshot or photo
                    </button>
                  )}
                </div>

                {helpError && (
                  <div className="mt-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b]">{helpError}</div>
                )}

                <button
                  type="button"
                  onClick={handleHelpSubmit}
                  disabled={helpSending || !helpMessage.trim()}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d5bcc2] bg-[linear-gradient(135deg,#9b4b56,#7f3a41)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {helpSending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Submit Ticket</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Profile Modal ── */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#e8dfe2] bg-white p-7 shadow-[0_24px_52px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#1f2937]">My Profile</h2>
                <p className="mt-1 text-sm text-[#6b7280]">View and manage your account details</p>
              </div>
              <button type="button" onClick={closeProfileModal} className="rounded-full border border-[#e8dfe2] p-2 text-[#6b7280] transition hover:text-[#7b2f3b]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileMsg && (
              <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                profileMsg.toLowerCase().includes("success") || profileMsg.toLowerCase().includes("updated") || profileMsg.toLowerCase().includes("photo")
                  ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                  : profileMsg.toLowerCase().includes("metadata")
                    ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                    : "border-[#f0cdd4] bg-[#fff6f7] text-[#9f1239]"
              }`}>{profileMsg}</div>
            )}

            {!profileDetails ? (
              <div className="py-10 text-center text-[#6b7280]">Loading profile...</div>
            ) : !profileEditOpen ? (
              <div className="space-y-5">
                {/* Avatar + Name card */}
                <div className="flex items-center gap-5 rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5">
                  <div className="relative shrink-0">
                    {profileDetails.avatarUrl ? (
                      <img src={profileDetails.avatarUrl} alt="Profile" className="h-20 w-20 rounded-full border-4 border-[#f8ecee] object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#b76a73,#8f3d56)] text-2xl font-semibold text-white">
                        {(profileDetails.fullName || profileDetails.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <button type="button" onClick={() => profileAvatarInputRef.current?.click()} disabled={profileUploadingAvatar} className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#8b3d4a] text-white shadow-md transition hover:brightness-110 disabled:opacity-60">
                      <Camera className="h-3 w-3" />
                    </button>
                    <input ref={profileAvatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onProfileAvatarSelected} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-[#1f2937]">{profileDetails.fullName}</h3>
                    <p className="text-sm text-[#6b7280]">{profileDetails.email}</p>
                    <span className="mt-1.5 inline-block rounded-full bg-[#f8ecee] px-3 py-0.5 text-xs font-semibold text-[#8b3d4a]">{profileDetails.role}</span>
                    {profileUploadingAvatar && <p className="mt-1 text-xs text-[#6b7280]">Uploading...</p>}
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#ece8e9] bg-[#fafafa] p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#e0cfd4] bg-[#f8ecee] text-[#8b3d4a]"><Mail className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Email Address</div>
                        <div className="truncate text-sm font-medium text-[#1f2937]">{profileDetails.email}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#ece8e9] bg-[#fafafa] p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#e0cfd4] bg-[#f8ecee] text-[#8b3d4a]"><Phone className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Phone Number</div>
                        <div className="truncate text-sm font-medium text-[#1f2937]">{profileDetails.phone || "Not provided"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#ece8e9] bg-[#fafafa] p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#e0cfd4] bg-[#f8ecee] text-[#8b3d4a]"><Shield className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Account Role</div>
                        <div className="truncate text-sm font-medium text-[#1f2937]">{profileDetails.role}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#ece8e9] bg-[#fafafa] p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#e0cfd4] bg-[#f8ecee] text-[#8b3d4a]"><CalendarDays className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Member Since</div>
                        <div className="truncate text-sm font-medium text-[#1f2937]">{profileDetails.memberSince}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => setProfileEditOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8c0c6] bg-[#f8ecee] px-4 py-2.5 text-sm font-semibold text-[#7b2f3b] transition hover:bg-[#f2dde2]">
                    <PencilLine className="h-4 w-4" /> Edit Details
                  </button>
                </div>
              </div>
            ) : (
              /* Edit form */
              <form onSubmit={onProfileSave} className="space-y-4">
                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Full Name</div>
                  <input value={profileForm.fullName} onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))} className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]" placeholder="Your full name" required />
                </label>
                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Phone Number</div>
                  <input value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]" placeholder="09XXXXXXXXX" />
                </label>
                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Account Role</div>
                  <input value={profileDetails.role} readOnly className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-[#f9fafb] px-4 py-3 text-sm text-[#6b7280] outline-none" />
                  <p className="mt-1 text-xs text-[#6b7280]">Account role is managed by admin.</p>
                </label>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setProfileEditOpen(false)} className="rounded-xl border border-[#e8dfe2] bg-white px-4 py-2 text-sm text-[#6b7280] transition hover:bg-[#f9fafb]">Cancel</button>
                  <button type="submit" disabled={profileSaving} className="rounded-xl bg-[#8b3e46] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60">{profileSaving ? "Saving..." : "Save Changes"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sign Out Confirmation — rendered outside header to avoid sticky clipping */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#e8dfe2] bg-white p-6 shadow-[0_22px_48px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff1f2] text-[#be123c]">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1f2937]">Sign Out</h3>
                <p className="text-sm text-[#6b7280]">Are you sure you want to sign out?</p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-[#f3f4f6]"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowLogoutConfirm(false); logout(); }}
                className="flex-1 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-4 py-2.5 text-sm font-semibold text-[#be123c] transition hover:bg-[#ffe4e8]"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

