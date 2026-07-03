import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image, Modal,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { blobToArrayBuffer } from "@/lib/blobToArrayBuffer";
import { getVisitorSession, rememberAuthorPin, sessionPinMatches } from "@/lib/visitorSession";
import PinPad from "@/components/PinPad";
import type { SupportMessage } from "@/lib/types";
import type { Theme } from "@/lib/themes";

// Section "Mur de soutien" extraite de l'ancien EntraideSoutien.tsx — voir
// components/Entraide.tsx pour l'autre moitié (Besoins).

const PHOTO_BUCKET = "support-photos";
const SOUVENIRS_BUCKET = "souvenirs";

function supportPhotoUrl(spaceId: string, filename: string) {
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${spaceId}/${filename}`);
  return data.publicUrl;
}

// Même règle de slug que SouvenirsGallery.tsx / NewsFeed.tsx.
function sanitize(str: string) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface Props {
  spaceId: string;
  C: Theme;
  isAdmin: boolean;
}

export default function Soutien({ spaceId, C, isAdmin }: Props) {
  const { focusMessageId } = useLocalSearchParams<{ focusMessageId?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const msgOffsets = useRef<Record<string, number>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const focusedRef = useRef(false);

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(true);

  const [msgText, setMsgText] = useState("");
  const [msgPrenom, setMsgPrenom] = useState("");
  const [msgNom, setMsgNom] = useState("");
  const [msgPin, setMsgPin] = useState("");
  const [msgPhotoUri, setMsgPhotoUri] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [msgSaving, setMsgSaving] = useState(false);

  // Édition d'un message déjà posté — déclenchée depuis le bouton ✏️ après
  // validation du PIN (ou directement pour l'admin), même schéma que
  // NewsFeed.tsx (openEdit/requestEdit/pinModal).
  const [editTarget, setEditTarget] = useState<SupportMessage | null>(null);
  const [editMsgText, setEditMsgText] = useState("");
  const [editPrenom, setEditPrenom] = useState("");
  const [editNom, setEditNom] = useState("");
  const [editPhoto, setEditPhoto] = useState<{ uri: string; filename: string | null } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [pinModal, setPinModal] = useState<SupportMessage | null>(null);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [sessionPin, setSessionPin] = useState("");

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Ajout manuel au mur de Souvenirs (message.id en cours de synchro)
  const [syncingToSouvenirs, setSyncingToSouvenirs] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setMsgsLoading(true);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false });
    setMessages(data || []);
    setMsgsLoading(false);
  }, [spaceId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Arrivée depuis "Mon compte" via un lien profond (?focusMessageId=...) :
  // on scrolle jusqu'à la carte du message et on la surligne brièvement.
  // focusedRef évite de re-déclencher le scroll à chaque rechargement
  // realtime de messages.
  useEffect(() => {
    if (!focusMessageId || focusedRef.current || msgsLoading) return;
    const target = messages.find((m) => m.id === focusMessageId);
    if (!target) return;
    focusedRef.current = true;
    setHighlightId(focusMessageId);
    setTimeout(() => {
      const y = msgOffsets.current[focusMessageId];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
    }, 300);
    setTimeout(() => setHighlightId(null), 2500);
  }, [focusMessageId, messages, msgsLoading]);

  // Pré-remplit prénom/nom/PIN depuis la session visiteur enregistrée pour
  // éviter de ressaisir — reste modifiable.
  useEffect(() => {
    getVisitorSession().then((s) => {
      if (s) {
        setMsgPrenom(s.prenom);
        setMsgNom(s.nom);
        if (s.pin) setSessionPin(s.pin);
      }
    });
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel(`support:${spaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `space_id=eq.${spaceId}` }, loadMessages)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId, loadMessages]);

  async function pickMsgPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    setPickingPhoto(true);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    setPickingPhoto(false);
    if (!result.canceled && result.assets[0]) {
      setMsgPhotoUri(result.assets[0].uri);
    }
  }

  function removeMsgPhoto() {
    setMsgPhotoUri(null);
  }

  // Les photos du mur de soutien peuvent aussi être copiées dans la galerie
  // Souvenirs (contrairement à celles du mur d'entraide), mais uniquement à
  // la demande — bouton "Ajouter au mur de souvenirs" sur le message déjà
  // posté (voir addMessagePhotoToSouvenirs). Best-effort : un échec de sync
  // ne doit pas bloquer le reste.
  async function syncPhotoToSouvenirs(fileData: ArrayBuffer, authorPrenom: string, authorNom: string, sourceId: string) {
    try {
      const ts = String(Date.now());
      const prenomClean = sanitize(authorPrenom.trim()) || "Anonyme";
      const rand = Math.random().toString(36).slice(2, 6);
      const filename = `${ts}_${rand}__${prenomClean}.jpg`;
      const storagePath = `${spaceId}/${filename}`;

      const { error: storageErr } = await supabase.storage
        .from(SOUVENIRS_BUCKET)
        .upload(storagePath, fileData, { contentType: "image/jpeg", cacheControl: "3600" });
      if (storageErr) return;

      const { error: dbErr } = await supabase.from("souvenirs").insert({
        space_id: spaceId,
        filename,
        caption: "",
        uploaded_by_prenom: authorPrenom.trim(),
        uploaded_by_nom: authorNom.trim(),
        // Pas de PIN visiteur pour un message de soutien — "ADMIN" est le
        // sentinel déjà utilisé ailleurs (NewsFeed) pour "non supprimable
        // via PIN visiteur", ce qui correspond bien ici.
        uploaded_by_pin: "ADMIN",
        source_type: "support",
        source_id: sourceId,
      });
      if (dbErr) {
        await supabase.storage.from(SOUVENIRS_BUCKET).remove([storagePath]);
      }
    } catch {
      /* sync vers Souvenirs en best-effort */
    }
  }

  // Bouton "Ajouter au mur de souvenirs" sur un message déjà posté — relit
  // la photo depuis support-photos puis la copie vers souvenirs.
  async function addMessagePhotoToSouvenirs(m: SupportMessage) {
    if (!m.photo) return;
    setSyncingToSouvenirs(m.id);
    try {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .download(`${spaceId}/${m.photo}`);
      if (error || !data) {
        showToast("Erreur lors de l'ajout");
      } else {
        const fileData = await blobToArrayBuffer(data);
        await syncPhotoToSouvenirs(fileData, m.author_prenom, m.author_nom, m.id);
        showToast("Ajouté au mur de souvenirs ✓");
      }
    } catch {
      showToast("Erreur lors de l'ajout");
    }
    setSyncingToSouvenirs(null);
  }

  async function postMessage() {
    if (!msgText.trim() || !msgPrenom.trim() || !msgNom.trim()) return;
    if (!isAdmin && !sessionPin && msgPin.length < 4) return;
    setMsgSaving(true);

    let photoFilename: string | null = null;
    if (msgPhotoUri) {
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          msgPhotoUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const fileData = await new File(compressed.uri).arrayBuffer();
        const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(`${spaceId}/${fname}`, fileData, { contentType: "image/jpeg", cacheControl: "3600" });
        if (!error) {
          photoFilename = fname;
        } else {
          Alert.alert("Photo non envoyée", "Le message sera publié sans la photo.");
        }
      } catch {
        Alert.alert("Photo non envoyée", "Le message sera publié sans la photo.");
      }
    }

    const pinToUse = isAdmin ? "ADMIN" : (sessionPin || msgPin);
    await supabase.from("support_messages").insert({
      space_id: spaceId,
      message: msgText.trim(),
      author_prenom: msgPrenom.trim(),
      author_nom: msgNom.trim(),
      author_pin: pinToUse,
      photo: photoFilename,
    });
    setMsgSaving(false);
    if (!isAdmin) await rememberAuthorPin(msgPrenom.trim(), msgNom.trim(), pinToUse);
    setMsgText(""); setMsgPhotoUri(null); setMsgPin(""); setShowAddModal(false);
    showToast("Message posté ✓");
    loadMessages();
  }

  // ── Édition (PIN visiteur ou direct admin) ─────────────────────────────────
  async function requestEdit(m: SupportMessage) {
    if (isAdmin || (await sessionPinMatches(m.author_pin))) {
      openEdit(m);
      return;
    }
    setPinModal(m);
    setPinEntry(""); setPinError(false);
  }

  function checkPin() {
    if (!pinModal) return;
    if (pinEntry === pinModal.author_pin) {
      const target = pinModal;
      setPinModal(null);
      openEdit(target);
    } else {
      setPinError(true);
      setPinEntry("");
    }
  }

  function openEdit(m: SupportMessage) {
    setEditTarget(m);
    setEditMsgText(m.message);
    setEditPrenom(m.author_prenom);
    setEditNom(m.author_nom);
    setEditPhoto(m.photo ? { uri: supportPhotoUrl(spaceId, m.photo), filename: m.photo } : null);
  }

  async function pickEditPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setEditPhoto({ uri: result.assets[0].uri, filename: null });
    }
  }

  function removeEditPhoto() {
    setEditPhoto(null);
  }

  async function handleSaveEdit() {
    if (!editTarget || !editMsgText.trim() || !editPrenom.trim() || !editNom.trim()) return;
    setEditSaving(true);

    // filename déjà connu (photo inchangée) ou null (pas de photo / nouvelle
    // photo locale à uploader ci-dessous).
    let finalFilename: string | null = editPhoto?.filename ?? null;

    if (editPhoto && !editPhoto.filename) {
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          editPhoto.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const fileData = await new File(compressed.uri).arrayBuffer();
        const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(`${spaceId}/${fname}`, fileData, { contentType: "image/jpeg", cacheControl: "3600" });
        if (!error) {
          finalFilename = fname;
        } else {
          Alert.alert("Photo non envoyée", "Le message sera modifié sans la nouvelle photo.");
          finalFilename = editTarget.photo;
        }
      } catch {
        Alert.alert("Photo non envoyée", "Le message sera modifié sans la nouvelle photo.");
        finalFilename = editTarget.photo;
      }
    }

    // Photo retirée ou remplacée : supprime l'ancien fichier du storage.
    if (editTarget.photo && editTarget.photo !== finalFilename) {
      await supabase.storage.from(PHOTO_BUCKET).remove([`${spaceId}/${editTarget.photo}`]);
    }

    const { error } = await supabase
      .from("support_messages")
      .update({
        message: editMsgText.trim(),
        author_prenom: editPrenom.trim(),
        author_nom: editNom.trim(),
        photo: finalFilename,
      })
      .eq("id", editTarget.id);

    setEditSaving(false);
    if (error) { Alert.alert("Erreur", "Erreur lors de la modification : " + error.message); return; }
    showToast("Message modifié ✓");
    setEditTarget(null);
    loadMessages();
  }

  async function deleteMessage(m: SupportMessage) {
    Alert.alert("Supprimer ce message ?", `"${m.message.slice(0, 60)}…"`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          if (m.photo) await supabase.storage.from(PHOTO_BUCKET).remove([`${spaceId}/${m.photo}`]);
          await supabase.from("support_messages").delete().eq("id", m.id);
          loadMessages();
          showToast("Message supprimé");
        },
      },
    ]);
  }

  const pinReady = isAdmin || !!sessionPin || msgPin.length >= 4;

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>💛 Mur de soutien</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: C.gold }]}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.listPad} keyboardShouldPersistTaps="handled">
        {msgsLoading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 24 }} />
        ) : messages.length === 0 ? (
          <View style={[styles.centered, { marginTop: 32 }]}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>💛</Text>
            <Text style={[styles.emptyText, { color: C.muted }]}>Aucun message de soutien.</Text>
            <Text style={[styles.emptyHint, { color: C.muted }]}>Sois le premier à en laisser un !</Text>
          </View>
        ) : (
          messages.map((m) => {
            const highlighted = highlightId === m.id;
            const canModify = isAdmin || (!!m.author_pin && m.author_pin !== "ADMIN");
            return (
            <View
              key={m.id}
              onLayout={(e) => { msgOffsets.current[m.id] = e.nativeEvent.layout.y; }}
              style={[
                styles.msgCard,
                { backgroundColor: C.card, borderColor: highlighted ? C.gold : C.border },
                highlighted && { borderWidth: 2 },
              ]}
            >
              <View style={styles.msgCardHeader}>
                <View style={[styles.msgAvatar, { backgroundColor: `${C.gold}33` }]}>
                  <Text style={[styles.msgAvatarText, { color: C.gold }]}>
                    {m.author_prenom.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.msgAuthor, { color: "#fff" }]}>{m.author_prenom} {m.author_nom}</Text>
                  <Text style={[styles.msgDate, { color: C.muted }]}>
                    {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </Text>
                </View>
                {(canModify || isAdmin) && (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {canModify && (
                      <TouchableOpacity onPress={() => requestEdit(m)} style={[styles.iconBtn, { borderColor: C.border }]}>
                        <Text style={{ fontSize: 13, color: C.muted }}>✏️</Text>
                      </TouchableOpacity>
                    )}
                    {isAdmin && (
                      <TouchableOpacity onPress={() => deleteMessage(m)} style={[styles.iconBtn, { borderColor: "rgba(233,69,96,0.3)" }]}>
                        <Text style={{ fontSize: 13, color: "#e94560" }}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
              <Text style={[styles.msgText, { color: C.text }]}>{m.message}</Text>
              {m.photo && (
                <>
                  <Image source={{ uri: supportPhotoUrl(spaceId, m.photo) }} style={styles.msgPhoto} resizeMode="cover" />
                  <TouchableOpacity
                    style={[styles.souvenirsBtn, { borderColor: C.border }]}
                    onPress={() => addMessagePhotoToSouvenirs(m)}
                    disabled={syncingToSouvenirs === m.id}
                    activeOpacity={0.75}
                  >
                    {syncingToSouvenirs === m.id
                      ? <ActivityIndicator color={C.gold} size="small" />
                      : <Text style={[styles.souvenirsBtnText, { color: C.gold }]}>📸 Ajouter au mur de souvenirs</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
            );
          })
        )}
      </ScrollView>

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: C.success }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* ── MODAL AJOUT ───────────────────────────────────────────────────── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => !msgSaving && setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !msgSaving && setShowAddModal(false)}>
            <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                  <Text style={[styles.sheetTitle, { color: "#fff" }]}>💛 Laisser un message</Text>

                  <TextInput
                    style={[styles.input, styles.msgArea, { backgroundColor: C.bg, borderColor: C.border, color: C.text, marginTop: 12 }]}
                    placeholder="Un mot d'encouragement pour la famille et le patient…"
                    placeholderTextColor={C.muted}
                    value={msgText}
                    onChangeText={setMsgText}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    autoFocus
                  />

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Prénom *"
                      placeholderTextColor={C.muted}
                      value={msgPrenom}
                      onChangeText={setMsgPrenom}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Nom *"
                      placeholderTextColor={C.muted}
                      value={msgNom}
                      onChangeText={setMsgNom}
                      autoCapitalize="words"
                    />
                  </View>

                  {msgPhotoUri ? (
                    <View style={styles.photoPreviewRow}>
                      <Image source={{ uri: msgPhotoUri }} style={styles.photoPreviewImg} resizeMode="cover" />
                      <TouchableOpacity style={[styles.photoPickRemove, { backgroundColor: "#e94560" }]} onPress={removeMsgPhoto}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.photoPickAdd, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={pickMsgPhoto}
                      disabled={pickingPhoto}
                    >
                      {pickingPhoto
                        ? <ActivityIndicator color={C.accent} size="small" />
                        : <Text style={[styles.photoPickAddText, { color: C.muted }]}>📷 Ajouter une photo (optionnel)</Text>
                      }
                    </TouchableOpacity>
                  )}

                  {!isAdmin && !sessionPin && (
                    <>
                      <Text style={[styles.pinLabel, { color: C.gold }]}>🔐 Choisis ton code PIN (4 chiffres)</Text>
                      <Text style={[styles.pinHint, { color: C.muted }]}>
                        Garde-le précieusement — tu en auras besoin pour modifier ton message.
                      </Text>
                      <PinPad value={msgPin} onChange={setMsgPin} theme={C} />
                    </>
                  )}

                  <View style={styles.sheetBtns}>
                    <TouchableOpacity
                      onPress={() => { setShowAddModal(false); setMsgText(""); setMsgPhotoUri(null); setMsgPin(""); }}
                      disabled={msgSaving}
                      style={[styles.btnSecondary, { borderColor: C.border }]}
                    >
                      <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={postMessage}
                      disabled={!msgText.trim() || !msgPrenom.trim() || !msgNom.trim() || !pinReady || msgSaving}
                      style={[
                        styles.btnPrimary,
                        { backgroundColor: C.gold },
                        (!msgText.trim() || !msgPrenom.trim() || !msgNom.trim() || !pinReady || msgSaving) && { opacity: 0.5 },
                      ]}
                    >
                      {msgSaving
                        ? <ActivityIndicator color="#0D1B2E" size="small" />
                        : <Text style={[styles.btnPrimaryText, { color: "#0D1B2E" }]}>Envoyer 💛</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL PIN (édition visiteur) ──────────────────────────────────── */}
      <Modal visible={!!pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🔐</Text>
              <Text style={[styles.sheetTitle, { color: "#fff" }]}>Code PIN</Text>
              <Text style={[styles.sheetSub, { color: C.muted }]}>Saisis le code PIN reçu lors de l'envoi de ton message.</Text>
            </View>

            <PinPad value={pinEntry} onChange={setPinEntry} theme={C} hasError={pinError} />

            {pinError && (
              <Text style={[styles.pinErrorText, { color: "#e94560" }]}>PIN incorrect.</Text>
            )}

            <View style={[styles.sheetBtns, { marginTop: 16 }]}>
              <TouchableOpacity onPress={() => setPinModal(null)} style={[styles.btnSecondary, { borderColor: C.border }]}>
                <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={checkPin}
                disabled={pinEntry.length < 4}
                style={[styles.btnPrimary, { backgroundColor: C.accent }, pinEntry.length < 4 && { opacity: 0.5 }]}
              >
                <Text style={styles.btnPrimaryText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL ÉDITION ─────────────────────────────────────────────────── */}
      <Modal visible={!!editTarget} transparent animationType="slide" onRequestClose={() => !editSaving && setEditTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !editSaving && setEditTarget(null)}>
            <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                  <Text style={[styles.sheetTitle, { color: "#fff" }]}>✏️ Modifier le message</Text>

                  <TextInput
                    style={[styles.input, styles.msgArea, { backgroundColor: C.bg, borderColor: C.border, color: C.text, marginTop: 12 }]}
                    placeholder="Un mot d'encouragement…"
                    placeholderTextColor={C.muted}
                    value={editMsgText}
                    onChangeText={setEditMsgText}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Prénom *" placeholderTextColor={C.muted}
                      value={editPrenom} onChangeText={setEditPrenom} autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Nom *" placeholderTextColor={C.muted}
                      value={editNom} onChangeText={setEditNom} autoCapitalize="words"
                    />
                  </View>

                  {editPhoto ? (
                    <View style={styles.photoPreviewRow}>
                      <Image source={{ uri: editPhoto.uri }} style={styles.photoPreviewImg} resizeMode="cover" />
                      <TouchableOpacity style={[styles.photoPickRemove, { backgroundColor: "#e94560" }]} onPress={removeEditPhoto}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.photoPickAdd, { backgroundColor: C.bg, borderColor: C.border }]} onPress={pickEditPhoto}>
                      <Text style={[styles.photoPickAddText, { color: C.muted }]}>📷 Ajouter une photo (optionnel)</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.sheetBtns}>
                    <TouchableOpacity onPress={() => setEditTarget(null)} disabled={editSaving} style={[styles.btnSecondary, { borderColor: C.border }]}>
                      <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveEdit}
                      disabled={!editMsgText.trim() || !editPrenom.trim() || !editNom.trim() || editSaving}
                      style={[
                        styles.btnPrimary,
                        { backgroundColor: C.accent },
                        (!editMsgText.trim() || !editPrenom.trim() || !editNom.trim() || editSaving) && { opacity: 0.5 },
                      ]}
                    >
                      {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>✓ Enregistrer</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, textAlign: "center", marginBottom: 6 },
  emptyHint: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textAlign: "center" },

  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },
  addBtn: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  addBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#0D1B2E" },

  listPad: { padding: 14, paddingBottom: 40 },

  msgArea: { height: 80, textAlignVertical: "top" },
  postBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  postBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#0D1B2E" },
  msgCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  msgCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  msgAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  msgAvatarText: { fontFamily: "DM_Sans_700Bold", fontSize: 15 },
  msgAuthor: { fontFamily: "DM_Sans_700Bold", fontSize: 13 },
  msgDate: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 1 },
  msgText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22 },
  msgPhoto: { width: "100%", height: 160, borderRadius: 10, marginTop: 10 },
  souvenirsBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 8 },
  souvenirsBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  iconBtn: { width: 30, height: 30, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10 },

  photoPreviewRow: { position: "relative", marginBottom: 10 },
  photoPreviewImg: { width: "100%", height: 140, borderRadius: 10 },
  photoPickRemove: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  photoPickAdd: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  photoPickAddText: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },

  pinLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, marginTop: 4 },
  pinHint: { fontFamily: "DM_Sans_400Regular", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  pinErrorText: { fontFamily: "DM_Sans_400Regular", fontSize: 12, textAlign: "center", marginTop: 8 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" },
  overlayScroll: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, marginBottom: 4 },
  sheetSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginBottom: 20 },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
});
