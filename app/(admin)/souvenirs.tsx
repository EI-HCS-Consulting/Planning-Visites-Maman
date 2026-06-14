import { View, Text, StyleSheet } from "react-native";
import { themes } from "@/lib/themes";

const C = themes.blue;

export default function AdminSouvenirsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Galerie Souvenirs</Text>
      <Text style={styles.sub}>Upload, grille, sélectionner tout, télécharger tout — à implémenter (tâche 5)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 24, color: "#fff", marginBottom: 12 },
  sub: { fontFamily: "DM_Sans_400Regular", fontSize: 14, color: C.muted, textAlign: "center" },
});
