import { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { getVisitorSession } from "@/lib/visitorSession";
import SpaceHeader from "@/components/SpaceHeader";
import BookingFlow, { type BookingFlowHandle } from "@/components/BookingFlow";
import { getSlotOccupancy, isSlotPast, toISO, toFrLong, toFrShort, addDays } from "@/lib/slotUtils";
import { themes } from "@/lib/themes";

// Recentré sur les créneaux "Visite" uniquement depuis le Lot 3 — la nuitée
// a son propre écran (home/nights.tsx). La logique de réservation/PIN/édition
// elle-même vit dans components/BookingFlow.tsx, partagée entre les deux.
export default function SlotsScreen() {
  const { space, slotConfig, slots, reservations, selectedDay, setSelectedDay, refreshReservations, token, pendingBookingSlot, setPendingBookingSlot } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];
  const flowRef = useRef<BookingFlowHandle>(null);

  const startDate = space ? new Date(space.start_date + "T00:00:00") : new Date();

  // Arrivée via "Prochaine disponibilité → Réserver" (Calendrier) : ouvre
  // directement la modale de réservation sur le créneau ciblé.
  useEffect(() => {
    getVisitorSession().then((s) => {
      if (pendingBookingSlot) {
        flowRef.current?.openBooking(toISO(selectedDay), pendingBookingSlot, s ? { prenom: s.prenom, nom: s.nom } : undefined);
        setPendingBookingSlot(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!space || !slotConfig) return null;

  const iso = toISO(selectedDay);

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <SpaceHeader space={space} active="slots" basePath="/(visitor)/home" C={C} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Day navigation */}
        <View style={[styles.dayNav, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity
            onPress={() => { const prev = addDays(selectedDay, -1); if (prev >= startDate) setSelectedDay(prev); }}
            disabled={toISO(selectedDay) === toISO(startDate)}
            style={[styles.navBtn, { borderColor: C.border }]}
          >
            <Text style={[styles.navBtnText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.dayTitle, { color: "#fff" }]}>{toFrLong(selectedDay)}</Text>
            <Text style={[styles.daySub, { color: C.muted }]}>{toFrShort(selectedDay)}</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedDay(addDays(selectedDay, 1))} style={[styles.navBtn, { borderColor: C.border }]}>
            <Text style={[styles.navBtnText, { color: C.text }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Slots */}
        {slots.map((slot) => {
          const occ = getSlotOccupancy(reservations, iso, slot);
          const full = occ.length >= slotConfig.max_visitors_per_slot;
          const past = isSlotPast(iso, slot);

          return (
            <View
              key={slot}
              style={[styles.slotCard, { backgroundColor: C.card, borderColor: full ? "rgba(233,69,96,0.3)" : C.border, opacity: past ? 0.5 : 1 }]}
            >
              <View style={styles.slotLeft}>
                <Text style={[styles.slotTime, { color: C.gold }]}>{slot}</Text>
                <Text style={[styles.slotCount, { color: C.muted }]}>{occ.length}/{slotConfig.max_visitors_per_slot} inscrits</Text>
                {occ.length === 0
                  ? <Text style={[styles.slotEmpty, { color: C.muted }]}>——</Text>
                  : occ.map((r) => (
                    <View key={r.id} style={styles.visitorRow}>
                      <Text style={[styles.visitorName, { color: C.success }]}>● {r.prenom} {r.nom}</Text>
                      <TouchableOpacity onPress={() => flowRef.current?.openPinModal(r)} style={[styles.editBadge, { backgroundColor: C.orange }]}>
                        <Text style={styles.editBadgeText}>✏️</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                }
              </View>
              {!full && !past && (
                <TouchableOpacity
                  style={[styles.reserveBtn, { backgroundColor: C.accent }]}
                  onPress={() => flowRef.current?.openBooking(iso, slot)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.reserveBtnText}>+ Réserver</Text>
                </TouchableOpacity>
              )}
              {full && !past && (
                <View style={[styles.fullBadge, { borderColor: C.border }]}>
                  <Text style={[styles.fullBadgeText, { color: C.muted }]}>Complet</Text>
                </View>
              )}
              {past && (
                <View style={[styles.fullBadge, { borderColor: C.border }]}>
                  <Text style={[styles.fullBadgeText, { color: C.muted }]}>Passé</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <BookingFlow
        ref={flowRef}
        type="Visite"
        space={space}
        slotConfig={slotConfig}
        slots={slots}
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

  dayNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  dayTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, textTransform: "capitalize" },
  daySub: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  navBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  navBtnText: { fontSize: 18, fontWeight: "600" },

  slotCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  slotLeft: { flex: 1 },
  slotTime: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22 },
  slotCount: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  slotEmpty: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginTop: 4 },
  visitorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  visitorName: { fontFamily: "DM_Sans_400Regular", fontSize: 13, flex: 1 },
  editBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  editBadgeText: { fontSize: 13 },
  reserveBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "center" },
  reserveBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#fff" },
  fullBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  fullBadgeText: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
});
