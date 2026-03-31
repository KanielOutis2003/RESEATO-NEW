import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Loader2,
  MinusCircle,
  PlusCircle,
  Save,
  Settings,
  Users,
} from "lucide-react";
import {
  getVendorRestaurant,
  getVendorRestaurantSlots,
  saveVendorRestaurantSlots,
  getVendorGuestConfigs,
  saveVendorGuestConfigs,
  VendorRestaurant,
  VendorSlotConfig,
  GuestCapacityConfigInput,
} from "../lib/api/vendor.api";
import { ApiError } from "../lib/api/client";
import { useAuth } from "../lib/auth/useAuth";
import VendorPageReveal from "../components/vendor/VendorPageReveal";

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const BASE_SLOTS = [
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

type Meridiem = "AM" | "PM";

type TimeParts = {
  hour: string;
  minute: string;
  period: Meridiem;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload as { message?: string } | undefined;
    return payload?.message ?? fallback;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

function getTodayDayOfWeek() {
  return new Date().getDay();
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5);
  return "";
}

function sortSlots(slots: VendorSlotConfig[]) {
  return [...slots].sort((a, b) => a.time.localeCompare(b.time));
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parseTimeToParts(time24: string): TimeParts {
  const normalized = normalizeTime(time24) || "12:00";
  const [hourRaw, minuteRaw] = normalized.split(":");

  let hourNumber = Number(hourRaw);
  if (!Number.isInteger(hourNumber)) hourNumber = 12;

  const period: Meridiem = hourNumber >= 12 ? "PM" : "AM";
  const hour12 = hourNumber % 12 === 0 ? 12 : hourNumber % 12;

  return {
    hour: String(hour12).padStart(2, "0"),
    minute: String(clampNumber(Number(minuteRaw), 0, 59)).padStart(2, "0"),
    period,
  };
}

function to24Hour(hour: string, minute: string, period: Meridiem) {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;

  const hourNumber = clampNumber(Number(hour), 1, 12);
  const minuteNumber = clampNumber(Number(minute), 0, 59);

  let hour24 = hourNumber % 12;
  if (period === "PM") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(minuteNumber).padStart(2, "0")}`;
}

function formatHourInput(value: string) {
  if (!value) return "";
  const normalized = String(clampNumber(Number(value), 1, 12));
  return normalized.padStart(2, "0");
}

function formatMinuteInput(value: string) {
  if (!value) return "";
  const normalized = String(clampNumber(Number(value), 0, 59));
  return normalized.padStart(2, "0");
}

type TimeInputProps = {
  value: string;
  onChange: (time24: string) => void;
  idPrefix: string;
};

function TimeInput12h({ value, onChange, idPrefix }: TimeInputProps) {
  const [parts, setParts] = useState<TimeParts>(() => parseTimeToParts(value));
  const minuteRef = useRef<HTMLInputElement | null>(null);
  const periodRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    setParts(parseTimeToParts(value));
  }, [value]);

  function commit(nextParts: TimeParts) {
    const converted = to24Hour(nextParts.hour, nextParts.minute, nextParts.period);
    if (converted) onChange(converted);
  }

  function handleHourChange(event: ChangeEvent<HTMLInputElement>) {
    const nextHour = event.target.value.replace(/\D/g, "").slice(0, 2);
    const nextParts: TimeParts = {
      ...parts,
      hour: nextHour,
    };

    setParts(nextParts);

    if (nextHour.length >= 2) {
      minuteRef.current?.focus();
      minuteRef.current?.select();
    }

    commit(nextParts);
  }

  function handleMinuteChange(event: ChangeEvent<HTMLInputElement>) {
    const nextMinute = event.target.value.replace(/\D/g, "").slice(0, 2);
    const nextParts: TimeParts = {
      ...parts,
      minute: nextMinute,
    };

    setParts(nextParts);

    if (nextMinute.length >= 2) {
      periodRef.current?.focus();
    }

    commit(nextParts);
  }

  function handlePeriodChange(event: ChangeEvent<HTMLSelectElement>) {
    const period = event.target.value === "PM" ? "PM" : "AM";
    const nextParts: TimeParts = {
      ...parts,
      period,
    };

    setParts(nextParts);
    commit(nextParts);
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        id={`${idPrefix}-hour`}
        inputMode="numeric"
        value={parts.hour}
        onChange={handleHourChange}
        onBlur={() => {
          const hour = formatHourInput(parts.hour);
          const nextParts: TimeParts = { ...parts, hour };
          setParts(nextParts);
          commit(nextParts);
        }}
        placeholder="HH"
        maxLength={2}
        className="w-[56px] rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937]"
      />

      <span className="text-[#8b97a8]">:</span>

      <input
        id={`${idPrefix}-minute`}
        ref={minuteRef}
        inputMode="numeric"
        value={parts.minute}
        onChange={handleMinuteChange}
        onBlur={() => {
          const minute = formatMinuteInput(parts.minute);
          const nextParts: TimeParts = { ...parts, minute };
          setParts(nextParts);
          commit(nextParts);
        }}
        placeholder="MM"
        maxLength={2}
        className="w-[56px] rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937]"
      />

      <select
        id={`${idPrefix}-period`}
        ref={periodRef}
        value={parts.period}
        onChange={handlePeriodChange}
        className="rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937] outline-none"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function VendorSlotsPage() {
  const { restaurantId = "" } = useParams<{ restaurantId: string }>();
  const { isAuthed, loading: authLoading } = useAuth();

  const [restaurant, setRestaurant] = useState<VendorRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number>(getTodayDayOfWeek());
  const [defaultMaxTables, setDefaultMaxTables] = useState<number>(10);
  const [slots, setSlots] = useState<VendorSlotConfig[]>([]);
  const [newSlotTime, setNewSlotTime] = useState("21:00");
  const [newSlotTables, setNewSlotTables] = useState("10");

  // Guest capacity config state
  const [guestConfigs, setGuestConfigs] = useState<GuestCapacityConfigInput[]>([]);
  const [savingGuests, setSavingGuests] = useState(false);
  const [guestMessage, setGuestMessage] = useState<string | null>(null);

  async function loadGuestConfigs(targetRestaurantId: string) {
    try {
      const data = await getVendorGuestConfigs(targetRestaurantId);
      setGuestConfigs(
        data.map((c) => ({
          minGuests: c.minGuests,
          maxGuests: c.maxGuests,
          maxTables: c.maxTables,
        })),
      );
    } catch {
      // Table may not exist yet — ignore
      setGuestConfigs([]);
    }
  }

  function addGuestConfig() {
    setGuestConfigs((prev) => [
      ...prev,
      { minGuests: 1, maxGuests: 2, maxTables: 10 },
    ]);
  }

  function updateGuestConfig(index: number, patch: Partial<GuestCapacityConfigInput>) {
    setGuestConfigs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeGuestConfig(index: number) {
    setGuestConfigs((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSaveGuestConfigs() {
    if (!restaurantId) return;

    try {
      setSavingGuests(true);
      setGuestMessage(null);

      const saved = await saveVendorGuestConfigs(restaurantId, guestConfigs);
      setGuestConfigs(
        saved.map((c) => ({
          minGuests: c.minGuests,
          maxGuests: c.maxGuests,
          maxTables: c.maxTables,
        })),
      );
      setGuestMessage("Guest capacity configuration saved.");
      setTimeout(() => setGuestMessage(null), 3000);
    } catch (error) {
      setGuestMessage(getErrorMessage(error, "Failed to save guest configs."));
    } finally {
      setSavingGuests(false);
    }
  }

  async function loadSlots(targetRestaurantId: string, targetDay: number) {
    const data = await getVendorRestaurantSlots(targetRestaurantId, targetDay);
    setDefaultMaxTables(data?.defaultMaxTables || 10);

    const slotsArr = Array.isArray(data?.slots) ? data.slots : [];
    if (slotsArr.length > 0) {
      setSlots(sortSlots(slotsArr));
      return;
    }

    setSlots(
      BASE_SLOTS.map((time) => ({
        time,
        maxTables: data.defaultMaxTables || 10,
        isActive: true,
      })),
    );
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!isAuthed || !restaurantId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setMessage(null);

        const restaurantData = await getVendorRestaurant(restaurantId);
        if (!alive) return;

        setRestaurant(restaurantData);
        await loadSlots(restaurantId, dayOfWeek);
        await loadGuestConfigs(restaurantId);
      } catch (error) {
        if (!alive) return;
        setMessage(getErrorMessage(error, "Unable to load slot configuration."));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [dayOfWeek, isAuthed, restaurantId]);

  const selectedDayLabel = useMemo(
    () => DAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ?? "",
    [dayOfWeek],
  );

  const isSuccessMessage =
    typeof message === "string" && message.toLowerCase().includes("saved");

  function updateSlot(index: number, patch: Partial<VendorSlotConfig>) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function addSlot() {
    const time = normalizeTime(newSlotTime);
    if (!time) {
      setMessage("Enter a valid slot time.");
      return;
    }

    const maxTables = Math.max(1, Number(newSlotTables) || defaultMaxTables || 1);

    setSlots((prev) => {
      const withoutTime = prev.filter((slot) => slot.time !== time);
      return sortSlots([
        ...withoutTime,
        {
          time,
          maxTables,
          isActive: true,
        },
      ]);
    });

    setMessage(null);
  }

  async function onSave() {
    if (!restaurantId) return;

    try {
      setSaving(true);
      setMessage(null);

      const payload = sortSlots(
        slots
          .map((slot) => ({
            time: normalizeTime(slot.time),
            maxTables: Math.max(1, Number(slot.maxTables) || defaultMaxTables || 1),
            isActive: slot.isActive,
          }))
          .filter((slot) => Boolean(slot.time)) as VendorSlotConfig[],
      );

      const saved = await saveVendorRestaurantSlots(restaurantId, dayOfWeek, payload);
      setSlots(sortSlots(saved.slots));
      setMessage(`Slot configuration saved for ${selectedDayLabel}.`);
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to save slot configuration."));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="inline-flex items-center gap-2 text-[#5b6374]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking session...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="rounded-3xl border border-[#e8e2e3] bg-white p-6 text-[#4b5563]">
            Login is required to manage restaurant slots.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-72px)] w-full bg-[#f3f3f4] text-[#1f2937]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b3d4a]">
            Vendor Portal
          </p>
          <h1 className="mt-2 text-5xl text-[#1f2937]">Tables & Slot Configuration</h1>
          <p className="mt-1 text-sm text-[#5b6374]">
            Configure table capacity per time slot and day.
          </p>
        </header>

        <div className="mt-4">
          <Link
            to="/vendor"
            className="inline-flex rounded-xl border border-[#ddd8da] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8fafc]"
          >
            Back to Dashboard
          </Link>
        </div>

        {message && (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              isSuccessMessage
                ? "border-[#b7e4c7] bg-[#ecfdf3] text-[#166534]"
                : "border-[#f2cccf] bg-[#fff6f7] text-[#9f1239]"
            }`}
          >
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-[#e8e2e3] bg-white p-6 text-[#5b6374] shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <div className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading slot settings...
            </div>
          </div>
        ) : (
          <VendorPageReveal>
          <section className="mt-6 rounded-3xl border border-[#e8e2e3] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-3xl text-[#1f2937]">{restaurant?.name ?? "Restaurant"}</h2>
                <p className="text-sm text-[#6b7280]">
                  Default table capacity: {defaultMaxTables}
                </p>
              </div>

              <label className="text-sm text-[#4b5563]">
                Day of Week
                <select
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(Number(event.target.value))}
                  className="ml-2 rounded-xl border border-[#ddd8da] bg-white px-3 py-2 text-sm text-[#1f2937] outline-none"
                >
                  {DAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#1f2937]">{selectedDayLabel} Slots</h3>
                <span className="text-xs uppercase tracking-wide text-[#8b97a8]">
                  {slots.length} slots
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {slots.map((slot, index) => (
                  <div
                    key={`${slot.time}-${index}`}
                    className="grid gap-2 rounded-xl border border-[#e5e7eb] bg-white p-3 sm:grid-cols-[220px_150px_120px_auto] sm:items-center"
                  >
                    <label className="text-xs text-[#6b7280]">
                      Time
                      <TimeInput12h
                        value={slot.time}
                        onChange={(nextTime) => updateSlot(index, { time: nextTime })}
                        idPrefix={`slot-${index}`}
                      />
                    </label>

                    <label className="text-xs text-[#6b7280]">
                      Max Tables
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={slot.maxTables}
                        onChange={(event) =>
                          updateSlot(index, {
                            maxTables: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937]"
                      />
                    </label>

                    <label className="inline-flex items-center gap-2 self-end pb-1 text-sm text-[#4b5563]">
                      <input
                        type="checkbox"
                        checked={slot.isActive}
                        onChange={(event) =>
                          updateSlot(index, { isActive: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-[#c8ccd6] accent-[#8b3d4a]"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      onClick={() => removeSlot(index)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#f2cccf] bg-[#fff6f7] px-2 py-1.5 text-xs text-[#9f1239] hover:bg-[#ffeef1]"
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-[#d2d8e3] bg-[#f8fafc] p-3 sm:grid-cols-[220px_150px_auto] sm:items-end">
                <label className="text-xs text-[#6b7280]">
                  New Time
                  <TimeInput12h
                    value={newSlotTime}
                    onChange={setNewSlotTime}
                    idPrefix="new-slot"
                  />
                </label>

                <label className="text-xs text-[#6b7280]">
                  Max Tables
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={newSlotTables}
                    onChange={(event) => setNewSlotTables(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937]"
                  />
                </label>

                <button
                  type="button"
                  onClick={addSlot}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d9c3c8] bg-[#f8ecee] px-3 py-2 text-sm font-medium text-[#7b2f3b] hover:bg-[#f3dde1]"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Slot
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#c98d98] bg-[#f8ecee] px-4 py-2.5 text-sm font-semibold text-[#7b2f3b] hover:bg-[#f3dde1] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Tables & Slot Configuration
                </>
              )}
            </button>

            <div className="mt-2 inline-flex items-center gap-2 text-xs text-[#6b7280]">
              <Settings className="h-3.5 w-3.5" />
              Inactive slots stay in config but are hidden from customer booking.
            </div>
          </section>

          {/* Guest Capacity Configuration */}
          <section className="mt-6 rounded-3xl border border-[#e8e2e3] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#8b3e46] to-[#6a2f35] text-white shadow-md">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-[#1f2937]">Guest Capacity</h2>
                <p className="text-sm text-[#6b7280]">
                  Set how many tables are available per guest count range.
                </p>
              </div>
            </div>

            {guestMessage && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  guestMessage.toLowerCase().includes("saved")
                    ? "border-[#b7e4c7] bg-[#ecfdf3] text-[#166534]"
                    : "border-[#f2cccf] bg-[#fff6f7] text-[#9f1239]"
                }`}
              >
                {guestMessage}
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-[#fcfcfd] p-4">
              {guestConfigs.length === 0 ? (
                <p className="text-sm text-[#6b7280]">
                  No guest capacity rules configured. All slots will use the default Max Tables value above.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#7b8498]">
                    <span>Min Guests</span>
                    <span>Max Guests</span>
                    <span>Tables Available</span>
                    <span />
                  </div>
                  {guestConfigs.map((cfg, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-xl border border-[#e5e7eb] bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center"
                    >
                      <label className="text-xs text-[#6b7280]">
                        <span className="sm:hidden">Min Guests</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={cfg.minGuests}
                          onChange={(e) =>
                            updateGuestConfig(index, {
                              minGuests: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937]"
                        />
                      </label>

                      <label className="text-xs text-[#6b7280]">
                        <span className="sm:hidden">Max Guests</span>
                        <input
                          type="number"
                          min={cfg.minGuests}
                          max={50}
                          value={cfg.maxGuests}
                          onChange={(e) =>
                            updateGuestConfig(index, {
                              maxGuests: Math.max(cfg.minGuests, Number(e.target.value) || cfg.minGuests),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937]"
                        />
                      </label>

                      <label className="text-xs text-[#6b7280]">
                        <span className="sm:hidden">Tables Available</span>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={cfg.maxTables}
                          onChange={(e) =>
                            updateGuestConfig(index, {
                              maxTables: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-[#d9dce3] bg-white px-2 py-1.5 text-sm text-[#1f2937]"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeGuestConfig(index)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#f2cccf] bg-[#fff6f7] px-2 py-1.5 text-xs text-[#9f1239] hover:bg-[#ffeef1]"
                      >
                        <MinusCircle className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addGuestConfig}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d9c3c8] bg-[#f8ecee] px-3 py-2 text-sm font-medium text-[#7b2f3b] hover:bg-[#f3dde1]"
              >
                <PlusCircle className="h-4 w-4" />
                Add Guest Rule
              </button>
            </div>

            <button
              type="button"
              onClick={onSaveGuestConfigs}
              disabled={savingGuests}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#c98d98] bg-[#f8ecee] px-4 py-2.5 text-sm font-semibold text-[#7b2f3b] hover:bg-[#f3dde1] disabled:opacity-60"
            >
              {savingGuests ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Guest Capacity
                </>
              )}
            </button>

            <div className="mt-2 text-xs text-[#6b7280]">
              <Settings className="mr-1 inline h-3.5 w-3.5" />
              Example: 1-2 guests → 13 tables, 3-5 guests → 6 tables, 6-12 guests → 2 tables.
            </div>
          </section>
          </VendorPageReveal>
        )}
      </div>
    </div>
  );
}

