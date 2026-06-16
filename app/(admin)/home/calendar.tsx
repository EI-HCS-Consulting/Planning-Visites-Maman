import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useSpace } from "@/lib/SpaceContext";
import {
  getDayStatus, findNextAvailableSlot, getDaysInMonth, toISO, toFrLong,
} from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function AdminCalendarScreen() {
  const { space, slotConfig, slots, reservations, loading, hasSpace, selectedDay, setSelectedDay, setPendingBookingSlot } = useSpace();
  const router = useRouter();
  const C = themes[space?.theme ?? "blue"];
  const [nextDispoModal, setNextDispoModal] = useState<{ date: Date; iso: string; slot: string } | null>(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const startDate = useMemo(
    () => space ? new Date(space.start_date + "T00:00:00") : today,
    [space, today],
  );
  const initialDay = useMemo(() => (today >= startDate ? today : startDate), [today, startDate]);

  const [calMonth, setCalMonth] = useState({ year: initialDay.getFullYear(), month: initialDay.getMonth() });

  function handleNextDispo() {
    if (!slotConfig) return;
    const result = findNextAvailableSlot(reservations, slotConfig, slots, startDate);
    if (result) {
      setNextDispoModal(result);
    } else {
      Alert.alert("Aucune disponibilité", "Aucun créneau libre dans les 90 prochains jours.");
    }
  }

  function goToDay() {
    if (!nextDispoModal) return;
    setSelectedDay(nextDispoModal.date);
    setCalMonth({ year: nextDispoModal.date.getFullYear(), month: nextDispoModal.date.getMonth() });
    setNextDispoModal(null);
    router.navigate("/(admin)/home/slots");
  }

  function reserveNow() {
    if (!nextDispoModal) return;
    setSelectedDay(nextDispoModal.date);
    setPendingBookingSlot(nextDispoModal.slot);
    setNextDispoModal(null);
    router.navigate("/(admin)/home/slots");
  }

  if (loading) return null;

  if (!hasSpace || !space || !slotConfig) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Text style={[styles.emptyText, { color: C.muted }]}>Aucun espace patient actif.</Text>
      </View>
    );
  }

  const monthDays = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDow = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(calMonth.year, calMonth.month, 1)
    .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <SpaceHeader space={space} active="calendar" basePath="/(admin)/home" C={C} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={[styles.nextDispoBtn, { backgroundColor: C.accent }]}
          onPress={handleNextDispo}
          activeOpacity={0.85}
        >
          <Text style={styles.nextDispoText}>⚡ Prochaine disponibilité</Text>
        </TouchableOpacity>

        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() => setCalMonth((m) => {
              const d = new Date(m.year, m.month - 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}
            style={[styles.navBtn, { borderColor: C.border }]}
          >
            <Text style={[styles.navBtnText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthName, { color: "#fff" }]}>{monthName}</Text>
          <TouchableOpacity
            onPress={() => setCalMonth((m) => {
              const d = new Date(m.year, m.month + 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}
            style={[styles.navBtn, { borderColor: C.border }]}
          >
            <Text style={[styles.navBtnText, { color: C.text }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dayLabels}>
          {DAY_LABELS.map((d, i) => (
            <Text key={i} style={[styles.dayLabel, { color: C.muted }]}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {Array(firstDow).fill(null).map((_, i) => <View key={`e${i}`} style={styles.cell} />)}
          {monthDays.map((day) => {
            const iso = toISO(day);
            const status = getDayStatus(reservations, iso, day, slotConfig, slots, startDate);
            const isToday = toISO(day) === toISO(today);
            const isSelected = toISO(day) === toISO(selectedDay);
            const isPast = status === "past";
            const dotColor =
              status === "full" ? C.danger :
              status === "partial" ? C.orange :
              status === "empty" ? C.success : "transparent";

            return (
              <TouchableOpacity
                key={iso}
                style={[
                  styles.cell,
                  {
                    backgroundColor: isSelected ? C.accent : isPast ? "transparent" : C.card,
                    borderColor: isSelected ? C.accent : isToday ? C.gold : C.border,
                    borderWidth: isToday ? 2 : 1,
                    opacity: isPast ? 0.3 : 1,
                  },
                ]}
                onPress={() => {
                  if (!isPast) {
                    setSelectedDay(day);
                    router.navigate("/(admin)/home/slots");
                  }
                }}
                disabled={isPast}
                activeOpacity={0.7}
              >
                <Text style={[styles.cellDate, { color: isSelected ? "#fff" : isToday ? C.gold : C.text }]}>
                  {day.getDate()}
                </Text>
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.legend}>
          {([[C.success, "Dispo"], [C.orange, "Partiel"], [C.danger, "Complet"]] as [string, string][]).map(
            ([color, label]) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={[styles.legendLabel, { color: C.muted }]}>{label}</Text>
              </View>
            ),
          )}
        </View>
      </ScrollView>

      {/* ── MODAL PROCHAINE DISPONIBILITÉ ──────────────────────────────────── */}
      <Modal transparent visible={!!nextDispoModal} animationType="fade" onRequestClose={() => setNextDispoModal(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setNextDispoModal(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modal, { backgroundColor: C.card, borderColor: C.accent }]}>
            <Text style={styles.modalEmoji}>⚡</Text>
            <Text style={[styles.modalLabel, { color: C.gold }]}>Prochaine disponibilité</Text>
            <Text style={[styles.modalDate, { color: "#fff" }]}>
              {nextDispoModal && toFrLong(nextDispoModal.date)}
            </Text>
            <Text style={[styles.modalSlot, { color: C.gold }]}>{nextDispoModal?.slot}</Text>
            {!!slotConfig && (
              <Text style={[styles.modalMeta, { color: C.muted }]}>
                Visite de {slotConfig.slot_duration_minutes} min max · {slotConfig.max_visitors_per_slot} personne{slotConfig.max_visitors_per_slot > 1 ? "s" : ""} max
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtnSecondary, { borderColor: C.border }]} onPress={goToDay}>
                <Text style={[styles.modalBtnSecondaryText, { color: C.muted }]}>Voir le jour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnPrimary, { backgroundColor: C.accent }]} onPress={reserveNow}>
                <Text style={styles.modalBtnPrimaryText}>✓ Ajouter</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
  scroll: { padding: 16, paddingBottom: 32 },
  nextDispoBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
  nextDispoText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  monthName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 17, textTransform: "capitalize" },
  navBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  navBtnText: { fontSize: 18, fontWeight: "600" },
  dayLabels: { flexDirection: "row", marginBottom: 6 },
  dayLabel: { flex: 1, textAlign: "center", fontFamily: "DM_Sans_600SemiBold", fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginBottom: 16 },
  cell: { width: "13.28%", aspectRatio: 1, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  cellDate: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: "DM_Sans_400Regular", fontSize: 11 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 340, borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center" },
  modalEmoji: { fontSize: 32, marginBottom: 8 },
  modalLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  modalDate: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, textTransform: "capitalize", textAlign: "center", marginBottom: 6 },
  modalSlot: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 36, marginBottom: 8 },
  modalMeta: { fontFamily: "DM_Sans_400Regular", fontSize: 12, textAlign: "center", marginBottom: 12 },
  modalButtons: { flexDirection: "row", gap: 10, width: "100%", marginTop: 8 },
  modalBtnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalBtnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  modalBtnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  modalBtnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },
});
