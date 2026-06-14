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

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    async function fetchSpace() {
      const { data: spaceData } = await supabase
        .from("patient_spaces")
        .select("*")
        .eq("invite_token", token)
        .eq("is_active", true)
        .single();

      if (!spaceData) { setLoading(false); return; }

      setSpace(spaceData);

      // Adjust selectedDay to start_date if today is before it
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
    }

    fetchSpace();
  }, [token]);

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

    // Space realtime — reflect theme/photo changes from admin immediately
    const ch2 = supabase
      .channel(`space-visitor:${space.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patient_spaces", filter: `id=eq.${space.id}` },
        (payload) => { setSpace(payload.new as PatientSpace); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [space?.id, refreshReservations]);

  return (
    <VisitorContext.Provider value={{ space, slotConfig, slots, reservations, loading, token, selectedDay, setSelectedDay, refreshReservations }}>
      {children}
    </VisitorContext.Provider>
  );
}
