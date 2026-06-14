import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { themes } from "@/lib/themes";

const C = themes.blue;

export default function SettingsScreen() {
  const router = useRouter();

  async function handleLogout() {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Paramètres</Text>
      <Text style={styles.sub}>Config espace, thème, purge RGPD — à implémenter (tâches 8 & 12)</Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 24, color: "#fff", marginBottom: 12 },
  sub: { fontFamily: "DM_Sans_400Regular", fontSize: 14, color: C.muted, textAlign: "center", marginBottom: 40 },
  logoutBtn: {
    borderWidth: 1, borderColor: C.danger, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  logoutText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, color: C.danger },
});
