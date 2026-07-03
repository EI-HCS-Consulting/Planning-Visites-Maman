import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { useSpace } from "@/lib/SpaceContext";
import { supabase } from "@/lib/supabase";
import { getSlotOccupancy, getNightReservation, toISO, toFrLong, toFrShort, addDays } from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";
import AdminAddReservation, { type AdminAddReservationHandle } from "@/components/AdminAddReservation";
import type { Reservation } from "@/lib/types";
import type { Theme } from "@/lib/themes";

// Recentré sur les créneaux "Visite" uniquement depuis le Lot 3 — la nuitée
// a son propre écran (home/nights.tsx).
export default function AdminSlotsScreen() {
  const {
    space, slotConfig, reservations, selectedDay, setSelectedDay, refreshReservations,
    pendingBookingSlot, setPendingBookingSlot,
  } = useSpace();
  const C = themes[space?.theme ?? "blue"];
  const addRef = useRef<AdminAddReservationHandle>(null);

  const startDate = space ? new Date(space.start_date + "T00:00:00") : new Date();

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Arrivée via "Prochaine disponibilité → Ajouter" (Calendrier) : ouvre
  // directement la modale d'ajout sur le créneau ciblé.
  useEffect(() => {
    if (pendingBookingSlot) {
      addRef.current?.open(toISO(selectedDay), pendingBookingSlot, "Visite");
      setPendingBookingSlot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDeleteResa(r: Reservation) {
    Alert.alert(
      "Supprimer cette réservation ?",
      `${r.prenom} ${r.nom} · ${r.creneau}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            await supabase.from("reservations").delete().eq("id", r.id);
            await refreshReservations();
            showToast("Réservation supprimée ✓");
          },
        },
      ],
    );
  }

  if (!space || !slotConfig) return null;

  const iso = toISO(selectedDay);

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <SpaceHeader space={space} active="slots" basePath="/(admin)/home" C={C} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.dayNav, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity
            onPress={() => {
              const prev = addDays(selectedDay, -1);
              if (prev >= startDate) setSelectedDay(prev);
            }}
            disabled={toISO(selectedDay) === toISO(startDate)}
            style={[styles.navBtn, { borderColor: C.border }]}
          >
            <Text style={[styles.navBtnText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.dayTitle, { color: "#fff" }]}>{toFrLong(selectedDay)}</Text>
            <Text style={[styles.daySub, { color: C.muted }]}>{toFrShort(selectedDay)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setSelectedDay(addDays(selectedDay, 1))}
            style={[styles.navBtn, { borderColor: C.border }]}
          >
            <Text style={[styles.navBtnText, { color: C.text }]}>›</Text>
          </TouchableOpacity>
        </View>

        <SlotsList
          iso={iso}
          reservations={reservations}
          C={C}
          onAdd={(slot) => addRef.current?.open(iso, slot, "Visite")}
          onDelete={handleDeleteResa}
        />

        {slotConfig.night_enabled && (() => {
          const nightResa = getNightReservation(reservations, iso);
          return (
            <View style={[styles.slotCard, { backgroundColor: C.card, borderColor: nightResa ? "rgba(233,69,96,0.3)" : C.border }]}>
              <View style={styles.slotHeader}>
                <Text style={[styles.slotTime, { color: C.gold }]}>🌙 Nuitée</Text>
                <Text style={[styles.slotCount, { color: C.muted }]}>18h → 11h</Text>
                {!nightResa && (
                  <TouchableOpacity
                    style={[styles.addResaBtn, { backgroundColor: C.accent }]}
                    onPress={() => addRef.current?.open(iso, "18:00", "Nuit")}
                  >
                    <Text style={styles.addResaBtnText}>+ Ajouter</Text>
                  </TouchableOpacity>
                )}
                {nightResa && <Text style={[styles.fullTag, { color: C.danger }]}>Occupée</Text>}
              </View>
              {!nightResa ? (
                <Text style={[styles.slotEmpty, { color: C.muted }]}>Aucun visiteur inscrit</Text>
              ) : (
                <View style={[styles.resaRow, { borderColor: C.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resaName, { color: C.success }]}>● {nightResa.prenom} {nightResa.nom}</Text>
                    {nightResa.telephone ? <Text style={[styles.resaTel, { color: C.muted }]}>{nightResa.telephone}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteResaBtn, { borderColor: "rgba(233,69,96,0.4)" }]}
                    onPress={() => handleDeleteResa(nightResa)}
                  >
                    <Text style={{ color: "#e94560", fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })()}
      </ScrollView>

      <AdminAddReservation
        ref={addRef}
        spaceId={space.id}
        onAdded={async () => { await refreshReservations(); showToast("Réservation ajoutée ✓"); }}
        C={C}
      />

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: C.success }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// Liste des créneaux horaires "Visite" du jour — pulls `slots`/`slotConfig`
// from context directly to keep the parent component's JSX uncluttered.
function SlotsList({
  iso, reservations, C, onAdd, onDelete,
}: {
  iso: string;
  reservations: Reservation[];
  C: Theme;
  onAdd: (slot: string) => void;
  onDelete: (r: Reservation) => void;
}) {
  const { slots, slotConfig } = useSpace();
  if (!slotConfig) return null;

  return (
    <>
      {slots.map((slot) => {
        const occ = getSlotOccupancy(reservations, iso, slot);
        const full = occ.length >= slotConfig.max_visitors_per_slot;

        return (
          <View key={slot} style={[styles.slotCard, { backgroundColor: C.card, borderColor: full ? "rgba(233,69,96,0.3)" : C.border }]}>
            <View style={styles.slotHeader}>
              <Text style={[styles.slotTime, { color: C.gold }]}>{slot}</Text>
              <Text style={[styles.slotCount, { color: C.muted }]}>{occ.length}/{slotConfig.max_visitors_per_slot}</Text>
              {!full && (
                <TouchableOpacity style={[styles.addResaBtn, { backgroundColor: C.accent }]} onPress={() => onAdd(slot)}>
                  <Text style={styles.addResaBtnText}>+ Ajouter</Text>
                </TouchableOpacity>
              )}
              {full && <Text style={[styles.fullTag, { color: C.danger }]}>Complet</Text>}
            </View>

            {occ.length === 0
              ? <Text style={[styles.slotEmpty, { color: C.muted }]}>Aucun visiteur inscrit</Text>
              : occ.map((r) => (
                <View key={r.id} style={[styles.resaRow, { borderColor: C.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resaName, { color: C.success }]}>● {r.prenom} {r.nom}</Text>
                    {r.telephone ? <Text style={[styles.resaTel, { color: C.muted }]}>{r.telephone}</Text> : null}
                  </View>
                  <TouchableOpacity style={[styles.deleteResaBtn, { borderColor: "rgba(233,69,96,0.4)" }]} onPress={() => onDelete(r)}>
                    <Text style={{ color: "#e94560", fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            }
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  dayNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  navBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  navBtnText: { fontSize: 18, fontWeight: "600" },
  dayTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, textTransform: "capitalize" },
  daySub: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },

  slotCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  slotHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  slotTime: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, flex: 1 },
  slotCount: { fontFamily: "DM_Sans_400Regular", fontSize: 12 },
  slotEmpty: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
  fullTag: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  addResaBtn: { borderRadius: 7, paddingVertical: 6, paddingHorizontal: 10 },
  addResaBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 12, color: "#fff" },
  resaRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, paddingTop: 8, marginTop: 6 },
  resaName: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  resaTel: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 2 },
  deleteResaBtn: { width: 28, height: 28, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
