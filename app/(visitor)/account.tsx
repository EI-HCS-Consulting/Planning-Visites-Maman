import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image, Alert, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import { supabase } from "@/lib/supabase";
import { getVisitorSession, saveVisitorSession, clearVisitorSession } from "@/lib/visitorSession";
import PinPad from "@/components/PinPad";
import type { Reservation, SouvenirPhoto, NewsEntry, SupportMessage, Task } from "@/lib/types";

function souvenirUrl(spaceId: string, filename: string) {
  const { data } = supabase.storage.from("souvenirs").getPublicUrl(`${spaceId}/${filename}`);
  return data.publicUrl;
}

function supportPhotoUrl(spaceId: string, filename: string) {
  const { data } = supabase.storage.from("support-photos").getPublicUrl(`${spaceId}/${filename}`);
  return data.publicUrl;
}

const CAT_ICONS: Record<Task["category"], string> = {
  repas: "🍽️", affaires: "🧳", courses: "🛒", autre: "📌",
};

type AccountSectionKey = "info" | "pin" | "resv" | "souvenirs" | "news" | "soutien" | "besoins";
const SECTION_META: Record<AccountSectionKey, { icon: string; label: string }> = {
  info: { icon: "📝", label: "Mes informations" },
  pin: { icon: "🔒", label: "Mon code PIN" },
  resv: { icon: "📅", label: "Mes réservations" },
  souvenirs: { icon: "📷", label: "Mes souvenirs" },
  news: { icon: "📰", label: "Mes nouvelles" },
  soutien: { icon: "💛", label: "Soutien" },
  besoins: { icon: "🤝", label: "Mes besoins" },
};

