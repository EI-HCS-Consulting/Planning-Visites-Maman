import { useRef, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { useSpace } from "@/lib/SpaceContext";
import { supabase } from "@/lib/supabase";
import { findNextAvailableNight, toISO, toFrLong, nightStartSlot } from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";
import AdminAddReservation, { type AdminAddReservationHandle } from "@/components/AdminAddReservation";
import type { Reservation } from "@/lib/types";

export default function AdminNightsScreen() {
  const { space, slotConfig, reservations, hasSpace, refreshReservations } = useSpace();
  const C = themes[space?.theme ?? "blue"];
  const addRef = useRef<AdminAddReservationHandle>(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const startDate = space ? new Date(space.start_date + "T00:00:00") : today;

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  if (!hasSpace || !space || !slotConfig) return null;

  const upcomingNights = reservations
    .filter((r): r is Reservation => r.type === "Nuit" && r.date >= toISO(today))
    .sort((a, b) => a.date.localeCompare(b.date));

  function handleReserveNext() {
    const next = findNextAvailableNight(reservations, slotConfig!, startDate);
    if (!next) {
      Alert.alert("Aucune disponibilité", "Aucune nuitée libre dans les 90 prochains jours.");
      return;
    }
    addRef.current?.open(next.iso, nightStartSlot(slotConfig!), "Nuit");
  }

  function handleDelete(r: Reservation) {
    Alert.alert(
      "Supprimer cette nuitée ?",
      `${r.prenom} ${r.nom}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            await supabase.from("reservations").delete().eq("id", r.id);
            await refreshReservations();
            showToast("Nuitée supprimée ✓");
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <SpaceHeader space={space} active="nights" basePath="/(admin)/home" C={C} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!slotConfig.night_enabled ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🌙</Text>
            <Text style={[styles.emptyText, { color: C.muted }]}>
              Les nuitées sont suspendues. Réactive-les depuis Compte → Paramètres.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={[styles.reserveNextBtn, { backgroundColor: C.gold }]} onPress={handleReserveNext} activeOpacity={0.85}>
              <Text style={styles.reserveNextBtnText}>+ Ajouter la prochaine nuitée disponible</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { color: C.gold }]}>Nuitées programmées</Text>

            {upcomingNights.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>🌙</Text>
                <Text style={[styles.emptyText, { color: C.muted }]}>Aucune nuitée programmée pour l'instant.</Text>
              </View>
            ) : (
              upcomingNights.map((r) => (
                <View key={r.id} style={[styles.nightCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.nightDate, { color: "#fff" }]}>{toFrLong(new Date(r.date + "T12:00:00"))}</Text>
                    <Text style={[styles.nightVisitor, { color: C.success }]}>● {r.prenom} {r.nom}</Text>
                    {r.telephone ? <Text style={[styles.nightTel, { color: C.muted }]}>{r.telephone}</Text> : null}
                  </View>
                  <TouchableOpacity style={[styles.deleteBtn, { borderColor: "rgba(233,69,96,0.4)" }]} onPress={() => handleDelete(r)}>
                    <Text style={{ color: "#e94560", fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <AdminAddReservation
        ref={addRef}
        spaceId={space.id}
        onAdded={async () => { await refreshReservations(); showToast("Nuitée ajoutée ✓"); }}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },

  reserveNextBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", marginBottom: 24 },
  reserveNextBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#0D1B2E", textAlign: "center" },

  sectionTitle: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },

  nightCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  nightDate: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 15, textTransform: "capitalize", marginBottom: 4 },
  nightVisitor: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
  nightTel: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  deleteBtn: { width: 28, height: 28, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  empty: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
