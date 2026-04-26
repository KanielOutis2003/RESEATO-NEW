import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ClipboardList,
  Crown,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PencilLine,
  Phone,
  Settings,
  Shield,
  User,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth/useAuth";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "../../lib/api/notifications.api";

/* ── types ── */
type ProfileRow = {
  id: string;
  full_name?: string | null;
  role?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};
type PersonalInfo = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  memberSince: string;
  avatarUrl: string;
};
type EditForm = { fullName: string; phone: string };

/* ── helpers ── */
const AVATAR_BUCKET = "profile-photos";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

function capitalize(v: string) {
  return v ? v[0].toUpperCase() + v.slice(1).toLowerCase() : "";
}
function formatDate(raw: string) {
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
function toInitials(name: string, email: string) {
  const p = name.split(" ").map((s) => s.trim()).filter(Boolean);
  if (p.length >= 2) return `${p[0][0]}${p[1][0]}`.toUpperCase();
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase() || "AD";
}
function deriveFromMetadata(user: {
  email?: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = typeof m.first_name === "string" ? m.first_name : "";
  const lastName = typeof m.last_name === "string" ? m.last_name : "";
  const role = typeof m.role === "string" ? m.role : "admin";
  const phone = typeof m.phone === "string" ? m.phone : "";
  const avatarUrl = typeof m.avatar_url === "string" ? m.avatar_url : "";
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    (typeof m.full_name === "string" ? m.full_name : "") ||
    (user.email ? user.email.split("@")[0] : "Admin");
  return { fullName, role, phone, avatarUrl };
}
async function upsertProfile(payload: Record<string, unknown>) {
  let cur = { ...payload };
  for (let i = 0; i < 4; i++) {
    const r = await supabase.from("profiles").upsert(cur, { onConflict: "id" }).select("*").single();
    if (!r.error) return r;
    const msg = r.error.message.toLowerCase();
    let changed = false;
    if (msg.includes("phone") && "phone" in cur) { delete cur.phone; changed = true; }
    if (msg.includes("avatar_url") && "avatar_url" in cur) { delete cur.avatar_url; changed = true; }
    if (!changed) return r;
  }
  return supabase.from("profiles").upsert(cur, { onConflict: "id" }).select("*").single();
}

/* ── sidebar link style ── */
const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm transition-colors duration-200 ${
    isActive
      ? "bg-[rgba(94,122,182,0.24)] text-white font-semibold"
      : "text-[#d0daf0] hover:bg-[rgba(94,122,182,0.14)]"
  }`;

const sidebarButtonClass =
  "flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm text-[#d0daf0] transition-colors duration-200 hover:bg-[rgba(94,122,182,0.14)]";

/* ── InfoRow ── */
function InfoRow(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#dde3ef] bg-[#f8f9fc] p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#c8d3ea] bg-[#e8edf8] text-[#3153a1]">
          {props.icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{props.label}</div>
          <div className="truncate text-sm font-medium text-[#1f2937]">{props.value || "Not provided"}</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ */
export default function AdminSidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /* admin display name */
  const adminName = useMemo(() => {
    if (!user) return "Admin";
    const { fullName } = deriveFromMetadata(user);
    return fullName.split(" ")[0] || "Admin";
  }, [user]);

  /* ── settings modal state ── */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account" | "security" | "notifications">("account");
  const [details, setDetails] = useState<PersonalInfo | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>({ fullName: "", phone: "" });
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  /* security tab */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  /* notifications tab */
  const [notifNewVendor, setNotifNewVendor] = useState(true);
  const [notifReservation, setNotifReservation] = useState(true);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifSystem, setNotifSystem] = useState(false);

  /* ── notification bell state ── */
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await listMyNotifications();
      setNotifications(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Realtime subscription for instant notifications
    if (!user) return;
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => [row, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications, user]);

  // Close panel on outside click
  useEffect(() => {
    if (!notifPanelOpen) return;
    function handleClick(e: MouseEvent) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setNotifPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifPanelOpen]);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch { /* ignore */ }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  }

  /* load profile when modal opens */
  useEffect(() => {
    if (!settingsOpen) return;
    if (!user) return;
    let alive = true;
    const isInitialLoad = !details;
    (async () => {
      if (isInitialLoad) setMessage(null);
      const fb = deriveFromMetadata(user);
      const fallback: PersonalInfo = {
        fullName: fb.fullName,
        email: user.email ?? "",
        phone: fb.phone,
        role: capitalize(fb.role),
        memberSince: formatDate(user.created_at || ""),
        avatarUrl: fb.avatarUrl,
      };
      if (alive) {
        setDetails(fallback);
        setForm({ fullName: fallback.fullName, phone: fallback.phone });
      }
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) { if (alive) setMessage("Using account metadata."); return; }
      let profile = data as ProfileRow | null;
      if (!profile) {
        const c = await upsertProfile({ id: user.id, full_name: fb.fullName, phone: fb.phone || null, avatar_url: fb.avatarUrl || null });
        if (c.error) { if (alive) setMessage("Profile row not found."); return; }
        profile = c.data as ProfileRow;
      }
      if (!alive || !profile) return;
      const merged: PersonalInfo = {
        fullName: profile.full_name?.trim() || fb.fullName,
        email: user.email ?? "",
        phone: profile.phone?.trim() || fb.phone,
        role: capitalize(profile.role?.trim() || fb.role),
        memberSince: formatDate(profile.created_at || user.created_at || ""),
        avatarUrl: profile.avatar_url?.trim() || fb.avatarUrl,
      };
      if (alive) { setDetails(merged); setForm({ fullName: merged.fullName, phone: merged.phone }); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, user]);

  const initials = useMemo(() => {
    if (!details) return "AD";
    return toInitials(details.fullName, details.email);
  }, [details]);

  async function onAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user || !details) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) { setMessage("Please use JPG, PNG, or WEBP."); event.target.value = ""; return; }
    if (file.size > MAX_AVATAR_BYTES) { setMessage("Max size is 5MB."); event.target.value = ""; return; }
    setUploadingAvatar(true); setMessage(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      const avatarUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
      await upsertProfile({ id: user.id, full_name: details.fullName, phone: details.phone || null, avatar_url: avatarUrl });
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { error: aErr } = await supabase.auth.updateUser({ data: { ...meta, avatar_url: avatarUrl } });
      if (aErr) throw aErr;
      setDetails((p) => (p ? { ...p, avatarUrl } : p));
      setMessage("Profile photo updated.");
    } catch (err: any) { setMessage(err?.message ?? "Failed to upload photo."); }
    finally { setUploadingAvatar(false); event.target.value = ""; }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user || !details) return;
    const cleanName = form.fullName.trim();
    const cleanPhone = form.phone.trim();
    if (!cleanName) { setMessage("Full name is required."); return; }
    if (cleanPhone && !/^[0-9+\-() ]{7,15}$/.test(cleanPhone)) { setMessage("Please enter a valid phone number."); return; }
    setSaving(true); setMessage(null);
    try {
      const up = await upsertProfile({ id: user.id, full_name: cleanName, phone: cleanPhone || null, avatar_url: details.avatarUrl || null });
      const prof = up.error ? null : (up.data as ProfileRow);
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const parts = cleanName.split(" ").map((p) => p.trim()).filter(Boolean);
      const { error: aErr } = await supabase.auth.updateUser({
        data: { ...meta, full_name: cleanName, first_name: parts[0] ?? "", last_name: parts.slice(1).join(" "), phone: cleanPhone, avatar_url: details.avatarUrl },
      });
      if (aErr) throw aErr;
      const merged: PersonalInfo = {
        fullName: prof?.full_name?.trim() || cleanName,
        email: user.email ?? "",
        phone: prof?.phone?.trim() || cleanPhone,
        role: capitalize(prof?.role?.trim() || details.role),
        memberSince: details.memberSince,
        avatarUrl: prof?.avatar_url?.trim() || details.avatarUrl,
      };
      setDetails(merged); setForm({ fullName: merged.fullName, phone: merged.phone });
      setEditOpen(false); setMessage("Profile updated.");
    } catch (err: any) { setMessage(err?.message ?? "Failed to update profile."); }
    finally { setSaving(false); }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword) { setMessage("Please enter your current password."); return; }
    if (!newPassword) { setMessage("Please enter a new password."); return; }
    if (newPassword.length < 6) { setMessage("Password must be at least 6 characters."); return; }
    if (newPassword === currentPassword) { setMessage("New password must be different from current password."); return; }
    if (newPassword !== confirmPassword) { setMessage("New passwords do not match."); return; }
    setChangingPw(true); setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setMessage("Password updated successfully.");
    } catch (err: any) {
      const msg = err?.message ?? "Failed to update password.";
      if (msg.includes("same_password")) setMessage("New password must be different from your current password.");
      else setMessage(msg);
    }
    finally { setChangingPw(false); }
  }

  function closeModal() { setSettingsOpen(false); setEditOpen(false); setMessage(null); setSettingsTab("account"); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/log-in-sign-up");
  }

  function closeMobile() { onMobileClose?.(); }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] bg-black/50 lg:hidden" onClick={closeMobile} />
      )}
      <aside className={`fixed top-0 left-0 z-[95] flex h-screen w-[270px] shrink-0 flex-col overflow-y-auto bg-[linear-gradient(180deg,#151923_0%,#1c2230_100%)] px-[18px] py-[26px] text-[#d0daf0] transition-transform duration-300 lg:sticky lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={closeMobile}
          className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-[rgba(255,255,255,0.08)] text-[#d0daf0] lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-3 rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 mb-7">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#6f89c8,#3b5ca8)] shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold tracking-wide text-white">RESEATO</div>
            <div className="truncate text-xs font-bold tracking-wide text-[#bfcdf4]">{adminName.toUpperCase()}</div>
          </div>
        </div>

        {/* Notification Bell */}
        <div className="relative mb-4" ref={notifPanelRef}>
          <button
            type="button"
            onClick={() => setNotifPanelOpen((p) => !p)}
            className="relative flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm text-[#d0daf0] transition-colors duration-200 hover:bg-[rgba(94,122,182,0.14)] w-full"
          >
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifPanelOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#1a2340] shadow-xl">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#1a2340] px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8a9bc4]">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[10px] font-semibold text-[#6f89c8] hover:text-white transition"
                  >
                    <Check className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-[#8a9bc4]">No notifications yet</div>
              ) : (
                notifications.slice(0, 30).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.is_read) handleMarkRead(n.id);
                      if (n.link) { navigate(n.link); setNotifPanelOpen(false); closeMobile(); }
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-[rgba(255,255,255,0.04)] transition hover:bg-[rgba(94,122,182,0.12)] ${
                      n.is_read ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6f89c8]" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate">{n.title}</div>
                        <div className="text-[11px] text-[#b0bfe0] line-clamp-2 mt-0.5">{n.body}</div>
                        <div className="text-[10px] text-[#6b7a9e] mt-1">
                          {new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Menu: Administration */}
        <div className="mb-2.5 ml-2.5 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#8a9bc4]">
          Administration
        </div>
        <nav className="space-y-1">
          <NavLink to="/admin" end className={sidebarLinkClass} onClick={closeMobile}>
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </NavLink>
          <NavLink to="/admin/users" className={sidebarLinkClass} onClick={closeMobile}>
            <Users className="h-4 w-4" />
            Users
          </NavLink>
          <NavLink to="/admin/restaurants" className={sidebarLinkClass} onClick={closeMobile}>
            <Building2 className="h-4 w-4" />
            Restaurants
          </NavLink>
          <NavLink to="/admin/reservations" className={sidebarLinkClass} onClick={closeMobile}>
            <BookOpenCheck className="h-4 w-4" />
            Reservations
          </NavLink>
          <NavLink to="/admin/featured" className={sidebarLinkClass} onClick={closeMobile}>
            <Crown className="h-4 w-4" />
            Featured
          </NavLink>
        </nav>

        {/* Menu: Reports */}
        <div className="mt-5 mb-2.5 ml-2.5 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#8a9bc4]">
          Reports
        </div>
        <nav className="space-y-1">
          <NavLink to="/admin/charts" className={sidebarLinkClass} onClick={closeMobile}>
            <BarChart3 className="h-4 w-4" />
            Performance Charts
          </NavLink>
          <NavLink to="/admin/audit" className={sidebarLinkClass} onClick={closeMobile}>
            <ClipboardList className="h-4 w-4" />
            Audit Logs
          </NavLink>
          <NavLink to="/admin/support" className={sidebarLinkClass} onClick={closeMobile}>
            <Headphones className="h-4 w-4" />
            Customer Service
          </NavLink>
          <button type="button" onClick={() => { setSettingsOpen(true); closeMobile(); }} className={sidebarButtonClass}>
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sign Out */}
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm text-[#d0daf0] transition hover:bg-[rgba(94,122,182,0.14)]"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </aside>

      {/* ── Settings Modal (Tabbed) ── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#dde3ef] bg-white p-7 shadow-[0_24px_52px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#1f2937]">Settings</h2>
                <p className="mt-1 text-sm text-[#6b7280]">Manage your account preferences and security</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-full border border-[#dde3ef] p-2 text-[#6b7280] transition hover:text-[#3153a1]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 rounded-2xl border border-[#dde3ef] bg-[#f8f9fc] p-1">
              {([
                { key: "account" as const, label: "Account", icon: <User className="h-4 w-4" /> },
                { key: "security" as const, label: "Security", icon: <KeyRound className="h-4 w-4" /> },
                { key: "notifications" as const, label: "Notifications", icon: <Bell className="h-4 w-4" /> },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setSettingsTab(tab.key); setMessage(null); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    settingsTab === tab.key
                      ? "bg-white text-[#3153a1] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                      : "text-[#6b7280] hover:text-[#1f2937]"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {message && (
              <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                message.toLowerCase().includes("success") || message.toLowerCase().includes("updated") || message.toLowerCase().includes("saved")
                  ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                  : message.toLowerCase().includes("metadata") || message.toLowerCase().includes("info")
                    ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                    : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
              }`}>{message}</div>
            )}

            {/* ── Account Tab ── */}
            {settingsTab === "account" && (
              <div className="space-y-5">
                {!details ? (
                  <div className="py-10 text-center text-[#6b7280]">Loading account details...</div>
                ) : !editOpen ? (
                  <>
                    <div className="flex items-center gap-5 rounded-2xl border border-[#dde3ef] bg-[#f8f9fc] p-5">
                      <div className="relative shrink-0">
                        {details.avatarUrl ? (
                          <img src={details.avatarUrl} alt="Profile" className="h-20 w-20 rounded-full border-4 border-[#e8edf8] object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#6f89c8,#3b5ca8)] text-2xl font-semibold text-white">{initials}</div>
                        )}
                        <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#3153a1] text-white shadow-md transition hover:brightness-110 disabled:opacity-60">
                          <Camera className="h-3 w-3" />
                        </button>
                        <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarSelected} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-[#1f2937]">{details.fullName}</h3>
                        <p className="text-sm text-[#6b7280]">{details.email}</p>
                        <span className="mt-1.5 inline-block rounded-full bg-[#e8edf8] px-3 py-0.5 text-xs font-semibold text-[#3153a1]">{details.role}</span>
                        {uploadingAvatar && <p className="mt-1 text-xs text-[#6b7280]">Uploading...</p>}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone Number" value={details.phone} />
                      <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Member Since" value={details.memberSince} />
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#c8d3ea] bg-[#e8edf8] px-4 py-2.5 text-sm font-semibold text-[#3153a1] transition hover:bg-[#dce4f5]">
                        <PencilLine className="h-4 w-4" /> Edit Account
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={onSave} className="space-y-4">
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Full Name</div>
                      <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="mt-2 w-full rounded-xl border border-[#d4dae8] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#6f89c8]" placeholder="Your full name" required />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Phone Number</div>
                      <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="mt-2 w-full rounded-xl border border-[#d4dae8] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#6f89c8]" placeholder="09XXXXXXXXX" />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Account Role</div>
                      <input value={details.role} readOnly className="mt-2 w-full rounded-xl border border-[#d4dae8] bg-[#f9fafb] px-4 py-3 text-sm text-[#6b7280] outline-none" />
                      <p className="mt-1 text-xs text-[#6b7280]">Account role cannot be changed.</p>
                    </label>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setEditOpen(false)} className="rounded-xl border border-[#dde3ef] bg-white px-4 py-2 text-sm text-[#6b7280] transition hover:bg-[#f9fafb]">Cancel</button>
                      <button type="submit" disabled={saving} className="rounded-xl bg-[#3153a1] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60">{saving ? "Saving..." : "Save Changes"}</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ── Security Tab ── */}
            {settingsTab === "security" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#dde3ef] bg-[#f8f9fc] p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <KeyRound className="h-5 w-5 text-[#3153a1]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Change Password</h3>
                  </div>
                  <p className="text-sm text-[#6b7280] mb-4">Update your password to keep your account secure. Use a strong password with at least 6 characters.</p>
                  <form onSubmit={onChangePassword} className="space-y-4">
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Current Password</div>
                      <div className="relative mt-2">
                        <input
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full rounded-xl border border-[#d4dae8] bg-white px-4 py-3 pr-11 text-sm text-[#111827] outline-none focus:border-[#6f89c8]"
                          placeholder="Enter current password"
                          required
                        />
                        <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280]">
                          {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">New Password</div>
                      <div className="relative mt-2">
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-xl border border-[#d4dae8] bg-white px-4 py-3 pr-11 text-sm text-[#111827] outline-none focus:border-[#6f89c8]"
                          placeholder="Enter new password"
                          required
                        />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280]">
                          {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Confirm New Password</div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-[#d4dae8] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#6f89c8]"
                        placeholder="Re-enter new password"
                        required
                      />
                    </label>
                    <div className="flex justify-end pt-1">
                      <button type="submit" disabled={changingPw} className="rounded-xl bg-[#3153a1] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60">
                        {changingPw ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-2xl border border-[#dde3ef] bg-[#f8f9fc] p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <Shield className="h-5 w-5 text-[#3153a1]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Account Security</h3>
                  </div>
                  <p className="text-sm text-[#6b7280]">Your account is protected by email-based authentication through Supabase. For additional security, use a unique password and avoid sharing your credentials.</p>
                </div>
              </div>
            )}

            {/* ── Notifications Tab ── */}
            {settingsTab === "notifications" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#dde3ef] bg-[#f8f9fc] p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <Bell className="h-5 w-5 text-[#3153a1]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Email Notifications</h3>
                  </div>
                  <p className="text-sm text-[#6b7280] mb-5">Choose which email notifications you would like to receive regarding platform activity.</p>
                  <div className="space-y-4">
                    {([
                      { label: "New Vendor Registrations", desc: "Receive an email when a new vendor registers on the platform.", value: notifNewVendor, set: setNotifNewVendor },
                      { label: "Reservation Activity", desc: "Get notified about reservation volume and platform-wide booking trends.", value: notifReservation, set: setNotifReservation },
                      { label: "Payment Alerts", desc: "Receive alerts when payments are processed or flagged for review.", value: notifPayment, set: setNotifPayment },
                      { label: "System & Maintenance", desc: "Get notified about system updates, scheduled maintenance, and platform alerts.", value: notifSystem, set: setNotifSystem },
                    ]).map((n) => (
                      <div key={n.label} className="flex items-start justify-between gap-4 rounded-xl border border-[#dde3ef] bg-white p-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1f2937]">{n.label}</div>
                          <div className="mt-0.5 text-xs text-[#6b7280]">{n.desc}</div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={n.value}
                          onClick={() => n.set(!n.value)}
                          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${n.value ? "bg-[#3153a1]" : "bg-[#d1d5db]"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${n.value ? "translate-x-5" : ""}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-[#dde3ef] bg-white p-6 shadow-[0_22px_48px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
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
