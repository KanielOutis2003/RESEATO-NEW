import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarCheck2,
  CalendarDays,
  Camera,
  Eye,
  EyeOff,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  PencilLine,
  Phone,
  Save,
  Settings,
  Shield,
  Star,
  Store,
  Table2,
  Trash2,
  Plus,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth/useAuth";
import { listVendorRestaurants, updateVendorRestaurant, uploadVendorRestaurantImage } from "../../lib/api/vendor.api";
import type { VendorRestaurant } from "../../lib/api/vendor.api";

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
  return email.slice(0, 2).toUpperCase() || "VN";
}
function deriveFromMetadata(user: {
  email?: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = typeof m.first_name === "string" ? m.first_name : "";
  const lastName = typeof m.last_name === "string" ? m.last_name : "";
  const role = typeof m.role === "string" ? m.role : "vendor";
  const phone = typeof m.phone === "string" ? m.phone : "";
  const avatarUrl = typeof m.avatar_url === "string" ? m.avatar_url : "";
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    (typeof m.full_name === "string" ? m.full_name : "") ||
    (user.email ? user.email.split("@")[0] : "Vendor");
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
      ? "bg-[rgba(183,106,115,0.22)] text-white font-semibold"
      : "text-[#f7e7e9] hover:bg-[rgba(183,106,115,0.12)]"
  }`;

const sidebarButtonClass =
  "flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm text-[#f7e7e9] transition-colors duration-200 hover:bg-[rgba(183,106,115,0.12)]";

/* ── InfoRow ── */
function InfoRow(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e8dfe2] bg-[#faf8f9] p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#e0cfd4] bg-[#f8ecee] text-[#8b3d4a]">
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
export default function VendorSidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [firstRestaurantId, setFirstRestaurantId] = useState<string | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);

  /* fetch first restaurant for best-sellers link */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listVendorRestaurants();
        if (alive && list.length > 0) setFirstRestaurantId(list[0].id);
      } catch { /* ignore */ }
      finally { if (alive) setLoadingRestaurant(false); }
    })();
    return () => { alive = false; };
  }, []);

  /* ── My Restaurant modal state ── */
  const [restaurantModalOpen, setRestaurantModalOpen] = useState(false);
  const [restaurantData, setRestaurantData] = useState<VendorRestaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const [restaurantSaving, setRestaurantSaving] = useState(false);
  const [restaurantMsg, setRestaurantMsg] = useState<string | null>(null);
  const [restForm, setRestForm] = useState({
    name: "", cuisine: "", location: "", description: "", imageUrl: "",
    contactPhone: "", contactEmail: "", rating: 0, priceLevel: 1,
  });
  const [restUploadingImg, setRestUploadingImg] = useState(false);
  const restImageRef = useRef<HTMLInputElement | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  /* auto-dismiss restaurant toast */
  useEffect(() => {
    if (!restaurantMsg) return;
    const t = setTimeout(() => setRestaurantMsg(null), 3500);
    return () => clearTimeout(t);
  }, [restaurantMsg]);

  /* load restaurant data when modal opens */
  useEffect(() => {
    if (!restaurantModalOpen) return;
    let alive = true;
    (async () => {
      setRestaurantLoading(true);
      setRestaurantMsg(null);
      try {
        const list = await listVendorRestaurants();
        if (!alive) return;
        if (list.length === 0) {
          setRestaurantData(null);
          setRestaurantMsg("No restaurant found. Contact admin to set up your restaurant.");
        } else {
          const r = list[0];
          setRestaurantData(r);
          setRestForm({
            name: r.name || "",
            cuisine: r.cuisine || "",
            location: r.location || "",
            description: r.description || "",
            imageUrl: r.imageUrl || "",
            contactPhone: r.contactPhone || "",
            contactEmail: r.contactEmail || "",
            rating: r.rating ?? 0,
            priceLevel: r.priceLevel ?? 1,
          });
          setGalleryImages(r.galleryImages ?? []);
        }
      } catch { setRestaurantMsg("Failed to load restaurant data."); }
      finally { if (alive) setRestaurantLoading(false); }
    })();
    return () => { alive = false; };
  }, [restaurantModalOpen]);

  async function onSaveRestaurant(e: FormEvent) {
    e.preventDefault();
    if (!restaurantData) return;
    setRestaurantSaving(true);
    setRestaurantMsg(null);
    try {
      await updateVendorRestaurant(restaurantData.id, {
        name: restForm.name.trim(),
        cuisine: restForm.cuisine.trim(),
        location: restForm.location.trim(),
        description: restForm.description.trim() || undefined,
        imageUrl: restForm.imageUrl.trim() || undefined,
        contactPhone: restForm.contactPhone.trim() || undefined,
        contactEmail: restForm.contactEmail.trim() || undefined,
        rating: Math.min(5, Math.max(0, restForm.rating)),
        priceLevel: Math.min(4, Math.max(1, restForm.priceLevel)),
      });
      setRestaurantData((p) => p ? { ...p, ...restForm } : p);
      setRestaurantMsg("Restaurant details updated successfully!");
      setTimeout(() => closeRestaurantModal(), 1200);
    } catch (err: any) {
      setRestaurantMsg(err?.message ?? "Failed to save changes.");
    } finally {
      setRestaurantSaving(false);
    }
  }

  async function onRestaurantImageUpload(file: File) {
    if (!restaurantData) return;
    setRestUploadingImg(true);
    setRestaurantMsg(null);
    try {
      const url = await uploadVendorRestaurantImage(file);
      await updateVendorRestaurant(restaurantData.id, { imageUrl: url });
      setRestForm((p) => ({ ...p, imageUrl: url }));
      setRestaurantData((p) => p ? { ...p, imageUrl: url } : p);
      setRestaurantMsg("Image uploaded successfully!");
    } catch (err: any) {
      setRestaurantMsg(err?.message ?? "Failed to upload image.");
    } finally {
      setRestUploadingImg(false);
    }
  }

  async function onGalleryUpload(file: File) {
    if (!restaurantData) return;
    setGalleryUploading(true);
    setRestaurantMsg(null);
    try {
      const url = await uploadVendorRestaurantImage(file);
      const updated = [...galleryImages, url];
      await updateVendorRestaurant(restaurantData.id, { galleryImages: updated });
      setGalleryImages(updated);
      setRestaurantMsg("Gallery photo added!");
    } catch (err: any) {
      setRestaurantMsg(err?.message ?? "Failed to upload gallery image.");
    } finally {
      setGalleryUploading(false);
    }
  }

  async function onGalleryRemove(idx: number) {
    if (!restaurantData) return;
    const updated = galleryImages.filter((_, i) => i !== idx);
    try {
      await updateVendorRestaurant(restaurantData.id, { galleryImages: updated });
      setGalleryImages(updated);
      setRestaurantMsg("Gallery photo removed.");
    } catch (err: any) {
      setRestaurantMsg(err?.message ?? "Failed to remove gallery image.");
    }
  }

  function closeRestaurantModal() {
    setRestaurantModalOpen(false);
    setRestaurantData(null);
    setRestaurantMsg(null);
    setGalleryImages([]);
  }

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
  const [notifNewReservation, setNotifNewReservation] = useState(true);
  const [notifCancellation, setNotifCancellation] = useState(true);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifReminder, setNotifReminder] = useState(false);


  /* load profile when settings modal opens */
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
    if (!details) return "VN";
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

  function closeSettingsModal() { setSettingsOpen(false); setEditOpen(false); setMessage(null); setSettingsTab("account"); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }

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
      <aside className={`fixed top-0 left-0 z-[95] flex h-screen w-[270px] shrink-0 flex-col bg-[linear-gradient(180deg,#22171a_0%,#2a1d21_100%)] px-[18px] py-[26px] text-[#f8ecee] transition-transform duration-300 lg:sticky lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Brand */}
        <div className="flex items-center gap-3 rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 mb-7">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#b76a73,#8f3d56)] shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold tracking-wide">RESEATO</div>
            <div className="text-xs text-[#d9bcc3]">Vendor Portal</div>
          </div>
        </div>

        {/* Menu */}
        <div className="mb-2.5 ml-2.5 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#d2b4bb]">
          Menu
        </div>
        <nav className="space-y-1">
          <NavLink to="/vendor" end className={sidebarLinkClass} onClick={closeMobile}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>
          <NavLink to="/vendor/reservations" className={sidebarLinkClass} onClick={closeMobile}>
            <CalendarCheck2 className="h-4 w-4" />
            Reservations
          </NavLink>
          <NavLink to="/vendor/tables" end className={sidebarLinkClass} onClick={closeMobile}>
            <Table2 className="h-4 w-4" />
            Tables
          </NavLink>
          <button type="button" onClick={() => { setRestaurantModalOpen(true); closeMobile(); }} className={sidebarButtonClass}>
            <ImageIcon className="h-4 w-4" />
            Gallery
          </button>
          <button type="button" onClick={() => { setRestaurantModalOpen(true); closeMobile(); }} className={sidebarButtonClass}>
            <Store className="h-4 w-4" />
            My Restaurant
          </button>
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
          className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm text-[#f7e7e9] transition hover:bg-[rgba(183,106,115,0.12)]"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </aside>

      {/* ── Settings Modal (Tabbed) ── */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#e8dfe2] bg-white p-7 shadow-[0_24px_52px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#1f2937]">Settings</h2>
                <p className="mt-1 text-sm text-[#6b7280]">Manage your account preferences and security</p>
              </div>
              <button type="button" onClick={closeSettingsModal} className="rounded-full border border-[#e8dfe2] p-2 text-[#6b7280] transition hover:text-[#7b2f3b]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-1">
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
                      ? "bg-white text-[#7b2f3b] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                      : "text-[#6b7280] hover:text-[#1f2937]"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {message && settingsOpen && (
              <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                message.toLowerCase().includes("success") || message.toLowerCase().includes("updated") || message.toLowerCase().includes("saved")
                  ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                  : message.toLowerCase().includes("metadata") || message.toLowerCase().includes("info")
                    ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                    : "border-[#f0cdd4] bg-[#fff6f7] text-[#9f1239]"
              }`}>{message}</div>
            )}

            {/* ── Account Tab ── */}
            {settingsTab === "account" && (
              <div className="space-y-5">
                {!details ? (
                  <div className="py-10 text-center text-[#6b7280]">Loading account details...</div>
                ) : !editOpen ? (
                  <>
                    <div className="flex items-center gap-5 rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5">
                      <div className="relative shrink-0">
                        {details.avatarUrl ? (
                          <img src={details.avatarUrl} alt="Profile" className="h-20 w-20 rounded-full border-4 border-[#f8ecee] object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#b76a73,#8f3d56)] text-2xl font-semibold text-white">{initials}</div>
                        )}
                        <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#8b3d4a] text-white shadow-md transition hover:brightness-110 disabled:opacity-60">
                          <Camera className="h-3 w-3" />
                        </button>
                        <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarSelected} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-[#1f2937]">{details.fullName}</h3>
                        <p className="text-sm text-[#6b7280]">{details.email}</p>
                        <span className="mt-1.5 inline-block rounded-full bg-[#f8ecee] px-3 py-0.5 text-xs font-semibold text-[#8b3d4a]">{details.role}</span>
                        {uploadingAvatar && <p className="mt-1 text-xs text-[#6b7280]">Uploading...</p>}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone Number" value={details.phone} />
                      <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Member Since" value={details.memberSince} />
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8c0c6] bg-[#f8ecee] px-4 py-2.5 text-sm font-semibold text-[#7b2f3b] transition hover:bg-[#f2dde2]">
                        <PencilLine className="h-4 w-4" /> Edit Account
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={onSave} className="space-y-4">
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Full Name</div>
                      <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]" placeholder="Your full name" required />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Phone Number</div>
                      <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]" placeholder="09XXXXXXXXX" />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Account Role</div>
                      <input value={details.role} readOnly className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-[#f9fafb] px-4 py-3 text-sm text-[#6b7280] outline-none" />
                      <p className="mt-1 text-xs text-[#6b7280]">Account role is managed by admin.</p>
                    </label>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setEditOpen(false)} className="rounded-xl border border-[#e8dfe2] bg-white px-4 py-2 text-sm text-[#6b7280] transition hover:bg-[#f9fafb]">Cancel</button>
                      <button type="submit" disabled={saving} className="rounded-xl bg-[#8b3e46] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60">{saving ? "Saving..." : "Save Changes"}</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ── Security Tab ── */}
            {settingsTab === "security" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <KeyRound className="h-5 w-5 text-[#8b3d4a]" />
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
                          className="w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 pr-11 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
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
                          className="w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 pr-11 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
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
                        className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
                        placeholder="Re-enter new password"
                        required
                      />
                    </label>
                    <div className="flex justify-end pt-1">
                      <button type="submit" disabled={changingPw} className="rounded-xl bg-[#8b3e46] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60">
                        {changingPw ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <Shield className="h-5 w-5 text-[#8b3d4a]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Account Security</h3>
                  </div>
                  <p className="text-sm text-[#6b7280]">Your account is protected by email-based authentication through Supabase. For additional security, use a unique password and avoid sharing your credentials.</p>
                </div>
              </div>
            )}

            {/* ── Notifications Tab ── */}
            {settingsTab === "notifications" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <Bell className="h-5 w-5 text-[#8b3d4a]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Email Notifications</h3>
                  </div>
                  <p className="text-sm text-[#6b7280] mb-5">Choose which email notifications you would like to receive regarding your restaurant activity.</p>
                  <div className="space-y-4">
                    {([
                      { label: "New Reservations", desc: "Receive an email when a customer makes a new reservation.", value: notifNewReservation, set: setNotifNewReservation },
                      { label: "Cancellations", desc: "Get notified when a customer cancels their reservation.", value: notifCancellation, set: setNotifCancellation },
                      { label: "Payment Confirmations", desc: "Receive confirmation when a reservation payment is completed.", value: notifPayment, set: setNotifPayment },
                      { label: "Daily Reminders", desc: "Get a daily summary of upcoming reservations for the next day.", value: notifReminder, set: setNotifReminder },
                    ]).map((n) => (
                      <div key={n.label} className="flex items-start justify-between gap-4 rounded-xl border border-[#e8dfe2] bg-white p-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1f2937]">{n.label}</div>
                          <div className="mt-0.5 text-xs text-[#6b7280]">{n.desc}</div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={n.value}
                          onClick={() => n.set(!n.value)}
                          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${n.value ? "bg-[#8b3d4a]" : "bg-[#d1d5db]"}`}
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

      {/* ── My Restaurant Modal ── */}
      {restaurantModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#e8dfe2] bg-white p-7 shadow-[0_24px_52px_rgba(15,23,42,0.18)]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#b76a73,#8f3d56)] text-white shadow-md">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1f2937]">My Restaurant</h2>
                  <p className="mt-0.5 text-sm text-[#6b7280]">Edit details visible to customers</p>
                </div>
              </div>
              <button type="button" onClick={closeRestaurantModal} className="rounded-full border border-[#e8dfe2] p-2 text-[#6b7280] transition hover:text-[#7b2f3b]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* toast rendered as fixed overlay — visible regardless of scroll */}
            {restaurantMsg && (
              <div className="fixed top-6 left-1/2 z-[9999] -translate-x-1/2 animate-[slideDown_0.3s_ease-out]">
                <div className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-sm ${
                  restaurantMsg.toLowerCase().includes("success") || restaurantMsg.toLowerCase().includes("updated") || restaurantMsg.toLowerCase().includes("uploaded") || restaurantMsg.toLowerCase().includes("added") || restaurantMsg.toLowerCase().includes("removed")
                    ? "border-[#bbf7d0] bg-[#f0fdf4]/95 text-[#166534]"
                    : "border-[#f0cdd4] bg-[#fff6f7]/95 text-[#9f1239]"
                }`}>
                  {restaurantMsg}
                  <button type="button" onClick={() => setRestaurantMsg(null)} className="ml-2 rounded-full p-0.5 opacity-60 hover:opacity-100 transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {restaurantLoading ? (
              <div className="py-16 text-center text-sm text-[#6b7280]">Loading restaurant data...</div>
            ) : !restaurantData ? (
              <div className="py-16 text-center text-sm text-[#6b7280]">No restaurant found. Contact admin to set up your restaurant.</div>
            ) : (
              <form onSubmit={onSaveRestaurant} className="space-y-5">
                {/* Restaurant Image */}
                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <ImageIcon className="h-5 w-5 text-[#8b3d4a]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Display Image</h3>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      {restForm.imageUrl ? (
                        <img src={restForm.imageUrl} alt="Restaurant" className="h-32 w-44 rounded-xl border border-[#e8dfe2] object-cover" />
                      ) : (
                        <div className="grid h-32 w-44 place-items-center rounded-xl border border-dashed border-[#d1d5db] bg-white text-[#9ca3af]">
                          <ImageIcon className="h-10 w-10" />
                        </div>
                      )}
                      {restUploadingImg && (
                        <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/40">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={restImageRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onRestaurantImageUpload(f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => restImageRef.current?.click()}
                        disabled={restUploadingImg}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d8c0c6] bg-[#f8ecee] px-4 py-2.5 text-sm font-semibold text-[#7b2f3b] transition hover:bg-[#f2dde2] disabled:opacity-60"
                      >
                        <Camera className="h-4 w-4" />
                        {restForm.imageUrl ? "Change Image" : "Upload Image"}
                      </button>
                      <p className="text-xs text-[#9ca3af]">JPG, PNG, or WEBP. Max 8 MB.</p>
                    </div>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5 space-y-4">
                  <div className="flex items-center gap-3 mb-1">
                    <PencilLine className="h-5 w-5 text-[#8b3d4a]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Basic Information</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Restaurant Name</div>
                      <input
                        value={restForm.name}
                        onChange={(e) => setRestForm((p) => ({ ...p, name: e.target.value }))}
                        className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
                        placeholder="Restaurant name"
                        required
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Cuisine</div>
                      <input
                        value={restForm.cuisine}
                        onChange={(e) => setRestForm((p) => ({ ...p, cuisine: e.target.value }))}
                        className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
                        placeholder="e.g. Filipino, Japanese"
                        required
                      />
                    </label>
                  </div>
                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Location</div>
                    <div className="relative mt-2">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
                      <input
                        value={restForm.location}
                        onChange={(e) => setRestForm((p) => ({ ...p, location: e.target.value }))}
                        className="w-full rounded-xl border border-[#ddd8da] bg-white pl-10 pr-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
                        placeholder="City or address"
                        required
                      />
                    </div>
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Description</div>
                    <textarea
                      value={restForm.description}
                      onChange={(e) => setRestForm((p) => ({ ...p, description: e.target.value }))}
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
                      placeholder="Describe your restaurant..."
                    />
                  </label>
                </div>

                {/* Contact Info */}
                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5 space-y-4">
                  <div className="flex items-center gap-3 mb-1">
                    <Phone className="h-5 w-5 text-[#8b3d4a]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Contact Information</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Contact Phone</div>
                      <input
                        value={restForm.contactPhone}
                        onChange={(e) => setRestForm((p) => ({ ...p, contactPhone: e.target.value }))}
                        className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
                        placeholder="09XXXXXXXXX"
                      />
                    </label>
                    <label className="block">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Contact Email</div>
                      <input
                        type="email"
                        value={restForm.contactEmail}
                        onChange={(e) => setRestForm((p) => ({ ...p, contactEmail: e.target.value }))}
                        className="mt-2 w-full rounded-xl border border-[#ddd8da] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#b46d73]"
                        placeholder="restaurant@email.com"
                      />
                    </label>
                  </div>
                </div>

                {/* Rating & Price Level */}
                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5 space-y-4">
                  <div className="flex items-center gap-3 mb-1">
                    <Star className="h-5 w-5 text-[#8b3d4a]" />
                    <h3 className="text-base font-bold text-[#1f2937]">Rating & Price Level</h3>
                  </div>

                  {/* Star rating */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] mb-2">Rating</div>
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const filled = restForm.rating >= star;
                        const half = !filled && restForm.rating >= star - 0.5;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRestForm((p) => ({ ...p, rating: star }))}
                            className="transition hover:scale-110"
                          >
                            <Star
                              className={`h-7 w-7 ${filled ? "fill-[#f59e0b] text-[#f59e0b]" : half ? "fill-[#f59e0b]/50 text-[#f59e0b]" : "fill-transparent text-[#d1d5db]"}`}
                            />
                          </button>
                        );
                      })}
                      <span className="ml-2 text-lg font-bold text-[#1f2937]">{restForm.rating.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={restForm.rating}
                      onChange={(e) => setRestForm((p) => ({ ...p, rating: parseFloat(e.target.value) }))}
                      className="w-full accent-[#8b3d4a]"
                    />
                    <div className="flex justify-between text-xs text-[#9ca3af]">
                      <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                  </div>

                  {/* Price level */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] mb-2">Price Level</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {([
                        [1, "Budget Friendly"],
                        [2, "Moderate"],
                        [3, "Upscale"],
                        [4, "Fine Dining"],
                      ] as [number, string][]).map(([lvl, label]) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setRestForm((p) => ({ ...p, priceLevel: lvl }))}
                          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                            restForm.priceLevel === lvl
                              ? "bg-[#8b3d4a] text-white shadow-md"
                              : "border border-[#ddd8da] bg-white text-[#6b7280] hover:border-[#b46d73] hover:text-[#8b3d4a]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gallery Photos */}
                <div className="rounded-2xl border border-[#ece8e9] bg-[#faf8f9] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="h-5 w-5 text-[#8b3d4a]" />
                      <h3 className="text-base font-bold text-[#1f2937]">Gallery Photos</h3>
                    </div>
                    <span className="text-xs text-[#9ca3af]">{galleryImages.length} photo{galleryImages.length !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-[#667085]">Upload photos of your menu, interior, and ambiance. These are shown to customers on your restaurant page.</p>

                  <div className="grid grid-cols-3 gap-2">
                    {galleryImages.map((url, i) => (
                      <div key={i} className="group relative overflow-hidden rounded-xl border border-[#e8dfe2]">
                        <img src={url} alt={`Gallery ${i + 1}`} className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => onGalleryRemove(i)}
                          className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {/* Add button */}
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={galleryUploading}
                      className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#d1d5db] bg-white text-[#9ca3af] transition hover:border-[#b46d73] hover:text-[#8b3d4a] disabled:opacity-60"
                    >
                      {galleryUploading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#8b3d4a] border-t-transparent" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5" />
                          <span className="text-[10px] font-medium">Add Photo</span>
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onGalleryUpload(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Save button */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeRestaurantModal}
                    className="rounded-xl border border-[#e8dfe2] bg-white px-5 py-2.5 text-sm font-semibold text-[#6b7280] transition hover:bg-[#f9fafb]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={restaurantSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#8b3d4a,#6b2a35)] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(139,61,74,0.35)] transition hover:brightness-110 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {restaurantSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-[#e8dfe2] bg-white p-6 shadow-[0_22px_48px_rgba(15,23,42,0.18)]"
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
