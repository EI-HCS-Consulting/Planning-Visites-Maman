import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { themes } from "@/lib/themes";
import { getVisitorSession } from "@/lib/visitorSession";

const C = themes.blue;

export default function WelcomeScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        router.replace("/(admin)/home/calendar");
        return;
      }

      // No admin session — check for a remembered visitor session so a
      // returning visitor lands straight on the calendar instead of
      // having to paste their invite link again.
      const visitor = await getVisitorSession();
      if (visitor) {
        router.replace({
          pathname: "/(visitor)/home/calendar",
          params: { spaceId: visitor.spaceId, token: visitor.token },
        });
        return;
      }

      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
        <Image source={require("@/assets/icon.png")} style={styles.logo} resizeMode="contain" />
      </View>

      <Text style={styles.title}>AvecToi</Text>
      <Text style={styles.baseline}>
        Parce qu'être présent,{"\n"}ça s'organise
      </Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push("/auth/visitor-entry")}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>📅 Je rends visite</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push("/auth/login")}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>🙋 Je suis Admin</Text>
        </TouchableOpacity>
      </View>

      {/* Reader app notice — no pricing, no purchase CTA */}
      <Text style={styles.notice}>
        Connectez-vous à votre espace patient pour commencer.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoWrap: {
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 38,
    color: "#fff",
    marginBottom: 8,
  },
  baseline: {
    fontFamily: "DM_Sans_400Regular",
    fontSize: 16,
    color: C.muted,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnPrimaryText: {
    fontFamily: "DM_Sans_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  btnSecondaryText: {
    fontFamily: "DM_Sans_600SemiBold",
    fontSize: 16,
    color: C.text,
  },
  notice: {
    fontFamily: "DM_Sans_400Regular",
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    marginTop: "auto",
    paddingTop: 24,
  },
});
