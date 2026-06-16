import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import { getVisitorSession, saveVisitorSession, clearVisitorSession } from "@/lib/visitorSession";
import PinPad from "@/components/PinPad";

// Onglet "Compte" côté visiteur — juste ses propres infos (pas de bouton
// Paramètres, contrairement à la version admin). Prénom/Nom/Email/PIN ne
// servent qu'à pré-remplir les futurs formulaires de réservation ; le PIN
// reste toujours ressaisi à la main pour confirmer une action sensible.
export default function VisitorAccountScreen() {
  const { space, token } = useVisitorSpace();
  const router = useRouter();
  const C = themes[space?.theme ?? "blue"];

  const [loading, setLoading] = useState(true);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    getVisitorSession().then((s) => {
      if (s) {
        setPrenom(s.prenom);
        setNom(s.nom);
        setEmail(s.email);
        setPin(s.pin);
        setPhotoUri(s.localPhotoUri);
      }
      setLoading(false);
    });
  }, []);

  async function handlePickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!space) return;
    setSaving(true);
    await saveVisitorSession({
      token,
      spaceId: space.id,
      prenom: prenom.trim(),
      nom: nom.trim(),
      email: email.trim(),
      pin,
      localPhotoUri: photoUri,
    });
    setSaving(false);
    showToast("Enregistré ✓");
  }

  function handleSwitchSpace() {
    Alert.alert(
      "Suivre un autre espace ?",
      "Tu devras saisir un nouveau lien d'invitation.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Continuer",
          onPress: async () => {
            await clearVisitorSession();
            router.replace("/");
          },
        },
      ],
    );
  }

  if (loading || !space) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>👤 Mon compte</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={handlePickPhoto} style={styles.photoWrap} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: C.bg, borderColor: C.border }]}>
              <Text style={{ fontSize: 28 }}>📷</Text>
            </View>
          )}
          <Text style={[styles.photoHint, { color: C.muted }]}>
            {photoUri ? "Changer ma photo" : "Ajouter ma photo (optionnel)"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: C.gold }]}>Mes informations</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Prénom"
            placeholderTextColor={C.muted}
            value={prenom}
            onChangeText={setPrenom}
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Nom"
            placeholderTextColor={C.muted}
            value={nom}
            onChangeText={setNom}
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
            placeholder="Adresse email"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: C.gold }]}>Mon code PIN</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardDesc, { color: C.muted }]}>
            Pour t'en souvenir — il te sera toujours redemandé pour valider une réservation,
            la modifier, l'annuler ou supprimer une photo.
          </Text>
          <PinPad value={pin} onChange={setPin} theme={C} />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: C.accent }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Enregistrer</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchLink} onPress={handleSwitchSpace}>
          <Text style={[styles.switchLinkText, { color: C.muted }]}>Suivre un autre espace</Text>
        </TouchableOpacity>
      </ScrollView>

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: C.success }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },
  scroll: { padding: 16, paddingBottom: 48 },

  photoWrap: { alignItems: "center", marginBottom: 24 },
  photo: { width: 88, height: 88, borderRadius: 44, marginBottom: 8 },
  photoPlaceholder: { width: 88, height: 88, borderRadius: 44, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  photoHint: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },

  sectionTitle: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 4, gap: 10 },
  cardDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 19, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 13, fontFamily: "DM_Sans_400Regular", fontSize: 15 },

  saveBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  saveBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },

  switchLink: { alignItems: "center", marginTop: 20 },
  switchLinkText: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textDecorationLine: "underline" },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
