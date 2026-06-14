import { useSpace } from "@/lib/SpaceContext";
import { themes } from "@/lib/themes";
import SouvenirsGallery from "@/components/SouvenirsGallery";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export default function AdminSouvenirsScreen() {
  const { space, loading, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!hasSpace || !space) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Text style={[styles.emptyText, { color: C.muted }]}>
          Aucun espace patient actif.
        </Text>
      </View>
    );
  }

  return <SouvenirsGallery spaceId={space.id} C={C} isAdmin={true} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 15, textAlign: "center" },
});
