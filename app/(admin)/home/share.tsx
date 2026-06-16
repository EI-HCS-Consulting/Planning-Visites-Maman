import { View, ScrollView } from "react-native";
import { useSpace } from "@/lib/SpaceContext";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";
import ShareSpace from "@/components/ShareSpace";

export default function AdminShareScreen() {
  const { space, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!hasSpace || !space) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SpaceHeader space={space} active="share" basePath="/(admin)/home" C={C} />
      <ScrollView>
        <ShareSpace space={space} C={C} />
      </ScrollView>
    </View>
  );
}
