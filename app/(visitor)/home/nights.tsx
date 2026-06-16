import { View, Text, StyleSheet } from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";

// Placeholder — le contenu complet (liste des nuitées programmées + réservation
// de la prochaine nuitée disponible) arrive au Lot 3. Pour l'instant la nuitée
// se réserve toujours depuis l'onglet Créneaux.
export default function VisitorNightsScreen() {
  const { space } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!space) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SpaceHeader space={space} active="nights" basePath="/(visitor)/home" C={C} />
      <View style={styles.center}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🌙</Text>
        <Text style={[styles.text, { color: C.muted }]}>
          La liste des nuitées et la réservation dédiée arrivent bientôt.{"\n"}
          En attendant, réserve une nuitée depuis l'onglet 🕐 Créneaux.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  text: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
});
