import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/lib/SpaceContext";
import { themes, themeLabels } from "@/lib/themes";
import type { ThemeKey } from "@/lib/themes";

const THEME_SWATCHES: Record<ThemeKey, string> = {
  blue: "#2E75B6",
  red: "#C0392B",
  pink: "#E91E8C",
  green: "#27AE60",
  yellow: "#D4A017",
  orange: "#E67E22",
};
const THEME_ORDER: ThemeKey[] = ["blue", "red", "pink", "green", "yellow", "orange"];

// Sensible defaults — admin can refine slot timing later; the onboarding
// form itself only covers patient identity + hospital info + visit rules.
const DEFAULT_SLOT_CONFIG = {
  visit_start_hour: 14,
  visit_end_hour: 20,
  slot_duration_minutes: 30,
  min_gap_minutes: 0,
  max_visitors_per_slot: 2,
  night_enabled: false,
  max_night_visitors: 1,
};

const SPACE_DURATION_DAYS = 90; // matches the "Prolonger de 90 jours" RGPD cycle

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

/**
 * Shown in place of the admin tabs as soon as an authenticated admin has no
 * active patient_spaces row yet — covers both the fresh-signup path and an
 * admin who logs back in after a space was somehow removed.
 */
export default function PatientOnboarding() {
  const { refreshSpace } = useSpace();
  const C = themes.blue;

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalService, setHospitalService] = useState("");
  const [hospitalRoom, setHospitalRoom] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [hospitalMapsUrl, setHospitalMapsUrl] = useState("");
  const [visitRules, setVisitRules] = useState("");
  const [theme, setTheme] = useState<ThemeKey>("blue");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = firstname.trim().length > 0 && lastname.trim().length > 0 && !submitting;

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) throw userErr ?? new Error("Session expirée, reconnecte-toi.");

      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + SPACE_DURATION_DAYS);

      const { data: space, error: spaceErr } = await supabase
        .from("patient_spaces")
        .insert({
          admin_id: userData.user.id,
          patient_firstname: firstname.trim(),
          patient_lastname: lastname.trim(),
          hospital_name: hospitalName.trim(),
          hospital_service: hospitalService.trim(),
          hospital_room: hospitalRoom.trim(),
          hospital_address: hospitalAddress.trim(),
          hospital_maps_url: hospitalMapsUrl.trim(),
          visit_rules: visitRules.trim(),
          theme,
          is_active: true,
          premium: false,
          invite_token: Crypto.randomUUID(),
          start_date: isoDate(now),
          end_date: isoDate(end),
          last_activity_at: now.toISOString(),
          purge_scheduled_at: end.toISOString(),
        })
        .select()
        .single();

      if (spaceErr || !space) throw spaceErr ?? new Error("Création de l'espace impossible.");

      const { error: slotErr } = await supabase
        .from("slot_config")
        .insert({ space_id: space.id, ...DEFAULT_SLOT_CONFIG });

      if (slotErr) throw slotErr;

      await refreshSpace();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer l'espace pour le moment.");
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Bienvenue 👋</Text>
        <Text style={styles.subtitle}>
          Crée l'espace de la personne que tu accompagnes pour commencer.{"\n"}
          Tu pourras tout modifier plus tard dans Paramètres.
        </Text>

        <Text style={[styles.sectionTitle, { color: C.gold }]}>Patient</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Prénom *"
            placeholderTextColor={C.muted}
            value={firstname}
            onChangeText={setFirstname}
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Nom *"
            placeholderTextColor={C.muted}
            value={lastname}
            onChangeText={setLastname}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: C.gold }]}>Hôpital</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Nom de l'hôpital"
            placeholderTextColor={C.muted}
            value={hospitalName}
            onChangeText={setHospitalName}
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Service"
            placeholderTextColor={C.muted}
            value={hospitalService}
            onChangeText={setHospitalService}
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="N° de chambre"
            placeholderTextColor={C.muted}
            value={hospitalRoom}
            onChangeText={setHospitalRoom}
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Adresse"
            placeholderTextColor={C.muted}
            value={hospitalAddress}
            onChangeText={setHospitalAddress}
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Lien Google Maps (optionnel)"
            placeholderTextColor={C.muted}
            value={hospitalMapsUrl}
            onChangeText={setHospitalMapsUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: C.gold }]}>Consignes de visite</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardDesc, { color: C.muted }]}>
            Une consigne par ligne — affichées aux visiteurs dans l'onglet Infos.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder={"Ex :\nMasque obligatoire\nMax 2 personnes par visite"}
            placeholderTextColor={C.muted}
            value={visitRules}
            onChangeText={setVisitRules}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: C.gold }]}>Thème de couleur</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.themeGrid}>
            {THEME_ORDER.map((key) => {
              const isActive = theme === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: C.bg,
                      borderColor: isActive ? THEME_SWATCHES[key] : C.border,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                  onPress={() => setTheme(key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: THEME_SWATCHES[key] }]} />
                  <Text style={[styles.themeLabel, { color: isActive ? "#fff" : C.muted }]}>
                    {themeLabels[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: C.accent }, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Créer l'espace</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>
          Tu pourras planifier jusqu'à 5 visites gratuitement.{"\n"}
          Pas de carte bancaire, pas d'engagement.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 48 },
  title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 26, color: "#fff", marginBottom: 8 },
  subtitle: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 21, color: "#7a8fa6", marginBottom: 24 },
  sectionTitle: {
    fontFamily: "DM_Sans_600SemiBold", fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 10, marginTop: 18,
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 19, marginBottom: 2 },
  input: {
    borderWidth: 1, borderRadius: 10, padding: 13,
    fontFamily: "DM_Sans_400Regular", fontSize: 15,
  },
  textarea: { minHeight: 90 },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  themeOption: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    minWidth: "46%",
  },
  themeSwatch: { width: 18, height: 18, borderRadius: 9 },
  themeLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, flex: 1 },
  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 16, color: "#fff" },
  hint: {
    fontFamily: "DM_Sans_400Regular", fontSize: 12, color: "#7a8fa6",
    textAlign: "center", marginTop: 16, lineHeight: 18,
  },
});
