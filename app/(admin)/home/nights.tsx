import { View, Text, StyleSheet } from "react-native";
import { useSpace } from "@/lib/SpaceContext";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";

// Placeholder — voir (visitor)/home/nights.tsx, le contenu complet arrive
// au Lot 3.
export default function AdminNightsScreen() {
  const { space, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!hasSpace || !space) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SpaceHeader space={space} active="nights" basePath="/(admin)/home" C={C} />
      <View style={styles.center}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🌙</Text>
        <Text style={[styles.text, { color: C.muted }]}>
          La liste des nuitées et la réservation dédiée arrivent bientôt.{"\n"}
          En attendant, gère les nuitées depuis l'onglet 🕐 Créneaux.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  text: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
});
