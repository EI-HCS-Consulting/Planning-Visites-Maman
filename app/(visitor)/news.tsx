import { View, Text, StyleSheet } from "react-native";
import { themes } from "@/lib/themes";
const C = themes.blue;
export default function VisitorNewsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nouvelles du jour</Text>
      <Text style={styles.sub}>Flux anté-chronologique — tâche 6</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 24, color: "#fff", marginBottom: 12 },
  sub: { fontFamily: "DM_Sans_400Regular", fontSize: 14, color: C.muted, textAlign: "center" },
});
