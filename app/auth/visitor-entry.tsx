import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { themes } from "@/lib/themes";
import { saveVisitorSession } from "@/lib/visitorSession";

const C = themes.blue;

export default function VisitorEntryScreen() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEnter() {
    const t = token.trim();
    if (!t) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("patient_spaces")
      .select("id, patient_firstname, patient_lastname, theme, is_active")
      .eq("invite_token", t)
      .single();

    setLoading(false);

    if (error || !data) {
      Alert.alert("Lien invalide", "Ce lien d'invitation n'existe pas ou a expiré.");
      return;
    }

    if (!data.is_active) {
      Alert.alert("Espace inactif", "Cet espace n'est pas encore actif.");
      return;
    }

    // Remember this space on the device — reopening the app will skip
    // straight to the calendar (see app/index.tsx).
    await saveVisitorSession({ token: t, spaceId: data.id });

    router.replace({
      pathname: "/(visitor)/calendar",
      params: { spaceId: data.id, token: t },
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Accès visiteur</Text>
        <Text style={styles.subtitle}>
          Collez le lien d'invitation reçu par SMS ou WhatsApp, ou saisissez le code d'accès.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Lien ou code d'invitation…"
          placeholderTextColor={C.muted}
          value={token}
          onChangeText={(v) => {
            const parsed = v.includes("token=")
              ? v.split("token=")[1].split("&")[0]
              : v;
            setToken(parsed);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />

        <TouchableOpacity
          style={[styles.btn, (!token.trim() || loading) && styles.btnDisabled]}
          onPress={handleEnter}
          disabled={!token.trim() || loading}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {loading ? "Vérification…" : "Accéder au planning"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 24,
    paddingTop: 60,
  },
  back: { marginBottom: 32 },
  backText: { fontFamily: "DM_Sans_400Regular", color: C.muted, fontSize: 15 },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "DM_Sans_400Regular",
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
    marginBottom: 32,
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
    color: C.text,
    fontFamily: "DM_Sans_400Regular",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily: "DM_Sans_700Bold",
    fontSize: 16,
    color: "#fff",
  },
});
