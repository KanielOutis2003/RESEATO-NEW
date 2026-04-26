import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { supabase } from "./supabase";
import { requireUser } from "./auth";

const app = express();

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const WEB_ORIGINS = Array.from(
  new Set(
    WEB_ORIGIN.split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean)
      .concat(
        process.env.NODE_ENV === "production"
          ? []
          : ["http://localhost:3000", "http://127.0.0.1:3000"],
      ),
  ),
);

function isAllowedOrigin(origin: string): boolean {
  if (WEB_ORIGINS.includes(origin)) return true;
  // Allow any local network origin in non-production (LAN IPs, localhost on any port)
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(origin);
      const host = url.hostname;
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      ) {
        return true;
      }
    } catch {
      // ignore malformed origins
    }
  }
  return false;
}
const APP_BASE_URL = (process.env.APP_BASE_URL ?? WEB_ORIGIN).replace(
  /\/+$/,
  "",
);
const PAYMONGO_BASE_URL =
  process.env.PAYMONGO_BASE_URL ?? "https://api.paymongo.com/v1";
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY ?? "";
const RESERVATION_FEE_PHP = Number(process.env.RESERVATION_FEE_PHP ?? 20);
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json());

type PaymentMethod = "card" | "wallet";
type PaymentStatus = "unpaid" | "processing" | "paid" | "failed" | "cancelled";

type ReservationDecisionAction = "approve" | "decline" | "complete";

const DEFAULT_BASE_SLOTS = [
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];

function normalizeReservationStatus(raw: unknown) {
  return String(raw ?? "pending").toLowerCase();
}

function toDayOfWeek(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getUTCDay();
}

function normalizeTime(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);
  return null;
}

function parsePositiveInt(value: unknown, fallback: number, min = 1, max = 999) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function normalizeDateString(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return null;

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return null;

  const normalized = dt.toISOString().slice(0, 10);
  return normalized === raw ? raw : null;
}

function formatDateKeyUTC(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

function shiftDateKey(dateKey: string, days: number) {
  const normalized = normalizeDateString(dateKey);
  if (!normalized) return null;

  const base = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return null;

  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatDateKeyUTC(shifted);
}

function createDateRangeKeys(from: string, to: string) {
  const normalizedFrom = normalizeDateString(from);
  const normalizedTo = normalizeDateString(to);
  if (!normalizedFrom || !normalizedTo) return [] as string[];
  if (normalizedFrom > normalizedTo) return [] as string[];

  const fromDate = new Date(`${normalizedFrom}T00:00:00.000Z`);
  const toDate = new Date(`${normalizedTo}T00:00:00.000Z`);
  const days =
    Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (!Number.isFinite(days) || days < 1 || days > 366) {
    return [] as string[];
  }

  const keys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const current = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000);
    keys.push(formatDateKeyUTC(current));
  }

  return keys;
}

function getTodayDateKeyUTC() {
  return new Date().toISOString().slice(0, 10);
}

function getErrorCode(error: any) {
  return String(error?.code ?? "");
}

function isUndefinedTableError(error: any) {
  const code = getErrorCode(error).toUpperCase();
  if (code === "42P01" || code === "PGRST205") return true;

  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("could not find the table") || message.includes("does not exist");
}

function isUndefinedColumnError(error: any) {
  const code = getErrorCode(error).toUpperCase();
  if (code === "42703" || code === "PGRST204") return true;

  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("column") && message.includes("could not find");
}

function isConflictError(error: any) {
  return getErrorCode(error) === "23505";
}

function getMissingColumnName(error: any) {
  const message = String(error?.message ?? "");
  const quoted = /column\s+"([a-zA-Z0-9_]+)"/i.exec(message)?.[1];
  if (quoted) return quoted;

  const plain = /column\s+([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i.exec(message)?.[1];
  if (plain) return plain;

  // PostgREST PGRST204: "Could not find the 'gallery_images' column of 'restaurants' in the schema cache"
  const pgrst = /the\s+'([a-zA-Z0-9_]+)'\s+column/i.exec(message)?.[1];
  return pgrst ?? null;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findAuthUserByEmail(email: string) {
  const target = normalizeEmail(email);
  if (!target) return null;

  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = data?.users ?? [];
    const match = users.find(
      (user) => normalizeEmail(user.email) === target,
    );

    if (match) return match;
    if (users.length < perPage) break;
  }

  return null;
}

async function sendEmailNotification(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !to) {
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function getAdminUserIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (error || !data) return [];
  return data.map((row: any) => String(row.id));
}

async function notifyAdmins(input: {
  title: string;
  body: string;
  type: string;
  link: string | null;
  data?: Record<string, unknown>;
}) {
  try {
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await createUserNotification({ ...input, userId: adminId });
    }
  } catch {
    // admin notifications are non-critical
  }
}

async function createUserNotification(input: {
  userId: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  data?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    body: input.body,
    type: input.type,
    link: input.link,
    data: input.data ?? {},
    is_read: false,
  });

  if (error && isUndefinedTableError(error)) return;
  if (error) throw new Error(error.message);
}

function defaultReservationFeeMinor() {
  const value = Math.round(RESERVATION_FEE_PHP * 100);
  if (!Number.isFinite(value) || value <= 0) return 2000;
  return value;
}

function normalizePaymentStatus(raw: unknown): PaymentStatus {
  const value = String(raw ?? "unpaid").toLowerCase();
  if (value === "processing") return "processing";
  if (value === "paid") return "paid";
  if (value === "failed") return "failed";
  if (value === "cancelled") return "cancelled";
  return "unpaid";
}

function getPaymongoPaymentTypes(method: PaymentMethod) {
  if (method === "wallet") return ["gcash", "paymaya"];
  return ["card"];
}

function getPaymongoAuthHeader() {
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error("PAYMONGO_SECRET_KEY is not configured on the API");
  }
  return `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString("base64")}`;
}

async function paymongoRequest(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${PAYMONGO_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: getPaymongoAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const rawText = await res.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!res.ok) {
    const detail =
      data?.errors?.[0]?.detail ??
      data?.errors?.[0]?.title ??
      data?.message ??
      `PayMongo request failed with status ${res.status}`;
    throw new Error(String(detail));
  }

  return data;
}

