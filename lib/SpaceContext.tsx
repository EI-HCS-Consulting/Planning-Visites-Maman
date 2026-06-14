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
  refreshReservations: () => Promise<void>;
}

const SpaceContext = createContext<SpaceContextValue>({
  space: null,
  slotConfig: null,
  slots: [],
  reservations: [],
  loading: true,
  hasSpace: false,
  refreshReservations: async () => {},
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

  useEffect(() => {
    async function fetchSpace() {
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
  }, [adminId]);

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

    const channel = supabase
      .channel(`reservations:${space.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `space_id=eq.${space.id}` },
        refreshReservations,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [space, refreshReservations]);

  return (
    <SpaceContext.Provider
      value={{ space, slotConfig, slots, reservations, loading, hasSpace: !!space, refreshReservations }}
    >
      {children}
    </SpaceContext.Provider>
  );
}
