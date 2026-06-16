import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from "react-native";
import { Tabs, useGlobalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VisitorSpaceProvider, useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import { setupNotifications } from "@/lib/notifications";

function VisitorTabs() {
  const { space, loading } = useVisitorSpace();
  const router = useRouter();
  const C = themes[space?.theme ?? "blue"];
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    if (!loading && !space) {
      router.replace("/auth/visitor-entry");
    }
  }, [loading, space]);

  useEffect(() => {
    if (!space) return;
    AsyncStorage.getItem(`consent_${space.id}`).then((val) => {
      setConsentGiven(val === "true");
    });
  }, [space?.id]);

  async function handleConsent() {
    if (!space) return;
    await AsyncStorage.setItem(`consent_${space.id}`, "true");
    setConsentGiven(true);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: themes.blue.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={themes.blue.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <Modal visible={consentGiven === false} transparent animationType="fade" statusBarTranslucent>
        <View style={consentStyles.overlay}>
          <View style={[consentStyles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={consentStyles.emoji}>👥</Text>
            <Text style={[consentStyles.title, { color: "#fff" }]}>Avant de continuer</Text>
            <Text style={[consentStyles.body, { color: C.muted }]}>
              Votre prénom et votre nom seront visibles par les autres personnes qui consultent ce planning.
            </Text>
            <TouchableOpacity
              style={[consentStyles.btn, { backgroundColor: C.accent }]}
              onPress={handleConsent}
              activeOpacity={0.85}
            >
              <Text style={consentStyles.btnText}>J'ai compris, continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
        name="home"
        options={{ href: null }}
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
        name="soutien"
        options={{
          title: "Soutien",
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Compte",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
    </>
  );
}

const consentStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  emoji: { fontSize: 44, marginBottom: 16 },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    marginBottom: 14,
    textAlign: "center",
  },
  body: {
    fontFamily: "DM_Sans_400Regular",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 28,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 15,
    width: "100%",
    alignItems: "center",
  },
  btnText: {
    fontFamily: "DM_Sans_700Bold",
    fontSize: 15,
    color: "#fff",
  },
});

export default function VisitorLayout() {
  // useGlobalSearchParams (not useLocalSearchParams): this layout is now two
  // levels above the actual screens (Tabs > home Stack > calendar/slots/...),
  // so the token/spaceId query params attached to e.g. "/(visitor)/home/calendar"
  // aren't visible to a *local* params read way up here — only the global,
  // whole-URL search params are.
  const { token } = useGlobalSearchParams<{ token: string }>();

  return (
    <VisitorSpaceProvider token={token ?? ""}>
      <VisitorTabs />
    </VisitorSpaceProvider>
  );
}