async function getReservationForUser(reservationId: string, userId: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      user_id,
      restaurant_id,
      name,
      phone,
      date,
      time,
      guests,
      status,
      created_at,
      payment_status,
      payment_amount,
      payment_provider,
      payment_checkout_session_id,
      payment_reference,
      payment_paid_at,
      payment_error
    `,
    )
    .eq("id", reservationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return data as any;
}

async function getRestaurantName(restaurantId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) return "Restaurant Reservation";
  return data?.name ?? "Restaurant Reservation";
}

function mapRestaurantRow(
  row: any,
  owner?: { name: string | null; email: string | null } | null,
) {
  return {
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    location: row.location,
    rating: Number(row.rating ?? 0),
    priceLevel: row.price_level ?? 1,
    description: row.description,
    imageUrl: row.image_url,
    contactPhone: row.contact_phone ?? null,
    contactEmail: row.contact_email ?? null,
    ownerId: row.owner_id ?? null,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    totalTables: Number(row.total_tables ?? 1),
    maxGuestsPerTable: parsePositiveInt(row.max_guests_per_table, 4, 1, 50),
    createdAt: row.created_at ?? null,
    galleryImages: Array.isArray(row.gallery_images) ? row.gallery_images.filter((u: unknown) => typeof u === "string" && (u as string).trim()) : [],
    isFeatured: Boolean(row.is_featured),
  };
}

function mapBestSellerRow(
  row: any,
  restaurantName?: string | null,
) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: restaurantName ?? null,
    name: row.name,
    priceMinor: Number(row.price_minor ?? 0),
    imageUrl: row.image_url ?? null,
    stockQuantity: Number(row.stock_quantity ?? 0),
    soldCount: Number(row.sold_count ?? 0),
    isActive: row.is_active !== false,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function displayNameFromIdentity(input: {
  fullName?: string | null;
  email?: string | null;
  fallbackId?: string | null;
}) {
  const fullName = String(input.fullName ?? "").trim();
  if (fullName) return fullName;

  const email = String(input.email ?? "").trim();
  if (email) return email;

  return String(input.fallbackId ?? "Unknown");
}

async function getUserIdentityMap(userIds: string[]) {
  const distinctIds = Array.from(
    new Set(
      userIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );

  const map = new Map<
    string,
    { name: string; fullName: string | null; email: string | null }
  >();
  if (!distinctIds.length) return map;

  const idSet = new Set(distinctIds);

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,full_name")
    .in("id", distinctIds);

  if (profilesError && !isUndefinedTableError(profilesError)) {
    throw new Error(profilesError.message);
  }

  const fullNameById = new Map<string, string | null>();
  for (const profile of profiles ?? []) {
    fullNameById.set(String((profile as any).id), (profile as any).full_name ?? null);
  }

  const authUsersResult = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const emailById = new Map<string, string | null>();
  for (const authUser of authUsersResult.data?.users ?? []) {
    const id = String(authUser.id ?? "");
    if (!idSet.has(id)) continue;
    emailById.set(id, String(authUser.email ?? "") || null);
  }

  for (const id of distinctIds) {
    const fullName = fullNameById.get(id) ?? null;
    const email = emailById.get(id) ?? null;
    const name = displayNameFromIdentity({
      fullName,
      email,
      fallbackId: id,
    });

    map.set(id, { name, fullName, email });
  }

  return map;
}

async function getUserRole(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!profileError && profile?.role) {
    return String(profile.role).trim().toLowerCase();
  }

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
    userId,
  );

  if (!authError) {
    const metadata = authData?.user?.user_metadata as
      | Record<string, unknown>
      | undefined;
    const roleFromMetadata =
      typeof metadata?.role === "string" ? metadata.role.trim().toLowerCase() : "";
    if (roleFromMetadata) return roleFromMetadata;
  }

  return "customer";
}

async function ensureVendorRole(userId: string) {
  const role = await getUserRole(userId);
  const isVendor = role === "vendor" || role === "owner" || role === "manager";

  if (!isVendor) {
    const error: any = new Error("Vendor access required");
    error.status = 403;
    throw error;
  }

  return role;
}

async function ensureAdminRole(userId: string) {
  const role = await getUserRole(userId);
  const isAdmin = role === "admin";

  if (!isAdmin) {
    const error: any = new Error("Admin access required");
    error.status = 403;
    throw error;
  }

  return role;
}

async function writeAdminAuditLog(input: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    payload: input.payload ?? {},
  });

  if (error && isUndefinedTableError(error)) return;
  if (error) throw new Error(error.message);
}

async function getOwnedRestaurantIds(userId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => String(row.id));
}

async function getRestaurantByIdForVendor(restaurantId: string, userId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as any | null;
}

async function getRestaurantTotalTables(restaurantId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("total_tables")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error && isUndefinedColumnError(error)) return 1;
  if (error) return 1;

  return parsePositiveInt(data?.total_tables, 1, 1, 999);
}

async function getRestaurantMaxGuestsPerTable(restaurantId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("max_guests_per_table")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error && isUndefinedColumnError(error)) return 4;
  if (error) return 4;

  return parsePositiveInt(data?.max_guests_per_table, 4, 1, 50);
}

type GuestConfig = { minGuests: number; maxGuests: number; maxTables: number };

async function getRestaurantGuestConfigs(restaurantId: string): Promise<GuestConfig[]> {
  const { data, error } = await supabase
    .from("restaurant_guest_configs")
    .select("min_guests,max_guests,max_tables")
    .eq("restaurant_id", restaurantId)
    .order("min_guests", { ascending: true });

  if (error) return [];

  return (data ?? []).map((row: any) => ({
    minGuests: Number(row.min_guests),
    maxGuests: Number(row.max_guests),
    maxTables: Number(row.max_tables),
  }));
}

function findGuestConfig(configs: GuestConfig[], guestCount: number): GuestConfig | null {
  return configs.find((c) => guestCount >= c.minGuests && guestCount <= c.maxGuests) ?? null;
}

async function getActiveReservationCountsByGuestRange(
  restaurantId: string,
  date: string,
  guestConfig: GuestConfig,
) {
  const { data, error } = await supabase
    .from("reservations")
    .select("time,status,guests")
    .eq("restaurant_id", restaurantId)
    .eq("date", date);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const status = normalizeReservationStatus(row.status);
    if (status !== "confirmed" && status !== "completed") continue;

    const time = normalizeTime(row.time);
    if (!time) continue;

    const rowGuests = parsePositiveInt(row.guests, 1, 1, 50);
    // Count only reservations that fall in the same guest range
    if (rowGuests >= guestConfig.minGuests && rowGuests <= guestConfig.maxGuests) {
      counts.set(time, (counts.get(time) ?? 0) + 1);
    }
  }

  return counts;
}

async function getSlotConfigsForDate(restaurantId: string, date: string) {
  const dayOfWeek = toDayOfWeek(date);
  if (dayOfWeek === null) {
    throw new Error("Invalid date. Use YYYY-MM-DD");
  }

  const defaultMaxTables = await getRestaurantTotalTables(restaurantId);

  const { data, error } = await supabase
    .from("restaurant_slot_configs")
    .select("slot_time,max_tables,is_active")
    .eq("restaurant_id", restaurantId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .order("slot_time", { ascending: true });

  if (error && isUndefinedTableError(error)) {
    const fallbackSlots = DEFAULT_BASE_SLOTS.map((time) => ({
      time,
      maxTables: defaultMaxTables,
    }));

    return {
      dayOfWeek,
      source: "default",
      slots: fallbackSlots,
    };
  }

  if (error) throw new Error(error.message);

  const rawSlots = (data ?? []).map((row: any) => ({
    time: normalizeTime(row.slot_time),
    maxTables: parsePositiveInt(row.max_tables, defaultMaxTables, 1, 999),
  }));

  const slots = rawSlots
    .filter((slot) => Boolean(slot.time))
    .map((slot) => ({ time: String(slot.time), maxTables: slot.maxTables }))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (slots.length === 0) {
    return {
      dayOfWeek,
      source: "default",
      slots: DEFAULT_BASE_SLOTS.map((time) => ({
        time,
        maxTables: defaultMaxTables,
      })),
    };
  }

  return {
    dayOfWeek,
    source: "configured",
    slots,
  };
}

async function getActiveReservationCounts(restaurantId: string, date: string, maxGuestsPerTable = 4) {
  const { data, error } = await supabase
    .from("reservations")
    .select("time,status,guests")
    .eq("restaurant_id", restaurantId)
    .eq("date", date);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const status = normalizeReservationStatus(row.status);
    if (status !== "confirmed" && status !== "completed") continue;

    const time = normalizeTime(row.time);
    if (!time) continue;

    const guestCount = parsePositiveInt(row.guests, 1, 1, 50);
    const tablesUsed = Math.ceil(guestCount / maxGuestsPerTable);
    counts.set(time, (counts.get(time) ?? 0) + tablesUsed);
  }

  return counts;
}

async function insertRestaurantWithFallback(
  ownerId: string | null,
  payload: Record<string, unknown>,
) {
  const currentPayload = {
    ...payload,
    owner_id: ownerId ?? null,
  } as Record<string, unknown>;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from("restaurants")
      .insert(currentPayload)
      .select("*")
      .single();

    if (!result.error) return result;
    if (!isUndefinedColumnError(result.error)) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (missingColumn && missingColumn in currentPayload) {
      delete currentPayload[missingColumn];
      continue;
    }

    if ("total_tables" in currentPayload) {
      delete currentPayload.total_tables;
      continue;
    }

    return result;
  }

  return supabase
    .from("restaurants")
    .insert(currentPayload)
    .select("*")
    .single();
}

async function updateRestaurantByIdWithFallback(
  restaurantId: string,
  payload: Record<string, unknown>,
) {
  const currentPayload = { ...payload } as Record<string, unknown>;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from("restaurants")
      .update(currentPayload)
      .eq("id", restaurantId)
      .select("*")
      .single();

    if (!result.error) return result;
    if (!isUndefinedColumnError(result.error)) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (missingColumn && missingColumn in currentPayload) {
      delete currentPayload[missingColumn];
      continue;
    }

    return result;
  }

  return supabase
    .from("restaurants")
    .update(currentPayload)
    .eq("id", restaurantId)
    .select("*")
    .single();
}

async function updateRestaurantWithFallback(
  userId: string,
  restaurantId: string,
  payload: Record<string, unknown>,
) {
  const currentPayload = { ...payload } as Record<string, unknown>;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from("restaurants")
      .update(currentPayload)
      .eq("id", restaurantId)
      .eq("owner_id", userId)
      .select("*")
      .single();

    if (!result.error) return result;
    if (!isUndefinedColumnError(result.error)) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (missingColumn && missingColumn in currentPayload) {
      delete currentPayload[missingColumn];
      // If payload is now empty after stripping, just fetch the current row
      if (Object.keys(currentPayload).length === 0) {
        return supabase.from("restaurants").select("*").eq("id", restaurantId).eq("owner_id", userId).single();
      }
      continue;
    }

    if ("total_tables" in currentPayload) {
      delete currentPayload.total_tables;
      if (Object.keys(currentPayload).length === 0) {
        return supabase.from("restaurants").select("*").eq("id", restaurantId).eq("owner_id", userId).single();
      }
      continue;
    }

    return result;
  }

  if (Object.keys(currentPayload).length === 0) {
    return supabase.from("restaurants").select("*").eq("id", restaurantId).eq("owner_id", userId).single();
  }

  return supabase
    .from("restaurants")
    .update(currentPayload)
    .eq("id", restaurantId)
    .eq("owner_id", userId)
    .select("*")
    .single();
}

app.get("/version", (_req, res) => {
  res.json({
    version: "0.1.0",
    env: process.env.NODE_ENV ?? "dev",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  });
});

app.post("/auth/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  try {
    const existingUser = await findAuthUserByEmail(email);
    if (!existingUser) {
      return res.status(404).json({
        message: "Email is not registered. Please check spelling and try again.",
      });
    }

    const requestedRedirectTo = String(req.body?.redirectTo ?? "").trim();
    const fallbackRedirectTo = `${APP_BASE_URL}/reset-password`;
    let redirectTo = fallbackRedirectTo;

    if (requestedRedirectTo) {
      try {
        const requestedUrl = new URL(requestedRedirectTo);
        const allowedOrigins = new Set<string>();

        for (const origin of WEB_ORIGINS) {
          try {
            allowedOrigins.add(new URL(origin).origin);
          } catch {
            // ignore malformed origin values
          }
        }

        try {
          allowedOrigins.add(new URL(APP_BASE_URL).origin);
        } catch {
          // ignore malformed app base url
        }

        if (!allowedOrigins.has(requestedUrl.origin)) {
          return res.status(400).json({ message: "Invalid reset redirect URL." });
        }

        redirectTo = requestedUrl.toString();
      } catch {
        return res.status(400).json({ message: "Invalid reset redirect URL." });
      }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.json({
      ok: true,
      message: "Password reset email sent. Please check your inbox.",
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message ?? "Unable to process forgot password request.",
    });
  }
});

app.get("/restaurants", async (_req, res) => {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("rating", { ascending: false });

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  const restaurants = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    location: r.location,
    rating: Number(r.rating),
    priceLevel: r.price_level,
    description: r.description,
    imageUrl: r.image_url,
    contactPhone: r.contact_phone ?? null,
    contactEmail: r.contact_email ?? null,
  }));

  res.json(restaurants);
});

app.get("/restaurants/:id", async (req, res) => {
  const restaurantId = String(req.params.id ?? "").trim();

  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (error || !data) {
    return res.status(404).json({ message: "Restaurant not found" });
  }

  let bestSellers: Array<{
    id: string;
    name: string;
    priceMinor: number;
    imageUrl: string | null;
    soldCount: number;
    stockQuantity: number;
  }> = [];

  const bestSellerResult = await supabase
    .from("restaurant_best_sellers")
    .select("id,name,price_minor,image_url,sold_count,stock_quantity,is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("sold_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(9);

  if (!bestSellerResult.error) {
    bestSellers = (bestSellerResult.data ?? []).map((row: any) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      priceMinor: Number(row.price_minor ?? 0),
      imageUrl: row.image_url ? String(row.image_url) : null,
      soldCount: Number(row.sold_count ?? 0),
      stockQuantity: Number(row.stock_quantity ?? 0),
    }));
  } else if (
    !isUndefinedTableError(bestSellerResult.error) &&
    !isUndefinedColumnError(bestSellerResult.error)
  ) {
    console.warn("Failed to load public best sellers:", bestSellerResult.error.message);
  }

  // Parse gallery_images — may be text[], jsonb, or absent
  let galleryImages: string[] = [];
  const rawGallery = (data as any).gallery_images;
  if (Array.isArray(rawGallery)) {
    galleryImages = rawGallery.filter((u: unknown) => typeof u === "string" && u.trim());
  } else if (typeof rawGallery === "string") {
    try { const parsed = JSON.parse(rawGallery); if (Array.isArray(parsed)) galleryImages = parsed.filter((u: unknown) => typeof u === "string" && u.trim()); } catch { /* ignore */ }
  }

  res.json({
    id: data.id,
    name: data.name,
    cuisine: data.cuisine,
    location: data.location,
    rating: Number(data.rating),
    priceLevel: data.price_level,
    description: data.description,
    imageUrl: data.image_url,
    contactPhone: data.contact_phone ?? null,
    contactEmail: data.contact_email ?? null,
    maxGuestsPerTable: parsePositiveInt(data.max_guests_per_table, 4, 1, 50),
    galleryImages,
    bestSellers,
  });
});

app.get("/restaurants/:id/slots", async (req, res) => {
  const restaurantId = req.params.id;
  const date = String(req.query.date ?? "");
  const guestsQuery = Number(req.query.guests) || 0;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD" });
  }

  try {
    const maxGuestsPerTable = await getRestaurantMaxGuestsPerTable(restaurantId);
    const slotConfigData = await getSlotConfigsForDate(restaurantId, date);
    const guestConfigs = await getRestaurantGuestConfigs(restaurantId);

    // If guest count is provided and guest configs exist, use guest-range-based availability
    const guestConfig = guestsQuery > 0 ? findGuestConfig(guestConfigs, guestsQuery) : null;

    let reservationCounts: Map<string, number>;
    let effectiveMaxTablesOverride: number | null = null;

    if (guestConfig) {
      // Count only reservations in this guest range
      reservationCounts = await getActiveReservationCountsByGuestRange(restaurantId, date, guestConfig);
      effectiveMaxTablesOverride = guestConfig.maxTables;
    } else {
      // Fallback: count all reservations using the old table-ratio logic
      reservationCounts = await getActiveReservationCounts(restaurantId, date, maxGuestsPerTable);
    }

    const slots = slotConfigData.slots.map((slot) => {
      const effectiveMax = effectiveMaxTablesOverride ?? slot.maxTables;
      const reservedTables = reservationCounts.get(slot.time) ?? 0;
      const remainingTables = Math.max(effectiveMax - reservedTables, 0);

      return {
        time: slot.time,
        available: remainingTables > 0,
        maxTables: effectiveMax,
        reservedTables,
        remainingTables,
      };
    });

    return res.json({
      restaurantId,
      date,
      dayOfWeek: slotConfigData.dayOfWeek,
      source: slotConfigData.source,
      maxGuestsPerTable,
      guestConfigs: guestConfigs.length > 0 ? guestConfigs : undefined,
      slots,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message ?? "Failed to load slot availability",
    });
  }
});

app.post("/reservations", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const { restaurantId, name, phone, date, time, guests } = req.body ?? {};

  const timeValue = normalizeTime(time);
  const guestCount = parsePositiveInt(guests, 1, 1, 50);

  if (!restaurantId || !name || !phone || !date || !timeValue) {
    return res.status(400).json({ message: "Missing required reservation fields" });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    const slotConfigData = await getSlotConfigsForDate(String(restaurantId), String(date));
    const slot = slotConfigData.slots.find((item) => item.time === timeValue);

    if (!slot) {
      return res.status(400).json({
        message: "Selected time is not available for this restaurant schedule.",
      });
    }

    // Check guest-range-based capacity if configs exist
    const guestConfigs = await getRestaurantGuestConfigs(String(restaurantId));
    const guestConfig = findGuestConfig(guestConfigs, guestCount);

    if (guestConfig) {
      // Use guest-range-based limits: count reservations in same guest range
      const rangeCounts = await getActiveReservationCountsByGuestRange(String(restaurantId), String(date), guestConfig);
      const reservedInRange = rangeCounts.get(timeValue) ?? 0;
      const remainingInRange = Math.max(guestConfig.maxTables - reservedInRange, 0);

      if (remainingInRange <= 0) {
        return res.status(409).json({
          message: `No tables available for ${guestCount} guest${guestCount === 1 ? "" : "s"} at this time. Only ${guestConfig.maxTables} table${guestConfig.maxTables === 1 ? " is" : "s are"} allocated for ${guestConfig.minGuests}-${guestConfig.maxGuests} guests.`,
        });
      }
    } else {
      // Fallback: use the old table-ratio logic
      const maxGuestsPerTable = await getRestaurantMaxGuestsPerTable(String(restaurantId));
      const tablesNeeded = Math.ceil(guestCount / maxGuestsPerTable);
      const counts = await getActiveReservationCounts(String(restaurantId), String(date), maxGuestsPerTable);
      const reservedTables = counts.get(timeValue) ?? 0;
      const remainingTables = Math.max(slot.maxTables - reservedTables, 0);

      if (tablesNeeded > remainingTables) {
        return res.status(409).json({
          message: remainingTables === 0
            ? "Selected time slot is already full. Please choose another time."
            : `Not enough capacity for ${guestCount} guests at this time. Please choose another time.`,
        });
      }
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        restaurant_id: restaurantId,
        user_id: userId,
        name: String(name).trim(),
        phone: String(phone).trim(),
        date: String(date),
        time: timeValue,
        guests: guestCount,
        status: "pending",
        payment_amount: defaultReservationFeeMinor(),
      })
      .select("*")
      .single();

    if (error) {
      if (isConflictError(error)) {
        return res.status(409).json({
          message: "Selected slot is no longer available. Please pick another.",
        });
      }
      return res.status(500).json({ message: error.message });
    }

    // Send notifications (non-critical)
    try {
      const { data: restRow } = await supabase
        .from("restaurants")
        .select("name,owner_id")
        .eq("id", restaurantId)
        .maybeSingle();
      const restaurantName = (restRow as any)?.name ?? "the restaurant";
      const vendorOwnerId = (restRow as any)?.owner_id ?? null;

      await createUserNotification({
        userId,
        title: "Reservation Placed",
        body: `Your reservation at ${restaurantName} for ${String(date)} at ${timeValue} has been placed. Waiting for vendor to confirm.`,
        type: "reservation_placed",
        link: "/my-reservations",
        data: { reservationId: data.id, restaurantId: String(restaurantId) },
      });

      // Notify vendor
      if (vendorOwnerId) {
        await createUserNotification({
          userId: vendorOwnerId,
          title: "New Reservation",
          body: `${name} booked a table for ${guestCount} guest${guestCount === 1 ? "" : "s"} on ${String(date)} at ${timeValue}.`,
          type: "vendor_reservation_placed",
          link: "/vendor/reservations",
          data: { reservationId: data.id, restaurantId: String(restaurantId) },
        });
      }

      // Notify admins
      await notifyAdmins({
        title: "New Reservation",
        body: `${name} booked at ${restaurantName} on ${String(date)} at ${timeValue} for ${guestCount} guest${guestCount === 1 ? "" : "s"}.`,
        type: "admin_reservation_placed",
        link: "/admin/reservations",
        data: { reservationId: data.id, restaurantId: String(restaurantId), customerName: name },
      });
    } catch {
      // notifications are non-critical
    }

    return res.status(201).json({
      id: data.id,
      restaurantId: data.restaurant_id,
      userId: data.user_id,
      name: data.name,
      phone: data.phone,
      date: String(data.date),
      time: String(data.time).slice(0, 5),
      guests: data.guests,
      status: data.status,
      createdAt: data.created_at,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message ?? "Failed to create reservation",
    });
  }
});

app.get("/me/reservations", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  res.json(data ?? []);
});

app.get("/me/notifications", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,body,type,link,data,is_read,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error && isUndefinedTableError(error)) {
    return res.json([]);
  }

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  return res.json(data ?? []);
});

app.post("/me/notifications/:notificationId/read", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const notificationId = String(req.params.notificationId ?? "");

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error && isUndefinedTableError(error)) {
    return res.status(404).json({ message: "Notifications not configured." });
  }

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  return res.json({ ok: true });
});

app.post("/me/notifications/read-all", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error && isUndefinedTableError(error)) {
    return res.status(404).json({ message: "Notifications not configured." });
  }

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  return res.json({ ok: true });
});
app.get("/me/reservations/:reservationId/payment", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const reservationId = String(req.params.reservationId ?? "");

  try {
    const reservation = await getReservationForUser(reservationId, userId);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    const restaurantName = await getRestaurantName(reservation.restaurant_id);

    const paymentAmountMinor =
      Number.isFinite(Number(reservation.payment_amount)) &&
      Number(reservation.payment_amount) > 0
        ? Number(reservation.payment_amount)
        : defaultReservationFeeMinor();

    return res.json({
      reservationId: reservation.id,
      restaurantId: reservation.restaurant_id,
      restaurantName,
      date: String(reservation.date),
      time: String(reservation.time).slice(0, 5),
      guests: Number(reservation.guests),
      reservationStatus: String(reservation.status ?? "pending"),
      paymentStatus: normalizePaymentStatus(reservation.payment_status),
      paymentAmountMinor,
      paymentAmount: paymentAmountMinor / 100,
      paymentProvider: reservation.payment_provider ?? "paymongo",
      checkoutSessionId: reservation.payment_checkout_session_id ?? null,
      paidAt: reservation.payment_paid_at ?? null,
      paymentReference: reservation.payment_reference ?? null,
      paymentError: reservation.payment_error ?? null,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error?.message ?? "Failed to load payment details",
    });
  }
});

app.post(
  "/me/reservations/:reservationId/payment/checkout",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const reservationId = String(req.params.reservationId ?? "");
    const rawMethod = String(req.body?.paymentMethod ?? "wallet").toLowerCase();

    try {
      const reservation = await getReservationForUser(reservationId, userId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      const reservationStatus = String(reservation.status ?? "pending").toLowerCase();
      if (reservationStatus === "cancelled") {
        return res
          .status(409)
          .json({ message: "Cancelled reservations cannot be paid." });
      }

      const currentPaymentStatus = normalizePaymentStatus(reservation.payment_status);
      if (currentPaymentStatus === "paid") {
        return res.status(409).json({ message: "Reservation is already paid." });
      }

      const amountMinor =
        Number.isFinite(Number(reservation.payment_amount)) &&
        Number(reservation.payment_amount) > 0
          ? Number(reservation.payment_amount)
          : defaultReservationFeeMinor();

      const providerLabel = rawMethod === "gcash" ? "gcash" : rawMethod === "gotyme" ? "gotyme" : "paymaya";

      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          payment_status: "paid",
          payment_provider: providerLabel,
          payment_amount: amountMinor,
          payment_paid_at: new Date().toISOString(),
          payment_error: null,
        })
        .eq("id", reservation.id)
        .eq("user_id", userId);

      if (updateError) {
        return res.status(500).json({ message: updateError.message });
      }

      // Notify admins about payment
      const { data: payRestRow } = await supabase
        .from("restaurants")
        .select("name,owner_id")
        .eq("id", reservation.restaurant_id)
        .maybeSingle();
      const payRestName = (payRestRow as any)?.name ?? "a restaurant";
      const payVendorId = (payRestRow as any)?.owner_id ?? null;

      // Notify vendor about payment
      if (payVendorId) {
        try {
          await createUserNotification({
            userId: payVendorId,
            title: "Payment Received",
            body: `${(reservation as any).name ?? "A customer"} paid for their reservation via ${providerLabel.toUpperCase()}.`,
            type: "vendor_payment_received",
            link: "/vendor/reservations",
            data: { reservationId: reservation.id, restaurantId: reservation.restaurant_id },
          });
        } catch { /* non-critical */ }
      }

      await notifyAdmins({
        title: "Payment Received",
        body: `${(reservation as any).name ?? "A customer"} paid for reservation at ${payRestName} via ${providerLabel.toUpperCase()}.`,
        type: "admin_payment_received",
        link: "/admin/reservations",
        data: { reservationId: reservation.id, restaurantId: reservation.restaurant_id },
      });

      return res.json({
        reservationId: reservation.id,
        paymentStatus: "paid",
        message: "Payment successful! Your reservation is now confirmed.",
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error?.message ?? "Failed to process payment",
      });
    }
  },
);

app.post(
  "/me/reservations/:reservationId/payment/confirm",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const reservationId = String(req.params.reservationId ?? "");

    try {
      if (!PAYMONGO_SECRET_KEY) {
        return res.status(500).json({
          message:
            "PAYMONGO_SECRET_KEY is missing. Configure it on the API server first.",
        });
      }

      const reservation = await getReservationForUser(reservationId, userId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      if (normalizePaymentStatus(reservation.payment_status) === "paid") {
        return res.json({
          reservationId,
          paymentStatus: "paid",
          reservationStatus: reservation.status,
          message: "Reservation payment is already completed.",
        });
      }

      const checkoutSessionId = String(
        reservation.payment_checkout_session_id ?? "",
      );
      if (!checkoutSessionId) {
        return res.status(400).json({
          message:
            "No checkout session found for this reservation. Start payment first.",
        });
      }

      const paymongoSession: any = await paymongoRequest(
        `/checkout_sessions/${checkoutSessionId}`,
      );

      const attributes = paymongoSession?.data?.attributes ?? {};
      const payments = Array.isArray(attributes?.payments)
        ? attributes.payments
        : [];

      const paidPayment = payments.find(
        (payment: any) =>
          String(payment?.attributes?.status ?? "").toLowerCase() === "paid",
      );

      const failedPayment = payments.find((payment: any) =>
        ["failed", "cancelled"].includes(
          String(payment?.attributes?.status ?? "").toLowerCase(),
        ),
      );

      const sessionStatus = String(attributes?.status ?? "").toLowerCase();
      const paymentIntentStatus = String(
        attributes?.payment_intent?.attributes?.status ??
          attributes?.payment_intent?.status ??
          "",
      ).toLowerCase();
      const isPaid =
        Boolean(paidPayment) ||
        ["paid", "completed", "succeeded"].includes(sessionStatus) ||
        ["paid", "succeeded", "awaiting_capture"].includes(paymentIntentStatus);

      if (isPaid) {
        const paidAtRaw = paidPayment?.attributes?.paid_at;
        const paidAt =
          typeof paidAtRaw === "number"
            ? new Date(paidAtRaw * 1000).toISOString()
            : typeof paidAtRaw === "string" && !Number.isNaN(Date.parse(paidAtRaw))
              ? new Date(paidAtRaw).toISOString()
              : new Date().toISOString();

        const nextReservationStatus =
          String(reservation.status ?? "pending").toLowerCase() === "pending"
            ? "confirmed"
            : reservation.status;

        const { error: updateError } = await supabase
          .from("reservations")
          .update({
            status: nextReservationStatus,
            payment_status: "paid",
            payment_reference:
              paidPayment?.id ?? reservation.payment_checkout_session_id,
            payment_paid_at: paidAt,
            payment_error: null,
          })
          .eq("id", reservation.id)
          .eq("user_id", userId);

        if (updateError) {
          return res.status(500).json({ message: updateError.message });
        }

        return res.json({
          reservationId: reservation.id,
          paymentStatus: "paid",
          reservationStatus: nextReservationStatus,
          paidAt,
          message: "Payment completed successfully.",
        });
      }

      const nextPaymentStatus = failedPayment ? "failed" : "processing";
      const errorMessage = failedPayment
        ? String(failedPayment?.attributes?.status ?? "Payment failed")
        : null;

      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          payment_status: nextPaymentStatus,
          payment_error: errorMessage,
        })
        .eq("id", reservation.id)
        .eq("user_id", userId);

      if (updateError) {
        return res.status(500).json({ message: updateError.message });
      }

      return res.json({
        reservationId: reservation.id,
        paymentStatus: nextPaymentStatus,
        reservationStatus: reservation.status,
        message:
          nextPaymentStatus === "failed"
            ? "Payment failed on provider."
            : "Payment is still processing.",
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error?.message ?? "Failed to confirm payment",
      });
    }
  },
);

app.post(
  "/me/reservations/:reservationId/payment/cancel",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const reservationId = String(req.params.reservationId ?? "");

    try {
      const reservation = await getReservationForUser(reservationId, userId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      const currentPaymentStatus = normalizePaymentStatus(reservation.payment_status);
      if (currentPaymentStatus === "paid") {
        return res.status(409).json({
          message: "Paid reservations cannot be marked as cancelled payment.",
        });
      }

      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          payment_status: "cancelled",
          payment_error: "Checkout cancelled by user",
        })
        .eq("id", reservation.id)
        .eq("user_id", userId);

      if (updateError) {
        return res.status(500).json({ message: updateError.message });
      }

      // Notify vendor and admins about payment cancellation
      const { data: cancelRestRow } = await supabase
        .from("restaurants")
        .select("name,owner_id")
        .eq("id", reservation.restaurant_id)
        .maybeSingle();
      const cancelRestName = (cancelRestRow as any)?.name ?? "a restaurant";
      const cancelVendorId = (cancelRestRow as any)?.owner_id ?? null;

      if (cancelVendorId) {
        try {
          await createUserNotification({
            userId: cancelVendorId,
            title: "Payment Cancelled",
            body: `${(reservation as any).name ?? "A customer"} cancelled their payment.`,
            type: "vendor_payment_cancelled",
            link: "/vendor/reservations",
            data: { reservationId: reservation.id, restaurantId: reservation.restaurant_id },
          });
        } catch { /* non-critical */ }
      }

      await notifyAdmins({
        title: "Payment Cancelled",
        body: `${(reservation as any).name ?? "A customer"} cancelled payment for reservation at ${cancelRestName}.`,
        type: "admin_payment_cancelled",
        link: "/admin/reservations",
        data: { reservationId: reservation.id, restaurantId: reservation.restaurant_id },
      });

      return res.json({
        reservationId: reservation.id,
        paymentStatus: "cancelled",
        message: "Payment attempt cancelled.",
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error?.message ?? "Failed to cancel payment attempt",
      });
    }
  },
);

app.get("/vendor/overview", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureVendorRole(userId);

    const restaurantIds = await getOwnedRestaurantIds(userId);
    if (restaurantIds.length === 0) {
      return res.json({
        restaurantCount: 0,
        reservationCount: 0,
        pendingCount: 0,
        confirmedCount: 0,
        completedCount: 0,
        paidCount: 0,
        totalPaidAmountMinor: 0,
      });
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("status,payment_status,payment_amount")
      .in("restaurant_id", restaurantIds);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    let pendingCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let paidCount = 0;
    let totalPaidAmountMinor = 0;

    for (const row of data ?? []) {
      const status = normalizeReservationStatus(row.status);
      const paymentStatus = normalizePaymentStatus(row.payment_status);

      if (status === "pending") pendingCount += 1;
      if (status === "confirmed") confirmedCount += 1;
      if (status === "completed") completedCount += 1;
      if (paymentStatus === "paid") {
        paidCount += 1;
      }
    }

    // Profit = paidCount × flat ₱20 fee (all goes to RESEATO)
    totalPaidAmountMinor = paidCount * defaultReservationFeeMinor();

    return res.json({
      restaurantCount: restaurantIds.length,
      reservationCount: (data ?? []).length,
      pendingCount,
      confirmedCount,
      completedCount,
      paidCount,
      totalPaidAmountMinor,
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Vendor access failed" });
  }
});

app.get("/vendor/restaurants", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureVendorRole(userId);

    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.json((data ?? []).map((row: any) => mapRestaurantRow(row)));
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load restaurants" });
  }
});

app.post("/vendor/restaurants", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureVendorRole(userId);

    const body = req.body ?? {};
    const name = String(body.name ?? "").trim();
    const cuisine = String(body.cuisine ?? "").trim();
    const location = String(body.location ?? "").trim();

    if (!name || !cuisine || !location) {
      return res.status(400).json({ message: "Name, cuisine, and location are required." });
    }

    const payload = {
      name,
      cuisine,
      location,
      rating: Number.isFinite(Number(body.rating)) ? Number(body.rating) : 0,
      price_level: parsePositiveInt(body.priceLevel, 1, 1, 4),
      description: String(body.description ?? "").trim() || null,
      image_url: String(body.imageUrl ?? "").trim() || null,
      contact_phone: String(body.contactPhone ?? "").trim() || null,
      contact_email: String(body.contactEmail ?? "").trim() || null,
      total_tables: parsePositiveInt(body.totalTables, 10, 1, 999),
      max_guests_per_table: parsePositiveInt(body.maxGuestsPerTable, 4, 1, 50),
    };

    const { data, error } = await insertRestaurantWithFallback(userId, payload);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.status(201).json(mapRestaurantRow(data));
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to create restaurant" });
  }
});

app.get("/vendor/restaurants/:restaurantId", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "");

  try {
    await ensureVendorRole(userId);
    const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.json(mapRestaurantRow(restaurant));
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load restaurant" });
  }
});

app.patch("/vendor/restaurants/:restaurantId", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "");

  try {
    await ensureVendorRole(userId);

    const body = req.body ?? {};
    const payload: Record<string, unknown> = {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      cuisine: typeof body.cuisine === "string" ? body.cuisine.trim() : undefined,
      location: typeof body.location === "string" ? body.location.trim() : undefined,
      description:
        typeof body.description === "string" ? body.description.trim() || null : undefined,
      image_url: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : undefined,
      contact_phone:
        typeof body.contactPhone === "string" ? body.contactPhone.trim() || null : undefined,
      contact_email:
        typeof body.contactEmail === "string" ? body.contactEmail.trim() || null : undefined,
      price_level:
        body.priceLevel === undefined
          ? undefined
          : parsePositiveInt(body.priceLevel, 1, 1, 4),
      total_tables:
        body.totalTables === undefined
          ? undefined
          : parsePositiveInt(body.totalTables, 10, 1, 999),
      max_guests_per_table:
        body.maxGuestsPerTable === undefined
          ? undefined
          : parsePositiveInt(body.maxGuestsPerTable, 4, 1, 50),
      rating:
        body.rating === undefined
          ? undefined
          : Math.min(5, Math.max(0, parseFloat(body.rating) || 0)),
      gallery_images:
        body.galleryImages === undefined
          ? undefined
          : Array.isArray(body.galleryImages)
            ? body.galleryImages.filter((u: unknown) => typeof u === "string" && (u as string).trim())
            : undefined,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
    });

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const { data, error } = await updateRestaurantWithFallback(
      userId,
      restaurantId,
      payload,
    );

    if (error) {
      console.error("[PATCH restaurant] error:", error.message, (error as any).details, (error as any).hint, (error as any).code);
      return res.status(500).json({ message: error.message });
    }

    if (!data) {
      console.error("[PATCH restaurant] no data returned");
      return res.status(404).json({ message: "Restaurant not found or not owned by you" });
    }

    return res.json(mapRestaurantRow(data));
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to update restaurant" });
  }
});

app.get("/vendor/restaurants/:restaurantId/slots", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "");
  const dayOfWeek = Number(req.query.dayOfWeek);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({ message: "dayOfWeek must be between 0 and 6" });
  }

  try {
    await ensureVendorRole(userId);

    const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const defaultMaxTables = parsePositiveInt(restaurant.total_tables, 1, 1, 999);

    const { data, error } = await supabase
      .from("restaurant_slot_configs")
      .select("slot_time,max_tables,is_active")
      .eq("restaurant_id", restaurantId)
      .eq("day_of_week", dayOfWeek)
      .order("slot_time", { ascending: true });

    if (error && isUndefinedTableError(error)) {
      return res.status(503).json({
        message:
          "Vendor slot config table is missing. Run the vendor SQL migration first.",
      });
    }

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const slots = (data ?? [])
      .map((row: any) => ({
        time: normalizeTime(row.slot_time),
        maxTables: parsePositiveInt(row.max_tables, defaultMaxTables, 1, 999),
        isActive: row.is_active !== false,
      }))
      .filter((slot) => Boolean(slot.time))
      .map((slot) => ({
        time: String(slot.time),
        maxTables: slot.maxTables,
        isActive: slot.isActive,
      }));

    return res.json({
      restaurantId,
      dayOfWeek,
      slots,
      defaultMaxTables,
      source: slots.length > 0 ? "configured" : "empty",
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load slot configs" });
  }
});

app.put("/vendor/restaurants/:restaurantId/slots", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "");

  try {
    await ensureVendorRole(userId);

    const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const dayOfWeek = Number(req.body?.dayOfWeek);
    const slotsInput = Array.isArray(req.body?.slots) ? req.body.slots : null;

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ message: "dayOfWeek must be between 0 and 6" });
    }

    if (!slotsInput) {
      return res.status(400).json({ message: "slots must be an array" });
    }

    const normalizedSlots: Array<{ slot_time: string; max_tables: number; is_active: boolean }> = [];

    for (const slot of slotsInput) {
      const time = normalizeTime(slot?.time);
      const maxTables = parsePositiveInt(slot?.maxTables, 1, 1, 999);
      const isActive = slot?.isActive !== false;

      if (!time) {
        return res.status(400).json({ message: "Each slot needs a valid time (HH:mm)." });
      }

      normalizedSlots.push({
        slot_time: time,
        max_tables: maxTables,
        is_active: isActive,
      });
    }

    const dedupedMap = new Map<string, { slot_time: string; max_tables: number; is_active: boolean }>();
    for (const slot of normalizedSlots) {
      dedupedMap.set(slot.slot_time, slot);
    }

    const dedupedSlots = Array.from(dedupedMap.values()).sort((a, b) =>
      a.slot_time.localeCompare(b.slot_time),
    );

    const { error: deleteError } = await supabase
      .from("restaurant_slot_configs")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("day_of_week", dayOfWeek);

    if (deleteError && isUndefinedTableError(deleteError)) {
      return res.status(503).json({
        message:
          "Vendor slot config table is missing. Run the vendor SQL migration first.",
      });
    }

    if (deleteError) {
      return res.status(500).json({ message: deleteError.message });
    }

    if (dedupedSlots.length > 0) {
      const { error: insertError } = await supabase
        .from("restaurant_slot_configs")
        .insert(
          dedupedSlots.map((slot) => ({
            restaurant_id: restaurantId,
            day_of_week: dayOfWeek,
            slot_time: slot.slot_time,
            max_tables: slot.max_tables,
            is_active: slot.is_active,
          })),
        );

      if (insertError) {
        return res.status(500).json({ message: insertError.message });
      }
    }

    return res.json({
      restaurantId,
      dayOfWeek,
      slots: dedupedSlots.map((slot) => ({
        time: slot.slot_time,
        maxTables: slot.max_tables,
        isActive: slot.is_active,
      })),
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to save slot configs" });
  }
});

// --- Guest capacity configs ---

app.get("/vendor/restaurants/:restaurantId/guest-configs", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "");

  try {
    await ensureVendorRole(userId);
    const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    const { data, error } = await supabase
      .from("restaurant_guest_configs")
      .select("id,min_guests,max_guests,max_tables")
      .eq("restaurant_id", restaurantId)
      .order("min_guests", { ascending: true });

    if (error && isUndefinedTableError(error)) return res.json([]);
    if (error) return res.status(500).json({ message: error.message });

    return res.json(
      (data ?? []).map((row: any) => ({
        id: row.id,
        minGuests: Number(row.min_guests),
        maxGuests: Number(row.max_guests),
        maxTables: Number(row.max_tables),
      })),
    );
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load guest configs" });
  }
});

app.put("/vendor/restaurants/:restaurantId/guest-configs", requireUser, async (req: any, res) => {
  const userId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "");

  try {
    await ensureVendorRole(userId);
    const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    const configs = Array.isArray(req.body?.configs) ? req.body.configs : null;
    if (!configs) return res.status(400).json({ message: "configs must be an array" });

    const normalized: Array<{ min_guests: number; max_guests: number; max_tables: number }> = [];

    for (const cfg of configs) {
      const minGuests = parsePositiveInt(cfg?.minGuests, 1, 1, 50);
      const maxGuests = parsePositiveInt(cfg?.maxGuests, minGuests, minGuests, 50);
      const maxTables = Math.max(0, Math.min(999, Number(cfg?.maxTables) || 0));

      normalized.push({ min_guests: minGuests, max_guests: maxGuests, max_tables: maxTables });
    }

    // Delete existing configs for this restaurant
    const { error: deleteError } = await supabase
      .from("restaurant_guest_configs")
      .delete()
      .eq("restaurant_id", restaurantId);

    if (deleteError && isUndefinedTableError(deleteError)) {
      return res.status(503).json({ message: "Guest config table missing. Run the SQL migration first." });
    }
    if (deleteError) return res.status(500).json({ message: deleteError.message });

    if (normalized.length > 0) {
      const { error: insertError } = await supabase
        .from("restaurant_guest_configs")
        .insert(
          normalized.map((cfg) => ({
            restaurant_id: restaurantId,
            min_guests: cfg.min_guests,
            max_guests: cfg.max_guests,
            max_tables: cfg.max_tables,
          })),
        );

      if (insertError) return res.status(500).json({ message: insertError.message });
    }

    // Return saved configs
    const { data: saved, error: readError } = await supabase
      .from("restaurant_guest_configs")
      .select("id,min_guests,max_guests,max_tables")
      .eq("restaurant_id", restaurantId)
      .order("min_guests", { ascending: true });

    if (readError) return res.status(500).json({ message: readError.message });

    return res.json(
      (saved ?? []).map((row: any) => ({
        id: row.id,
        minGuests: Number(row.min_guests),
        maxGuests: Number(row.max_guests),
        maxTables: Number(row.max_tables),
      })),
    );
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to save guest configs" });
  }
});

app.get("/vendor/reservations", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureVendorRole(userId);

    const restaurantIds = await getOwnedRestaurantIds(userId);
    if (restaurantIds.length === 0) return res.json([]);

    const restaurantIdFilter = String(req.query.restaurantId ?? "").trim();
    const statusFilter = String(req.query.status ?? "").trim().toLowerCase();
    const dateFilter = String(req.query.date ?? "").trim();

    let targetRestaurantIds = restaurantIds;
    if (restaurantIdFilter) {
      targetRestaurantIds = restaurantIds.includes(restaurantIdFilter)
        ? [restaurantIdFilter]
        : [];
    }

    if (targetRestaurantIds.length === 0) return res.json([]);

    let query = supabase
      .from("reservations")
      .select(
        "id,restaurant_id,user_id,name,phone,date,time,guests,status,created_at,payment_status,payment_amount,payment_provider,payment_paid_at,payment_reference,reviewed_by,reviewed_at,decline_reason",
      )
      .in("restaurant_id", targetRestaurantIds);

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (dateFilter) {
      query = query.eq("date", dateFilter);
    }

    const { data, error } = await query
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .order("created_at", { ascending: false });

    if (error && isUndefinedColumnError(error)) {
      let fallbackQuery = supabase
        .from("reservations")
        .select(
          "id,restaurant_id,user_id,name,phone,date,time,guests,status,created_at,payment_status,payment_amount,payment_provider,payment_paid_at,payment_reference",
        )
        .in("restaurant_id", targetRestaurantIds);

      if (statusFilter && statusFilter !== "all") {
        fallbackQuery = fallbackQuery.eq("status", statusFilter);
      }

      if (dateFilter) {
        fallbackQuery = fallbackQuery.eq("date", dateFilter);
      }

      const fallback = await fallbackQuery
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .order("created_at", { ascending: false });

      if (fallback.error) {
        return res.status(500).json({ message: fallback.error.message });
      }

      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("id,name,cuisine,location")
        .in("id", targetRestaurantIds);

      if (restaurantsError) {
        return res.status(500).json({ message: restaurantsError.message });
      }

      const restaurantMap = new Map<string, any>(
        (restaurantsData ?? []).map((restaurant: any) => [restaurant.id, restaurant]),
      );

      return res.json(
        (fallback.data ?? []).map((row: any) => ({
          ...row,
          time: String(row.time).slice(0, 5),
          reviewed_by: null,
          reviewed_at: null,
          decline_reason: null,
          restaurant: restaurantMap.get(row.restaurant_id) ?? null,
        })),
      );
    }

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const { data: restaurantsData, error: restaurantsError } = await supabase
      .from("restaurants")
      .select("id,name,cuisine,location")
      .in("id", targetRestaurantIds);

    if (restaurantsError) {
      return res.status(500).json({ message: restaurantsError.message });
    }

    const restaurantMap = new Map<string, any>(
      (restaurantsData ?? []).map((restaurant: any) => [restaurant.id, restaurant]),
    );

    return res.json(
      (data ?? []).map((row: any) => ({
        ...row,
        time: String(row.time).slice(0, 5),
        restaurant: restaurantMap.get(row.restaurant_id) ?? null,
      })),
    );
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load vendor reservations" });
  }
});

app.post(
  "/vendor/reservations/:reservationId/decision",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const reservationId = String(req.params.reservationId ?? "");

    try {
      await ensureVendorRole(userId);

      const actionRaw = String(req.body?.action ?? "").toLowerCase();
      const action: ReservationDecisionAction | null =
        actionRaw === "approve" || actionRaw === "decline" || actionRaw === "complete"
          ? (actionRaw as ReservationDecisionAction)
          : null;

      if (!action) {
        return res.status(400).json({ message: "action must be approve, decline, or complete" });
      }

      const { data: reservation, error: reservationError } = await supabase
        .from("reservations")
         .select("id,restaurant_id,user_id,date,time,status,payment_status,payment_amount,payment_reference")
        .eq("id", reservationId)
        .maybeSingle();

      if (reservationError) {
        return res.status(500).json({ message: reservationError.message });
      }

      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      const restaurant = await getRestaurantByIdForVendor(
        String(reservation.restaurant_id),
        userId,
      );

      if (!restaurant) {
        return res.status(403).json({ message: "You are not allowed to review this reservation." });
      }

      const status = normalizeReservationStatus(reservation.status);
      if (["cancelled", "completed", "declined"].includes(status) && action === "approve") {
        return res.status(409).json({
          message: "This reservation cannot be approved in its current state.",
        });
      }

      if (action === "complete" && status !== "confirmed") {
        return res.status(409).json({
          message: "Only confirmed reservations can be marked as completed.",
        });
      }

      const nowIso = new Date().toISOString();
      const declineReason =
        action === "decline"
          ? String(req.body?.reason ?? "").trim() || "Declined by restaurant"
          : null;

      const nextStatus = action === "approve" ? "confirmed" : action === "complete" ? "completed" : "declined";

      const payload = {
        status: nextStatus,
        reviewed_by: userId,
        reviewed_at: nowIso,
        decline_reason: declineReason,
      } as Record<string, unknown>;

      let updateResult = await supabase
        .from("reservations")
        .update(payload)
        .eq("id", reservationId)
        .select("*")
        .single();

      if (updateResult.error && isUndefinedColumnError(updateResult.error)) {
        updateResult = await supabase
          .from("reservations")
          .update({ status: payload.status })
          .eq("id", reservationId)
          .select("*")
          .single();
      }

            if (updateResult.error) {
        return res.status(500).json({ message: updateResult.error.message });
      }

      const updatedReservation = {
        ...(updateResult.data as any),
        time: String((updateResult.data as any).time).slice(0, 5),
      };

      const notificationTitle =
        action === "approve" ? "Reservation Confirmed" : "Reservation Declined";

      const notificationBody =
        action === "approve"
          ? `Your reservation at ${restaurant.name} has been confirmed. See you on ${String((reservation as any).date ?? "")}!`
          : `Your reservation at ${restaurant.name} was declined.${declineReason ? ` Reason: ${declineReason}` : ""}`;

      const notificationLink = "/my-reservations";

      await createUserNotification({
        userId: String((reservation as any).user_id),
        title: notificationTitle,
        body: notificationBody,
        type: action === "approve" ? "reservation_approved" : "reservation_declined",
        link: notificationLink,
        data: {
          reservationId,
          restaurantId: reservation.restaurant_id,
          paymentStatus: reservation.payment_status,
        },
      });

      const userLookup = await supabase.auth.admin.getUserById(String((reservation as any).user_id));
      const recipientEmail = userLookup.data?.user?.email ?? "";

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;color:#222">
          <h2>${notificationTitle}</h2>
          <p>${notificationBody}</p>
          <p>Date: ${String((reservation as any).date ?? "")}</p>
          <p>Time: ${String((reservation as any).time ?? "")}</p>
          <p><a href="${APP_BASE_URL}${notificationLink}">Open RESEATO</a></p>
        </div>
      `;

      await sendEmailNotification(recipientEmail, notificationTitle, emailHtml);

      // Notify admins about vendor decision
      const adminDecisionLabel = action === "approve" ? "approved" : action === "complete" ? "completed" : "declined";
      await notifyAdmins({
        title: `Reservation ${adminDecisionLabel.charAt(0).toUpperCase() + adminDecisionLabel.slice(1)}`,
        body: `Vendor ${adminDecisionLabel} a reservation at ${restaurant.name} for ${String((reservation as any).date ?? "")}.`,
        type: `admin_reservation_${adminDecisionLabel}`,
        link: "/admin/reservations",
        data: { reservationId, restaurantId: reservation.restaurant_id },
      });

      return res.json({
        reservation: updatedReservation,
        message:
          action === "approve"
            ? "Reservation approved. Customer has been notified."
            : "Reservation declined successfully.",
      });
    } catch (error: any) {
      const status = Number(error?.status ?? 500);
      return res.status(status).json({ message: error?.message ?? "Failed to update reservation" });
    }
  },
);

