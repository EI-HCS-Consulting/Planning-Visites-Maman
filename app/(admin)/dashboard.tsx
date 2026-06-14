import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, Alert,
} from "react-native";
import { useSpace } from "@/lib/SpaceContext";
import {
  getDayStatus, getSlotOccupancy, getNightReservation,
  findNextAvailableSlot, getDaysInMonth, toISO, toFrLong, toFrShort, addDays,
} from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import PatientAvatar from "@/components/PatientAvatar";
import type { Reservation } from "@/lib/types";

type DashView = "calendar" | "day";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function DashboardScreen() {
  const { space, slotConfig, slots, reservations, loading, hasSpace } = useSpace();

  const C = themes[space?.theme ?? "blue"];

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const startDate = useMemo(
    () => space ? new Date(space.start_date + "T00:00:00") : today,
    [space, today],
  );
  const initialDay = useMemo(() => (today >= startDate ? today : startDate), [today, startDate]);

  const [view, setView] = useState<DashView>("calendar");
  const [calMonth, setCalMonth] = useState({ year: initialDay.getFullYear(), month: initialDay.getMonth() });
  const [selectedDay, setSelectedDay] = useState<Date>(initialDay);
  const [nextDispoModal, setNextDispoModal] = useState<{ date: Date; iso: string; slot: string } | null>(null);

  function handleDayPress(day: Date) {
    setSelectedDay(day);
    setView("day");
  }

  function handleNextDispo() {
    if (!slotConfig) return;
    const result = findNextAvailableSlot(reservations, slotConfig, slots, startDate);
    if (result) {
      setNextDispoModal(result);
    } else {
      Alert.alert("Aucune disponibilité", "Aucun créneau libre dans les 90 prochains jours.");
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!hasSpace) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Text style={[styles.emptyTitle, { color: "#fff" }]}>Votre espace patient</Text>
        <Text style={[styles.emptyText, { color: C.muted }]}>
          Connectez-vous à votre espace pour gérer le planning des visites.{"\n\n"}
          Votre espace sera affiché ici une fois activé.
        </Text>
      </View>
    );
  }

  const monthDays = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDow = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(calMonth.year, calMonth.month, 1)
    .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <PatientAvatar
          photoUrl={space!.patient_photo_url}
          firstname={space!.patient_firstname}
          lastname={space!.patient_lastname}
          size={44}
          C={C}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: "#fff" }]}>
            {space!.patient_firstname} {space!.patient_lastname}
          </Text>
          <Text style={[styles.headerSub, { color: C.gold }]}>
            {space!.hospital_room} · {space!.hospital_name.split("·")[0].trim()}
          </Text>
        </View>
      </View>

      {view === "calendar" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Prochaine dispo */}
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

          {/* Calendar grid */}
          <View style={styles.grid}>
            {Array(firstDow).fill(null).map((_, i) => <View key={`e${i}`} style={styles.cell} />)}
            {monthDays.map((day) => {
              const iso = toISO(day);
              const status = getDayStatus(reservations, iso, day, slotConfig!, slots, startDate);
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
                  onPress={() => !isPast && handleDayPress(day)}
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
      ) : (
        <DayView
          day={selectedDay}
          reservations={reservations}
          slots={slots}
          slotConfig={slotConfig!}
          spaceId={space!.id}
          C={C}
          onBack={() => setView("calendar")}
          onPrevDay={() => {
            const prev = addDays(selectedDay, -1);
            if (prev >= startDate) setSelectedDay(prev);
          }}
          onNextDay={() => setSelectedDay(addDays(selectedDay, 1))}
          startDate={startDate}
        />
      )}

      {/* Prochaine dispo modal */}
      <Modal transparent visible={!!nextDispoModal} animationType="fade" onRequestClose={() => setNextDispoModal(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setNextDispoModal(null)}>
          <View style={[styles.modal, { backgroundColor: C.card, borderColor: C.accent }]}>
            <Text style={styles.modalEmoji}>⚡</Text>
            <Text style={[styles.modalLabel, { color: C.gold }]}>Prochaine disponibilité</Text>
            <Text style={[styles.modalDate, { color: "#fff" }]}>
              {nextDispoModal && toFrLong(nextDispoModal.date)}
            </Text>
            <Text style={[styles.modalSlot, { color: C.gold }]}>{nextDispoModal?.slot}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, { borderColor: C.border }]}
                onPress={() => {
                  if (nextDispoModal) {
                    setSelectedDay(nextDispoModal.date);
                    setCalMonth({ year: nextDispoModal.date.getFullYear(), month: nextDispoModal.date.getMonth() });
                    setView("day");
                  }
                  setNextDispoModal(null);
                }}
              >
                <Text style={[styles.modalBtnSecondaryText, { color: C.muted }]}>Voir le jour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: C.accent }]}
                onPress={() => {
                  if (nextDispoModal) {
                    setSelectedDay(nextDispoModal.date);
                    setView("day");
                  }
                  setNextDispoModal(null);
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>Voir les créneaux</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── DayView component ────────────────────────────────────────────────────────
interface DayViewProps {
  day: Date;
  reservations: Reservation[];
  slots: string[];
  slotConfig: import("@/lib/types").SlotConfig;
  spaceId: string;
  C: import("@/lib/themes").Theme;
  onBack: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  startDate: Date;
}

function DayView({ day, reservations, slots, slotConfig, spaceId, C, onBack, onPrevDay, onNextDay, startDate }: DayViewProps) {
  const iso = toISO(day);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Back */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={[styles.backText, { color: C.muted }]}>← Calendrier</Text>
      </TouchableOpacity>

      {/* Day nav */}
      <View style={[styles.dayNav, { backgroundColor: C.card, borderColor: C.border }]}>
        <TouchableOpacity
          onPress={onPrevDay}
          disabled={toISO(day) === toISO(startDate)}
          style={[styles.navBtn, { borderColor: C.border }]}
        >
          <Text style={[styles.navBtnText, { color: C.text }]}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.dayTitle, { color: "#fff" }]}>{toFrLong(day)}</Text>
          <Text style={[styles.daySub, { color: C.muted }]}>{toFrShort(day)}</Text>
        </View>
        <TouchableOpacity onPress={onNextDay} style={[styles.navBtn, { borderColor: C.border }]}>
          <Text style={[styles.navBtnText, { color: C.text }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Slots */}
      {slots.map((slot) => {
        const occ = getSlotOccupancy(reservations, iso, slot);
        const full = occ.length >= slotConfig.max_visitors_per_slot;

        return (
          <View
            key={slot}
            style={[
              styles.slotCard,
              {
                backgroundColor: C.card,
                borderColor: full ? "rgba(233,69,96,0.3)" : C.border,
              },
            ]}
          >
            <View style={styles.slotLeft}>
              <Text style={[styles.slotTime, { color: C.gold }]}>{slot}</Text>
              <Text style={[styles.slotCount, { color: C.muted }]}>
                {occ.length}/{slotConfig.max_visitors_per_slot} inscrits
              </Text>
              {occ.map((r) => (
                <Text key={r.id} style={[styles.slotName, { color: C.success }]}>
                  ● {r.prenom} {r.nom}
                </Text>
              ))}
              {occ.length === 0 && (
                <Text style={[styles.slotName, { color: C.muted }]}>——</Text>
              )}
            </View>
            <View style={styles.slotRight}>
              {!full && (
                <Text style={[styles.slotAvail, { color: C.accent }]}>Disponible</Text>
              )}
              {full && (
                <Text style={[styles.slotFull, { color: C.danger }]}>Complet</Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Night slot */}
      {slotConfig.night_enabled && (() => {
        const night = getNightReservation(reservations, iso);
        return (
          <View
            style={[
              styles.slotCard,
              {
                backgroundColor: C.card,
                borderColor: night ? "rgba(233,69,96,0.3)" : "rgba(240,180,41,0.3)",
              },
            ]}
          >
            <View style={styles.slotLeft}>
              <Text style={[styles.slotTime, { color: C.gold }]}>🌙 Nuit</Text>
              <Text style={[styles.slotCount, { color: C.muted }]}>18h → 11h</Text>
              {night ? (
                <Text style={[styles.slotName, { color: C.success }]}>● {night.prenom} {night.nom}</Text>
              ) : (
                <Text style={[styles.slotName, { color: C.muted }]}>——</Text>
              )}
            </View>
            <View style={styles.slotRight}>
              {night
                ? <Text style={[styles.slotFull, { color: C.danger }]}>Occupé</Text>
                : <Text style={[styles.slotAvail, { color: C.gold }]}>Disponible</Text>
              }
            </View>
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  scroll: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },
  headerSub: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  emptyTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, marginBottom: 16, textAlign: "center" },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 24 },
  modal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  modalEmoji: { fontSize: 32, marginBottom: 8 },
  modalLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  modalDate: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, textTransform: "capitalize", textAlign: "center", marginBottom: 6 },
  modalSlot: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 36, marginBottom: 20 },
  modalButtons: { flexDirection: "row", gap: 10, width: "100%" },
  modalBtnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalBtnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  modalBtnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalBtnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },
  backBtn: { marginBottom: 14 },
  backText: { fontFamily: "DM_Sans_400Regular", fontSize: 14 },
  dayNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  dayTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, textTransform: "capitalize" },
  daySub: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  slotCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  slotLeft: { flex: 1 },
  slotRight: { justifyContent: "center", paddingLeft: 10 },
  slotTime: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22 },
  slotCount: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  slotName: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginTop: 3 },
  slotAvail: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  slotFull: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
});
