import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";
import { generateSlots } from "./slotUtils";
import type { PatientSpace, SlotConfig, Reservation } from "./types";

interface VisitorContextValue {
  space: PatientSpace | null;
  slotConfig: SlotConfig | null;
  slots: string[];
  reservations: Reservation[];
  loading: boolean;
  token: string;
  refreshReservations: () => Promise<void>;
}

const VisitorContext = createContext<VisitorContextValue>({
  space: null,
  slotConfig: null,
  slots: [],
  reservations: [],
  loading: true,
  token: "",
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

  useEffect(() => {
    if (!token) return;

    async function fetchSpace() {
      const { data: spaceData } = await supabase
        .from("patient_spaces")
        .select("*")
        .eq("invite_token", token)
        .eq("is_active", true)
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

    const channel = supabase
      .channel(`visitor-reservations:${space.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `space_id=eq.${space.id}` },
        refreshReservations,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [space, refreshReservations]);

  return (
    <VisitorContext.Provider
      value={{ space, slotConfig, slots, reservations, loading, token, refreshReservations }}
    >
      {children}
    </VisitorContext.Provider>
  );
}