app.get("/vendor/charts", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureVendorRole(userId);

    const today = getTodayDateKeyUTC();
    const to = normalizeDateString(req.query.to) ?? today;
    const from = normalizeDateString(req.query.from) ?? shiftDateKey(to, -29);

    if (!from || !to) {
      return res.status(400).json({ message: "Invalid date range. Use YYYY-MM-DD." });
    }

    if (from > to) {
      return res.status(400).json({ message: "Invalid range: from must be on or before to." });
    }

    const keys = createDateRangeKeys(from, to);
    if (!keys.length) {
      return res
        .status(400)
        .json({ message: "Date range must be between 1 and 366 days." });
    }

    const dayMap = new Map<
      string,
      {
        date: string;
        total: number;
        completed: number;
        cancelled: number;
        pending: number;
        confirmed: number;
        paid: number;
        revenueMinor: number;
      }
    >();

    for (const key of keys) {
      dayMap.set(key, {
        date: key,
        total: 0,
        completed: 0,
        cancelled: 0,
        pending: 0,
        confirmed: 0,
        paid: 0,
        revenueMinor: 0,
      });
    }

    const restaurantIds = await getOwnedRestaurantIds(userId);

    if (restaurantIds.length > 0) {
      const { data, error } = await supabase
        .from("reservations")
        .select("date,status,payment_status,payment_amount")
        .in("restaurant_id", restaurantIds)
        .gte("date", from)
        .lte("date", to);

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      for (const row of data ?? []) {
        const dateKey = normalizeDateString((row as any).date);
        if (!dateKey) continue;

        const bucket = dayMap.get(dateKey);
        if (!bucket) continue;

        bucket.total += 1;

        const status = normalizeReservationStatus((row as any).status);
        if (status === "completed") bucket.completed += 1;
        if (status === "cancelled" || status === "declined") bucket.cancelled += 1;
        if (status === "pending") bucket.pending += 1;
        if (status === "confirmed") bucket.confirmed += 1;

        const paymentStatus = normalizePaymentStatus((row as any).payment_status);
        if (paymentStatus === "paid") {
          bucket.paid += 1;

          const amount = Number((row as any).payment_amount ?? 0);
          if (Number.isFinite(amount) && amount > 0) {
            bucket.revenueMinor += amount;
          }
        }
      }
    }

    const days = keys.map((key) => dayMap.get(key)!);

    const summaryBase = days.reduce(
      (acc, day) => {
        acc.totalReservations += day.total;
        acc.totalCompleted += day.completed;
        acc.totalCancelled += day.cancelled;
        acc.totalPending += day.pending;
        acc.totalConfirmed += day.confirmed;
        acc.totalPaid += day.paid;
        acc.totalRevenueMinor += day.revenueMinor;
        return acc;
      },
      {
        totalReservations: 0,
        totalCompleted: 0,
        totalCancelled: 0,
        totalPending: 0,
        totalConfirmed: 0,
        totalPaid: 0,
        totalRevenueMinor: 0,
      },
    );

    const completionRate =
      summaryBase.totalReservations > 0
        ? Number(
            ((summaryBase.totalCompleted / summaryBase.totalReservations) * 100).toFixed(2),
          )
        : 0;

    const cancellationRate =
      summaryBase.totalReservations > 0
        ? Number(
            ((summaryBase.totalCancelled / summaryBase.totalReservations) * 100).toFixed(2),
          )
        : 0;

    return res.json({
      from,
      to,
      days,
      summary: {
        ...summaryBase,
        completionRate,
        cancellationRate,
      },
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load vendor charts" });
  }
});

