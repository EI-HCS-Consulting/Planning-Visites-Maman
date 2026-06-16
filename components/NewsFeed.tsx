import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, Image, Modal, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import type { NewsEntry } from "@/lib/types";
import type { Theme } from "@/lib/themes";

const { width: SCREEN_W } = Dimensions.get("window");
const PHOTO_BUCKET = "news-photos";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NewsEntryWithUrls extends NewsEntry {
  photoUrls: string[];
}

interface Props {
  spaceId: string;
  C: Theme;
  isAdmin: boolean;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function newsPhotoUrl(spaceId: string, filename: string) {
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${spaceId}/${filename}`);
  return data.publicUrl;
}

function frDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function frDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function avatarInitial(prenom: string) {
  return prenom.trim().charAt(0).toUpperCase() || "?";
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function NewsFeed({ spaceId, C, isAdmin }: Props) {
  const [entries, setEntries] = useState<NewsEntryWithUrls[]>([]);
  const [loading, setLoading] = useState(true);

  // Publish / edit modal
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<NewsEntryWithUrls | null>(null);

  // Form state
  const [formText, setFormText] = useState("");
  const [formPrenom, setFormPrenom] = useState("");
  const [formNom, setFormNom] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formPhotos, setFormPhotos] = useState<{ uri: string; filename: string }[]>([]);
  const [formSaving, setFormSaving] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);

  // PIN modal (visitor edit/delete)
  const [pinModal, setPinModal] = useState<{ entry: NewsEntryWithUrls; action: "edit" | "delete" } | null>(null);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);

  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news_entries")
      .select("*")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false });

    if (error) {
      showToast("Erreur chargement nouvelles");
      setLoading(false);
      return;
    }

    const withUrls: NewsEntryWithUrls[] = (data || []).map((e: NewsEntry) => ({
      ...e,
      photoUrls: (e.photos || []).map((f: string) => newsPhotoUrl(spaceId, f)),
    }));
    setEntries(withUrls);
    setLoading(false);
  }, [spaceId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`news:${spaceId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "news_entries",
        filter: `space_id=eq.${spaceId}`,
      }, loadEntries)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [spaceId, loadEntries]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  function openPublish() {
    setEditTarget(null);
    setFormText(""); setFormPrenom(""); setFormNom(""); setFormPin("");
    setFormPhotos([]);
    setShowForm(true);
  }

  function openEdit(entry: NewsEntryWithUrls) {
    setEditTarget(entry);
    setFormText(entry.content);
    setFormPrenom(entry.author_prenom);
    setFormNom(entry.author_nom);
    setFormPin("");
    // When editing, existing photos are kept server-side;
    // show them as "already uploaded" (no local uri)
    setFormPhotos(entry.photos.map((f, i) => ({ uri: entry.photoUrls[i], filename: f })));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditTarget(null);
    setFormPhotos([]);
  }

