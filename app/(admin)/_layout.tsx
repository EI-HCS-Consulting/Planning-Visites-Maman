import { useEffect, useState, type ReactNode } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { AdminSpaceProvider, useSpace } from "@/lib/SpaceContext";
import { themes } from "@/lib/themes";
import PatientOnboarding from "@/components/PatientOnboarding";

const C = themes.blue;

// Sits inside AdminSpaceProvider — shows the onboarding form instead of the
// tabs until the admin has an active patient_spaces row.
function AdminGate({ children }: { children: ReactNode }) {
  const { loading, hasSpace } = useSpace();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!hasSpace) {
    return <PatientOnboarding />;
  }

  return <>{children}</>;
}

export default function AdminLayout() {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/auth/login");
        return;
      }
      setAdminId(session.user.id);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.replace("/");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready || !adminId) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <AdminSpaceProvider adminId={adminId}>
      <AdminGate>
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
          <Tabs.Screen
            name="settings"
            options={{ href: null }}
          />
        </Tabs>
      </AdminGate>
    </AdminSpaceProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" },
});
