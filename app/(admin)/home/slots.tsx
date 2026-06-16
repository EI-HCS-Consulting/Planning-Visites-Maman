import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Modal, Alert, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSpace } from "@/lib/SpaceContext";
import { supabase } from "@/lib/supabase";
import {
  getSlotOccupancy, getNightReservation, toISO, toFrLong, toFrShort, addDays,
} from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";
import type { Reservation } from "@/lib/types";
import type { Theme } from "@/lib/themes";

export default function AdminSlotsScreen() {
  const {
    space, slotConfig, reservations, selectedDay, setSelectedDay, refreshReservations,
    pendingBookingSlot, setPendingBookingSlot,
  } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  const startDate = space ? new Date(space.start_date + "T00:00:00") : new Date();

  const [addSlot, setAddSlot] = useState<string | null>(null);
  const [addPrenom, setAddPrenom] = useState("");
  const [addNom, setAddNom] = useState("");
  const [addTel, setAddTel] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openAddResa(slot: string) {
    setAddSlot(slot);
    setAddPrenom(""); setAddNom(""); setAddTel("");
  }

  // Arrivée via "Prochaine disponibilité → Ajouter" (Calendrier) : ouvre
  // directement la modale d'ajout sur le créneau ciblé.
  useEffect(() => {
    if (pendingBookingSlot) {
      openAddResa(pendingBookingSlot);
      setPendingBookingSlot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddResa() {
    if (!space || !addSlot || !addPrenom.trim() || !addNom.trim()) return;
    setAddSaving(true);
    const { error } = await supabase.from("reservations").insert({
      space_id: space.id,
      date: toISO(selectedDay),
      creneau: addSlot,
      prenom: addPrenom.trim(),
      nom: addNom.trim(),
      telephone: addTel.trim(),
      type: addSlot === "🌙 Nuit" ? "Nuit" : "Visite",
      pin: "ADMIN",
    });
    setAddSaving(false);
    if (error) { showToast("Erreur lors de l'ajout."); return; }
    showToast("Réservation ajoutée ✓");
    setAddSlot(null);
    await refreshReservations();
  }

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
  const night = getNightReservation(reservations, iso);

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

        {/* Visite slots */}
        <SlotsList
          iso={iso}
          reservations={reservations}
          C={C}
          onAdd={openAddResa}
          onDelete={handleDeleteResa}
        />

        {/* Night slot */}
        {slotConfig.night_enabled && (
          <View
            style={[styles.slotCard, { backgroundColor: C.card, borderColor: night ? "rgba(233,69,96,0.3)" : "rgba(240,180,41,0.3)" }]}
          >
            <View style={styles.slotHeader}>
              <Text style={[styles.slotTime, { color: C.gold }]}>🌙 Nuit</Text>
              <Text style={[styles.slotCount, { color: C.muted }]}>18h → 11h</Text>
              {!night && (
                <TouchableOpacity
                  style={[styles.addResaBtn, { backgroundColor: C.gold }]}
                  onPress={() => openAddResa("🌙 Nuit")}
                >
                  <Text style={[styles.addResaBtnText, { color: "#0D1B2E" }]}>+ Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
            {night ? (
              <View style={[styles.resaRow, { borderColor: C.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resaName, { color: C.success }]}>● {night.prenom} {night.nom}</Text>
                  {night.telephone ? <Text style={[styles.resaTel, { color: C.muted }]}>{night.telephone}</Text> : null}
                </View>
                <TouchableOpacity style={[styles.deleteResaBtn, { borderColor: "rgba(233,69,96,0.4)" }]} onPress={() => handleDeleteResa(night)}>
                  <Text style={{ color: "#e94560", fontSize: 13 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.slotEmpty, { color: C.muted }]}>Aucun visiteur inscrit</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── MODAL AJOUT RÉSERVATION ─────────────────────────────────────── */}
      <Modal visible={!!addSlot} transparent animationType="slide" onRequestClose={() => setAddSlot(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !addSaving && setAddSlot(null)}>
            <TouchableOpacity activeOpacity={1}>
              <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                <Text style={[styles.sheetTitle, { color: "#fff" }]}>➕ Ajouter une visite — {addSlot}</Text>
                <Text style={[styles.sheetSub, { color: C.muted }]}>{toFrLong(selectedDay)}</Text>

                <TextInput
                  style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Prénom *" placeholderTextColor={C.muted}
                  value={addPrenom} onChangeText={setAddPrenom} autoCapitalize="words"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Nom *" placeholderTextColor={C.muted}
                  value={addNom} onChangeText={setAddNom} autoCapitalize="words"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Téléphone (optionnel)" placeholderTextColor={C.muted}
                  value={addTel} onChangeText={setAddTel} keyboardType="phone-pad"
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalBtnSecondary, { borderColor: C.border }]} onPress={() => setAddSlot(null)} disabled={addSaving}>
                    <Text style={[styles.modalBtnSecondaryText, { color: C.muted }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtnPrimary, { backgroundColor: C.accent }, (!addPrenom.trim() || !addNom.trim() || addSaving) && { opacity: 0.5 }]}
                    onPress={handleAddResa}
                    disabled={!addPrenom.trim() || !addNom.trim() || addSaving}
                  >
                    {addSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnPrimaryText}>Ajouter</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

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

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", padding: 20 },
  sheet: { width: "100%", maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 24, paddingBottom: 36, alignItems: "center" },
  sheetTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, marginBottom: 6, textAlign: "center" },
  sheetSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textAlign: "center", marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10, width: "100%" },
  modalButtons: { flexDirection: "row", gap: 10, width: "100%", marginTop: 16 },
  modalBtnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalBtnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  modalBtnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  modalBtnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
