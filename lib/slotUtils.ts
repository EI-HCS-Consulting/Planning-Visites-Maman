import type { SlotConfig, Reservation } from "./types";

export function generateSlots(config: SlotConfig): string[] {
  const slots: string[] = [];
  const startMin = config.visit_start_hour * 60;
  const endMin = config.visit_end_hour * 60;

  for (let m = startMin; m + config.slot_duration_minutes <= endMin; m += config.slot_duration_minutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

export type DayStatus = "past" | "empty" | "partial" | "full";

export function getDayStatus(
  reservations: Reservation[],
  iso: string,
  dateObj: Date,
  config: SlotConfig,
  slots: string[],
  startDate: Date,
): DayStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (d < start || d < today) return "past";

  const dayResas = reservations.filter((r) => r.date === iso);
  const visits = dayResas.filter((r) => r.type === "Visite");
  const night = dayResas.find((r) => r.type === "Nuit");

  if (visits.length === 0 && !night) return "empty";

  const maxVisits = slots.length * config.max_visitors_per_slot;
  const visitsAtMax = visits.length >= maxVisits;
  const nightAtMax = !config.night_enabled || !!night;

  if (visitsAtMax && nightAtMax) return "full";
  return "partial";
}

// A slot whose start time has already gone by today can't be booked —
// only relevant for the current day, any other date is never "past" here.
export function isSlotPast(iso: string, slot: string): boolean {
  const now = new Date();
  if (iso !== toISO(now)) return false;
  const [h, m] = slot.split(":").map(Number);
  return h + m / 60 <= now.getHours() + now.getMinutes() / 60;
}

export function getSlotOccupancy(
  reservations: Reservation[],
  iso: string,
  slot: string,
  excludeId?: string,
): Reservation[] {
  return reservations.filter(
    (r) => r.date === iso && r.creneau === slot && r.type === "Visite" && r.id !== excludeId,
  );
}

export function getNightReservation(
  reservations: Reservation[],
  iso: string,
  excludeId?: string,
): Reservation | undefined {
  return reservations.find(
    (r) => r.date === iso && r.type === "Nuit" && r.id !== excludeId,
  );
}

export function findNextAvailableSlot(
  reservations: Reservation[],
  config: SlotConfig,
  slots: string[],
  startDate: Date,
): { date: Date; iso: string; slot: string } | null {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const searchStart = new Date(startDate);
  searchStart.setHours(0, 0, 0, 0);
  if (today > searchStart) {
    searchStart.setTime(today.getTime());
  }

  for (let i = 0; i < 90; i++) {
    const d = new Date(searchStart);
    d.setDate(d.getDate() + i);
    const iso = toISO(d);
    const isToday = iso === toISO(today);
    const currentHour = now.getHours() + now.getMinutes() / 60;

    for (const slot of slots) {
      const slotH = parseInt(slot.split(":")[0]) + parseInt(slot.split(":")[1]) / 60;
      if (isToday && slotH <= currentHour) continue;

      const occ = getSlotOccupancy(reservations, iso, slot);
      if (occ.length < config.max_visitors_per_slot) {
        return { date: d, iso, slot };
      }
    }
  }
  return null;
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toFrLong(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function toFrShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month + 1, 0);
  for (let d = new Date(year, month, 1); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}
