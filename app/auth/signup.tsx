import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { themes } from "@/lib/themes";

const C = themes.blue;

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim() && password && confirm && !loading;

  async function handleSignup() {
    if (!canSubmit) return;

    if (password.length < 6) {
      Alert.alert("Mot de passe trop court", "Utilise au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Les mots de passe ne correspondent pas", "Vérifie la confirmation.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert("Inscription impossible", error.message);
      return;
    }

    if (data.session) {
      // Email confirmation disabled on this project — straight into onboarding.
      router.replace("/(admin)/home/calendar");
    } else {
      // Email confirmation required — the admin tabs will pick up onboarding
      // automatically once they log back in with a confirmed account.
      Alert.alert(
        "Compte créé ✓",
        "Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.",
        [{ text: "OK", onPress: () => router.replace("/auth/login") }],
      );
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

        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>
          Gratuit, sans carte bancaire.{"\n"}
          Tu pourras planifier jusqu'à 5 visites avant de passer en illimité.
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
            placeholder="Mot de passe (6 caractères min.)"
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe"
            placeholderTextColor={C.muted}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleSignup}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? "Création…" : "Créer mon compte"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Déjà un compte ?{" "}
          <Text style={{ color: C.accent }} onPress={() => router.replace("/auth/login")}>
            Se connecter
          </Text>
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
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    marginTop: 32,
    lineHeight: 20,
  },
});
