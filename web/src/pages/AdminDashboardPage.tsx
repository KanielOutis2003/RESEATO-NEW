import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Search,
  Star,
  Pencil,
  Trash2,
  Users,
  Wallet,
  X,
  Plus,
} from "lucide-react";
import { useAuth } from "../lib/auth/useAuth";
import { CompletionLineChart, ReservationsLineChart } from "../components/admin/AdminOverviewCharts";
import { supabase } from "../lib/supabase";
import {
  AdminAuditLog,
  AdminChartsResponse,
  AdminOverview,
  AdminReservation,
  AdminRestaurant,
  AdminUser,
  assignAdminRestaurantOwner,
  createAdminRestaurant,
  deleteAdminRestaurant,
  deleteAdminUser,
  getAdminCharts,
  updateAdminUserDetails,
  getAdminOverview,
  listAdminAuditLogs,
  listAdminReservations,
  listAdminRestaurants,
  listAdminUsers,
  toggleAdminRestaurantFeatured,
  updateAdminReservationStatus,
  updateAdminUserRole,
} from "../lib/api/admin.api";

type TabKey = "overview" | "users" | "restaurants" | "reservations" | "audit" | "charts" | "support" | "featured";

type SupportTicket = {
  id: string;
  user_id: string;
  email: string | null;
  subject: string;
  message: string;
  attachment_url: string | null;
  status: string;
  created_at: string;
};
type ChartPreset = "7d" | "14d" | "30d" | "90d" | "custom";

function toPeso(minor: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format((Number(minor) || 0) / 100);
  }

function toDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  }

function normalizeRole(raw: unknown) {
  return String(raw ?? "customer").trim().toLowerCase();
  }

function sectionToTab(section?: string): TabKey {
  const value = String(section ?? "").trim().toLowerCase();
  if (value === "users") return "users";
  if (value === "restaurants") return "restaurants";
  if (value === "reservations") return "reservations";
  if (value === "audit") return "audit";
  if (value === "charts") return "charts";
  if (value === "support") return "support";
  if (value === "featured") return "featured";
  return "overview";
  }



function to12Hour(raw: string) {
  const hhmm = String(raw).slice(0, 5);
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function shortId(value: string) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
  }

function toLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }

function reservationStatusTone(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "confirmed") return "border-[#d2f5e6] bg-[#ecfcf4] text-[#047857]";
  if (normalized === "completed") return "border-[#cae6ff] bg-[#edf7ff] text-[#1d4ed8]";
  if (normalized === "pending") return "border-[#fee4bf] bg-[#fff4df] text-[#b45309]";
  if (normalized === "declined" || normalized === "cancelled") {
    return "border-[#f7d3d7] bg-[#fff1f2] text-[#be123c]";
  }
  return "border-[#e4e7ec] bg-[#f8fafc] text-[#475467]";
  }

function paymentStatusTone(status: string | null | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "paid") return "border-[#d2f5e6] bg-[#ecfcf4] text-[#047857]";
  if (normalized === "processing") return "border-[#cae6ff] bg-[#edf7ff] text-[#1d4ed8]";
  if (normalized === "failed" || normalized === "cancelled") {
    return "border-[#f7d3d7] bg-[#fff1f2] text-[#be123c]";
  }
  return "border-[#fee4bf] bg-[#fff4df] text-[#b45309]";
  }

function userRoleTone(role: string | null | undefined) {
  const normalized = String(role ?? "").toLowerCase();
  if (normalized === "admin") return "border-[#f7d3d7] bg-[#fff1f2] text-[#be123c]";
  if (normalized === "vendor") return "border-[#d7e6ff] bg-[#eff6ff] text-[#1d4ed8]";
  return "border-[#d2f5e6] bg-[#ecfcf4] text-[#047857]";
  }

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return false;
  return dt.toISOString().slice(0, 10) === value;
  }

function dateInputFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
  }

