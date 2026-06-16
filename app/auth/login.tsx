import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { themes } from "@/lib/themes";

const C = themes.blue;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    setLoading(false);

    if (error) {
      Alert.alert("Connexion impossible", error.message);
    } else {
      router.replace("/(admin)/home/calendar");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Connexion admin</Text>
        <Text style={styles.subtitle}>
          Gérez votre espace patient depuis l'app.{"\n"}
          Pas encore de compte ?{" "}
          <Text style={{ color: C.accent }} onPress={() => router.push("/auth/signup")}>
            Créez-en un
          </Text>
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, (!email || !password || loading) && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={!email || !password || loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? "Connexion…" : "Se connecter"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          L'application ne vend rien — aucun achat in-app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  form: { gap: 12 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
    color: C.text,
    fontFamily: "DM_Sans_400Regular",
    fontSize: 15,
  },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily: "DM_Sans_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  hint: {
    fontFamily: "DM_Sans_400Regular",
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
    marginTop: 32,
    lineHeight: 20,
  },
});