app.get("/vendor/best-sellers", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureVendorRole(userId);

    const restaurantIds = await getOwnedRestaurantIds(userId);
    if (restaurantIds.length === 0) return res.json([]);

    const restaurantIdFilter = String(req.query.restaurantId ?? "").trim();
    const activeFilter = String(req.query.active ?? "all").trim().toLowerCase();
    const limit = parsePositiveInt(req.query.limit, 120, 1, 500);

    let targetRestaurantIds = restaurantIds;
    if (restaurantIdFilter) {
      targetRestaurantIds = restaurantIds.includes(restaurantIdFilter)
        ? [restaurantIdFilter]
        : [];
    }

    if (targetRestaurantIds.length === 0) return res.json([]);

    let query = supabase
      .from("restaurant_best_sellers")
      .select(
        "id,restaurant_id,name,price_minor,image_url,stock_quantity,sold_count,is_active,created_by,created_at,updated_at",
      )
      .in("restaurant_id", targetRestaurantIds);

    if (activeFilter === "true" || activeFilter === "false") {
      query = query.eq("is_active", activeFilter === "true");
    }

    const { data, error } = await query
      .order("sold_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error && isUndefinedTableError(error)) {
      return res.status(503).json({
        message: "Best sellers table is missing. Run the vendor best-sellers SQL migration first.",
      });
    }

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const { data: restaurantsData, error: restaurantsError } = await supabase
      .from("restaurants")
      .select("id,name")
      .in("id", targetRestaurantIds);

    if (restaurantsError) {
      return res.status(500).json({ message: restaurantsError.message });
    }

    const restaurantNameById = new Map<string, string>(
      (restaurantsData ?? []).map((row: any) => [String(row.id), String(row.name ?? "")]),
    );

    return res.json(
      (data ?? []).map((row: any) =>
        mapBestSellerRow(row, restaurantNameById.get(String(row.restaurant_id)) ?? null),
      ),
    );
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load best sellers" });
  }
});

