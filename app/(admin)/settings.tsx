import { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Image, TextInput, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/lib/SpaceContext";
import { themes, themeLabels } from "@/lib/themes";
import PatientAvatar from "@/components/PatientAvatar";
import type { ThemeKey } from "@/lib/themes";

// ─── Swatches de prévisualisation par thème ───────────────────────────────────
const THEME_SWATCHES: Record<ThemeKey, string> = {
  blue: "#2E75B6",
  red: "#C0392B",
  pink: "#E91E8C",
  green: "#27AE60",
  yellow: "#D4A017",
  orange: "#E67E22",
};

const THEME_ORDER: ThemeKey[] = ["blue", "red", "pink", "green", "yellow", "orange"];

export default function SettingsScreen() {
  const router = useRouter();
  const { space, slotConfig, loading, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  const [themeUpdating, setThemeUpdating] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [prolonging, setProlonging] = useState(false);
  const [toast, setToast] = useState("");

  // Admin notes
  const notesInit = useRef(false);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  useEffect(() => {
    if (space && !notesInit.current) {
      notesInit.current = true;
      setNotes(space.admin_notes ?? "");
    }
  }, [space]);

  // Service de l'hôpital (hospital_sector)
  const sectorInit = useRef(false);
  const [sector, setSector] = useState("");
  const [sectorSaving, setSectorSaving] = useState(false);
  useEffect(() => {
    if (space && !sectorInit.current) {
      sectorInit.current = true;
      setSector(space.hospital_sector ?? "");
    }
  }, [space]);

  // Nuitées toggle
  const [nightToggling, setNightToggling] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Admin notes ────────────────────────────────────────────────────────────
  async function handleSaveNotes() {
    if (!space) return;
    setNotesSaving(true);
    const { error } = await supabase
      .from("patient_spaces")
      .update({ admin_notes: notes.trim() })
      .eq("id", space.id);
    setNotesSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else showToast("Message enregistré ✓");
  }

  // ── Service de l'hôpital ───────────────────────────────────────────────────
  async function handleSaveSector() {
    if (!space) return;
    setSectorSaving(true);
    const { error } = await supabase
      .from("patient_spaces")
      .update({ hospital_sector: sector.trim() || null })
      .eq("id", space.id);
    setSectorSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else showToast("Service enregistré ✓");
  }

  // ── Nuitées toggle ─────────────────────────────────────────────────────────
  async function handleToggleNight() {
    if (!slotConfig) return;
    setNightToggling(true);
    const { error } = await supabase
      .from("slot_config")
      .update({ night_enabled: !slotConfig.night_enabled })
      .eq("id", slotConfig.id);
    setNightToggling(false);
    if (error) showToast("Erreur lors de la mise à jour.");
    else showToast(slotConfig.night_enabled ? "Nuitées suspendues ✓" : "Nuitées activées ✓");
  }

  // ── Theme switch ───────────────────────────────────────────────────────────
  async function handleThemeChange(key: ThemeKey) {
    if (!space || key === space.theme) return;
    setThemeUpdating(true);
    const { error } = await supabase
      .from("patient_spaces")
      .update({ theme: key })
      .eq("id", space.id);
    setThemeUpdating(false);
    if (error) showToast("Erreur lors du changement de thème.");
    // Realtime in SpaceContext will update space automatically
  }

  // ── Patient photo upload ───────────────────────────────────────────────────
  async function handlePhotoUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setPhotoUploading(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      const response = await fetch(compressed.uri);
      const blob = await response.blob();
      const storagePath = `${space!.id}/photo.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("patient-photos")
        .upload(storagePath, blob, {
          contentType: "image/jpeg",
          cacheControl: "0",
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("patient-photos")
        .getPublicUrl(storagePath);

      // Bust cache with a timestamp
      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("patient_spaces")
        .update({ patient_photo_url: photoUrl })
        .eq("id", space!.id);

      if (dbErr) throw dbErr;

      showToast("Photo mise à jour ✓");
    } catch (e: any) {
      showToast("Erreur : " + (e?.message ?? "inconnue"));
    }
    setPhotoUploading(false);
  }

  async function handleRemovePhoto() {
    if (!space?.patient_photo_url) return;
    Alert.alert("Supprimer la photo ?", "La photo du patient sera retirée de l'app.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.storage.from("patient-photos").remove([`${space.id}/photo.jpg`]);
          await supabase.from("patient_spaces").update({ patient_photo_url: null }).eq("id", space.id);
          showToast("Photo supprimée ✓");
        },
      },
    ]);
  }

  // ── Prolongation RGPD ─────────────────────────────────────────────────────
  function handleProlong() {
    if (!space) return;
    Alert.alert(
      "Prolonger l'espace",
      "Ajouter 30 jours à la date de conservation ? Toutes les données seront conservées 30 jours de plus.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Prolonger",
          onPress: async () => {
            setProlonging(true);

            const currentPurge = new Date(space.purge_scheduled_at);
            const newPurge = new Date(currentPurge);
            newPurge.setDate(newPurge.getDate() + 30);

            const currentEnd = new Date(space.end_date + "T00:00:00");
            const newEnd = new Date(currentEnd);
            newEnd.setDate(newEnd.getDate() + 30);

            const { error } = await supabase
              .from("patient_spaces")
              .update({
                purge_scheduled_at: newPurge.toISOString(),
                end_date: newEnd.toISOString().split("T")[0],
              })
              .eq("id", space.id);

            setProlonging(false);
            if (error) {
              showToast("Erreur lors de la prolongation.");
            } else {
              showToast("Espace prolongé de 30 jours ✓");
            }
          },
        },
      ],
    );
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  function handleLogout() {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/");
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: C.muted }]}>← Compte</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>⚙️ Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {hasSpace && space ? (
          <>
            {/* ── Section : Espace patient ──────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Espace patient</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={styles.patientRow}>
                <PatientAvatar
                  photoUrl={space.patient_photo_url}
                  firstname={space.patient_firstname}
                  lastname={space.patient_lastname}
                  size={56}
                  C={C}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.patientName, { color: "#fff" }]}>
                    {space.patient_firstname} {space.patient_lastname}
                  </Text>
                  <Text style={[styles.patientHospital, { color: C.muted }]}>
                    {space.hospital_name}
                    {space.hospital_room ? ` · ${space.hospital_room}` : ""}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Section : Photo patient ───────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Photo du patient</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Affichée en avatar dans l'app pour tous les visiteurs. Ronde, centrée sur le visage.
              </Text>

              <View style={styles.photoRow}>
                <PatientAvatar
                  photoUrl={space.patient_photo_url}
                  firstname={space.patient_firstname}
                  lastname={space.patient_lastname}
                  size={72}
                  C={C}
                />
                <View style={{ flex: 1, gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: C.accent }]}
                    onPress={handlePhotoUpload}
                    disabled={photoUploading}
                  >
                    {photoUploading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.photoBtnText}>
                          {space.patient_photo_url ? "Changer la photo" : "Ajouter une photo"}
                        </Text>
                    }
                  </TouchableOpacity>
                  {space.patient_photo_url && (
                    <TouchableOpacity
                      style={[styles.photoBtn, { borderWidth: 1, borderColor: "rgba(233,69,96,0.4)", backgroundColor: "rgba(233,69,96,0.08)" }]}
                      onPress={handleRemovePhoto}
                    >
                      <Text style={[styles.photoBtnText, { color: "#e94560" }]}>Supprimer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* ── Section : Thème ───────────────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Thème de couleur</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Appliqué en temps réel pour tous les visiteurs.
              </Text>
              {themeUpdating && (
                <ActivityIndicator color={C.accent} style={{ marginBottom: 12 }} />
              )}
              <View style={styles.themeGrid}>
                {THEME_ORDER.map((key) => {
                  const isActive = space.theme === key;
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
                      onPress={() => handleThemeChange(key)}
                      disabled={themeUpdating}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.themeSwatch, { backgroundColor: THEME_SWATCHES[key] }]} />
                      <Text style={[styles.themeLabel, { color: isActive ? "#fff" : C.muted }]}>
                        {themeLabels[key]}
                      </Text>
                      {isActive && (
                        <Text style={[styles.themeCheck, { color: THEME_SWATCHES[key] }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {/* ── Section : Service de l'hôpital ────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Service de l'hôpital</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Affiché dans le bandeau (ex : "Secteur A"), entre le service et la chambre.
              </Text>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : Secteur A"
                placeholderTextColor={C.muted}
                value={sector}
                onChangeText={setSector}
              />
              <TouchableOpacity
                style={[styles.saveNotesBtn, { backgroundColor: C.accent }, sectorSaving && { opacity: 0.6 }]}
                onPress={handleSaveSector}
                disabled={sectorSaving}
              >
                {sectorSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveNotesBtnText}>Enregistrer le service</Text>
                }
              </TouchableOpacity>
            </View>

            {/* ── Section : Consignes de visite ─────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Consignes de visite</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Affiché aux visiteurs dans l'onglet Infos.
              </Text>
              <Text style={[styles.warningText, { color: C.orange }]}>
                ⚠️ N'indiquez pas d'informations médicales sensibles.
              </Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : La chambre se trouve au 3ème étage, aile B…"
                placeholderTextColor={C.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.saveNotesBtn, { backgroundColor: C.accent }, notesSaving && { opacity: 0.6 }]}
                onPress={handleSaveNotes}
                disabled={notesSaving}
              >
                {notesSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveNotesBtnText}>Enregistrer les consignes</Text>
                }
              </TouchableOpacity>
            </View>

            {/* ── Section : Nuitées ─────────────────────────────────────────── */}
            {slotConfig && (
              <>
                <Text style={[styles.sectionTitle, { color: C.gold }]}>Nuitées</Text>
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={styles.nightRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.nightLabel, { color: "#fff" }]}>
                        {slotConfig.night_enabled ? "Nuitées activées" : "Nuitées suspendues"}
                      </Text>
                      <Text style={[styles.nightDesc, { color: C.muted }]}>
                        {slotConfig.night_enabled
                          ? "Les visiteurs peuvent réserver une nuit (18h → 11h)."
                          : "Le bloc nuit est masqué pour les visiteurs."}
                      </Text>
                    </View>
                    {nightToggling
                      ? <ActivityIndicator color={C.accent} />
                      : <Switch
                          value={slotConfig.night_enabled}
                          onValueChange={handleToggleNight}
                          trackColor={{ false: C.border, true: C.accent }}
                          thumbColor="#fff"
                        />
                    }
                  </View>
                </View>
              </>
            )}
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.cardDesc, { color: C.muted }]}>
              Aucun espace patient actif.{"\n"}Rendez-vous sur avectoi.care pour créer votre espace.
            </Text>
          </View>
        )}

        {/* ── Section : Conservation RGPD ──────────────────────────────────── */}
        {hasSpace && space && (() => {
          const purgeDate = new Date(space.purge_scheduled_at);
          const todayMs = new Date().setHours(0, 0, 0, 0);
          const daysLeft = Math.ceil((purgeDate.getTime() - todayMs) / (1000 * 60 * 60 * 24));
          const purgeDateFr = purgeDate.toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric",
          });
          const isUrgent = daysLeft <= 7;
          const isWarning = daysLeft <= 30;
          const alertColor = isUrgent ? "#e94560" : isWarning ? C.orange : C.muted;

          return (
            <>
              <Text style={[styles.sectionTitle, { color: C.gold }]}>Conservation des données</Text>
              <View style={[styles.card, {
                backgroundColor: C.card,
                borderColor: isUrgent ? "rgba(233,69,96,0.5)" : isWarning ? "rgba(230,126,34,0.4)" : C.border,
              }]}>
                <View style={styles.rgpdRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rgpdLabel, { color: C.muted }]}>Suppression prévue le</Text>
                    <Text style={[styles.rgpdDate, { color: isUrgent ? "#e94560" : "#fff" }]}>
                      {purgeDateFr}
                    </Text>
                    <Text style={[styles.rgpdDays, { color: alertColor }]}>
                      {daysLeft > 0
                        ? `J-${daysLeft}${isUrgent ? " ⚠️  Suppression imminente" : isWarning ? " — Pensez à prolonger" : ""}`
                        : "Expiration dépassée"
                      }
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardDesc, { marginTop: 12, marginBottom: 14 }]}>
                  Planning, souvenirs et messages seront définitivement supprimés à cette date. Conforme RGPD.
                </Text>

                <TouchableOpacity
                  style={[styles.prolongBtn, { backgroundColor: C.accent }, prolonging && { opacity: 0.6 }]}
                  onPress={handleProlong}
                  disabled={prolonging}
                >
                  {prolonging
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.prolongBtnText}>⏳ Prolonger de 30 jours (renouvelable gratuitement)</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          );
        })()}

        {/* ── Section : Compte ─────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: C.gold }]}>Compte</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: "rgba(233,69,96,0.4)" }]}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Text style={[styles.logoutText, { color: "#e94560" }]}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Toast */}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { marginBottom: 8 },
  backBtnText: { fontFamily: "DM_Sans_400Regular", fontSize: 14 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },

  scroll: { padding: 16, paddingBottom: 48 },
  sectionTitle: {
    fontFamily: "DM_Sans_600SemiBold", fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 10, marginTop: 20,
  },
  card: {
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 4,
  },
  cardDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 20, marginBottom: 14 },

  // Patient row
  patientRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  patientName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16 },
  patientHospital: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginTop: 2 },

  // Photo
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  photoBtn: {
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: "center", justifyContent: "center",
  },
  photoBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },

  // Theme grid
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  themeOption: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    minWidth: "46%",
  },
  themeSwatch: { width: 18, height: 18, borderRadius: 9 },
  themeLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, flex: 1 },
  themeCheck: { fontFamily: "DM_Sans_700Bold", fontSize: 14 },

  // RGPD
  rgpdRow: { flexDirection: "row", alignItems: "flex-start" },
  rgpdLabel: { fontFamily: "DM_Sans_400Regular", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  rgpdDate: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 17 },
  rgpdDays: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, marginTop: 4 },
  prolongBtn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  prolongBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },

  // Service de l'hôpital
  sectorInput: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontFamily: "DM_Sans_400Regular", fontSize: 14,
    marginBottom: 12,
  },

  // Admin notes
  warningText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, marginBottom: 10 },
  notesInput: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontFamily: "DM_Sans_400Regular", fontSize: 14,
    minHeight: 100, marginBottom: 12,
  },
  saveNotesBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  saveNotesBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },

  // Nuitées
  nightRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nightLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, marginBottom: 4 },
  nightDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 18 },

  // Logout
  logoutBtn: {
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 14, alignItems: "center",
  },
  logoutText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15 },

  toast: {
    position: "absolute", bottom: 24, alignSelf: "center",
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
  },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
