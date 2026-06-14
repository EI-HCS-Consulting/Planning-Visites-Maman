import { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Image,
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
  const { space, loading, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  const [themeUpdating, setThemeUpdating] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
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
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.cardDesc, { color: C.muted }]}>
              Aucun espace patient actif.{"\n"}Rendez-vous sur avectoi.care pour créer votre espace.
            </Text>
          </View>
        )}

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