app.get(
  "/vendor/restaurants/:restaurantId/best-sellers",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const restaurantId = String(req.params.restaurantId ?? "").trim();

    try {
      await ensureVendorRole(userId);

      const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { data, error } = await supabase
        .from("restaurant_best_sellers")
        .select(
          "id,restaurant_id,name,price_minor,image_url,stock_quantity,sold_count,is_active,created_by,created_at,updated_at",
        )
        .eq("restaurant_id", restaurantId)
        .order("sold_count", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error && isUndefinedTableError(error)) {
        return res.status(503).json({
          message: "Best sellers table is missing. Run the vendor best-sellers SQL migration first.",
        });
      }

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      return res.json((data ?? []).map((row: any) => mapBestSellerRow(row, restaurant.name)));
    } catch (error: any) {
      const status = Number(error?.status ?? 500);
      return res.status(status).json({ message: error?.message ?? "Failed to load best sellers" });
    }
  },
);

app.post(
  "/vendor/restaurants/:restaurantId/best-sellers",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const restaurantId = String(req.params.restaurantId ?? "").trim();

    try {
      await ensureVendorRole(userId);

      const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const body = req.body ?? {};
      const name = String(body.name ?? "").trim();
      const priceMinor = parsePositiveInt(body.priceMinor, 0, 0, 1000000000);

      if (!name) {
        return res.status(400).json({ message: "Best seller name is required." });
      }

      if (priceMinor <= 0) {
        return res.status(400).json({ message: "priceMinor must be greater than 0." });
      }

      const payload = {
        restaurant_id: restaurantId,
        created_by: userId,
        name,
        price_minor: priceMinor,
        image_url: String(body.imageUrl ?? "").trim() || null,
        stock_quantity: parsePositiveInt(body.stockQuantity, 0, 0, 1000000),
        sold_count: parsePositiveInt(body.soldCount, 0, 0, 100000000),
        is_active: body.isActive !== false,
      };

      const { data, error } = await supabase
        .from("restaurant_best_sellers")
        .insert(payload)
        .select("*")
        .single();

      if (error && isUndefinedTableError(error)) {
        return res.status(503).json({
          message: "Best sellers table is missing. Run the vendor best-sellers SQL migration first.",
        });
      }

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      return res.status(201).json(mapBestSellerRow(data, restaurant.name));
    } catch (error: any) {
      const status = Number(error?.status ?? 500);
      return res.status(status).json({ message: error?.message ?? "Failed to create best seller" });
    }
  },
);

