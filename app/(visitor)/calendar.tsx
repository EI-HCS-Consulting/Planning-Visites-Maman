import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import {
  getDayStatus, findNextAvailableSlot, getDaysInMonth,
  toISO, toFrLong, addDays,
} from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import { useRouter } from "expo-router";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function VisitorCalendarScreen() {
  const { space, slotConfig, slots, reservations } = useVisitorSpace();
  const router = useRouter();

  const C = themes[space?.theme ?? "blue"];
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const startDate = useMemo(
    () => space ? new Date(space.start_date + "T00:00:00") : today,
    [space, today],
  );
  const initialDay = useMemo(() => (today >= startDate ? today : startDate), [today, startDate]);

  const [calMonth, setCalMonth] = useState({ year: initialDay.getFullYear(), month: initialDay.getMonth() });
  const [selectedDay, setSelectedDay] = useState<Date>(initialDay);

  const monthDays = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDow = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(calMonth.year, calMonth.month, 1)
    .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  function handleNextDispo() {
    if (!slotConfig) return;
    const result = findNextAvailableSlot(reservations, slotConfig, slots, startDate);
    if (result) {
      setSelectedDay(result.date);
      setCalMonth({ year: result.date.getFullYear(), month: result.date.getMonth() });
      router.navigate("/(visitor)/slots");
    } else {
      Alert.alert("Aucune disponibilité", "Aucun créneau libre dans les 90 prochains jours.");
    }
  }

  if (!space || !slotConfig) return null;

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.patientName, { color: "#fff" }]}>
          {space.patient_firstname} {space.patient_lastname}
        </Text>
        <Text style={[styles.room, { color: C.gold }]}>
          {space.hospital_room}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={[styles.nextDispoBtn, { backgroundColor: C.accent }]}
          onPress={handleNextDispo}
          activeOpacity={0.85}
        >
          <Text style={styles.nextDispoText}>⚡ Prochaine disponibilité</Text>
        </TouchableOpacity>

        {/* Month nav */}
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

        {/* Day labels */}
        <View style={styles.dayLabels}>
          {DAY_LABELS.map((d, i) => (
            <Text key={i} style={[styles.dayLabel, { color: C.muted }]}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
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
                    router.navigate("/(visitor)/slots");
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

        {/* Legend */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  patientName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },
  room: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
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
  cell: {
    width: "13.28%",
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  cellDate: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: "DM_Sans_400Regular", fontSize: 11 },
});
