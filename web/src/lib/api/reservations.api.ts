import { api } from "./client";

export type Slot = {
  time: string;
  available: boolean;
  maxTables?: number;
  reservedTables?: number;
  remainingTables?: number;
  remainingGuests?: number;
};

export type SlotsResponse = {
  restaurantId: string;
  date: string;
  dayOfWeek: number;
  source: "default" | "configured" | string;
  maxGuestsPerTable?: number;
  slots: Slot[];
};

export type CreateReservationInput = {
  restaurantId: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
};

export type CreateReservationResponse = {
  id: string;
  restaurantId: string;
  userId: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  status: string;
  createdAt: string;
};

export function getSlots(restaurantId: string, date: string, guests?: number) {
  let url = `/restaurants/${restaurantId}/slots?date=${encodeURIComponent(date)}`;
  if (guests && guests > 0) url += `&guests=${guests}`;
  return api<SlotsResponse>(url);
}

export function createReservation(payload: CreateReservationInput) {
  return api<CreateReservationResponse>("/reservations", {
    method: "POST",
    body: payload,
  });
}
