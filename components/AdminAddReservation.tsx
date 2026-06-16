import { useState, forwardRef, useImperativeHandle } from "react";
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { toFrLong } from "@/lib/slotUtils";
import type { Theme } from "@/lib/themes";

// Modale "ajouter une réservation" côté admin — pas de PIN, pas de cap
// freemium (l'admin peut toujours ajouter). Partagée entre (admin)/home/
// slots.tsx (Visite) et nights.tsx (Nuit) pour éviter de dupliquer ce
// formulaire dans les deux écrans.

export interface AdminAddReservationHandle {
  open: (iso: string, slot: string, type: "Visite" | "Nuit") => void;
}

interface Props {
  spaceId: string;
  onAdded: () => void;
  C: Theme;
}

function AdminAddReservation({ spaceId, onAdded, C }: Props, ref: React.Ref<AdminAddReservationHandle>) {
  const [target, setTarget] = useState<{ iso: string; slot: string; type: "Visite" | "Nuit" } | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    open: (iso, slot, type) => {
      setTarget({ iso, slot, type });
      setPrenom(""); setNom(""); setTel("");
    },
  }));

  async function handleAdd() {
    if (!target || !prenom.trim() || !nom.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("reservations").insert({
      space_id: spaceId,
      date: target.iso,
      creneau: target.type === "Nuit" ? "🌙 Nuit" : target.slot,
      prenom: prenom.trim(),
      nom: nom.trim(),
      telephone: tel.trim(),
      type: target.type,
      pin: "ADMIN",
    });
    setSaving(false);
    if (error) {
      // Modale native au-dessus de tout — visible même si la modale d'ajout
      // (elle aussi native) reste ouverte.
      Alert.alert("Erreur", "Erreur lors de l'ajout : " + error.message);
      return;
    }
    setTarget(null);
    onAdded();
  }

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !saving && setTarget(null)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
              <Text style={[styles.sheetTitle, { color: "#fff" }]}>
                ➕ Ajouter {target?.type === "Nuit" ? "une nuitée" : `une visite — ${target?.slot}`}
              </Text>
              <Text style={[styles.sheetSub, { color: C.muted }]}>
                {target && toFrLong(new Date(target.iso + "T12:00:00"))}
              </Text>

              <TextInput
                style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Prénom *" placeholderTextColor={C.muted}
                value={prenom} onChangeText={setPrenom} autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Nom *" placeholderTextColor={C.muted}
                value={nom} onChangeText={setNom} autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Téléphone (optionnel)" placeholderTextColor={C.muted}
                value={tel} onChangeText={setTel} keyboardType="phone-pad"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtnSecondary, { borderColor: C.border }]} onPress={() => setTarget(null)} disabled={saving}>
                  <Text style={[styles.modalBtnSecondaryText, { color: C.muted }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnPrimary, { backgroundColor: C.accent }, (!prenom.trim() || !nom.trim() || saving) && { opacity: 0.5 }]}
                  onPress={handleAdd}
                  disabled={!prenom.trim() || !nom.trim() || saving}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnPrimaryText}>Ajouter</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default forwardRef(AdminAddReservation);

const styles = StyleSheet.create({
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
});
