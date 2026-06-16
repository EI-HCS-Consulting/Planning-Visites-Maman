import { View, ActivityIndicator } from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import Soutien from "@/components/Soutien";

export default function VisitorSoutienScreen() {
  const { space } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!space) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return <Soutien spaceId={space.id} C={C} isAdmin={false} />;
}