app.patch(
  "/vendor/restaurants/:restaurantId/best-sellers/:itemId",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const restaurantId = String(req.params.restaurantId ?? "").trim();
    const itemId = String(req.params.itemId ?? "").trim();

    try {
      await ensureVendorRole(userId);

      const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const body = req.body ?? {};
      const payload: Record<string, unknown> = {};

      if (body.name !== undefined) {
        const name = String(body.name ?? "").trim();
        if (!name) {
          return res.status(400).json({ message: "Best seller name cannot be empty." });
        }
        payload.name = name;
      }

      if (body.priceMinor !== undefined) {
        const priceMinor = parsePositiveInt(body.priceMinor, 0, 0, 1000000000);
        payload.price_minor = priceMinor;
      }

      if (body.imageUrl !== undefined) {
        payload.image_url = String(body.imageUrl ?? "").trim() || null;
      }

      if (body.stockQuantity !== undefined) {
        payload.stock_quantity = parsePositiveInt(body.stockQuantity, 0, 0, 1000000);
      }

      if (body.soldCount !== undefined) {
        payload.sold_count = parsePositiveInt(body.soldCount, 0, 0, 100000000);
      }

      if (body.isActive !== undefined) {
        payload.is_active = body.isActive !== false;
      }

      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const { data, error } = await supabase
        .from("restaurant_best_sellers")
        .update(payload)
        .eq("id", itemId)
        .eq("restaurant_id", restaurantId)
        .select("*")
        .maybeSingle();

      if (error && isUndefinedTableError(error)) {
        return res.status(503).json({
          message: "Best sellers table is missing. Run the vendor best-sellers SQL migration first.",
        });
      }

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      if (!data) {
        return res.status(404).json({ message: "Best seller item not found" });
      }

      return res.json(mapBestSellerRow(data, restaurant.name));
    } catch (error: any) {
      const status = Number(error?.status ?? 500);
      return res.status(status).json({ message: error?.message ?? "Failed to update best seller" });
    }
  },
);

