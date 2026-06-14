import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import SouvenirsGallery from "@/components/SouvenirsGallery";
import { View, ActivityIndicator } from "react-native";

export default function VisitorSouvenirsScreen() {
  const { space } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!space) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return <SouvenirsGallery spaceId={space.id} C={C} isAdmin={false} />;
}
