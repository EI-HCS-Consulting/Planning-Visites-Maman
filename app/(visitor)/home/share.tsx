import { View, ScrollView } from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";
import ShareSpace from "@/components/ShareSpace";

export default function VisitorShareScreen() {
  const { space } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!space) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SpaceHeader space={space} active="share" basePath="/(visitor)/home" C={C} />
      <ScrollView>
        <ShareSpace space={space} C={C} />
      </ScrollView>
    </View>
  );
}