// Onglet "Compte" côté visiteur — juste ses propres infos (pas de bouton
// Paramètres, contrairement à la version admin). Prénom/Nom/Email/PIN ne
// servent qu'à pré-remplir les futurs formulaires de réservation ; le PIN
// reste toujours ressaisi à la main pour confirmer une action sensible.
export default function VisitorAccountScreen() {
  const { space, token, setSelectedDay, setPendingEditReservationId } = useVisitorSpace();
  const router = useRouter();
  const C = themes[space?.theme ?? "blue"];

  const [loading, setLoading] = useState(true);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinRevealed, setPinRevealed] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Changement de PIN — 3 phases dans une même modale, réutilisant le même
  // PinPad : (1) vérifier l'ancien PIN, (2) saisir le nouveau, (3) le
  // confirmer. Le PIN d'un item déjà créé (réservation, nouvelle…) n'est
  // jamais retouché ici : seul celui stocké dans la session change.
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinPhase, setPinPhase] = useState<"verify" | "new" | "confirm">("verify");
  const [pinInput, setPinInput] = useState("");
  const [newPinDraft, setNewPinDraft] = useState("");
  const [pinModalError, setPinModalError] = useState(false);

  // Vue centralisée "Mes contributions" — tout ce que le visiteur a saisi
  // dans l'App, regroupé ici pour qu'il n'ait pas besoin de naviguer
  // ailleurs pour le retrouver. Le rapprochement se fait par prénom+nom
  // (pas d'identifiant de compte dans cette App), donc figé au moment du
  // chargement de la page plutôt que recalculé à chaque frappe.
  const [activityLoading, setActivityLoading] = useState(false);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [mySouvenirs, setMySouvenirs] = useState<(SouvenirPhoto & { url: string })[]>([]);
  const [myNews, setMyNews] = useState<NewsEntry[]>([]);
  const [myMessages, setMyMessages] = useState<SupportMessage[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);

  // Lightbox plein écran pour "Mes souvenirs" — index dans mySouvenirs, ou
  // null si fermé.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Section active de la grille de tuiles (null = grille affichée)
  const [activeSection, setActiveSection] = useState<AccountSectionKey | null>(null);
  const identityMissing = !prenom.trim() || !nom.trim();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  const loadActivity = useCallback(async (spaceId: string, p: string, n: string) => {
    if (!p.trim() || !n.trim()) return;
    setActivityLoading(true);
    const [resv, souv, news, msgs, tasks] = await Promise.all([
      supabase.from("reservations").select("*").eq("space_id", spaceId)
        .ilike("prenom", p.trim()).ilike("nom", n.trim()).order("date", { ascending: false }),
      supabase.from("souvenirs").select("*").eq("space_id", spaceId)
        .ilike("uploaded_by_prenom", p.trim()).ilike("uploaded_by_nom", n.trim()).order("created_at", { ascending: false }),
      supabase.from("news_entries").select("*").eq("space_id", spaceId)
        .ilike("author_prenom", p.trim()).ilike("author_nom", n.trim()).order("created_at", { ascending: false }),
      supabase.from("support_messages").select("*").eq("space_id", spaceId)
        .ilike("author_prenom", p.trim()).ilike("author_nom", n.trim()).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("space_id", spaceId)
        .ilike("claimed_by_prenom", p.trim()).ilike("claimed_by_nom", n.trim()).order("created_at", { ascending: false }),
    ]);
    setMyReservations(resv.data || []);
    setMySouvenirs((souv.data || []).map((s: SouvenirPhoto) => ({ ...s, url: souvenirUrl(spaceId, s.filename) })));
    setMyNews(news.data || []);
    setMyMessages(msgs.data || []);
    setMyTasks(tasks.data || []);
    setActivityLoading(false);
  }, []);

  useEffect(() => {
    getVisitorSession().then((s) => {
      if (s) {
        setPrenom(s.prenom);
        setNom(s.nom);
        setEmail(s.email);
        setPin(s.pin);
        setPhotoUri(s.localPhotoUri);
        if (space) loadActivity(space.id, s.prenom, s.nom);
      }
      setLoading(false);
    });
  }, [space, loadActivity]);

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
      localPhotoUri: photoUri,
    });
    setSaving(false);
    showToast("Enregistré ✓");
    loadActivity(space.id, prenom, nom);
  }

  function openChangePinModal() {
    setPinPhase("verify");
    setPinInput("");
    setNewPinDraft("");
    setPinModalError(false);
    setPinModalVisible(true);
  }

  function closeChangePinModal() {
    setPinModalVisible(false);
    setPinPhase("verify");
    setPinInput("");
    setNewPinDraft("");
    setPinModalError(false);
  }

  async function handlePinInputChange(value: string) {
    setPinModalError(false);
    setPinInput(value);
    if (value.length < 4) return;

    if (pinPhase === "verify") {
      if (value === pin) {
        setPinPhase("new");
        setPinInput("");
      } else {
        setPinModalError(true);
        setPinInput("");
      }
      return;
    }

    if (pinPhase === "new") {
      setNewPinDraft(value);
      setPinInput("");
      setPinPhase("confirm");
      return;
    }

    // pinPhase === "confirm"
    if (value === newPinDraft) {
      if (!space) return;
      setPin(value);
      await saveVisitorSession({ token, spaceId: space.id, pin: value });
      closeChangePinModal();
      showToast("PIN modifié ✓");
    } else {
      setPinModalError(true);
      setPinInput("");
      setNewPinDraft("");
      setPinPhase("new");
    }
  }

  // Ouvre la réservation visée sur l'écran Créneaux (Visite) ou Nuitées
  // (Nuit) avec la modale PIN/modification déjà ouverte — transmis via le
  // contexte (pendingEditReservationId), pas un query param, pour la même
  // raison que pendingBookingSlot : ça ne survit pas à la navigation Tabs >
  // home Stack.
  function handleOpenReservation(r: Reservation) {
    setPendingEditReservationId(r.id);
    if (r.type === "Nuit") {
      router.push("/(visitor)/home/nights" as any);
    } else {
      setSelectedDay(new Date(r.date + "T12:00:00"));
      router.push("/(visitor)/home/slots" as any);
    }
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

  const missingIdentityCard = (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[styles.cardDesc, { color: C.muted, marginBottom: 0 }]}>
        Renseigne ton prénom et ton nom dans "Mes informations" pour retrouver ici tout ce que tu as saisi dans l'App.
      </Text>
    </View>
  );

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

        {activeSection === null && (
          <View style={styles.tileGrid}>
            {(Object.keys(SECTION_META) as AccountSectionKey[]).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.tile, { backgroundColor: C.card, borderColor: C.border }]}
                onPress={() => setActiveSection(key)}
                activeOpacity={0.8}
              >
                <View style={[styles.tileIcon, { backgroundColor: `${C.accent}22` }]}>
                  <Text style={styles.tileIconText}>{SECTION_META[key].icon}</Text>
                </View>
                <Text style={[styles.tileLabel, { color: "#fff" }]}>{SECTION_META[key].label}</Text>
                <Text style={[styles.tileHint, { color: C.muted }]}>
                  {key === "info" ? (prenom.trim() && nom.trim() ? `${prenom} ${nom}` : "À compléter")
                    : key === "pin" ? "Voir / changer"
                    : key === "resv" ? `${myReservations.length} réservation(s)`
                    : key === "souvenirs" ? `${mySouvenirs.length} photo(s)`
                    : key === "news" ? `${myNews.length} nouvelle(s)`
                    : key === "soutien" ? `${myMessages.length} message(s)`
                    : `${myTasks.length} besoin(s)`}
                </Text>
                <Text style={[styles.tileChevron, { color: C.muted }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeSection !== null && (
          <TouchableOpacity style={styles.backToGrid} onPress={() => setActiveSection(null)} activeOpacity={0.7}>
            <Text style={[styles.backToGridText, { color: C.accent }]}>← Retour à mon compte</Text>
          </TouchableOpacity>
        )}

        {activeSection === "info" && (
        <>
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
        </>
        )}

        {activeSection === "pin" && (
        <>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: C.gold, marginBottom: 0 }]}>Mon code PIN</Text>
          <TouchableOpacity onPress={() => setPinRevealed((v) => !v)} style={styles.revealBtn}>
            <Text style={[styles.revealBtnText, { color: C.accent }]}>
              {pinRevealed ? "🙈 Masquer" : "👁 Afficher"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardDesc, { color: C.muted }]}>
            Pour t'en souvenir — il te sera toujours redemandé pour valider une réservation,
            la modifier, l'annuler ou supprimer une photo.
          </Text>
          <PinPad value={pin} onChange={() => {}} theme={C} reveal={pinRevealed} readOnly />
          <TouchableOpacity style={[styles.changePinBtn, { borderColor: C.accent }]} onPress={openChangePinModal}>
            <Text style={[styles.changePinBtnText, { color: C.accent }]}>Changer mon PIN</Text>
          </TouchableOpacity>
        </View>
        </>
        )}

        {activeSection === "resv" && (
          activityLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} />
          ) : identityMissing ? missingIdentityCard : (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>📅 Mes réservations ({myReservations.length})</Text>
              {myReservations.length === 0 ? (
                <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucune réservation pour le moment.</Text>
              ) : myReservations.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.activityRow}
                  onPress={() => handleOpenReservation(r)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]}>
                    {r.type === "Nuit" ? "🌙" : "☀️"} {new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} · {r.creneau}
                  </Text>
                  <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        {activeSection === "souvenirs" && (
          activityLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} />
          ) : identityMissing ? missingIdentityCard : (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>📷 Mes souvenirs ({mySouvenirs.length})</Text>
              {mySouvenirs.length === 0 ? (
                <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucune photo envoyée pour le moment.</Text>
              ) : (
                <View style={styles.activityThumbRow}>
                  {mySouvenirs.map((s, idx) => (
                    <TouchableOpacity key={s.id} onPress={() => setLightboxIndex(idx)} activeOpacity={0.8}>
                      <Image source={{ uri: s.url }} style={styles.activityThumb} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )
        )}

        {activeSection === "news" && (
          activityLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} />
          ) : identityMissing ? missingIdentityCard : (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>📰 Mes nouvelles ({myNews.length})</Text>
              {myNews.length === 0 ? (
                <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucune nouvelle publiée pour le moment.</Text>
              ) : myNews.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.activityRow}
                  onPress={() => router.push(`/(visitor)/news?focusEntryId=${entry.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]} numberOfLines={2}>
                    {new Date(entry.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {entry.content}
                  </Text>
                  <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        {activeSection === "soutien" && (
          activityLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} />
          ) : identityMissing ? missingIdentityCard : (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>💛 Mes messages de soutien ({myMessages.length})</Text>
              {myMessages.length === 0 ? (
                <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucun message envoyé pour le moment.</Text>
              ) : myMessages.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.activityRow, { alignItems: "flex-start" }]}
                  onPress={() => router.push(`/(visitor)/soutien?focusMessageId=${m.id}` as any)}
                  activeOpacity={0.7}
                >
                  {m.photo && (
                    <Image source={{ uri: supportPhotoUrl(space.id, m.photo) }} style={styles.activityMsgThumb} resizeMode="cover" />
                  )}
                  <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]} numberOfLines={2}>
                    {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {m.message}
                  </Text>
                  <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        {activeSection === "besoins" && (
          activityLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} />
          ) : identityMissing ? missingIdentityCard : (
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>🤝 Besoins dont je m'occupe ({myTasks.length})</Text>
              {myTasks.length === 0 ? (
                <Text style={[styles.activityEmpty, { color: C.muted }]}>Tu n'as pris en charge aucun besoin pour le moment.</Text>
              ) : myTasks.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.activityRow}
                  onPress={() => router.push(`/(visitor)/entraide?focusTaskId=${t.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]} numberOfLines={1}>
                    {CAT_ICONS[t.category]} {t.title}
                  </Text>
                  <View style={[styles.activityStatusBadge, { borderColor: t.status === "fait" ? C.success : C.orange }]}>
                    <Text style={[styles.activityStatusText, { color: t.status === "fait" ? C.success : C.orange }]}>
                      {t.status === "fait" ? "✓ Fait" : "⏳ En attente"}
                    </Text>
                  </View>
                  <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        <TouchableOpacity style={styles.switchLink} onPress={handleSwitchSpace}>
          <Text style={[styles.switchLinkText, { color: C.muted }]}>Suivre un autre espace</Text>
        </TouchableOpacity>
      </ScrollView>

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: C.success }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <Modal visible={lightboxIndex !== null} transparent animationType="fade" onRequestClose={() => setLightboxIndex(null)}>
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxIndex(null)}>
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>

          {lightboxIndex !== null && mySouvenirs[lightboxIndex] && (
            <>
              <Image source={{ uri: mySouvenirs[lightboxIndex].url }} style={styles.lightboxImg} resizeMode="contain" />

              <View style={styles.lightboxNavRow}>
                <TouchableOpacity
                  disabled={lightboxIndex === 0}
                  onPress={() => setLightboxIndex((i) => (i !== null ? Math.max(i - 1, 0) : i))}
                  style={[styles.lightboxNavBtn, lightboxIndex === 0 && { opacity: 0.3 }]}
                >
                  <Text style={styles.lightboxNavText}>‹ Précédent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={lightboxIndex === mySouvenirs.length - 1}
                  onPress={() => setLightboxIndex((i) => (i !== null ? Math.min(i + 1, mySouvenirs.length - 1) : i))}
                  style={[styles.lightboxNavBtn, lightboxIndex === mySouvenirs.length - 1 && { opacity: 0.3 }]}
                >
                  <Text style={styles.lightboxNavText}>Suivant ›</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.lightboxLink, { backgroundColor: C.accent }]}
                onPress={() => {
                  setLightboxIndex(null);
                  router.push("/(visitor)/souvenirs" as any);
                }}
              >
                <Text style={styles.lightboxLinkText}>📷 Voir dans Souvenirs</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={closeChangePinModal}>
        <View style={styles.pinModalOverlay}>
          <View style={[styles.pinModalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.pinModalTitle, { color: "#fff" }]}>
              {pinPhase === "verify" && "Confirme ton PIN actuel"}
              {pinPhase === "new" && "Choisis ton nouveau PIN"}
              {pinPhase === "confirm" && "Confirme ton nouveau PIN"}
            </Text>
            {pinModalError && (
              <Text style={[styles.pinModalError, { color: C.danger }]}>
                {pinPhase === "new" ? "Les PIN ne correspondent pas, recommence." : "PIN incorrect, réessaie."}
              </Text>
            )}
            <PinPad
              value={pinInput}
              onChange={handlePinInputChange}
              theme={C}
              hasError={pinModalError}
            />
            <TouchableOpacity style={styles.pinModalCancel} onPress={closeChangePinModal}>
              <Text style={[styles.pinModalCancelText, { color: C.muted }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  tile: {
    width: "47%", borderWidth: 1, borderRadius: 16, padding: 14,
    gap: 8, position: "relative",
  },
  tileIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  tileIconText: { fontSize: 18 },
  tileLabel: { fontFamily: "DM_Sans_700Bold", fontSize: 13, lineHeight: 17 },
  tileHint: { fontFamily: "DM_Sans_400Regular", fontSize: 11, lineHeight: 15 },
  tileChevron: { position: "absolute", top: 14, right: 12, fontFamily: "DM_Sans_700Bold", fontSize: 14 },
  backToGrid: { alignSelf: "flex-start", marginBottom: 4, paddingVertical: 4 },
  backToGridText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },

  sectionTitle: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginTop: 8 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 10 },
  revealBtn: { paddingVertical: 2, paddingHorizontal: 4 },
  revealBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 4, gap: 10 },
  cardDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 19, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 13, fontFamily: "DM_Sans_400Regular", fontSize: 15 },

  activityGroupTitle: { fontFamily: "DM_Sans_700Bold", fontSize: 13, marginBottom: 4 },
  activityEmpty: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
  activityRow: { paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  activityRowText: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 19 },
  activityThumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  activityThumb: { width: 64, height: 64, borderRadius: 8 },
  activityMsgThumb: { width: 44, height: 44, borderRadius: 8 },
  activityStatusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  activityStatusText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 10 },
  activityChevron: { fontFamily: "DM_Sans_700Bold", fontSize: 16 },

  saveBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  saveBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },

  changePinBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  changePinBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13 },

  pinModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 24 },
  pinModalCard: { width: "100%", maxWidth: 340, borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center" },
  pinModalTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 17, textAlign: "center", marginBottom: 12 },
  pinModalError: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, textAlign: "center", marginBottom: 10 },
  pinModalCancel: { marginTop: 16 },
  pinModalCancelText: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textDecorationLine: "underline" },

  switchLink: { alignItems: "center", marginTop: 20 },
  switchLinkText: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textDecorationLine: "underline" },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },

  lightboxOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
  lightboxClose: { position: "absolute", top: 52, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", zIndex: 1 },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontFamily: "DM_Sans_700Bold" },
  lightboxImg: { width: "100%", height: "65%" },
  lightboxNavRow: { flexDirection: "row", gap: 16, marginTop: 16 },
  lightboxNavBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  lightboxNavText: { color: "#fff", fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  lightboxLink: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 22, marginTop: 20 },
  lightboxLinkText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },
});