function shiftDateInput(value: string, deltaDays: number) {
  if (!isValidDateKey(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  dt.setDate(dt.getDate() + deltaDays);
  return dateInputFromDate(dt);
  }

function getPresetDays(preset: ChartPreset) {
  if (preset === "7d") return 7;
  if (preset === "14d") return 14;
  if (preset === "90d") return 90;
  return 30;
  }

function csvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
  }

function parsePositiveInt(
  value: unknown,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}
/* ─── Reusable Confirmation Modal ─── */
function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  confirmColor,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor?: "red" | "rose";
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const btnClass =
    confirmColor === "rose"
      ? "bg-[#8b3d4a] hover:bg-[#6f2f3b] text-white"
      : "bg-[#d14d5b] hover:bg-[#be3a48] text-white";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative mx-4 w-full max-w-md rounded-[24px] border border-[#e8e2e3] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#fff5f5] text-[#d14d5b]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#1f2937]">{title}</h3>
            <p className="text-sm text-[#667085]">This action cannot be undone.</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-[#475467]">{description}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#475467] transition hover:bg-[#f8fafc] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${btnClass}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Loading Overlay ─── */
function LoadingOverlay({ visible, label }: { visible: boolean; label?: string }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="rounded-2xl border border-[#e7e3e5] bg-white px-8 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#8b3d4a]" />
        <p className="mt-3 text-sm font-semibold text-[#1f2937]">{label || "Processing..."}</p>
      </div>
    </div>
  );
}

const RESTAURANT_FALLBACK_IMG =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";

export default function AdminDashboardPage() {
  const { section } = useParams<{ section?: string }>();
  const { isAuthed, loading: authLoading, user } = useAuth();

  const [role, setRole] = useState("customer");
  const [roleLoading, setRoleLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  const [chartPreset, setChartPreset] = useState<ChartPreset>("30d");
  const [chartTo, setChartTo] = useState(() => dateInputFromDate(new Date()));
  const [chartFrom, setChartFrom] = useState(() => shiftDateInput(dateInputFromDate(new Date()), -29));
  const [chartData, setChartData] = useState<AdminChartsResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [reservationStatusFilter, setReservationStatusFilter] = useState("all");
  const [reservationPaymentFilter, setReservationPaymentFilter] = useState("all");
  const [reservationDateFilter, setReservationDateFilter] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");

  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<string, string>>({});
  const [statusDraftByReservationId, setStatusDraftByReservationId] = useState<Record<string, string>>({});

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(null);

  const [assignableVendors, setAssignableVendors] = useState<AdminUser[]>([]);

  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    cuisine: "",
    location: "",
    totalTables: "10",
    priceLevel: "1",
    ownerId: "",
    imageUrl: "",
    contactPhone: "",
    contactEmail: "",
    description: "",
    rating: "",
  });


  const [ownerDraftByRestaurantId, setOwnerDraftByRestaurantId] = useState<Record<string, string>>({});
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);
  const [assigningRestaurantId, setAssigningRestaurantId] = useState<string | null>(null);
  const [deletingRestaurantId, setDeletingRestaurantId] = useState<string | null>(null);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(null);
  const [showAddRestaurantModal, setShowAddRestaurantModal] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState<string | null>(null);

  // Edit user details modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ fullName: "", email: "" });
  const [editUserSaving, setEditUserSaving] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    confirmColor?: "red" | "rose";
    onConfirm: () => void;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Support tickets state
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportStatusFilter, setSupportStatusFilter] = useState("all");

  const panelClass =
    "rounded-[24px] border border-[#e7e3e5] bg-white p-[22px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]";
  const inputClass =
    "rounded-xl border border-[#d8dbe2] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none placeholder:text-[#8b97a8] focus:border-[#5a7ec0] focus:ring-2 focus:ring-[rgba(59,92,168,0.18)]";
  const selectClass =
    "rounded-xl border border-[#d8dbe2] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none focus:border-[#5a7ec0] focus:ring-2 focus:ring-[rgba(59,92,168,0.18)]";
  const ghostButtonClass =
    "rounded-[14px] border border-[#d9e3fb] bg-[#eef4ff] px-3 py-2 text-sm font-bold text-[#3153a1] hover:bg-[#e4edff]";

  useEffect(() => {
    let alive = true;

    async function resolveRole() {
      if (!user) {
        if (alive) {
          setRole("customer");
          setRoleLoading(false);
        }
        return;
      }

      const metadataRole = normalizeRole(
        (user.user_metadata as Record<string, unknown> | undefined)?.role,
      );
      if (metadataRole && metadataRole !== "customer") {
        if (alive) {
          setRole(metadataRole);
          setRoleLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      if (error || !data?.role) {
        setRole(metadataRole || "customer");
      } else {
        setRole(normalizeRole(data.role));
      }

      setRoleLoading(false);
    }

    setRoleLoading(true);
    void resolveRole();

    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (chartPreset === "custom") return;

    const days = getPresetDays(chartPreset);
    const to = dateInputFromDate(new Date());
    const from = shiftDateInput(to, -(days - 1));

    setChartTo(to);
    setChartFrom(from);
  }, [chartPreset]);

  const isAdmin = useMemo(() => role === "admin", [role]);
  const activeTab = useMemo(() => sectionToTab(section), [section]);

  const filteredReservations = useMemo(() => {
    if (!reservationSearch.trim()) return reservations;
    const q = reservationSearch.trim().toLowerCase();
    return reservations.filter((r) =>
      [r.id, r.name, r.user_name, r.user_email, r.restaurant_name, r.phone, r.date, r.status]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [reservations, reservationSearch]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (err) {
      console.error("Failed to load overview:", err);
    }
  }, []);

  const loadCharts = useCallback(async (from: string, to: string) => {
    setChartLoading(true);
    setChartError(null);

    try {
      const data = await getAdminCharts({ from, to });
      setChartData(data);
    } catch (error: any) {
      setChartError(error?.payload?.message ?? error?.message ?? "Failed to load chart data.");
    } finally {
      setChartLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await listAdminUsers({
        search: userSearch.trim() || undefined,
        role: userRoleFilter,
        limit: 80,
        offset: 0,
      });

      const rows = Array.isArray(data) ? data : [];
      setUsers(rows);
      setRoleDraftByUserId((prev) => {
        const next = { ...prev };
        for (const item of rows) {
          if (!next[item.id]) {
            next[item.id] = item.role;
          }
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to load users:", err);
      setUsers([]);
    }
  }, [userRoleFilter, userSearch]);
  const loadAssignableVendors = useCallback(async () => {
    try {
      const data = await listAdminUsers({
        role: "all",
        limit: 300,
        offset: 0,
      });

      const rows = Array.isArray(data) ? data : [];
      const vendors = rows.filter((item) => {
        const roleValue = normalizeRole(item.role);
        return roleValue === "vendor" || roleValue === "owner" || roleValue === "manager";
      });

      setAssignableVendors(vendors);
    } catch (err) {
      console.error("Failed to load assignable vendors:", err);
      setAssignableVendors([]);
    }
  }, []);

  const loadRestaurants = useCallback(async () => {
    try {
      const data = await listAdminRestaurants({
        search: restaurantSearch.trim() || undefined,
        limit: 80,
        offset: 0,
      });

      const rows = Array.isArray(data) ? data : [];
      setRestaurants(rows);
      setOwnerDraftByRestaurantId((prev) => {
        const next = { ...prev };
        for (const item of rows) {
          next[item.id] = item.ownerId ?? "";
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to load restaurants:", err);
      setRestaurants([]);
    }
  }, [restaurantSearch]);

  const loadReservations = useCallback(async () => {
    try {
      const data = await listAdminReservations({
        status: reservationStatusFilter,
        paymentStatus: reservationPaymentFilter,
        date: reservationDateFilter || undefined,
        limit: 100,
        offset: 0,
      });

      const rows = Array.isArray(data) ? data : [];
      setReservations(rows);
      setStatusDraftByReservationId((prev) => {
        const next = { ...prev };
        for (const item of rows) {
          if (!next[item.id]) {
            next[item.id] = item.status;
          }
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to load reservations:", err);
      setReservations([]);
    }
  }, [reservationDateFilter, reservationPaymentFilter, reservationStatusFilter]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const data = await listAdminAuditLogs({ limit: 80 });
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      setAuditLogs([]);
    }
  }, []);

  const loadSupportTickets = useCallback(async () => {
    setSupportLoading(true);
    try {
      const { supabase } = await import("../lib/supabase");
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setSupportTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load support tickets:", err);
      setSupportTickets([]);
    } finally {
      setSupportLoading(false);
    }
  }, []);

  async function updateTicketStatus(ticketId: string, newStatus: string) {
    try {
      const { supabase } = await import("../lib/supabase");
      const { error } = await supabase.from("support_tickets").update({ status: newStatus }).eq("id", ticketId);
      if (error) throw error;
      setSupportTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error("Failed to update ticket:", err);
      setMessage("Failed to update ticket status.");
    }
  }

  function extractErrorMessage(error: any, fallback: string) {
    return error?.payload?.message ?? error?.message ?? fallback;
  }

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    const jobs: Array<{ label: string; run: () => Promise<void> }> = [
      { label: "overview", run: loadOverview },
    ];

    if (activeTab === "users") {
      jobs.push({ label: "users", run: loadUsers });
    } else if (activeTab === "restaurants") {
      jobs.push({ label: "restaurants", run: loadRestaurants });
      jobs.push({ label: "assignable vendors", run: loadAssignableVendors });
      jobs.push({ label: "reservations for system profit", run: loadReservations });
    } else if (activeTab === "reservations") {
      jobs.push({ label: "reservations", run: loadReservations });
    } else if (activeTab === "audit") {
      jobs.push({ label: "audit logs", run: loadAuditLogs });
    } else if (activeTab === "support") {
      jobs.push({ label: "support tickets", run: loadSupportTickets });
    } else if (activeTab === "featured") {
      jobs.push({ label: "restaurants", run: loadRestaurants });
    }

    const results = await Promise.allSettled(jobs.map((job) => job.run()));

    const failures: string[] = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === "rejected") {
        failures.push(
          `${jobs[index].label}: ${extractErrorMessage(
            result.reason,
            "Failed to load admin data.",
          )}`,
        );
      }
    }

    if (failures.length > 0) {
      setMessage(failures.join(" | "));
    }

    setLoading(false);
  }, [activeTab, loadAuditLogs, loadAssignableVendors, loadOverview, loadReservations, loadRestaurants, loadUsers, loadSupportTickets]);
  useEffect(() => {
    if (!isAuthed || roleLoading || !isAdmin) {
      setLoading(false);
      return;
    }

    void refreshAll();
  }, [isAuthed, roleLoading, isAdmin, refreshAll]);

  useEffect(() => {
    if (!isAuthed || roleLoading || !isAdmin) return;
    if (activeTab !== "charts") return;

    if (!isValidDateKey(chartFrom) || !isValidDateKey(chartTo)) {
      setChartError("Invalid date format. Use YYYY-MM-DD.");
      return;
    }

    if (chartFrom > chartTo) {
      setChartError("Date range is invalid. From date must be before To date.");
      return;
    }

    void loadCharts(chartFrom, chartTo);
  }, [activeTab, chartFrom, chartTo, isAdmin, isAuthed, loadCharts, roleLoading]);

  async function handleRefresh() {
    await refreshAll();

    if (
      activeTab === "charts" &&
      isValidDateKey(chartFrom) &&
      isValidDateKey(chartTo) &&
      chartFrom <= chartTo
    ) {
      await loadCharts(chartFrom, chartTo);
    }
  }

  function handleExportChartCsv() {
    if (!chartData?.days?.length) {
      setChartError("No chart data available to export for the selected range.");
      return;
    }

    const headers = [
      "date",
      "total",
      "completed",
      "cancelled",
      "pending",
      "confirmed",
      "paid",
      "revenue_minor",
      "revenue_php",
      "completion_rate_pct",
      "cancellation_rate_pct",
    ];

    const rows = chartData.days.map((day) => {
      const total = Number(day.total ?? 0);
      const completionRate = total > 0 ? (Number(day.completed ?? 0) / total) * 100 : 0;
      const cancellationRate = total > 0 ? (Number(day.cancelled ?? 0) / total) * 100 : 0;
      const revenueMinor = Number(day.revenueMinor ?? 0);

      return [
        day.date,
        total,
        Number(day.completed ?? 0),
        Number(day.cancelled ?? 0),
        Number(day.pending ?? 0),
        Number(day.confirmed ?? 0),
        Number(day.paid ?? 0),
        revenueMinor,
        (revenueMinor / 100).toFixed(2),
        completionRate.toFixed(2),
        cancellationRate.toFixed(2),
      ];
    });

    const generatedAt = new Date().toLocaleString();
    const metaRows = [
      "RESEATO - Admin Performance Report",
      `Report Period: ${chartData.from} to ${chartData.to}`,
      `Generated: ${generatedAt}`,
      `Total Reservations: ${chartData.summary.totalReservations}`,
      `Total Revenue: PHP ${(chartData.summary.totalRevenueMinor / 100).toFixed(2)}`,
      "",
    ];

    const csv = [
      ...metaRows.map((line) => csvCell(line)),
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map((cell) => csvCell(cell as string | number)).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RESEATO-Admin-Report-${chartData.from}-to-${chartData.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportChartExcel() {
    if (!chartData?.days?.length) return;

    const headers = [
      "Date", "Total", "Completed", "Cancelled", "Pending",
      "Confirmed", "Paid", "Revenue (minor)", "Revenue (PHP)",
      "Completion %", "Cancellation %",
    ];

    const rows = chartData.days.map((day) => {
      const total = Number(day.total ?? 0);
      const completionRate = total > 0 ? (Number(day.completed ?? 0) / total) * 100 : 0;
      const cancellationRate = total > 0 ? (Number(day.cancelled ?? 0) / total) * 100 : 0;
      const revenueMinor = Number(day.revenueMinor ?? 0);
      return [
        day.date, total, Number(day.completed ?? 0), Number(day.cancelled ?? 0),
        Number(day.pending ?? 0), Number(day.confirmed ?? 0), Number(day.paid ?? 0),
        revenueMinor, (revenueMinor / 100).toFixed(2),
        completionRate.toFixed(2), cancellationRate.toFixed(2),
      ];
    });

    const generatedAt = new Date().toLocaleString();

    // Build XML Spreadsheet (opens natively in Excel, no library needed)
    const escXml = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const colWidths = [90, 60, 80, 80, 70, 80, 55, 110, 100, 95, 110];
    let xml = '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '<Styles>';
    xml += '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#8b3d4a"/></Style>';
    xml += '<Style ss:ID="meta"><Font ss:Size="11" ss:Color="#667085"/></Style>';
    xml += '<Style ss:ID="metaBold"><Font ss:Bold="1" ss:Size="11" ss:Color="#374151"/></Style>';
    xml += '<Style ss:ID="hdr"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF"/><Interior ss:Color="#8b3d4a" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>';
    xml += '<Style ss:ID="sum"><Font ss:Bold="1" ss:Size="10"/><Interior ss:Color="#FFF1F2" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>';
    xml += '<Style ss:ID="cell"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>';
    xml += '<Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>';
    xml += '<Style ss:ID="dateCell"><Alignment ss:Horizontal="Left"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>';
    xml += '</Styles>\n';
    xml += '<Worksheet ss:Name="Performance Report">\n<Table>\n';

    // Column widths
    for (const w of colWidths) xml += `<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`;
    xml += '\n';

    // Report header rows
    xml += `<Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">RESEATO - Admin Performance Report</Data></Cell></Row>\n`;
    xml += `<Row><Cell ss:StyleID="meta" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Report Period: ${escXml(chartData.from)} to ${escXml(chartData.to)}</Data></Cell></Row>\n`;
    xml += `<Row><Cell ss:StyleID="meta" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Generated: ${escXml(generatedAt)}</Data></Cell></Row>\n`;
    xml += `<Row><Cell ss:StyleID="metaBold" ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">Total Reservations: ${chartData.summary.totalReservations}  |  Revenue: PHP ${(chartData.summary.totalRevenueMinor / 100).toFixed(2)}  |  Completion: ${(chartData.summary.completionRate).toFixed(1)}%  |  Cancellation: ${(chartData.summary.cancellationRate).toFixed(1)}%</Data></Cell></Row>\n`;
    xml += "<Row></Row>\n";

    // Column header row
    xml += "<Row>";
    for (const h of headers) xml += `<Cell ss:StyleID="hdr"><Data ss:Type="String">${escXml(h)}</Data></Cell>`;
    xml += "</Row>\n";

    // Summary row
    xml += "<Row>";
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="String">SUMMARY</Data></Cell>`;
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="Number">${chartData.summary.totalReservations}</Data></Cell>`;
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="Number">${chartData.summary.totalCompleted}</Data></Cell>`;
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="Number">${chartData.summary.totalCancelled}</Data></Cell>`;
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="String">-</Data></Cell>`;
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="String">-</Data></Cell>`;
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="Number">${chartData.summary.totalPaid}</Data></Cell>`;
    xml += `<Cell ss:StyleID="sum"><Data ss:Type="Number">${chartData.summary.totalRevenueMinor}</Data></Cell>`;
    xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${(chartData.summary.totalRevenueMinor / 100).toFixed(2)}</Data></Cell>`;
    xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${(chartData.summary.completionRate).toFixed(2)}</Data></Cell>`;
    xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${(chartData.summary.cancellationRate).toFixed(2)}</Data></Cell>`;
    xml += "</Row>\n";

    // Data rows
    for (const row of rows) {
      const cells = row.map((cell, i) => {
        if (i === 0) return `<Cell ss:StyleID="dateCell"><Data ss:Type="String">${escXml(cell)}</Data></Cell>`;
        if (i >= 8) return `<Cell ss:StyleID="num"><Data ss:Type="Number">${escXml(cell)}</Data></Cell>`;
        return `<Cell ss:StyleID="cell"><Data ss:Type="Number">${escXml(cell)}</Data></Cell>`;
      }).join("");
      xml += `<Row>${cells}</Row>\n`;
    }

    xml += "</Table>\n</Worksheet>\n</Workbook>";

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RESEATO-Admin-Report-${chartData.from}-to-${chartData.to}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleUpdateUserRole(targetUserId: string) {
    const nextRole = String(roleDraftByUserId[targetUserId] ?? "").toLowerCase();
    if (!["customer", "vendor", "admin"].includes(nextRole)) {
      setMessage("Invalid role selection.");
      return;
    }

    try {
      setUpdatingUserId(targetUserId);
      setMessage(null);

      await updateAdminUserRole(targetUserId, nextRole as "customer" | "vendor" | "admin");
      await Promise.all([loadUsers(), loadOverview(), loadAuditLogs()]);
      setMessage("User role updated.");
    } catch (error: any) {
      setMessage(error?.payload?.message ?? error?.message ?? "Failed to update user role.");
    } finally {
      setUpdatingUserId(null);
    }
  }


  function openEditUser(item: AdminUser) {
    setEditingUser(item);
    setEditUserForm({ fullName: item.fullName || "", email: item.email || "" });
  }

  async function handleSaveUserDetails() {
    if (!editingUser) return;
    try {
      setEditUserSaving(true);
      setMessage(null);
      await updateAdminUserDetails(editingUser.id, {
        fullName: editUserForm.fullName,
        email: editUserForm.email,
      });
      await Promise.all([loadUsers(), loadAuditLogs()]);
      setMessage("User details updated.");
      setEditingUser(null);
    } catch (error: any) {
      setMessage(error?.payload?.message ?? error?.message ?? "Failed to update user details.");
    } finally {
      setEditUserSaving(false);
    }
  }

  async function handleCreateRestaurant() {
    const name = restaurantForm.name.trim();
    const cuisine = restaurantForm.cuisine.trim();
    const location = restaurantForm.location.trim();

    if (!name || !cuisine || !location) {
      setMessage("Restaurant name, cuisine, and location are required.");
      return;
    }

    try {
      setCreatingRestaurant(true);
      setGlobalLoading("Creating restaurant...");
      setMessage(null);

      const ratingValue = Number(restaurantForm.rating);
      const created = await createAdminRestaurant({
        name,
        cuisine,
        location,
        totalTables: parsePositiveInt(restaurantForm.totalTables, 10, 1, 999),
        priceLevel: parsePositiveInt(restaurantForm.priceLevel, 1, 1, 4),
        rating: Number.isFinite(ratingValue) ? ratingValue : undefined,
        ownerId: restaurantForm.ownerId.trim() || null,
        imageUrl: restaurantForm.imageUrl.trim() || undefined,
        contactPhone: restaurantForm.contactPhone.trim() || undefined,
        contactEmail: restaurantForm.contactEmail.trim() || undefined,
        description: restaurantForm.description.trim() || undefined,
      });

      setRestaurants((prev) => [created, ...prev]);
      setOwnerDraftByRestaurantId((prev) => ({
        ...prev,
        [created.id]: created.ownerId ?? "",
      }));

      await loadOverview();

      setRestaurantForm({
        name: "",
        cuisine: "",
        location: "",
        totalTables: "10",
        priceLevel: "1",
        ownerId: "",
        imageUrl: "",
        contactPhone: "",
        contactEmail: "",
        description: "",
        rating: "",
      });

      setMessage("Restaurant added successfully.");
    } catch (error: any) {
      setMessage(error?.payload?.message ?? error?.message ?? "Failed to create restaurant.");
    } finally {
      setCreatingRestaurant(false);
      setGlobalLoading(null);
    }
  }

  async function handleAssignRestaurantOwner(restaurantId: string) {
    const ownerId = String(ownerDraftByRestaurantId[restaurantId] ?? "").trim() || null;

    try {
      setAssigningRestaurantId(restaurantId);
      setMessage(null);

      const updated = await assignAdminRestaurantOwner(restaurantId, ownerId);

      setRestaurants((prev) =>
        prev.map((item) => (item.id === restaurantId ? updated : item)),
      );

      setOwnerDraftByRestaurantId((prev) => ({
        ...prev,
        [restaurantId]: updated.ownerId ?? "",
      }));

      setMessage(ownerId ? "Restaurant assigned to vendor." : "Restaurant assignment cleared.");
    } catch (error: any) {
      setMessage(error?.payload?.message ?? error?.message ?? "Failed to assign restaurant owner.");
    } finally {
      setAssigningRestaurantId(null);
    }
  }

  async function handleToggleFeatured(restaurantId: string, currentValue: boolean) {
    setTogglingFeaturedId(restaurantId);
    try {
      const updated = await toggleAdminRestaurantFeatured(restaurantId, !currentValue);
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurantId ? { ...r, isFeatured: updated.isFeatured } : r)),
      );
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to toggle featured");
    } finally {
      setTogglingFeaturedId(null);
    }
  }

  function handleDeleteRestaurant(restaurantId: string, restaurantName: string) {
    setConfirmModal({
      title: "Delete Restaurant",
      description: `Are you sure you want to delete "${restaurantName}"? This will also remove all related reservations, slot configs, and best sellers.`,
      confirmLabel: "Delete Restaurant",
      confirmColor: "red",
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          setDeletingRestaurantId(restaurantId);
          setMessage(null);

          await deleteAdminRestaurant(restaurantId);

          setRestaurants((prev) => prev.filter((item) => item.id !== restaurantId));
          setOwnerDraftByRestaurantId((prev) => {
            const next = { ...prev };
            delete next[restaurantId];
            return next;
          });

          await loadOverview();
          setMessage(`Restaurant "${restaurantName}" has been deleted.`);
        } catch (error: any) {
          setMessage(error?.payload?.message ?? error?.message ?? "Failed to delete restaurant.");
        } finally {
          setDeletingRestaurantId(null);
          setConfirmLoading(false);
          setConfirmModal(null);
        }
      },
    });
  }

  function handleDeleteUser(userId: string, userName: string) {
    setConfirmModal({
      title: "Delete User",
      description: `Are you sure you want to delete user "${userName}"? This will remove their profile, reservations, and unassign any restaurants they manage.`,
      confirmLabel: "Delete User",
      confirmColor: "red",
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          setDeletingUserId(userId);
          setMessage(null);

          await deleteAdminUser(userId);

          setUsers((prev) => prev.filter((item) => item.id !== userId));
          await Promise.all([loadOverview(), loadAuditLogs()]);
          setMessage(`User "${userName}" has been deleted.`);
        } catch (error: any) {
          setMessage(error?.payload?.message ?? error?.message ?? "Failed to delete user.");
        } finally {
          setDeletingUserId(null);
          setConfirmLoading(false);
          setConfirmModal(null);
        }
      },
    });
  }

  async function handleUpdateReservationStatus(reservationId: string) {
    const nextStatus = String(statusDraftByReservationId[reservationId] ?? "").toLowerCase();
    if (!["pending", "confirmed", "declined", "cancelled", "completed"].includes(nextStatus)) {
      setMessage("Invalid reservation status.");
      return;
    }

    let reason: string | undefined;
    if (nextStatus === "declined") {
      const input = window.prompt("Decline reason (optional):", "Declined by admin");
      if (input === null) return;
      reason = input;
    }

    try {
      setUpdatingReservationId(reservationId);
      setMessage(null);

      const result = await updateAdminReservationStatus(
        reservationId,
        nextStatus as "pending" | "confirmed" | "declined" | "cancelled" | "completed",
        reason,
      );

      await Promise.all([loadReservations(), loadOverview(), loadAuditLogs()]);
      setMessage(result.message);
    } catch (error: any) {
      setMessage(error?.payload?.message ?? error?.message ?? "Failed to update reservation status.");
    } finally {
      setUpdatingReservationId(null);
    }
  }

  if (authLoading || roleLoading) {
    return (
      <div className="p-7">
        <div className="inline-flex items-center gap-2 text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking admin access...
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="p-7">
        <div className="rounded-[24px] border border-[#e5e7eb] bg-white p-6 text-[#475467] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          Login is required to access admin dashboard.
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-7">
        <div className="rounded-[24px] border border-[#f3c3cc] bg-[#fff1f3] p-6 text-[#9f1239]">
          You do not have admin access.
        </div>
      </div>
    );
  }

  return (
    <>
    <ConfirmModal
      open={Boolean(confirmModal)}
      title={confirmModal?.title ?? ""}
      description={confirmModal?.description ?? ""}
      confirmLabel={confirmModal?.confirmLabel ?? "Confirm"}
      confirmColor={confirmModal?.confirmColor}
      loading={confirmLoading}
      onConfirm={() => confirmModal?.onConfirm()}
      onCancel={() => { if (!confirmLoading) setConfirmModal(null); }}
    />
    <LoadingOverlay visible={Boolean(globalLoading)} label={globalLoading ?? undefined} />

    <div className="p-7 text-[#1f2937]">
      {/* Topbar */}
      <header className="mb-5 rounded-[24px] bg-[linear-gradient(135deg,#1d2740,#334b7a)] px-6 py-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[32px] font-extrabold">Admin Dashboard</h2>
            <p className="mt-1 text-sm text-[#d9e4ff]">Monitor the complete RESEATO platform from one control center.</p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-[14px] border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </header>

      {message && (
        <div className="mb-5 rounded-[18px] border border-[#f3c3cc] bg-[#fff1f3] px-4 py-3 text-sm text-[#9f1239]">
          {message}
        </div>
      )}

      {activeTab === "overview" && (
        <section className="space-y-5">
          {/* Stats Grid */}
          <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Users", value: overview?.users ?? 0, icon: Users, sub: `+${overview?.vendors ?? 0} vendors` },
              { label: "Restaurants", value: overview?.restaurants ?? 0, icon: Building2, sub: "Active listings" },
              { label: "Reservations", value: overview?.reservations ?? 0, icon: CalendarCheck2, sub: "Healthy weekly flow" },
              { label: "System Profit", value: toPeso(overview?.totalPaidAmountMinor ?? 0), icon: Wallet, sub: "Reservation fees (₱20 each)" },
            ].map((card) => {
              return (
                <article key={card.label} className="rounded-[22px] border border-[#e7e3e5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[1px] text-[#667085]">{card.label}</div>
                  <div className="mt-2.5 text-[34px] font-extrabold text-[#1f2937]">{card.value}</div>
                  <div className="mt-1 text-xs font-bold text-[#3153a1]">{card.sub}</div>
                </article>
              );
            })}
          </div>

          {/* System Snapshot + Mini Cards */}
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <article className="rounded-[24px] border border-[#e7e3e5] bg-white p-[22px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-[18px]">
                <div>
                  <h3 className="text-[22px] font-extrabold text-[#1f2937]">System Snapshot</h3>
                  <p className="text-[13px] text-[#667085]">Quick visibility of operational load and reservation movement.</p>
                </div>
                <button type="button" onClick={handleRefresh} className="rounded-[14px] border border-[#d9e3fb] bg-[#eef4ff] px-3.5 py-2.5 text-sm font-bold text-[#3153a1]">Refresh Data</button>
              </div>

              <div className="space-y-[14px]">
                {[
                  { title: `${overview?.users ?? 0} Registered Users`, desc: "Customers, vendors, and admin accounts across the platform.", status: "Stable", tone: "confirmed" as const },
                  { title: `${overview?.restaurants ?? 0} Restaurant Listings`, desc: "Partner restaurants with varying reservation activity.", status: "Growing", tone: "confirmed" as const },
                  { title: `${overview?.pendingReservations ?? 0} Pending Reservations`, desc: "Reservations awaiting vendor approval or system processing.", status: "Monitor", tone: "pending" as const },
                ].map((item) => (
                  <div key={item.title} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#e7e3e5] bg-[#fcfafb] p-4">
                    <div>
                      <h4 className="text-[15px] font-bold text-[#1f2937]">{item.title}</h4>
                      <p className="mt-1 text-xs text-[#667085]">{item.desc}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-extrabold ${
                      item.tone === "confirmed" ? "bg-[#e8f7ef] text-[#1f7a4d]" : "bg-[#fff1d9] text-[#b7791f]"
                    }`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </article>

            <div className="grid gap-[14px]">
              {[
                { label: "Admin Alerts", value: overview?.admins ?? 0, sub: "Recent activities requiring review" },
                { label: "New Vendors", value: overview?.vendors ?? 0, sub: "Applications this week" },
                { label: "Paid Reservations", value: overview?.paidReservations ?? 0, sub: "Completed payment transactions" },
              ].map((item) => (
                <article key={item.label} className="rounded-[20px] border border-[#e7e3e5] bg-[linear-gradient(180deg,#fffaf9_0%,#fffdfd_100%)] p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                  <div className="text-xs font-semibold uppercase tracking-[1px] text-[#667085]">{item.label}</div>
                  <div className="mt-2 text-[28px] font-extrabold text-[#1f2937]">{item.value}</div>
                  <div className="text-xs text-[#667085]">{item.sub}</div>
                </article>
              ))}
            </div>
          </div>

        </section>
      )}

      {activeTab === "charts" && (
        <section className="space-y-5">
          <article className={panelClass}>
            <h2 className="text-2xl font-extrabold text-[#1f2937]">Performance Charts</h2>
            <p className="mt-1 text-sm text-[#667085]">Analyze reservation trends, completion rates, and revenue over time.</p>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8b97a8]">Range preset</p>
                <select
                  value={chartPreset}
                  onChange={(event) => setChartPreset(event.target.value as ChartPreset)}
                  className={`${selectClass} mt-1`}
                >
                  <option value="7d">Last 7 days</option>
                  <option value="14d">Last 14 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-[#8b97a8]">From</p>
                <input
                  type="date"
                  value={chartFrom}
                  onChange={(event) => {
                    setChartPreset("custom");
                    setChartFrom(event.target.value);
                  }}
                  className={`${inputClass} mt-1`}
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-[#8b97a8]">To</p>
                <input
                  type="date"
                  value={chartTo}
                  onChange={(event) => {
                    setChartPreset("custom");
                    setChartTo(event.target.value);
                  }}
                  className={`${inputClass} mt-1`}
                />
              </div>

              <div className="pb-1 text-xs text-[#8b97a8]">
                Charts update instantly when range changes.
              </div>

              <button
                type="button"
                onClick={handleExportChartCsv}
                disabled={!chartData?.days?.length}
                className={`${ghostButtonClass} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportChartExcel}
                disabled={!chartData?.days?.length}
                className="inline-flex items-center gap-1.5 rounded-[14px] border border-[#c8dcc8] bg-[#eef7ee] px-3 py-2 text-sm font-bold text-[#2d6a2e] hover:bg-[#e0f0e0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export Excel
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-sm text-[#5b6374]">
                Range: <span className="font-semibold text-[#1f2937]">{chartData?.from ?? chartFrom}</span> to <span className="font-semibold text-[#1f2937]">{chartData?.to ?? chartTo}</span>
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-sm text-[#5b6374]">
                Completion Rate: <span className="font-semibold text-[#1f2937]">{(chartData?.summary.completionRate ?? 0).toFixed(2)}%</span>
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-sm text-[#5b6374]">
                Cancellation Rate: <span className="font-semibold text-[#1f2937]">{(chartData?.summary.cancellationRate ?? 0).toFixed(2)}%</span>
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-sm text-[#5b6374]">
                System Profit in range: <span className="font-semibold text-[#1f2937]">{toPeso(chartData?.summary.totalRevenueMinor ?? 0)}</span>
              </div>
              <div className="rounded-xl border border-[#f0d5a5] bg-[#fff9ef] px-3 py-2 text-sm text-[#5b6374]">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                  Avg Rating:
                </span>{" "}
                <span className="font-semibold text-[#1f2937]">
                  {(() => {
                    const rated = restaurants.filter((r) => r.rating != null && Number(r.rating) > 0);
                    if (rated.length === 0) return "N/A";
                    return (rated.reduce((sum, r) => sum + Number(r.rating), 0) / rated.length).toFixed(1);
                  })()}
                </span>
                <span className="ml-1 text-xs text-[#8b97a8]">({restaurants.filter((r) => r.rating != null && Number(r.rating) > 0).length} restaurants)</span>
              </div>
            </div>

            {chartError && (
              <div className="mt-4 rounded-xl border border-[#f3c3cc] bg-[#fff1f3] px-3 py-2 text-sm text-[#9f1239]">
                {chartError}
              </div>
            )}
          </article>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className={panelClass}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-2xl text-[#1f2937]">Reservations by Day</h3>
                {chartLoading && <Loader2 className="h-4 w-4 animate-spin text-[#667085]" />}
              </div>
              <p className="text-xs text-[#8b97a8]">Line chart of total reservations per selected date.</p>
              <div className="mt-3">
                <ReservationsLineChart points={chartData?.days ?? []} />
              </div>
            </article>

            <article className={panelClass}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-2xl text-[#1f2937]">Completion vs Cancellation</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-[#0f766e]">
                    <span className="h-2 w-2 rounded-full bg-[#10b981]" /> completed
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#be123c]">
                    <span className="h-2 w-2 rounded-full bg-[#fb7185]" /> cancelled/declined
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#8b97a8]">Bar chart comparing completed and cancelled reservations by day.</p>
              <div className="mt-3">
                <CompletionLineChart points={chartData?.days ?? []} />
              </div>
            </article>
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className={`mt-5 ${panelClass}`}>
          <h2 className="text-3xl text-[#1f2937]">User Management</h2>

          <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by full name"
              className={`${inputClass} w-full sm:w-auto`}
            />

            <select
              value={userRoleFilter}
              onChange={(event) => setUserRoleFilter(event.target.value)}
              className={`${selectClass} w-full sm:w-auto`}
            >
              <option value="all">All roles</option>
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="admin">Admin</option>
            </select>

            <button type="button" onClick={loadUsers} className={`${ghostButtonClass} w-full sm:w-auto`}>
              Apply
            </button>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {users.length === 0 ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] px-4 py-6 text-center text-sm text-[#667085]">
                No users found.
              </div>
            ) : (
              users.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#1f2937]">{item.fullName || shortId(item.id)}</h3>
                      <p className="mt-0.5 break-words text-xs text-[#667085]">{item.email || "-"}</p>
                      <p className="mt-1 text-[11px] text-[#98a2b3]">Joined {toDateTime(item.createdAt)}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${userRoleTone(
                        item.role,
                      )}`}
                    >
                      {toLabel(item.role)}
                    </span>
                  </div>

                  <label className="mt-3 block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">
                      Account role
                    </span>
                    <select
                      value={roleDraftByUserId[item.id] ?? item.role}
                      onChange={(event) =>
                        setRoleDraftByUserId((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      className={`${selectClass} mt-1 h-10 w-full text-sm`}
                    >
                      <option value="customer">customer</option>
                      <option value="vendor">vendor</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditUser(item)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#c8d3e8] bg-[#eef2fb] px-3 py-2 text-xs font-semibold text-[#2f4a7b] transition hover:bg-[#e2e8f5]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateUserRole(item.id)}
                      disabled={updatingUserId === item.id}
                      className="rounded-xl border border-[#d9c3c8] bg-[#f8ecee] px-3 py-2 text-xs font-semibold text-[#7b2f3b] disabled:opacity-60"
                    >
                      {updatingUserId === item.id ? "Saving..." : "Update role"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(item.id, item.fullName || item.email || shortId(item.id))}
                      disabled={deletingUserId === item.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#f3c3cc] bg-[#fff1f2] px-3 py-2 text-xs font-semibold text-[#be123c] transition hover:bg-[#ffe4e6] disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingUserId === item.id ? "..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
              <table className="w-full text-sm text-[#374151]">
                <thead className="bg-[#f8fafc]">
                  <tr className="border-b border-[#e5e7eb] text-left text-xs uppercase tracking-wide text-[#8b97a8]">
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Joined</th>
                    <th className="px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-[#8b97a8]">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => (
                      <tr key={item.id} className="border-b border-[#f1f5f9] transition hover:bg-[#fcfdff]">
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            <span className="font-medium text-[#1f2937]">{item.fullName || shortId(item.id)}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#475467]">{item.email || "-"}</td>
                        <td className="px-3 py-3">
                          <select
                            value={roleDraftByUserId[item.id] ?? item.role}
                            onChange={(event) =>
                              setRoleDraftByUserId((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            className={`${selectClass} rounded-lg px-2 py-1 text-xs`}
                          >
                            <option value="customer">customer</option>
                            <option value="vendor">vendor</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-[#667085]">{toDateTime(item.createdAt)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditUser(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#c8d3e8] bg-[#eef2fb] px-2.5 py-1 text-xs font-semibold text-[#2f4a7b] transition hover:bg-[#e2e8f5]"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateUserRole(item.id)}
                              disabled={updatingUserId === item.id}
                              className="rounded-lg border border-[#d9c3c8] bg-[#f8ecee] px-2.5 py-1 text-xs font-semibold text-[#7b2f3b] disabled:opacity-60"
                            >
                              {updatingUserId === item.id ? "Saving..." : "Role"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(item.id, item.fullName || item.email || shortId(item.id))}
                              disabled={deletingUserId === item.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#f3c3cc] bg-[#fff1f2] px-2.5 py-1 text-xs font-semibold text-[#be123c] transition hover:bg-[#ffe4e6] disabled:opacity-60"
                            >
                              <Trash2 className="h-3 w-3" />
                              {deletingUserId === item.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ─── Edit User Details Modal ─── */}
      {editingUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !editUserSaving && setEditingUser(null)} />
          <div
            className="relative mx-4 w-full max-w-md rounded-[24px] border border-[#e8e2e3] bg-white p-6 shadow-[0_28px_60px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-[#1f2937]">Edit User Details</h3>
                <p className="text-sm text-[#667085]">ID: {shortId(editingUser.id)}</p>
              </div>
              <button
                type="button"
                onClick={() => !editUserSaving && setEditingUser(null)}
                className="rounded-xl border border-[#e5e7eb] p-1.5 text-[#667085] transition hover:bg-[#f3f4f6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Full Name</span>
                <input
                  value={editUserForm.fullName}
                  onChange={(e) => setEditUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded-xl border border-[#d8dbe2] bg-[#fcfcfd] px-3.5 py-2.5 text-sm text-[#1f2937] outline-none transition focus:border-[#8b3d4a] focus:ring-1 focus:ring-[#8b3d4a]"
                  placeholder="Enter full name"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Email</span>
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-[#d8dbe2] bg-[#fcfcfd] px-3.5 py-2.5 text-sm text-[#1f2937] outline-none transition focus:border-[#8b3d4a] focus:ring-1 focus:ring-[#8b3d4a]"
                  placeholder="Enter email address"
                />
              </label>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={editUserSaving}
                className="rounded-xl border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#475467] transition hover:bg-[#f8fafc] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUserDetails}
                disabled={editUserSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8b3d4a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6f2f3b] disabled:opacity-60"
              >
                {editUserSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddRestaurantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !creatingRestaurant && setShowAddRestaurantModal(false)}
          />
          <div className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-[#e7e3e5] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1f2937]">Add Restaurant</h2>
                <p className="mt-1 text-sm text-[#8b97a8]">Create restaurant details and optionally assign a vendor manager.</p>
              </div>
              <button
                type="button"
                onClick={() => !creatingRestaurant && setShowAddRestaurantModal(false)}
                className="rounded-xl border border-[#e5e7eb] p-1.5 text-[#667085] transition hover:bg-[#f3f4f6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-[#eceff4] bg-[#fbfcfe] p-5 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Name *</span>
                <input
                  value={restaurantForm.name}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Restaurant name"
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Cuisine *</span>
                <input
                  value={restaurantForm.cuisine}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, cuisine: event.target.value }))
                  }
                  placeholder="Cuisine"
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Location *</span>
                <input
                  value={restaurantForm.location}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="Address/location"
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Total tables</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={restaurantForm.totalTables}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, totalTables: event.target.value }))
                  }
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Price level</span>
                <select
                  value={restaurantForm.priceLevel}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, priceLevel: event.target.value }))
                  }
                  className={`${selectClass} h-11 w-full`}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Assign vendor</span>
                <select
                  value={restaurantForm.ownerId}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, ownerId: event.target.value }))
                  }
                  className={`${selectClass} h-11 w-full`}
                >
                  <option value="">Unassigned</option>
                  {assignableVendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {(vendor.fullName || vendor.email || shortId(vendor.id)) + " (" + vendor.role + ")"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Image URL</span>
                <input
                  value={restaurantForm.imageUrl}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, imageUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Contact phone</span>
                <input
                  value={restaurantForm.contactPhone}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, contactPhone: event.target.value }))
                  }
                  placeholder="09xxxxxxxxx"
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Contact email</span>
                <input
                  value={restaurantForm.contactEmail}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, contactEmail: event.target.value }))
                  }
                  placeholder="restaurant@email.com"
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Rating</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={restaurantForm.rating ?? ""}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, rating: event.target.value }))
                  }
                  placeholder="0.0 - 5.0"
                  className={`${inputClass} h-11 w-full`}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">Description</span>
                <textarea
                  value={restaurantForm.description}
                  onChange={(event) =>
                    setRestaurantForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Short restaurant description"
                  rows={3}
                  className={`${inputClass} min-h-[100px] w-full resize-y py-3`}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !creatingRestaurant && setShowAddRestaurantModal(false)}
                className="rounded-xl border border-[#d8dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#667085] transition hover:bg-[#f3f4f6] disabled:opacity-60"
                disabled={creatingRestaurant}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleCreateRestaurant();
                  if (restaurantForm.name.trim() === "") {
                    setShowAddRestaurantModal(false);
                  }
                }}
                disabled={creatingRestaurant}
                className="rounded-xl border border-[#d9c3c8] bg-[#f8ecee] px-5 py-2.5 text-sm font-semibold text-[#7b2f3b] shadow-sm transition hover:bg-[#f3dde1] disabled:opacity-60"
              >
                {creatingRestaurant ? "Creating..." : "Create Restaurant"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "restaurants" && (
        <section className="mt-5 space-y-4">
          <article className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-3xl text-[#1f2937]">Restaurant Management</h2>
                <p className="mt-1 text-xs text-[#8b97a8]">Assign restaurant owners from vendor accounts</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRestaurantModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d9c3c8] bg-[#f8ecee] px-4 py-2.5 text-sm font-semibold text-[#7b2f3b] shadow-sm transition hover:bg-[#f3dde1]"
              >
                <Plus className="h-4 w-4" />
                Add Restaurant
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
              <input
                value={restaurantSearch}
                onChange={(event) => setRestaurantSearch(event.target.value)}
                placeholder="Search restaurant name/cuisine/location"
                className={`${inputClass} w-full sm:w-[340px]`}
              />
              <button type="button" onClick={loadRestaurants} className={`${ghostButtonClass} w-full sm:w-auto`}>
                Apply
              </button>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {restaurants.length === 0 ? (
                <div className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] px-4 py-6 text-center text-sm text-[#667085]">
                  No restaurants found.
                </div>
              ) : (
                restaurants.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-[#1f2937]">{item.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                          <span>{item.cuisine} | {item.location}</span>
                          {item.rating != null && Number(item.rating) > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-[#f0d5a5] bg-[#fff9ef] px-2 py-0.5 text-[11px] font-semibold text-[#9a6a19]">
                              <Star className="h-2.5 w-2.5 fill-[#f59e0b] text-[#f59e0b]" />
                              {Number(item.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(item.id, item.isFeatured)}
                          disabled={togglingFeaturedId === item.id}
                          className="shrink-0 p-1 transition hover:scale-110"
                          title={item.isFeatured ? "Remove from featured" : "Add to featured"}
                        >
                          <Star className={`h-5 w-5 ${item.isFeatured ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[#d1d5db]"}`} />
                        </button>
                        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Active
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                        <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Owner</div>
                        <div className="mt-1 break-words text-xs font-medium text-[#344054]">
                          {item.ownerName || item.ownerEmail || (item.ownerId ? shortId(item.ownerId) : "-")}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                        <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Performance</div>
                        <div className="mt-1 text-xs font-medium text-[#344054]">
                          {item.totalTables} tables | {item.rating.toFixed(1)} rating
                        </div>
                      </div>
                    </div>

                    <label className="mt-3 block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">
                        Assign vendor
                      </span>
                      <select
                        value={ownerDraftByRestaurantId[item.id] ?? item.ownerId ?? ""}
                        onChange={(event) =>
                          setOwnerDraftByRestaurantId((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        className={`${selectClass} mt-1 h-10 w-full text-xs`}
                      >
                        <option value="">Unassigned</option>
                        {assignableVendors.map((vendor) => (
                          <option key={vendor.id} value={vendor.id}>
                            {(vendor.fullName || vendor.email || shortId(vendor.id)) + " (" + vendor.role + ")"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAssignRestaurantOwner(item.id)}
                        disabled={assigningRestaurantId === item.id}
                        className="flex-1 rounded-xl border border-[#d9c3c8] bg-[#f8ecee] px-3 py-2 text-xs font-semibold text-[#7b2f3b] disabled:opacity-60"
                      >
                        {assigningRestaurantId === item.id ? "Saving..." : "Save assignment"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRestaurant(item.id, item.name)}
                        disabled={deletingRestaurantId === item.id}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {deletingRestaurantId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
                <table className="w-full text-[#374151]">
                  <thead className="bg-[#f8fafc]">
                    <tr className="border-b border-[#e5e7eb] text-left text-xs uppercase tracking-wide text-[#8b97a8]">
                      <th className="px-3 py-2.5">Restaurant</th>
                      <th className="px-3 py-2.5">Owner / Vendor</th>
                      <th className="px-3 py-2.5">Assign Vendor</th>
                      <th className="px-3 py-2.5">System Profit</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Featured</th>
                      <th className="px-3 py-2.5">Tables</th>
                      <th className="px-3 py-2.5">Rating</th>
                      <th className="px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restaurants.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-[#8b97a8]">
                          No restaurants found.
                        </td>
                      </tr>
                    ) : (
                      restaurants.map((item) => {
                        const restoReservations = reservations.filter(
                          (r) => r.restaurant_id === item.id && (r.payment_status === "paid"),
                        );
                        const totalSystemProfit = restoReservations.reduce(
                          (sum, r) => sum + (Number(r.payment_amount) || 0), 0,
                        );
                        return (
                        <tr key={item.id} className="border-b border-[#f1f5f9] align-top transition hover:bg-[#fcfdff]">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1f2937]">{item.name}</span>
                              {item.rating != null && Number(item.rating) > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-[#f0d5a5] bg-[#fff9ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a6a19]">
                                  <Star className="h-2.5 w-2.5 fill-[#f59e0b] text-[#f59e0b]" />
                                  {Number(item.rating).toFixed(1)}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-[#8b97a8]">
                              {item.cuisine} | {item.location}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-[#475467]">
                              {item.ownerName || item.ownerEmail || (item.ownerId ? shortId(item.ownerId) : "-")}
                            </div>
                            {item.ownerName && item.ownerEmail && (
                              <div className="mt-0.5 text-[11px] text-[#8b97a8]">{item.ownerEmail}</div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-[280px] items-center gap-2">
                              <select
                                value={ownerDraftByRestaurantId[item.id] ?? item.ownerId ?? ""}
                                onChange={(event) =>
                                  setOwnerDraftByRestaurantId((prev) => ({
                                    ...prev,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                className={`${selectClass} min-w-[190px] rounded-lg px-2 py-1 text-xs`}
                              >
                                <option value="">Unassigned</option>
                                {assignableVendors.map((vendor) => (
                                  <option key={vendor.id} value={vendor.id}>
                                    {(vendor.fullName || vendor.email || shortId(vendor.id)) +
                                      " (" +
                                      vendor.role +
                                      ")"}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAssignRestaurantOwner(item.id)}
                                disabled={assigningRestaurantId === item.id}
                                className="rounded-lg border border-[#d9c3c8] bg-[#f8ecee] px-2.5 py-1 text-xs font-semibold text-[#7b2f3b] disabled:opacity-60"
                              >
                                {assigningRestaurantId === item.id ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-semibold text-[#7b2f3b]">{toPeso(totalSystemProfit)}</div>
                            <div className="mt-0.5 text-[11px] text-[#8b97a8]">{restoReservations.length} paid</div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              Active
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleFeatured(item.id, item.isFeatured)}
                              disabled={togglingFeaturedId === item.id}
                              className="transition hover:scale-110"
                              title={item.isFeatured ? "Remove from featured" : "Add to featured"}
                            >
                              <Star className={`h-5 w-5 ${item.isFeatured ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[#d1d5db] hover:text-[#f59e0b]/50"}`} />
                            </button>
                          </td>
                          <td className="px-3 py-3 text-[#475467]">{item.totalTables}</td>
                          <td className="px-3 py-3 text-[#475467]">{item.rating.toFixed(1)}</td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteRestaurant(item.id, item.name)}
                              disabled={deletingRestaurantId === item.id}
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              title="Delete restaurant"
                            >
                              {deletingRestaurantId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      )}
      {activeTab === "reservations" && (
        <section className={`mt-5 ${panelClass}`}>
          <h2 className="text-3xl text-[#1f2937]">All Reservations</h2>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b97a8]" />
            <input
              type="text"
              value={reservationSearch}
              onChange={(e) => setReservationSearch(e.target.value)}
              placeholder="Search by name, email, restaurant, or ID..."
              className={`${inputClass} w-full pl-9`}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:flex sm:flex-wrap">
            <select
              value={reservationStatusFilter}
              onChange={(event) => setReservationStatusFilter(event.target.value)}
              className={`${selectClass} w-full sm:w-auto`}
            >
              <option value="all">All statuses</option>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="declined">declined</option>
              <option value="cancelled">cancelled</option>
              <option value="completed">completed</option>
            </select>

            <select
              value={reservationPaymentFilter}
              onChange={(event) => setReservationPaymentFilter(event.target.value)}
              className={`${selectClass} w-full sm:w-auto`}
            >
              <option value="all">All payment</option>
              <option value="unpaid">unpaid</option>
              <option value="processing">processing</option>
              <option value="paid">paid</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>

            <input
              type="date"
              value={reservationDateFilter}
              onChange={(event) => setReservationDateFilter(event.target.value)}
              className={`${inputClass} w-full sm:w-auto`}
            />

            <button type="button" onClick={loadReservations} className={`${ghostButtonClass} w-full sm:w-auto`}>
              Apply Filters
            </button>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {filteredReservations.length === 0 ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] px-4 py-6 text-center text-sm text-[#667085]">
                No reservations found.
              </div>
            ) : (
              filteredReservations.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-[#8b97a8]">{shortId(item.id)}</div>
                      <div className="mt-1 text-sm font-semibold text-[#1f2937]">
                        {item.restaurant_name || shortId(item.restaurant_id)}
                      </div>
                      <div className="mt-0.5 break-words text-xs text-[#667085]">
                        {item.user_name || item.user_email || shortId(item.user_id)}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${reservationStatusTone(
                        item.status,
                      )}`}
                    >
                      {toLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                      <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Date/Time</div>
                      <div className="mt-1 text-xs font-medium text-[#344054]">
                        {item.date} {to12Hour(item.time)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                      <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Guests</div>
                      <div className="mt-1 text-xs font-medium text-[#344054]">{item.guests}</div>
                    </div>
                    <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                      <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Payment</div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${paymentStatusTone(
                            item.payment_status || "unpaid",
                          )}`}
                        >
                          {toLabel(item.payment_status || "unpaid")}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                      <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Amount</div>
                      <div className="mt-1 text-xs font-semibold text-[#7b2f3b]">{toPeso(item.payment_amount ?? 0)}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <label className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d8798]">
                        Update status
                      </span>
                      <select
                        value={statusDraftByReservationId[item.id] ?? item.status}
                        onChange={(event) =>
                          setStatusDraftByReservationId((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        className={`${selectClass} h-10 w-full text-sm`}
                      >
                        <option value="pending">pending</option>
                        <option value="confirmed">confirmed</option>
                        <option value="declined">declined</option>
                        <option value="cancelled">cancelled</option>
                        <option value="completed">completed</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleUpdateReservationStatus(item.id)}
                      disabled={updatingReservationId === item.id}
                      className="w-full rounded-xl border border-[#d9c3c8] bg-[#f8ecee] px-3 py-2 text-xs font-semibold text-[#7b2f3b] disabled:opacity-60"
                    >
                      {updatingReservationId === item.id ? "Saving..." : "Update reservation"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
              <table className="w-full text-sm text-[#374151]">
                <thead className="bg-[#f8fafc]">
                  <tr className="border-b border-[#e5e7eb] text-left text-xs uppercase tracking-wide text-[#8b97a8]">
                    <th className="px-3 py-2.5">ID</th>
                    <th className="px-3 py-2.5">User</th>
                    <th className="px-3 py-2.5">Restaurant</th>
                    <th className="px-3 py-2.5">Date/Time</th>
                    <th className="px-3 py-2.5">Guests</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Payment</th>
                    <th className="px-3 py-2.5">Amount</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-sm text-[#8b97a8]">
                        No reservations found.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((item) => (
                      <tr key={item.id} className="border-b border-[#f1f5f9] transition hover:bg-[#fcfdff]">
                        <td className="px-3 py-3 text-[#667085]">{shortId(item.id)}</td>
                        <td className="px-3 py-3 text-[#475467]">
                          {item.user_name || item.user_email || shortId(item.user_id)}
                        </td>
                        <td className="px-3 py-3 text-[#475467]">{item.restaurant_name || shortId(item.restaurant_id)}</td>
                        <td className="px-3 py-3 text-[#475467]">
                          {item.date} {to12Hour(item.time)}
                        </td>
                        <td className="px-3 py-3 text-[#475467]">{item.guests}</td>
                        <td className="px-3 py-3">
                          <select
                            value={statusDraftByReservationId[item.id] ?? item.status}
                            onChange={(event) =>
                              setStatusDraftByReservationId((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            className={`${selectClass} rounded-lg px-2 py-1 text-xs`}
                          >
                            <option value="pending">pending</option>
                            <option value="confirmed">confirmed</option>
                            <option value="declined">declined</option>
                            <option value="cancelled">cancelled</option>
                            <option value="completed">completed</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-[#475467]">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${paymentStatusTone(
                              item.payment_status || "unpaid",
                            )}`}
                          >
                            {toLabel(item.payment_status || "unpaid")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#475467]">{toPeso(item.payment_amount ?? 0)}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => handleUpdateReservationStatus(item.id)}
                            disabled={updatingReservationId === item.id}
                            className="rounded-lg border border-[#d9c3c8] bg-[#f8ecee] px-2.5 py-1 text-xs font-semibold text-[#7b2f3b] disabled:opacity-60"
                          >
                            {updatingReservationId === item.id ? "Saving..." : "Update"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-3 text-xs italic text-[#8b97a8]">
            Each completed reservation contributes ₱20 to the system profit.
          </p>
        </section>
      )}

      {activeTab === "audit" && (
        <section className={`mt-5 ${panelClass}`}>
          <h2 className="text-3xl text-[#1f2937]">Admin Audit Logs</h2>

          <div className="mt-4 space-y-3 md:hidden">
            {auditLogs.map((log) => (
              <article
                key={log.id}
                className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-[#1f2937]">{log.action}</div>
                  <div className="text-[11px] text-[#8b97a8]">{toDateTime(log.created_at)}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                    <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Actor</div>
                    <div className="mt-1 text-xs text-[#344054]">{shortId(log.actor_id)}</div>
                  </div>
                  <div className="rounded-xl border border-[#ebedf1] bg-white p-2">
                    <div className="text-[10px] uppercase tracking-wide text-[#98a2b3]">Target</div>
                    <div className="mt-1 text-xs text-[#344054]">
                      {log.target_type} ({shortId(log.target_id)})
                    </div>
                  </div>
                </div>
                <details className="mt-2 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#7b2f3b]">
                    View payload JSON
                  </summary>
                  <pre className="max-h-56 overflow-auto border-t border-[#eef1f4] bg-[#f8fafc] p-2 text-[11px] text-[#475467]">
                    {JSON.stringify(log.payload ?? {}, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
            {auditLogs.length === 0 && (
              <div className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 text-sm text-[#667085]">
                No audit logs available.
              </div>
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
              <table className="w-full text-sm text-[#374151]">
                <thead className="bg-[#f8fafc]">
                  <tr className="border-b border-[#e5e7eb] text-left text-xs uppercase tracking-wide text-[#8b97a8]">
                    <th className="px-3 py-2.5">Action</th>
                    <th className="px-3 py-2.5">Actor</th>
                    <th className="px-3 py-2.5">Target</th>
                    <th className="px-3 py-2.5">Created</th>
                    <th className="px-3 py-2.5">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-[#8b97a8]">
                        No audit logs available.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-[#f1f5f9] align-top transition hover:bg-[#fcfdff]">
                        <td className="px-3 py-3 font-semibold text-[#1f2937]">{log.action}</td>
                        <td className="px-3 py-3 text-[#475467]">{shortId(log.actor_id)}</td>
                        <td className="px-3 py-3 text-[#475467]">
                          {log.target_type} ({shortId(log.target_id)})
                        </td>
                        <td className="px-3 py-3 text-[#667085]">{toDateTime(log.created_at)}</td>
                        <td className="px-3 py-3">
                          <details className="w-full overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
                            <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[#7b2f3b]">
                              View JSON
                            </summary>
                            <pre className="max-h-52 overflow-auto border-t border-[#eef1f4] bg-[#f8fafc] p-2 text-[11px] text-[#475467]">
                              {JSON.stringify(log.payload ?? {}, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      {activeTab === "support" && (
        <section className={`mt-5 ${panelClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-3xl text-[#1f2937]">Customer Service</h2>
              <p className="text-[13px] text-[#667085]">Support tickets submitted by customers.</p>
            </div>
            <div className="flex gap-2">
              {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSupportStatusFilter(s)} className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${supportStatusFilter === s ? "bg-[#1f2937] text-white" : "border border-[#d8dbe2] bg-white text-[#374151] hover:bg-[#f3f4f6]"}`}>
                  {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {supportLoading ? (
            <div className="py-8 text-center text-sm text-[#667085]">Loading tickets...</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {supportTickets
                  .filter((t) => supportStatusFilter === "all" || t.status === supportStatusFilter)
                  .map((ticket) => (
                  <article key={ticket.id} className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-[#1f2937]">{ticket.subject}</div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ticket.status === "open" ? "bg-[#fef3c7] text-[#92400e]" : ticket.status === "resolved" ? "bg-[#d1fae5] text-[#065f46]" : ticket.status === "closed" ? "bg-[#f3f4f6] text-[#6b7280]" : "bg-[#dbeafe] text-[#1e40af]"}`}>
                        {ticket.status === "in_progress" ? "In Progress" : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[#6b7280]">{ticket.email || "No email"}</div>
                    <div className="mt-2 rounded-xl border border-[#ebedf1] bg-white p-3 text-sm text-[#475467]">
                      {ticket.message}
                      {ticket.attachment_url && (
                        <a href={ticket.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                          <img src={ticket.attachment_url} alt="Attachment" className="h-20 w-auto rounded-lg border border-[#e8dfe2] object-cover hover:opacity-80 transition" />
                        </a>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-[11px] text-[#8b97a8]">{toDateTime(ticket.created_at)}</div>
                      <select
                        value={ticket.status}
                        onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                        className="rounded-lg border border-[#d8dbe2] bg-white px-2 py-1 text-xs text-[#374151]"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </article>
                ))}
                {supportTickets.filter((t) => supportStatusFilter === "all" || t.status === supportStatusFilter).length === 0 && (
                  <div className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4 text-sm text-[#667085]">No support tickets found.</div>
                )}
              </div>

              {/* Desktop table */}
              <div className="mt-4 hidden overflow-x-auto md:block">
                <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
                  <table className="w-full text-sm text-[#374151]">
                    <thead className="bg-[#f8fafc]">
                      <tr className="border-b border-[#e5e7eb] text-left text-xs uppercase tracking-wide text-[#8b97a8]">
                        <th className="px-3 py-2.5">Subject</th>
                        <th className="px-3 py-2.5">Email</th>
                        <th className="px-3 py-2.5">Message</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supportTickets
                        .filter((t) => supportStatusFilter === "all" || t.status === supportStatusFilter)
                        .length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-[#8b97a8]">No support tickets found.</td></tr>
                      ) : (
                        supportTickets
                          .filter((t) => supportStatusFilter === "all" || t.status === supportStatusFilter)
                          .map((ticket) => (
                          <tr key={ticket.id} className="border-b border-[#f1f5f9] transition hover:bg-[#fcfdff]">
                            <td className="px-3 py-3 font-semibold text-[#1f2937]">{ticket.subject}</td>
                            <td className="px-3 py-3 text-[#475467]">{ticket.email || "—"}</td>
                            <td className="max-w-xs px-3 py-3 text-[#475467]">
                              <div className="truncate">{ticket.message}</div>
                              {ticket.attachment_url && (
                                <a href={ticket.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
                                  <img src={ticket.attachment_url} alt="Attachment" className="h-10 w-auto rounded border border-[#e8dfe2] object-cover hover:opacity-80 transition" />
                                </a>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ticket.status === "open" ? "bg-[#fef3c7] text-[#92400e]" : ticket.status === "resolved" ? "bg-[#d1fae5] text-[#065f46]" : ticket.status === "closed" ? "bg-[#f3f4f6] text-[#6b7280]" : "bg-[#dbeafe] text-[#1e40af]"}`}>
                                {ticket.status === "in_progress" ? "In Progress" : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[#667085]">{toDateTime(ticket.created_at)}</td>
                            <td className="px-3 py-3">
                              <select
                                value={ticket.status}
                                onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                                className="rounded-lg border border-[#d8dbe2] bg-white px-2 py-1.5 text-xs text-[#374151]"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {activeTab === "featured" && (
        <section className={`mt-5 ${panelClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-3xl text-[#1f2937]">Featured Restaurants</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Select which restaurants appear on the homepage. Vendors can pay to have their restaurants featured.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#667085]">
              <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
              {restaurants.filter((r) => r.isFeatured).length} featured
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[#3153a1]" />
            </div>
          ) : restaurants.length === 0 ? (
            <div className="rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-8 text-center text-sm text-[#8b97a8]">
              No restaurants found. Add restaurants first.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...restaurants].sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1)).map((item) => (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                    item.isFeatured
                      ? "border-[#f59e0b]/40 bg-gradient-to-br from-[#fffbeb] to-[#fef9c3] shadow-[0_8px_24px_rgba(245,158,11,0.12)]"
                      : "border-[#e5e7eb] bg-white hover:border-[#d1d5db] hover:shadow-md"
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-[140px] overflow-hidden">
                    <img
                      src={item.imageUrl || RESTAURANT_FALLBACK_IMG}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).src = RESTAURANT_FALLBACK_IMG;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                    {/* Featured badge */}
                    {item.isFeatured && (
                      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#f59e0b] px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                        <Star className="h-3 w-3 fill-white" />
                        FEATURED
                      </div>
                    )}

                    {/* Rating */}
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-[#1f2937] backdrop-blur">
                      <Star className="h-3 w-3 fill-[#f59e0b] text-[#f59e0b]" />
                      {item.rating.toFixed(1)}
                    </div>

                    {/* Name on image */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="text-base font-bold text-white drop-shadow">{item.name}</div>
                      <div className="text-xs text-white/80">{item.cuisine} | {item.location}</div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="text-xs text-[#667085]">
                      {item.ownerName || item.ownerEmail || "No owner assigned"}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(item.id, item.isFeatured)}
                      disabled={togglingFeaturedId === item.id}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                        item.isFeatured
                          ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                          : "border border-[#f0d5a5] bg-[#fffbeb] text-[#92400e] hover:bg-[#fef3c7]"
                      }`}
                    >
                      <Star className={`h-3.5 w-3.5 ${item.isFeatured ? "" : "fill-[#f59e0b] text-[#f59e0b]"}`} />
                      {togglingFeaturedId === item.id
                        ? "Updating..."
                        : item.isFeatured
                          ? "Remove"
                          : "Feature"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
    </>
  );
  }