  // ── Photo picking ──────────────────────────────────────────────────────────
  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    setAddingPhoto(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
    });
    setAddingPhoto(false);
    if (!result.canceled) {
      const newPhotos: { uri: string; filename: string }[] = [];
      for (const asset of result.assets) {
        const ts = Date.now();
        const idx = formPhotos.length + newPhotos.length;
        const filename = `${ts}_${idx}.jpg`;
        newPhotos.push({ uri: asset.uri, filename });
      }
      setFormPhotos((prev) => [...prev, ...newPhotos]);
    }
  }

  function removePhoto(idx: number) {
    setFormPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Upload photos ──────────────────────────────────────────────────────────
  async function uploadNewPhotos(photos: { uri: string; filename: string }[]): Promise<string[]> {
    const filenames: string[] = [];
    for (const photo of photos) {
      // Skip already-uploaded photos (uri starts with https)
      if (photo.uri.startsWith("http")) {
        filenames.push(photo.filename);
        continue;
      }
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const response = await fetch(compressed.uri);
        const blob = await response.blob();
        const ts = Date.now();
        const fname = `${ts}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(`${spaceId}/${fname}`, blob, { contentType: "image/jpeg", cacheControl: "3600" });
        if (!error) filenames.push(fname);
      } catch {
        /* skip failed photo */
      }
    }
    return filenames;
  }

  // ── Save (create / edit) ───────────────────────────────────────────────────
  async function handleSave() {
    if (!formText.trim() || !formPrenom.trim() || !formNom.trim()) return;
    if (!isAdmin && !editTarget && formPin.length < 4) return;
    setFormSaving(true);

    // Upload new photos
    const newPhotosCount = formPhotos.filter((p) => !p.uri.startsWith("http")).length;
    const uploadedFilenames = await uploadNewPhotos(formPhotos);
    const keptCount = formPhotos.filter((p) => p.uri.startsWith("http")).length;
    const newlyUploadedCount = uploadedFilenames.length - keptCount;
    if (newlyUploadedCount < newPhotosCount) {
      // uploadNewPhotos() silently skips photos that fail to upload — warn
      // instead of letting the post save with fewer photos than expected
      // and no explanation.
      Alert.alert(
        "Envoi de photo incomplet",
        `${newPhotosCount - newlyUploadedCount} photo(s) sur ${newPhotosCount} n'a/n'ont pas pu être envoyée(s). La nouvelle sera publiée avec les autres.`,
      );
    }

    if (editTarget) {
      // Edit: remove old photos that were removed from formPhotos
      const keptFilenames = formPhotos
        .filter((p) => p.uri.startsWith("http"))
        .map((p) => p.filename);
      const removedFilenames = editTarget.photos.filter((f) => !keptFilenames.includes(f));

      // Delete removed photos from storage
      if (removedFilenames.length) {
        await supabase.storage.from(PHOTO_BUCKET).remove(
          removedFilenames.map((f) => `${spaceId}/${f}`),
        );
      }

      // Merge: kept + newly uploaded
      const finalFilenames = [...keptFilenames, ...uploadedFilenames.filter((f) => !keptFilenames.includes(f))];

      const { error } = await supabase
        .from("news_entries")
        .update({
          content: formText.trim(),
          author_prenom: formPrenom.trim(),
          author_nom: formNom.trim(),
          photos: finalFilenames,
        })
        .eq("id", editTarget.id);

      setFormSaving(false);
      // The publish/edit sheet is a native <Modal> — it stays open on error
      // (so the user can retry), which would hide the toast banner behind
      // it. Alert is native too, so it's visible regardless.
      if (error) { Alert.alert("Erreur", "Erreur lors de la modification : " + error.message); return; }
      showToast("Nouvelle modifiée ✓");
    } else {
      const { error } = await supabase.from("news_entries").insert({
        space_id: spaceId,
        news_date: new Date().toISOString().slice(0, 10),
        content: formText.trim(),
        author_prenom: formPrenom.trim(),
        author_nom: formNom.trim(),
        author_pin: isAdmin ? "ADMIN" : formPin,
        photos: uploadedFilenames,
      });

      setFormSaving(false);
      if (error) { Alert.alert("Erreur", "Erreur lors de la publication : " + error.message); return; }
      showToast("Nouvelle publiée ✓");
    }

    closeForm();
    await loadEntries();
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function doDelete(entry: NewsEntryWithUrls) {
    // Delete photos from storage
    if (entry.photos.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(
        entry.photos.map((f) => `${spaceId}/${f}`),
      );
    }
    await supabase.from("news_entries").delete().eq("id", entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    showToast("Nouvelle supprimée ✓");
  }

  function requestDelete(entry: NewsEntryWithUrls) {
    if (isAdmin) {
      Alert.alert(
        "Supprimer cette nouvelle ?",
        `"${entry.content.slice(0, 60)}${entry.content.length > 60 ? "…" : ""}"`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: () => doDelete(entry) },
        ],
      );
    } else {
      setPinModal({ entry, action: "delete" });
      setPinEntry(""); setPinError(false);
    }
  }

  function requestEdit(entry: NewsEntryWithUrls) {
    if (isAdmin) {
      openEdit(entry);
    } else {
      setPinModal({ entry, action: "edit" });
      setPinEntry(""); setPinError(false);
    }
  }

  function checkPin() {
    if (!pinModal) return;
    if (pinEntry === pinModal.entry.author_pin) {
      const { entry, action } = pinModal;
      setPinModal(null);
      if (action === "edit") openEdit(entry);
      else doDelete(entry);
    } else {
      setPinError(true);
      setPinEntry("");
    }
  }

  // ── Render entry ───────────────────────────────────────────────────────────
  function renderEntry({ item: entry }: { item: NewsEntryWithUrls }) {
    const canModify = isAdmin || entry.author_pin !== "ADMIN";
    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {/* Author + date */}
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: C.accent }]}>
            <Text style={styles.avatarText}>{avatarInitial(entry.author_prenom)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.authorName, { color: "#fff" }]}>
              {entry.author_prenom} {entry.author_nom}
            </Text>
            <Text style={[styles.entryDate, { color: C.muted }]}>
              {frDateTime(entry.created_at)}
            </Text>
          </View>
          {canModify && (
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => requestEdit(entry)} style={[styles.actionBtn, { borderColor: C.border }]}>
                <Text style={[styles.actionBtnText, { color: C.muted }]}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => requestDelete(entry)} style={[styles.actionBtn, { borderColor: "rgba(233,69,96,0.3)" }]}>
                <Text style={[styles.actionBtnText, { color: "#e94560" }]}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Text */}
        <Text style={[styles.entryText, { color: C.text }]}>{entry.content}</Text>

        {/* Photos */}
        {entry.photoUrls.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {entry.photoUrls.map((url, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setLightbox({ urls: entry.photoUrls, idx: i })}
                activeOpacity={0.85}
              >
                <Image source={{ uri: url }} style={[styles.photoThumb, { borderColor: C.border }]} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>📰 Nouvelles du jour</Text>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: C.accent }]}
          onPress={openPublish}
        >
          <Text style={styles.publishBtnText}>+ Publier</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📰</Text>
          <Text style={[styles.emptyText, { color: C.muted }]}>Aucune nouvelle pour l'instant.</Text>
          <Text style={[styles.emptyHint, { color: C.muted }]}>Partage un compte-rendu après ta visite 💛</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* ── MODAL PUBLICATION / ÉDITION ───────────────────────────────────── */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !formSaving && closeForm()}>
            <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                  <Text style={[styles.sheetTitle, { color: "#fff" }]}>
                    {editTarget ? "✏️ Modifier la nouvelle" : "📰 Nouvelle du jour"}
                  </Text>

                  {/* Champs auteur */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Prénom *"
                      placeholderTextColor={C.muted}
                      value={formPrenom}
                      onChangeText={setFormPrenom}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Nom *"
                      placeholderTextColor={C.muted}
                      value={formNom}
                      onChangeText={setFormNom}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Texte */}
                  <TextInput
                    style={[styles.input, styles.textarea, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Raconte ta visite… comment allait-elle ? ✍️"
                    placeholderTextColor={C.muted}
                    value={formText}
                    onChangeText={setFormText}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />

                  {/* Photos */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>Photos (optionnel)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
                      {formPhotos.map((p, i) => (
                        <View key={i} style={styles.photoPickItem}>
                          <Image source={{ uri: p.uri }} style={styles.photoPickThumb} resizeMode="cover" />
                          <TouchableOpacity
                            style={[styles.photoPickRemove, { backgroundColor: "#e94560" }]}
                            onPress={() => removePhoto(i)}
                          >
                            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity
                        style={[styles.photoPickAdd, { backgroundColor: C.bg, borderColor: C.border }]}
                        onPress={pickPhoto}
                        disabled={addingPhoto}
                      >
                        {addingPhoto
                          ? <ActivityIndicator color={C.accent} size="small" />
                          : <Text style={[styles.photoPickAddText, { color: C.muted }]}>📷{"\n"}Ajouter</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </ScrollView>

                  {/* PIN (visiteur uniquement, uniquement à la création) */}
                  {!isAdmin && !editTarget && (
                    <>
                      <Text style={[styles.fieldLabel, { color: C.gold }]}>
                        🔐 Code PIN (pour modifier ou supprimer)
                      </Text>
                      <PinPad value={formPin} onChange={setFormPin} theme={C} />
                    </>
                  )}

                  <View style={styles.sheetBtns}>
                    <TouchableOpacity
                      onPress={closeForm}
                      disabled={formSaving}
                      style={[styles.btnSecondary, { borderColor: C.border }]}
                    >
                      <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={
                        !formText.trim() || !formPrenom.trim() || !formNom.trim() ||
                        (!isAdmin && !editTarget && formPin.length < 4) ||
                        formSaving
                      }
                      style={[
                        styles.btnPrimary,
                        { backgroundColor: C.accent },
                        (!formText.trim() || !formPrenom.trim() || !formNom.trim() ||
                          (!isAdmin && !editTarget && formPin.length < 4) || formSaving) && { opacity: 0.5 },
                      ]}
                    >
                      {formSaving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.btnPrimaryText}>{editTarget ? "Enregistrer" : "Publier"}</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL PIN ─────────────────────────────────────────────────────── */}
      <Modal visible={!!pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🔐</Text>
              <Text style={[styles.sheetTitle, { color: "#fff" }]}>Code PIN</Text>
              <Text style={[styles.sheetSub, { color: C.muted }]}>
                {pinModal?.action === "edit"
                  ? "Saisis ton PIN pour modifier cette nouvelle."
                  : "Saisis ton PIN pour supprimer cette nouvelle."}
              </Text>
            </View>

            {pinModal && (
              <View style={[styles.pinContext, { backgroundColor: C.bg, borderColor: C.border }]}>
                <Text style={[styles.pinContextText, { color: C.text }]} numberOfLines={2}>
                  "{pinModal.entry.content.slice(0, 80)}{pinModal.entry.content.length > 80 ? "…" : ""}"
                </Text>
                <Text style={[styles.pinContextAuthor, { color: C.muted }]}>
                  — {pinModal.entry.author_prenom} {pinModal.entry.author_nom}
                </Text>
              </View>
            )}

            <PinPad value={pinEntry} onChange={setPinEntry} theme={C} hasError={pinError} />

            {pinError && (
              <Text style={[styles.pinErrorText, { color: "#e94560" }]}>
                PIN incorrect.
              </Text>
            )}

            <View style={[styles.sheetBtns, { marginTop: 16 }]}>
              <TouchableOpacity
                onPress={() => setPinModal(null)}
                style={[styles.btnSecondary, { borderColor: C.border }]}
              >
                <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={checkPin}
                disabled={pinEntry.length < 4}
                style={[
                  styles.btnPrimary,
                  { backgroundColor: pinModal?.action === "delete" ? "#e94560" : C.accent },
                  pinEntry.length < 4 && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {pinModal?.action === "delete" ? "Supprimer" : "Modifier"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── LIGHTBOX ──────────────────────────────────────────────────────── */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={styles.lightboxBg}>
          {lightbox && (
            <>
              <Image
                source={{ uri: lightbox.urls[lightbox.idx] }}
                style={styles.lightboxImg}
                resizeMode="contain"
              />
              {/* Prev / next */}
              {lightbox.urls.length > 1 && (
                <View style={styles.lightboxNav}>
                  <TouchableOpacity
                    onPress={() => setLightbox({ ...lightbox, idx: Math.max(0, lightbox.idx - 1) })}
                    style={[styles.lightboxNavBtn, lightbox.idx === 0 && { opacity: 0.3 }]}
                    disabled={lightbox.idx === 0}
                  >
                    <Text style={styles.lightboxNavText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.lightboxCounter}>
                    {lightbox.idx + 1} / {lightbox.urls.length}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setLightbox({ ...lightbox, idx: Math.min(lightbox.urls.length - 1, lightbox.idx + 1) })}
                    style={[styles.lightboxNavBtn, lightbox.idx === lightbox.urls.length - 1 && { opacity: 0.3 }]}
                    disabled={lightbox.idx === lightbox.urls.length - 1}
                  >
                    <Text style={styles.lightboxNavText}>›</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightbox(null)}>
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Toast */}
      {!!toast && (
        <View style={[styles.toast, { backgroundColor: C.success }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, textAlign: "center", marginBottom: 8 },
  emptyHint: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },
  publishBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  publishBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#fff" },

  list: { padding: 14, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "DM_Sans_700Bold", fontSize: 16, color: "#fff" },
  authorName: { fontFamily: "DM_Sans_700Bold", fontSize: 14 },
  entryDate: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 1 },
  cardActions: { flexDirection: "row", gap: 6 },
  actionBtn: { width: 32, height: 32, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actionBtnText: { fontSize: 14 },
  entryText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22 },
  photoStrip: { paddingTop: 10, gap: 6 },
  photoThumb: { width: 100, height: 100, borderRadius: 10, borderWidth: 1 },

  // Overlay / sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" },
  overlayScroll: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, marginBottom: 4 },
  sheetSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginBottom: 20 },

  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10 },
  textarea: { height: 110, textAlignVertical: "top" },
  fieldLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },

  photoPickItem: { position: "relative" },
  photoPickThumb: { width: 72, height: 72, borderRadius: 10 },
  photoPickRemove: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  photoPickAdd: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  photoPickAddText: { fontFamily: "DM_Sans_400Regular", fontSize: 11, textAlign: "center", lineHeight: 16 },

  pinContext: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  pinContextText: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 20, fontStyle: "italic" },
  pinContextAuthor: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, marginTop: 6 },
  pinErrorText: { fontFamily: "DM_Sans_400Regular", fontSize: 12, textAlign: "center", marginTop: 8 },

  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },

  // Lightbox
  lightboxBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", alignItems: "center", justifyContent: "center" },
  lightboxImg: { width: SCREEN_W, height: SCREEN_W * 1.1 },
  lightboxNav: { position: "absolute", bottom: 60, flexDirection: "row", alignItems: "center", gap: 24 },
  lightboxNavBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  lightboxNavText: { color: "#fff", fontSize: 22, fontWeight: "600" },
  lightboxCounter: { fontFamily: "DM_Sans_400Regular", fontSize: 14, color: "rgba(255,255,255,0.7)" },
  lightboxClose: { position: "absolute", top: 52, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
