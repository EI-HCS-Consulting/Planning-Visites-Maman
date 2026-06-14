import { useEffect } from "react";
import { View, ActivityIndicator, Text, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { themes } from "@/lib/themes";

const C = themes.blue;

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      Alert.alert("Lien invalide", "Ce lien d'invitation est manquant ou corrompu.");
      router.replace("/");
      return;
    }

    async function validateToken() {
      const { data, error } = await supabase
        .from("patient_spaces")
        .select("id, is_active, patient_firstname")
        .eq("invite_token", token)
        .single();

      if (error || !data) {
        Alert.alert("Lien invalide", "Ce lien d'invitation n'existe pas ou a expiré.");
        router.replace("/");
        return;
      }

      if (!data.is_active) {
        Alert.alert(
          "Espace inactif",
          `L'espace pour ${data.patient_firstname} n'est pas encore actif. Contactez l'organisateur.`,
        );
        router.replace("/");
        return;
      }

      router.replace({
        pathname: "/(visitor)/calendar",
        params: { spaceId: data.id, token },
      });
    }

    validateToken();
  }, [token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={C.accent} size="large" />
      <Text style={styles.text}>Vérification du lien…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center", gap: 16 },
  text: { fontFamily: "DM_Sans_400Regular", fontSize: 14, color: C.muted },
});
