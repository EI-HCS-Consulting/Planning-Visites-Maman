import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "./supabase";
import { generateSlots, toISO } from "./slotUtils";
import type { PatientSpace, SlotConfig, Reservation } from "./types";

interface VisitorContextValue {
  space: PatientSpace | null;
  slotConfig: SlotConfig | null;
  slots: string[];
  reservations: Reservation[];
  loading: boolean;
  token: string;
  selectedDay: Date;
  setSelectedDay: (day: Date) => void;
  // Set by "Prochaine disponibilité" 's "Réserver" button (Calendrier) so the
  // Créneaux screen can auto-open the booking modal on mount, pre-targeted —
  // shared via context rather than a route param, since query params don't
  // reliably survive navigation through the Tabs > home Stack nesting.
  pendingBookingSlot: string | null;
  setPendingBookingSlot: (slot: string | null) => void;
  // Set par "Mon compte" > "Mes réservations" pour que l'écran Créneaux ou
  // Nuitées rouvre directement la modale PIN/modification sur la réservation
  // visée — même mécanisme que pendingBookingSlot, pour la même raison.
  pendingEditReservationId: string | null;
  setPendingEditReservationId: (id: string | null) => void;
  refreshReservations: () => Promise<void>;
}

const VisitorContext = createContext<VisitorContextValue>({
  space: null,
  slotConfig: null,
  slots: [],
  reservations: [],
  loading: true,
  token: "",
  selectedDay: new Date(),
  setSelectedDay: () => {},
  pendingBookingSlot: null,
  setPendingBookingSlot: () => {},
  pendingEditReservationId: null,
  setPendingEditReservationId: () => {},
  refreshReservations: async () => {},
});

export function useVisitorSpace() {
  return useContext(VisitorContext);
}

export function VisitorSpaceProvider({ token, children }: { token: string; children: ReactNode }) {
  const [space, setSpace] = useState<PatientSpace | null>(null);
  const [slotConfig, setSlotConfig] = useState<SlotConfig | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [pendingBookingSlot, setPendingBookingSlot] = useState<string | null>(null);
  const [pendingEditReservationId, setPendingEditReservationId] = useState<string | null>(null);

  const fetchSpace = useCallback(async () => {
    if (!token) { setLoading(false); return; }

    const { data: spaceData } = await supabase
      .from("patient_spaces")
      .select("*")
      .eq("invite_token", token)
      .eq("is_active", true)
      .single();

    if (!spaceData) { setLoading(false); return; }

    setSpace(spaceData);

    const startDate = new Date(spaceData.start_date + "T00:00:00");
    setSelectedDay((prev) => (prev < startDate ? startDate : prev));

    const { data: configData } = await supabase
      .from("slot_config")
      .select("*")
      .eq("space_id", spaceData.id)
      .single();

    if (configData) {
      setSlotConfig(configData);
      setSlots(generateSlots(configData));
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchSpace();
  }, [fetchSpace]);

  const refreshReservations = useCallback(async () => {
    if (!space) return;
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("space_id", space.id);
    setReservations(data || []);
  }, [space]);

  useEffect(() => {
    if (!space) return;
    refreshReservations();

    // Reservations realtime
    const ch1 = supabase
      .channel(`visitor-reservations:${space.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `space_id=eq.${space.id}` }, refreshReservations)
      .subscribe();

    // Space realtime — re-fetch on any admin update to get the full row
    // (payload.new only includes changed columns without REPLICA IDENTITY FULL)
    const ch2 = supabase
      .channel(`space-visitor:${space.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patient_spaces", filter: `id=eq.${space.id}` },
        () => { fetchSpace(); },
      )
      .subscribe();

    // slot_config realtime — visitor sees updated visit rules immediately.
    const spaceId = space.id;
    const ch3 = supabase
      .channel(`slot-config-visitor:${spaceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "slot_config", filter: `space_id=eq.${spaceId}` },
        async () => {
          const { data } = await supabase.from("slot_config").select("*").eq("space_id", spaceId).single();
          if (data) { setSlotConfig(data); setSlots(generateSlots(data)); }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, [space?.id, refreshReservations, fetchSpace]);

  return (
    <VisitorContext.Provider value={{ space, slotConfig, slots, reservations, loading, token, selectedDay, setSelectedDay, pendingBookingSlot, setPendingBookingSlot, pendingEditReservationId, setPendingEditReservationId, refreshReservations }}>
      {children}
    </VisitorContext.Provider>
  );
}
