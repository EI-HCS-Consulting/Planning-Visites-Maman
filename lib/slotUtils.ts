import type { SlotConfig, Reservation } from "./types";

export function generateSlots(config: SlotConfig): string[] {
  const slots: string[] = [];
  const startMin = config.visit_start_hour * 60;
  const endMin = config.visit_end_hour * 60;

  // min_gap_minutes est l'intervalle entre les débuts de créneaux.
  // 0 = dos à dos (step = durée seule).
  const step = config.min_gap_minutes > 0 ? config.min_gap_minutes : config.slot_duration_minutes;
  for (let m = startMin; m + config.slot_duration_minutes <= endMin; m += step) {
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
  if (config.allowed_weekdays && !config.allowed_weekdays.includes(d.getDay())) return "past";
  if (config.blocked_dates && config.blocked_dates.includes(iso)) return "past";

  // Les nuitées ont leur propre écran (Nuits) et n'influencent plus le point
  // de couleur du calendrier — uniquement basé sur l'occupation des
  // créneaux "Visite" du jour.
  const visits = reservations.filter((r) => r.date === iso && r.type === "Visite");

  if (visits.length === 0) return "empty";

  const maxVisits = slots.length * config.max_visitors_per_slot;
  if (visits.length >= maxVisits) return "full";
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

// Une réservation (visite ou nuitée) dont le jour est déjà passé ne peut
// plus être modifiée ni annulée — le rendez-vous a déjà eu lieu.
export function isReservationDatePast(date: string): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  return d < today;
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
    if (config.allowed_weekdays && !config.allowed_weekdays.includes(d.getDay())) continue;
    if (config.blocked_dates && config.blocked_dates.includes(iso)) continue;

    for (const slot of slots) {
      // isSlotPast() is a no-op for any day other than today, so this only
      // ever filters out today's already-gone slots — kept in sync with the
      // exact same check used when rendering the slots list.
      if (isSlotPast(iso, slot)) continue;

      const occ = getSlotOccupancy(reservations, iso, slot);
      if (occ.length < config.max_visitors_per_slot) {
        return { date: d, iso, slot };
      }
    }
  }
  return null;
}

// Cherche la prochaine date sans nuitée déjà enregistrée (un seul créneau
// "Nuit" par jour). Contrairement aux créneaux "Visite", l'heure du jour
// n'entre pas en jeu : une nuitée se réserve pour 18h, même si on regarde
// après 18h le jour même (cohérent avec le comportement existant de
// l'ancienne carte "Nuit" dans Créneaux, qui n'a jamais filtré sur l'heure).
export function findNextAvailableNight(
  reservations: Reservation[],
  config: SlotConfig,
  startDate: Date,
): { date: Date; iso: string } | null {
  if (!config.night_enabled) return null;

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
    if (config.allowed_weekdays && !config.allowed_weekdays.includes(d.getDay())) continue;
    if (config.blocked_dates && config.blocked_dates.includes(iso)) continue;
    if (!getNightReservation(reservations, iso)) {
      return { date: d, iso };
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