app.delete(
  "/vendor/restaurants/:restaurantId/best-sellers/:itemId",
  requireUser,
  async (req: any, res) => {
    const userId = req.user.id;
    const restaurantId = String(req.params.restaurantId ?? "").trim();
    const itemId = String(req.params.itemId ?? "").trim();

    try {
      await ensureVendorRole(userId);

      const restaurant = await getRestaurantByIdForVendor(restaurantId, userId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      const { data, error } = await supabase
        .from("restaurant_best_sellers")
        .delete()
        .eq("id", itemId)
        .eq("restaurant_id", restaurantId)
        .select("id")
        .maybeSingle();

      if (error && isUndefinedTableError(error)) {
        return res.status(503).json({
          message: "Best sellers table is missing. Run the vendor best-sellers SQL migration first.",
        });
      }

      if (error) {
        return res.status(500).json({ message: error.message });
      }

      if (!data) {
        return res.status(404).json({ message: "Best seller item not found" });
      }

      return res.json({ ok: true, id: itemId });
    } catch (error: any) {
      const status = Number(error?.status ?? 500);
      return res.status(status).json({ message: error?.message ?? "Failed to delete best seller" });
    }
  },
);

app.get("/admin/overview", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureAdminRole(userId);

    const [profilesResult, restaurantsCountResult, reservationsResult] = await Promise.all([
      supabase.from("profiles").select("id,role"),
      supabase.from("restaurants").select("id", { count: "exact", head: true }),
      supabase
        .from("reservations")
        .select("id,status,payment_status,payment_amount", { count: "exact" }),
    ]);

    if (profilesResult.error) {
      return res.status(500).json({ message: profilesResult.error.message });
    }

    if (restaurantsCountResult.error) {
      return res.status(500).json({ message: restaurantsCountResult.error.message });
    }

    if (reservationsResult.error) {
      return res.status(500).json({ message: reservationsResult.error.message });
    }

    const profiles = profilesResult.data ?? [];
    const reservations = reservationsResult.data ?? [];

    let vendors = 0;
    let customers = 0;
    let admins = 0;

    for (const profile of profiles) {
      const role = String((profile as any).role ?? "customer").toLowerCase();
      if (role === "admin") {
        admins += 1;
      } else if (["vendor", "owner", "manager"].includes(role)) {
        vendors += 1;
      } else {
        customers += 1;
      }
    }

    let pendingReservations = 0;
    let confirmedReservations = 0;
    let completedReservations = 0;
    let paidReservations = 0;
    let totalPaidAmountMinor = 0;

    for (const reservation of reservations) {
      const status = normalizeReservationStatus((reservation as any).status);
      const paymentStatus = normalizePaymentStatus((reservation as any).payment_status);

      if (status === "pending") pendingReservations += 1;
      if (status === "confirmed") confirmedReservations += 1;
      if (status === "completed") completedReservations += 1;

      if (paymentStatus === "paid") {
        paidReservations += 1;
      }
    }

    // Profit = paidReservations × flat ₱20 fee (all goes to RESEATO)
    totalPaidAmountMinor = paidReservations * defaultReservationFeeMinor();

    return res.json({
      users: profiles.length,
      vendors,
      customers,
      admins,
      restaurants: Number(restaurantsCountResult.count ?? 0),
      reservations: Number(reservationsResult.count ?? reservations.length),
      pendingReservations,
      confirmedReservations,
      completedReservations,
      paidReservations,
      totalPaidAmountMinor,
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load admin overview" });
  }
});

app.get("/admin/charts", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureAdminRole(userId);

    const today = getTodayDateKeyUTC();
    const to = normalizeDateString(req.query.to) ?? today;
    const from = normalizeDateString(req.query.from) ?? shiftDateKey(to, -29);

    if (!from || !to) {
      return res.status(400).json({ message: "Invalid date range. Use YYYY-MM-DD." });
    }

    if (from > to) {
      return res.status(400).json({ message: "Invalid range: from must be on or before to." });
    }

    const keys = createDateRangeKeys(from, to);
    if (!keys.length) {
      return res
        .status(400)
        .json({ message: "Date range must be between 1 and 366 days." });
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("date,status,payment_status,payment_amount")
      .gte("date", from)
      .lte("date", to);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const dayMap = new Map<
      string,
      {
        date: string;
        total: number;
        completed: number;
        cancelled: number;
        pending: number;
        confirmed: number;
        paid: number;
        revenueMinor: number;
      }
    >();

    for (const key of keys) {
      dayMap.set(key, {
        date: key,
        total: 0,
        completed: 0,
        cancelled: 0,
        pending: 0,
        confirmed: 0,
        paid: 0,
        revenueMinor: 0,
      });
    }

    for (const row of data ?? []) {
      const dateKey = normalizeDateString((row as any).date);
      if (!dateKey) continue;

      const bucket = dayMap.get(dateKey);
      if (!bucket) continue;

      bucket.total += 1;

      const status = normalizeReservationStatus((row as any).status);
      if (status === "completed") bucket.completed += 1;
      if (status === "cancelled" || status === "declined") bucket.cancelled += 1;
      if (status === "pending") bucket.pending += 1;
      if (status === "confirmed") bucket.confirmed += 1;

      const paymentStatus = normalizePaymentStatus((row as any).payment_status);
      if (paymentStatus === "paid") {
        bucket.paid += 1;

        const amount = Number((row as any).payment_amount ?? 0);
        if (Number.isFinite(amount) && amount > 0) {
          bucket.revenueMinor += amount;
        }
      }
    }

    const days = keys.map((key) => dayMap.get(key)!);

    const summaryBase = days.reduce(
      (acc, day) => {
        acc.totalReservations += day.total;
        acc.totalCompleted += day.completed;
        acc.totalCancelled += day.cancelled;
        acc.totalPaid += day.paid;
        acc.totalRevenueMinor += day.revenueMinor;
        return acc;
      },
      {
        totalReservations: 0,
        totalCompleted: 0,
        totalCancelled: 0,
        totalPaid: 0,
        totalRevenueMinor: 0,
      },
    );

    const completionRate =
      summaryBase.totalReservations > 0
        ? Number(
            ((summaryBase.totalCompleted / summaryBase.totalReservations) * 100).toFixed(2),
          )
        : 0;

    const cancellationRate =
      summaryBase.totalReservations > 0
        ? Number(
            ((summaryBase.totalCancelled / summaryBase.totalReservations) * 100).toFixed(2),
          )
        : 0;

    return res.json({
      from,
      to,
      days,
      summary: {
        ...summaryBase,
        completionRate,
        cancellationRate,
      },
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load admin charts" });
  }
});

app.get("/admin/users", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureAdminRole(userId);

    const search = String(req.query.search ?? "").trim();
    const roleFilter = String(req.query.role ?? "").trim().toLowerCase();
    const limit = parsePositiveInt(req.query.limit, 50, 1, 200);
    const offset = Math.max(0, parsePositiveInt(req.query.offset, 0, 0, 100000));

    let query = supabase
      .from("profiles")
      .select("id,role,full_name,created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (roleFilter && roleFilter !== "all") {
      query = query.eq("role", roleFilter);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%`);
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      return res.status(500).json({ message: profilesError.message });
    }

    const authUsersResult = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const users = authUsersResult.data?.users ?? [];
    const emailById = new Map<string, string>();

    for (const authUser of users) {
      emailById.set(String(authUser.id), String(authUser.email ?? ""));
    }

    const mapped = (profiles ?? []).map((profile: any) => ({
      id: profile.id,
      role: String(profile.role ?? "customer"),
      fullName: profile.full_name ?? null,
      createdAt: profile.created_at ?? null,
      email: emailById.get(String(profile.id)) ?? null,
    }));

    return res.json(mapped);
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load admin users" });
  }
});

app.patch("/admin/users/:targetUserId/role", requireUser, async (req: any, res) => {
  const actorId = req.user.id;
  const targetUserId = String(req.params.targetUserId ?? "").trim();

  try {
    await ensureAdminRole(actorId);

    if (!targetUserId) {
      return res.status(400).json({ message: "targetUserId is required" });
    }

    const nextRoleRaw = String(req.body?.role ?? "").trim().toLowerCase();
    const nextRole = ["customer", "vendor", "admin"].includes(nextRoleRaw)
      ? nextRoleRaw
      : null;

    if (!nextRole) {
      return res.status(400).json({ message: "role must be customer, vendor, or admin" });
    }

    const { error: profileUpdateError } = await supabase.from("profiles").upsert(
      {
        id: targetUserId,
        role: nextRole,
      },
      {
        onConflict: "id",
      },
    );

    if (profileUpdateError) {
      return res.status(500).json({ message: profileUpdateError.message });
    }

    const currentAuth = await supabase.auth.admin.getUserById(targetUserId);
    if (!currentAuth.error && currentAuth.data?.user) {
      const existingMetadata = (currentAuth.data.user.user_metadata ?? {}) as Record<string, unknown>;
      const mergedMetadata = {
        ...existingMetadata,
        role: nextRole,
      };

      const metadataUpdate = await supabase.auth.admin.updateUserById(targetUserId, {
        user_metadata: mergedMetadata,
      });

      if (metadataUpdate.error) {
        return res.status(500).json({ message: metadataUpdate.error.message });
      }
    }

    await writeAdminAuditLog({
      actorId,
      action: "user_role_update",
      targetType: "user",
      targetId: targetUserId,
      payload: {
        role: nextRole,
      },
    });

    return res.json({
      ok: true,
      targetUserId,
      role: nextRole,
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to update user role" });
  }
});

app.patch("/admin/users/:targetUserId/details", requireUser, async (req: any, res) => {
  const actorId = req.user.id;
  const targetUserId = String(req.params.targetUserId ?? "").trim();

  try {
    await ensureAdminRole(actorId);

    if (!targetUserId) {
      return res.status(400).json({ message: "targetUserId is required" });
    }

    const fullName = req.body?.fullName != null ? String(req.body.fullName).trim() : undefined;
    const email = req.body?.email != null ? String(req.body.email).trim() : undefined;

    if (fullName === undefined && email === undefined) {
      return res.status(400).json({ message: "At least one field (fullName or email) is required." });
    }

    // Update profile table
    if (fullName !== undefined) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", targetUserId);

      if (profileError) {
        return res.status(500).json({ message: profileError.message });
      }
    }

    // Update auth user metadata & email
    const currentAuth = await supabase.auth.admin.getUserById(targetUserId);
    if (!currentAuth.error && currentAuth.data?.user) {
      const existingMetadata = (currentAuth.data.user.user_metadata ?? {}) as Record<string, unknown>;
      const updatePayload: Record<string, unknown> = {};

      if (fullName !== undefined) {
        updatePayload.user_metadata = { ...existingMetadata, full_name: fullName };
      }
      if (email !== undefined) {
        updatePayload.email = email;
      }

      const authUpdate = await supabase.auth.admin.updateUserById(targetUserId, updatePayload);
      if (authUpdate.error) {
        return res.status(500).json({ message: authUpdate.error.message });
      }
    }

    await writeAdminAuditLog({
      actorId,
      action: "user_details_update",
      targetType: "user",
      targetId: targetUserId,
      payload: { fullName, email },
    });

    return res.json({ ok: true, targetUserId });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to update user details" });
  }
});

app.delete("/admin/users/:targetUserId", requireUser, async (req: any, res) => {
  const actorId = req.user.id;
  const targetUserId = String(req.params.targetUserId ?? "").trim();

  if (!targetUserId) {
    return res.status(400).json({ message: "targetUserId is required" });
  }

  if (targetUserId === actorId) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }

  try {
    await ensureAdminRole(actorId);

    // Check user exists
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", targetUserId)
      .maybeSingle();

    // Delete user's reservations
    await supabase.from("reservations").delete().eq("user_id", targetUserId);

    // Unassign restaurants owned by this user
    await supabase
      .from("restaurants")
      .update({ owner_id: null })
      .eq("owner_id", targetUserId);

    // Delete profile
    await supabase.from("profiles").delete().eq("id", targetUserId);

    // Delete auth user via admin API
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      return res.status(500).json({ message: authDeleteError.message });
    }

    await writeAdminAuditLog({
      actorId,
      action: "user_delete",
      targetType: "user",
      targetId: targetUserId,
      payload: {
        fullName: (targetProfile as any)?.full_name ?? null,
        role: (targetProfile as any)?.role ?? null,
      },
    });

    return res.json({ ok: true, targetUserId });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({
      message: error?.message ?? "Failed to delete user",
    });
  }
});

app.get("/admin/restaurants", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureAdminRole(userId);

    const search = String(req.query.search ?? "").trim();
    const ownerId = String(req.query.ownerId ?? "").trim();
    const limit = parsePositiveInt(req.query.limit, 50, 1, 200);
    const offset = Math.max(0, parsePositiveInt(req.query.offset, 0, 0, 100000));

    let query = supabase
      .from("restaurants")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,cuisine.ilike.%${search}%,location.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const rows = (data ?? []) as any[];
    const ownerIds = rows
      .map((row) => String(row.owner_id ?? "").trim())
      .filter(Boolean);
    const ownerMap = await getUserIdentityMap(ownerIds);

    return res.json(
      rows.map((row) =>
        mapRestaurantRow(
          row,
          row.owner_id ? ownerMap.get(String(row.owner_id)) ?? null : null,
        ),
      ),
    );
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load admin restaurants" });
  }
});


app.post("/admin/restaurants", requireUser, async (req: any, res) => {
  const actorId = req.user.id;

  try {
    await ensureAdminRole(actorId);

    const body = req.body ?? {};
    const name = String(body.name ?? "").trim();
    const cuisine = String(body.cuisine ?? "").trim();
    const location = String(body.location ?? "").trim();

    if (!name || !cuisine || !location) {
      return res.status(400).json({ message: "Name, cuisine, and location are required." });
    }

    const ownerIdRaw = String(body.ownerId ?? "").trim();
    const ownerId = ownerIdRaw || null;

    if (ownerId) {
      const ownerRole = await getUserRole(ownerId);
      const isAssignableVendor =
        ownerRole === "vendor" || ownerRole === "owner" || ownerRole === "manager";

      if (!isAssignableVendor) {
        return res.status(400).json({
          message: "Assigned owner must be a vendor account.",
        });
      }

      const ownerLookup = await supabase.auth.admin.getUserById(ownerId);
      if (ownerLookup.error || !ownerLookup.data?.user) {
        return res.status(400).json({ message: "Assigned vendor account was not found." });
      }
    }

    const payload = {
      name,
      cuisine,
      location,
      rating: Number.isFinite(Number(body.rating)) ? Number(body.rating) : 0,
      price_level: parsePositiveInt(body.priceLevel, 1, 1, 4),
      description: String(body.description ?? "").trim() || null,
      image_url: String(body.imageUrl ?? "").trim() || null,
      contact_phone: String(body.contactPhone ?? "").trim() || null,
      contact_email: String(body.contactEmail ?? "").trim() || null,
      total_tables: parsePositiveInt(body.totalTables, 10, 1, 999),
    };

    const { data, error } = await insertRestaurantWithFallback(ownerId, payload);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const created = data as any;
    const ownerMap = await getUserIdentityMap(
      created?.owner_id ? [String(created.owner_id)] : [],
    );

    await writeAdminAuditLog({
      actorId,
      action: "restaurant_create",
      targetType: "restaurant",
      targetId: String(created.id),
      payload: {
        name,
        cuisine,
        location,
        ownerId,
      },
    });

    return res.status(201).json(
      mapRestaurantRow(
        created,
        created?.owner_id ? ownerMap.get(String(created.owner_id)) ?? null : null,
      ),
    );
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to create restaurant" });
  }
});

app.delete("/admin/restaurants/:restaurantId", requireUser, async (req: any, res) => {
  const actorId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "").trim();

  if (!restaurantId) {
    return res.status(400).json({ message: "restaurantId is required" });
  }

  try {
    await ensureAdminRole(actorId);

    // Check restaurant exists
    const { data: existing, error: fetchError } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Delete related records first to avoid FK violations
    await supabase.from("restaurant_slot_configs").delete().eq("restaurant_id", restaurantId);
    await supabase.from("best_sellers").delete().eq("restaurant_id", restaurantId);

    // Delete reservations for this restaurant
    await supabase.from("reservations").delete().eq("restaurant_id", restaurantId);

    // Delete the restaurant
    const { error: deleteError } = await supabase
      .from("restaurants")
      .delete()
      .eq("id", restaurantId);

    if (deleteError) {
      return res.status(500).json({ message: deleteError.message });
    }

    await writeAdminAuditLog({
      actorId,
      action: "restaurant_delete",
      targetType: "restaurant",
      targetId: restaurantId,
      payload: { name: (existing as any).name },
    });

    return res.json({ ok: true, restaurantId });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({
      message: error?.message ?? "Failed to delete restaurant",
    });
  }
});

app.patch("/admin/restaurants/:restaurantId/owner", requireUser, async (req: any, res) => {
  const actorId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "").trim();

  if (!restaurantId) {
    return res.status(400).json({ message: "restaurantId is required" });
  }

  try {
    await ensureAdminRole(actorId);

    const ownerIdRaw = String(req.body?.ownerId ?? "").trim();
    const ownerId = ownerIdRaw || null;

    if (ownerId) {
      const ownerRole = await getUserRole(ownerId);
      const isAssignableVendor =
        ownerRole === "vendor" || ownerRole === "owner" || ownerRole === "manager";

      if (!isAssignableVendor) {
        return res.status(400).json({
          message: "Assigned owner must be a vendor account.",
        });
      }

      const ownerLookup = await supabase.auth.admin.getUserById(ownerId);
      if (ownerLookup.error || !ownerLookup.data?.user) {
        return res.status(400).json({ message: "Assigned vendor account was not found." });
      }
    }

    const { data, error } = await updateRestaurantByIdWithFallback(restaurantId, {
      owner_id: ownerId,
    });

    if (error && isUndefinedColumnError(error)) {
      return res.status(500).json({
        message: "Restaurant owner assignment is unavailable (owner_id column missing).",
      });
    }

    if (error) {
      if (String(error?.code ?? "").toUpperCase() === "PGRST116") {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      return res.status(500).json({ message: error.message });
    }

    const updated = data as any;
    const ownerMap = await getUserIdentityMap(
      updated?.owner_id ? [String(updated.owner_id)] : [],
    );

    await writeAdminAuditLog({
      actorId,
      action: "restaurant_owner_assign",
      targetType: "restaurant",
      targetId: restaurantId,
      payload: {
        ownerId,
      },
    });

    return res.json(
      mapRestaurantRow(
        updated,
        updated?.owner_id ? ownerMap.get(String(updated.owner_id)) ?? null : null,
      ),
    );
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({
      message: error?.message ?? "Failed to update restaurant owner",
    });
  }
});

app.patch("/admin/restaurants/:restaurantId/featured", requireUser, async (req: any, res) => {
  const actorId = req.user.id;
  const restaurantId = String(req.params.restaurantId ?? "").trim();

  if (!restaurantId) {
    return res.status(400).json({ message: "restaurantId is required" });
  }

  try {
    await ensureAdminRole(actorId);

    const isFeatured = Boolean(req.body?.isFeatured);

    const { data, error } = await supabase
      .from("restaurants")
      .update({ is_featured: isFeatured })
      .eq("id", restaurantId)
      .select("*")
      .single();

    if (error) {
      if (isUndefinedColumnError(error)) {
        return res.status(500).json({
          message:
            "The is_featured column is not recognized yet. Please run: NOTIFY pgrst, 'reload schema'; in the Supabase SQL editor.",
        });
      }
      if (String(error?.code ?? "").toUpperCase() === "PGRST116") {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      console.error("[featured-toggle] Supabase error:", error.code, error.message);
      return res.status(500).json({ message: error.message });
    }

    try {
      await writeAdminAuditLog({
        actorId,
        action: "restaurant_featured_toggle",
        targetType: "restaurant",
        targetId: restaurantId,
        payload: { isFeatured },
      });
    } catch (auditErr) {
      console.error("[featured-toggle] Audit log write failed (non-critical):", auditErr);
    }

    return res.json(mapRestaurantRow(data));
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({
      message: error?.message ?? "Failed to toggle featured status",
    });
  }
});

app.get("/admin/reservations", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureAdminRole(userId);

    const statusFilter = String(req.query.status ?? "").trim().toLowerCase();
    const paymentStatusFilter = String(req.query.paymentStatus ?? "").trim().toLowerCase();
    const restaurantId = String(req.query.restaurantId ?? "").trim();
    const dateFilter = String(req.query.date ?? "").trim();
    const limit = parsePositiveInt(req.query.limit, 80, 1, 300);
    const offset = Math.max(0, parsePositiveInt(req.query.offset, 0, 0, 100000));

    let query = supabase
      .from("reservations")
      .select(
        "id,restaurant_id,user_id,name,phone,date,time,guests,status,created_at,payment_status,payment_amount,payment_provider,payment_paid_at,payment_reference,reviewed_by,reviewed_at,decline_reason",
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (paymentStatusFilter && paymentStatusFilter !== "all") {
      query = query.eq("payment_status", paymentStatusFilter);
    }

    if (restaurantId) {
      query = query.eq("restaurant_id", restaurantId);
    }

    if (dateFilter) {
      query = query.eq("date", dateFilter);
    }

    const { data, error } = await query;

    const enrichRowsWithNames = async (rows: any[]) => {
      const normalizedRows = rows.map((row) => ({
        ...row,
        time: normalizeTime(row.time) ?? String(row.time ?? "").slice(0, 5),
      }));

      const restaurantIds = Array.from(
        new Set(
          normalizedRows
            .map((row) => String(row.restaurant_id ?? "").trim())
            .filter(Boolean),
        ),
      );

      const userIds = Array.from(
        new Set(
          normalizedRows
            .map((row) => String(row.user_id ?? "").trim())
            .filter(Boolean),
        ),
      );

      const restaurantNameById = new Map<string, string>();
      if (restaurantIds.length > 0) {
        const restaurantsLookup = await supabase
          .from("restaurants")
          .select("id,name")
          .in("id", restaurantIds);

        if (!restaurantsLookup.error) {
          for (const row of restaurantsLookup.data ?? []) {
            restaurantNameById.set(String((row as any).id), String((row as any).name ?? ""));
          }
        }
      }

      const userIdentityById = await getUserIdentityMap(userIds);

      return normalizedRows.map((row) => {
        const restaurantId = String(row.restaurant_id ?? "");
        const userId = String(row.user_id ?? "");
        const userIdentity = userIdentityById.get(userId);

        return {
          ...row,
          restaurant_name: restaurantNameById.get(restaurantId) ?? restaurantId,
          user_name: userIdentity?.name ?? userId,
          user_email: userIdentity?.email ?? null,
        };
      });
    };

    if (error && isUndefinedColumnError(error)) {
      const fallback = await supabase
        .from("reservations")
        .select(
          "id,restaurant_id,user_id,name,phone,date,time,guests,status,created_at,payment_status,payment_amount,payment_provider,payment_paid_at,payment_reference",
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (fallback.error) {
        return res.status(500).json({ message: fallback.error.message });
      }

      const rows = (fallback.data ?? []).map((row: any) => ({
        ...row,
        reviewed_by: null,
        reviewed_at: null,
        decline_reason: null,
      }));

      return res.json(await enrichRowsWithNames(rows));
    }

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.json(await enrichRowsWithNames((data ?? []) as any[]));
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load admin reservations" });
  }
});

app.patch("/admin/reservations/:reservationId/status", requireUser, async (req: any, res) => {
  const actorId = req.user.id;
  const reservationId = String(req.params.reservationId ?? "").trim();

  try {
    await ensureAdminRole(actorId);

    if (!reservationId) {
      return res.status(400).json({ message: "reservationId is required" });
    }

    const nextStatusRaw = String(req.body?.status ?? "").trim().toLowerCase();
    const nextStatus = ["pending", "confirmed", "declined", "cancelled", "completed"].includes(nextStatusRaw)
      ? nextStatusRaw
      : null;

    if (!nextStatus) {
      return res.status(400).json({ message: "Invalid reservation status" });
    }

    const reason = String(req.body?.reason ?? "").trim();
    const payload: Record<string, unknown> = {
      status: nextStatus,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      decline_reason: nextStatus === "declined" ? reason || "Declined by admin" : null,
    };

    let updateResult = await supabase
      .from("reservations")
      .update(payload)
      .eq("id", reservationId)
      .select("*")
      .single();

    if (updateResult.error && isUndefinedColumnError(updateResult.error)) {
      updateResult = await supabase
        .from("reservations")
        .update({ status: nextStatus })
        .eq("id", reservationId)
        .select("*")
        .single();
    }

    if (updateResult.error) {
      return res.status(500).json({ message: updateResult.error.message });
    }

    await writeAdminAuditLog({
      actorId,
      action: "reservation_status_update",
      targetType: "reservation",
      targetId: reservationId,
      payload: {
        status: nextStatus,
        reason: reason || null,
      },
    });

    return res.json({
      reservation: {
        ...(updateResult.data as any),
        time: String((updateResult.data as any).time).slice(0, 5),
      },
      message: "Reservation status updated.",
    });
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to update reservation status" });
  }
});

app.get("/admin/audit-logs", requireUser, async (req: any, res) => {
  const userId = req.user.id;

  try {
    await ensureAdminRole(userId);

    const limit = parsePositiveInt(req.query.limit, 60, 1, 300);

    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("id,actor_id,action,target_type,target_id,payload,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error && isUndefinedTableError(error)) {
      return res.json([]);
    }

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.json(data ?? []);
  } catch (error: any) {
    const status = Number(error?.status ?? 500);
    return res.status(status).json({ message: error?.message ?? "Failed to load admin audit logs" });
  }
});

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});









