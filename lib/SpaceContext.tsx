import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";
import { generateSlots } from "./slotUtils";
import type { PatientSpace, SlotConfig, Reservation } from "./types";

interface SpaceContextValue {
  space: PatientSpace | null;
  slotConfig: SlotConfig | null;
  slots: string[];
  reservations: Reservation[];
  loading: boolean;
  hasSpace: boolean;
  selectedDay: Date;
  setSelectedDay: (day: Date) => void;
  // Same pattern as VisitorContext — "Prochaine disponibilité → Réserver"
  // sets this so the Créneaux screen auto-opens the add-reservation modal.
  pendingBookingSlot: string | null;
  setPendingBookingSlot: (slot: string | null) => void;
  refreshReservations: () => Promise<void>;
  refreshSpace: () => Promise<void>;
  refreshSlotConfig: () => Promise<void>;
}

const SpaceContext = createContext<SpaceContextValue>({
  space: null,
  slotConfig: null,
  slots: [],
  reservations: [],
  loading: true,
  hasSpace: false,
  selectedDay: new Date(),
  setSelectedDay: () => {},
  pendingBookingSlot: null,
  setPendingBookingSlot: () => {},
  refreshReservations: async () => {},
  refreshSpace: async () => {},
  refreshSlotConfig: async () => {},
});

export function useSpace() {
  return useContext(SpaceContext);
}

export function AdminSpaceProvider({ adminId, children }: { adminId: string; children: ReactNode }) {
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

  const fetchSpace = useCallback(async () => {
    const { data: spaceData } = await supabase
      .from("patient_spaces")
      .select("*")
      .eq("admin_id", adminId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!spaceData) {
      setLoading(false);
      return;
    }

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
  }, [adminId]);

  useEffect(() => {
    fetchSpace();
  }, [fetchSpace]);

  // Exposed so the onboarding form can pull in the freshly created space
  // without waiting for the next Realtime tick.
  const refreshSpace = useCallback(async () => {
    setLoading(true);
    await fetchSpace();
  }, [fetchSpace]);

  // Lightweight re-fetch of slotConfig only (no loading spinner) — called by
  // settings after saving slot rules so the context updates immediately.
  const refreshSlotConfig = useCallback(async () => {
    if (!space?.id) return;
    const { data } = await supabase.from("slot_config").select("*").eq("space_id", space.id).single();
    if (data) { setSlotConfig(data); setSlots(generateSlots(data)); }
  }, [space?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .channel(`reservations:${space.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `space_id=eq.${space.id}` },
        refreshReservations,
      )
      .subscribe();

    // Space realtime — reflect any field change immediately (re-fetch to get
    // the full row; payload.new only includes changed columns without REPLICA
    // IDENTITY FULL, so direct assignment would drop unmodified fields).
    const ch2 = supabase
      .channel(`space-admin:${space.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patient_spaces", filter: `id=eq.${space.id}` },
        () => { fetchSpace(); },
      )
      .subscribe();

    // slot_config realtime — update slots immediately when admin saves rules.
    const spaceId = space.id;
    const ch3 = supabase
      .channel(`slot-config-admin:${spaceId}`)
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
  }, [space?.id, refreshReservations]);

  return (
    <SpaceContext.Provider
      value={{ space, slotConfig, slots, reservations, loading, hasSpace: !!space, selectedDay, setSelectedDay, pendingBookingSlot, setPendingBookingSlot, refreshReservations, refreshSpace, refreshSlotConfig }}
    >
      {children}
    </SpaceContext.Provider>
  );
}
