import { useRef, useMemo, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import SpaceHeader from "@/components/SpaceHeader";
import BookingFlow, { type BookingFlowHandle } from "@/components/BookingFlow";
import { findNextAvailableNight, toISO, toFrLong, nightStartSlot } from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import type { Reservation } from "@/lib/types";

export default function VisitorNightsScreen() {
  const { space, slotConfig, reservations, token, refreshReservations, pendingEditReservationId, setPendingEditReservationId } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];
  const flowRef = useRef<BookingFlowHandle>(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const startDate = space ? new Date(space.start_date + "T00:00:00") : today;

  // Arrivée via "Mon compte" > "Mes réservations" sur une nuitée : rouvre la
  // modale PIN/modification directement sur la réservation visée.
  useEffect(() => {
    if (!pendingEditReservationId) return;
    const r = reservations.find((x) => x.id === pendingEditReservationId && x.type === "Nuit");
    if (!r) return;
    flowRef.current?.openPinModal(r);
    setPendingEditReservationId(null);
  }, [pendingEditReservationId, reservations, setPendingEditReservationId]);

  if (!space || !slotConfig) return null;

  const upcomingNights = reservations
    .filter((r): r is Reservation => r.type === "Nuit" && r.date >= toISO(today))
    .sort((a, b) => a.date.localeCompare(b.date));

  function handleReserveNext() {
    if (!slotConfig) return;
    const next = findNextAvailableNight(reservations, slotConfig, startDate);
    if (!next) {
      Alert.alert("Aucune disponibilité", "Aucune nuitée libre dans les 90 prochains jours.");
      return;
    }
    flowRef.current?.openBooking(next.iso, nightStartSlot(slotConfig));
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <SpaceHeader space={space} active="nights" basePath="/(visitor)/home" C={C} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!slotConfig.night_enabled ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🌙</Text>
            <Text style={[styles.emptyText, { color: C.muted }]}>
              Les nuitées sont actuellement suspendues par l'organisateur.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.reserveNextBtn, { backgroundColor: C.gold }]}
              onPress={handleReserveNext}
              activeOpacity={0.85}
            >
              <Text style={styles.reserveNextBtnText}>+ Réserver la prochaine nuitée disponible</Text>
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
                  </View>
                  <TouchableOpacity onPress={() => flowRef.current?.openPinModal(r)} style={[styles.editBadge, { backgroundColor: C.orange }]}>
                    <Text style={styles.editBadgeText}>✏️</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <BookingFlow
        ref={flowRef}
        type="Nuit"
        space={space}
        slotConfig={slotConfig}
        slots={[]}
        reservations={reservations}
        startDate={startDate}
        token={token}
        refreshReservations={refreshReservations}
        homeCalendarPath="/(visitor)/home/calendar"
        C={C}
      />
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
  editBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  editBadgeText: { fontSize: 13 },

  empty: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },
});
