import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VisitorSpaceProvider, useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";

function VisitorTabs() {
  const { space, loading } = useVisitorSpace();
  const router = useRouter();
  const C = themes[space?.theme ?? "blue"];

  useEffect(() => {
    if (!loading && !space) {
      router.replace("/auth/visitor-entry");
    }
  }, [loading, space]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: themes.blue.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={themes.blue.accent} size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, borderTopWidth: 1 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendrier",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="slots"
        options={{
          title: "Créneaux",
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "Nouvelles",
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="souvenirs"
        options={{
          title: "Souvenirs",
          tabBarIcon: ({ color, size }) => <Ionicons name="images-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="entraide"
        options={{
          title: "Entraide",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: "Infos",
          tabBarIcon: ({ color, size }) => <Ionicons name="information-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function VisitorLayout() {
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <VisitorSpaceProvider token={token ?? ""}>
      <VisitorTabs />
    </VisitorSpaceProvider>
  );
}
