import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSpace } from "@/lib/SpaceContext";
import { themes } from "@/lib/themes";
import PatientAvatar from "@/components/PatientAvatar";

// Onglet "Compte" côté admin — contrairement au visiteur, l'admin gère un
// espace entier : ce petit écran récapitule l'espace et renvoie vers
// Paramètres (qui regroupe tout ce que l'admin peut configurer).
export default function AdminAccountScreen() {
  const router = useRouter();
  const { space, loading, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>👤 Mon compte</Text>
      </View>

      {hasSpace && space ? (
        <View style={styles.body}>
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
              <Text style={[styles.patientSub, { color: C.muted }]}>
                {space.premium ? "Espace premium" : "Espace gratuit"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: C.accent }]}
            onPress={() => router.push("/(admin)/settings")}
            activeOpacity={0.85}
          >
            <Text style={styles.settingsBtnText}>⚙️ Paramètres</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: C.muted }]}>Aucun espace patient actif.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },
  body: { padding: 16 },
  patientRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  patientName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },
  patientSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginTop: 2 },
  settingsBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  settingsBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center" },
});
