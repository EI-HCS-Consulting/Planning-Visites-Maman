import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { themes } from "@/lib/themes";

const C = themes.blue;

export default function VisitorCalendarScreen() {
  const { spaceId, token } = useLocalSearchParams<{ spaceId: string; token: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendrier des visites</Text>
      <Text style={styles.sub}>Espace : {spaceId}</Text>
      <Text style={styles.sub}>Migration MVP calendrier + créneaux + réservation + PIN — à implémenter (tâche 4)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 24, color: "#fff", marginBottom: 12 },
  sub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 8 },
});
