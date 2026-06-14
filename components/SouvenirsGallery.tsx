import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Image, FlatList, Alert,
  ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import type { SouvenirPhoto } from "@/lib/types";
import type { Theme } from "@/lib/themes";

const { width: SCREEN_W } = Dimensions.get("window");
const COL_GAP = 3;
const CELL_SIZE = (SCREEN_W - 32 - COL_GAP) / 2;

interface Props {
  spaceId: string;
  C: Theme;
  isAdmin: boolean;
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function sanitize(str: string) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function photoPublicUrl(spaceId: string, filename: string) {
  const { data } = supabase.storage.from("souvenirs").getPublicUrl(`${spaceId}/${filename}`);
  return data.publicUrl;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function SouvenirsGallery({ spaceId, C, isAdmin }: Props) {
  const [photos, setPhotos] = useState<(SouvenirPhoto & { url: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadUri, setUploadUri] = useState<string | null>(null);
  const [upPrenom, setUpPrenom] = useState("");
  const [upNom, setUpNom] = useState("");
  const [upPin, setUpPin] = useState("");
  const [upCaption, setUpCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Lightbox
  const [lightbox, setLightbox] = useState<(SouvenirPhoto & { url: string }) | null>(null);

  // Delete via PIN (visiteur)
  const [deleteTarget, setDeleteTarget] = useState<(SouvenirPhoto & { url: string }) | null>(null);
  const [deletePinEntry, setDeletePinEntry] = useState("");
  const [deletePinError, setDeletePinError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Downloading
  const [downloading, setDownloading] = useState(false);

  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadPhotos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("souvenirs")
      .select("*")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false });

    if (error) {
      showToast("Erreur chargement galerie");
      setLoading(false);
      return;
    }

    const withUrls = (data || []).map((p: SouvenirPhoto) => ({
      ...p,
      url: photoPublicUrl(spaceId, p.filename),
    }));
    setPhotos(withUrls);
    setLoading(false);
  }, [spaceId]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  // ── Image picker ───────────────────────────────────────────────────────────
  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadPreview(result.assets[0].uri);
      setUploadUri(result.assets[0].uri);
      setShowUpload(true);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la caméra dans les paramètres.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadPreview(result.assets[0].uri);
      setUploadUri(result.assets[0].uri);
      setShowUpload(true);
    }
  }

  function resetUploadForm() {
    setUpPrenom(""); setUpNom(""); setUpPin(""); setUpCaption("");
    setUploadPreview(null); setUploadUri(null);
    setShowUpload(false);
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!uploadUri || !upPrenom.trim() || (!isAdmin && upPin.length < 4)) return;
    setUploading(true);

    try {
      // 1. Compress
      const compressed = await ImageManipulator.manipulateAsync(
        uploadUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      );

      // 2. Build filename
      const ts = String(Date.now());
      const prenomClean = sanitize(upPrenom.trim()) || "Anonyme";
      const captionClean = sanitize(upCaption.trim());
      const filename = captionClean
        ? `${ts}__${prenomClean}__${captionClean}.jpg`
        : `${ts}__${prenomClean}.jpg`;
      const storagePath = `${spaceId}/${filename}`;

      // 3. Upload to Storage
      const response = await fetch(compressed.uri);
      const blob = await response.blob();

      const { error: storageErr } = await supabase.storage
        .from("souvenirs")
        .upload(storagePath, blob, { contentType: "image/jpeg", cacheControl: "3600" });

      if (storageErr) throw storageErr;

      // 4. Insert DB record
      const { error: dbErr } = await supabase.from("souvenirs").insert({
        space_id: spaceId,
        filename,
        caption: upCaption.trim(),
        uploaded_by_prenom: upPrenom.trim(),
        uploaded_by_nom: upNom.trim(),
        uploaded_by_pin: isAdmin ? "ADMIN" : upPin,
      });

      if (dbErr) {
        // Rollback storage
        await supabase.storage.from("souvenirs").remove([storagePath]);
        throw dbErr;
      }

      showToast("Photo ajoutée ✓");
      resetUploadForm();
      await loadPhotos();
    } catch (e: any) {
      showToast("Erreur upload : " + (e?.message ?? "inconnue"));
    }

    setUploading(false);
  }

  // ── Select / download ──────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(photos.map((p) => p.id)));
  }

  async function downloadSelected() {
    const targets = photos.filter((p) => selected.has(p.id));
    if (targets.length === 0) return;

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Partage non disponible", "Le partage de fichiers n'est pas disponible sur cet appareil.");
      return;
    }

    setDownloading(true);
    let ok = 0;
    for (const photo of targets) {
      try {
        const localUri = (FileSystem.cacheDirectory ?? "") + `souvenir_${photo.id}.jpg`;
        const { uri } = await FileSystem.downloadAsync(photo.url, localUri);
        await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: `Souvenir de ${photo.uploaded_by_prenom}` });
        ok++;
      } catch {
        /* skip failed */
      }
    }
    setDownloading(false);
    showToast(`${ok}/${targets.length} photo${targets.length > 1 ? "s" : ""} partagée${targets.length > 1 ? "s" : ""}`);
  }

  async function sharePhoto(photo: SouvenirPhoto & { url: string }) {
    if (!(await Sharing.isAvailableAsync())) return;
    try {
      const localUri = (FileSystem.cacheDirectory ?? "") + `souvenir_${photo.id}.jpg`;
      const { uri } = await FileSystem.downloadAsync(photo.url, localUri);
      await Sharing.shareAsync(uri, { mimeType: "image/jpeg" });
    } catch {
      showToast("Erreur lors du partage");
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  function confirmDelete(photo: SouvenirPhoto & { url: string }) {
    if (isAdmin) {
      Alert.alert(
        "Supprimer la photo ?",
        `Photo de ${photo.uploaded_by_prenom} ${photo.uploaded_by_nom}.`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: () => doDelete(photo) },
        ],
      );
    } else {
      setDeleteTarget(photo);
      setDeletePinEntry("");
      setDeletePinError(false);
    }
  }

  async function doDelete(photo: SouvenirPhoto & { url: string }) {
    setDeleting(true);
    setLightbox(null);

    const storagePath = `${spaceId}/${photo.filename}`;
    await supabase.storage.from("souvenirs").remove([storagePath]);
    await supabase.from("souvenirs").delete().eq("id", photo.id);

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setDeleteTarget(null);
    showToast("Photo supprimée ✓");
    setDeleting(false);
  }

  function checkDeletePin() {
    if (!deleteTarget) return;
    if (deletePinEntry === deleteTarget.uploaded_by_pin) {
      doDelete(deleteTarget);
    } else {
      setDeletePinError(true);
      setDeletePinEntry("");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const canUpload = isAdmin || true; // visiteurs peuvent toujours uploader

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>📷 Souvenirs</Text>
        <View style={styles.headerBtns}>
          {photos.length > 0 && (
            <TouchableOpacity
              style={[styles.headerBtn, { borderColor: C.border }]}
              onPress={() => {
                setSelectMode(!selectMode);
                setSelected(new Set());
              }}
            >
              <Text style={[styles.headerBtnText, { color: selectMode ? C.accent : C.muted }]}>
                {selectMode ? "Annuler" : "Sélect."}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerBtn, { borderColor: C.border, backgroundColor: "rgba(46,117,182,0.15)" }]}
            onPress={() => {
              Alert.alert(
                "Ajouter une photo",
                "Choisir la source",
                [
                  { text: "📷 Caméra", onPress: pickFromCamera },
                  { text: "🖼️ Galerie", onPress: pickFromGallery },
                  { text: "Annuler", style: "cancel" },
                ],
              );
            }}
          >
            <Text style={[styles.headerBtnText, { color: C.accent }]}>+ Photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Select bar */}
      {selectMode && (
        <View style={[styles.selectBar, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={selectAll} style={[styles.selectBarBtn, { borderColor: C.border }]}>
            <Text style={[styles.selectBarBtnText, { color: C.text }]}>Tout sélect. ({photos.length})</Text>
          </TouchableOpacity>
          <Text style={[styles.selectCount, { color: C.muted }]}>{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</Text>
          <TouchableOpacity
            onPress={downloadSelected}
            disabled={selected.size === 0 || downloading}
            style={[styles.selectBarBtn, { borderColor: C.accent, backgroundColor: "rgba(46,117,182,0.15)" }, selected.size === 0 && { opacity: 0.4 }]}
          >
            {downloading
              ? <ActivityIndicator color={C.accent} size="small" />
              : <Text style={[styles.selectBarBtnText, { color: C.accent }]}>⬇️ Télécharger</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Gallery */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={[styles.emptyText, { color: C.muted }]}>Aucune photo pour l'instant.</Text>
          <Text style={[styles.emptyHint, { color: C.muted }]}>Sois le premier à partager un souvenir 💛</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: COL_GAP }}
          ItemSeparatorComponent={() => <View style={{ height: COL_GAP }} />}
          renderItem={({ item: photo }) => {
            const isSel = selected.has(photo.id);
            return (
              <TouchableOpacity
                style={[
                  styles.cell,
                  { width: CELL_SIZE, height: CELL_SIZE, borderColor: isSel ? C.gold : "transparent" },
                ]}
                onPress={() => {
                  if (selectMode) { toggleSelect(photo.id); }
                  else { setLightbox(photo); }
                }}
                onLongPress={() => {
                  if (!selectMode) {
                    setSelectMode(true);
                    setSelected(new Set([photo.id]));
                  }
                }}
                activeOpacity={0.85}
              >
                <Image source={{ uri: photo.url }} style={styles.cellImg} resizeMode="cover" />
                {isSel && (
                  <View style={[styles.checkBadge, { backgroundColor: C.gold }]}>
                    <Text style={styles.checkBadgeText}>✓</Text>
                  </View>
                )}
                <View style={styles.cellOverlay}>
                  {photo.caption ? (
                    <Text style={styles.cellCaption} numberOfLines={1}>{photo.caption}</Text>
                  ) : null}
                  <Text style={styles.cellAuthor}>{photo.uploaded_by_prenom}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── LIGHTBOX ──────────────────────────────────────────────────────── */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={[styles.lightboxBg, { backgroundColor: "rgba(0,0,0,0.96)" }]}>
          {lightbox && (
            <>
              <Image source={{ uri: lightbox.url }} style={styles.lightboxImg} resizeMode="contain" />
              <View style={[styles.lightboxInfo, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
                {lightbox.caption ? (
                  <Text style={styles.lightboxCaption}>{lightbox.caption}</Text>
                ) : null}
                <Text style={styles.lightboxAuthor}>{lightbox.uploaded_by_prenom} {lightbox.uploaded_by_nom}</Text>
                <Text style={styles.lightboxDate}>
                  {new Date(lightbox.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </Text>
                <View style={styles.lightboxBtns}>
                  <TouchableOpacity
                    style={[styles.lbBtn, { backgroundColor: C.accent }]}
                    onPress={() => sharePhoto(lightbox)}
                  >
                    <Text style={styles.lbBtnText}>⬇️ Partager</Text>
                  </TouchableOpacity>
                  {(isAdmin || lightbox.uploaded_by_pin !== "ADMIN") && (
                    <TouchableOpacity
                      style={[styles.lbBtn, { backgroundColor: "rgba(233,69,96,0.2)", borderWidth: 1, borderColor: "rgba(233,69,96,0.4)" }]}
                      onPress={() => confirmDelete(lightbox)}
                    >
                      <Text style={[styles.lbBtnText, { color: "#e94560" }]}>🗑️ Supprimer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          )}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightbox(null)}>
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── MODAL UPLOAD ──────────────────────────────────────────────────── */}
      <Modal visible={showUpload} transparent animationType="slide" onRequestClose={resetUploadForm}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !uploading && resetUploadForm()}>
            <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                  <Text style={[styles.sheetTitle, { color: "#fff" }]}>📸 Ajouter un souvenir</Text>

                  {/* Preview */}
                  {uploadPreview && (
                    <View style={[styles.uploadPreview, { backgroundColor: C.bg }]}>
                      <Image source={{ uri: uploadPreview }} style={styles.uploadPreviewImg} resizeMode="cover" />
                      <View style={[styles.compressNote, { backgroundColor: "rgba(62,207,142,0.1)", borderColor: "rgba(62,207,142,0.3)" }]}>
                        <Text style={[styles.compressNoteText, { color: C.success }]}>✓ Compression automatique avant envoi</Text>
                      </View>
                    </View>
                  )}

                  <TextInput
                    style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ton prénom *"
                    placeholderTextColor={C.muted}
                    value={upPrenom}
                    onChangeText={setUpPrenom}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ton nom"
                    placeholderTextColor={C.muted}
                    value={upNom}
                    onChangeText={setUpNom}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={[styles.input, styles.inputCaption, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Légende (optionnelle)"
                    placeholderTextColor={C.muted}
                    value={upCaption}
                    onChangeText={setUpCaption}
                    multiline
                    numberOfLines={2}
                  />

                  {/* PIN — seulement pour les visiteurs */}
                  {!isAdmin && (
                    <>
                      <Text style={[styles.pinLabel, { color: C.gold }]}>
                        🔐 Code PIN (pour pouvoir supprimer ta photo)
                      </Text>
                      <PinPad value={upPin} onChange={setUpPin} theme={C} />
                    </>
                  )}

                  <View style={styles.sheetBtns}>
                    <TouchableOpacity
                      onPress={resetUploadForm}
                      disabled={uploading}
                      style={[styles.btnSecondary, { borderColor: C.border }]}
                    >
                      <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleUpload}
                      disabled={!upPrenom.trim() || (!isAdmin && upPin.length < 4) || uploading || !uploadUri}
                      style={[
                        styles.btnPrimary,
                        { backgroundColor: C.accent },
                        (!upPrenom.trim() || (!isAdmin && upPin.length < 4) || uploading || !uploadUri) && { opacity: 0.5 },
                      ]}
                    >
                      {uploading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.btnPrimaryText}>Envoyer</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL DELETE PIN (visiteur) ────────────────────────────────────── */}
      <Modal visible={!!deleteTarget && !isAdmin} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: "#e94560" }]}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🗑️</Text>
              <Text style={[styles.sheetTitle, { color: "#fff" }]}>Supprimer la photo ?</Text>
              <Text style={[styles.sheetSub, { color: C.muted }]}>
                Saisis le PIN utilisé lors de l'upload de cette photo.
              </Text>
            </View>

            {deleteTarget && (
              <View style={[styles.deletePreviewRow, { backgroundColor: C.bg, borderColor: C.border }]}>
                <Image source={{ uri: deleteTarget.url }} style={styles.deleteThumb} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.deleteAuthorText, { color: C.text }]}>
                    {deleteTarget.uploaded_by_prenom} {deleteTarget.uploaded_by_nom}
                  </Text>
                  {deleteTarget.caption ? (
                    <Text style={[styles.deleteCaptionText, { color: C.muted }]} numberOfLines={1}>
                      {deleteTarget.caption}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            <PinPad value={deletePinEntry} onChange={setDeletePinEntry} theme={C} hasError={deletePinError} />

            {deletePinError && (
              <Text style={[styles.pinErrorText, { color: "#e94560" }]}>
                PIN incorrect. Saisis le code choisi lors de l'upload.
              </Text>
            )}

            <View style={[styles.sheetBtns, { marginTop: 16 }]}>
              <TouchableOpacity
                onPress={() => setDeleteTarget(null)}
                style={[styles.btnSecondary, { borderColor: C.border }]}
              >
                <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={checkDeletePin}
                disabled={deletePinEntry.length < 4 || deleting}
                style={[
                  styles.btnPrimary,
                  { backgroundColor: "#e94560" },
                  (deletePinEntry.length < 4 || deleting) && { opacity: 0.5 },
                ]}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Supprimer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
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
  headerBtns: { flexDirection: "row", gap: 8 },
  headerBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  headerBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },

  selectBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  selectBarBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  selectBarBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  selectCount: { fontFamily: "DM_Sans_400Regular", fontSize: 13, flex: 1, textAlign: "center" },

  grid: { padding: 16, paddingBottom: 32 },
  cell: { borderRadius: 10, overflow: "hidden", borderWidth: 2 },
  cellImg: { width: "100%", height: "100%" },
  checkBadge: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  checkBadgeText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#0D1B2E" },
  cellOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 20, backgroundColor: "rgba(0,0,0,0)" },
  cellCaption: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, color: "#fff" },
  cellAuthor: { fontFamily: "DM_Sans_400Regular", fontSize: 10, color: "rgba(255,255,255,0.75)" },

  // Lightbox
  lightboxBg: { flex: 1, justifyContent: "center", alignItems: "center" },
  lightboxImg: { width: SCREEN_W, height: SCREEN_W * 1.1 },
  lightboxInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36 },
  lightboxCaption: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, color: "#fff", marginBottom: 6 },
  lightboxAuthor: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "rgba(255,255,255,0.85)" },
  lightboxDate: { fontFamily: "DM_Sans_400Regular", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2, marginBottom: 14 },
  lightboxBtns: { flexDirection: "row", gap: 10 },
  lbBtn: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  lbBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#fff" },
  lightboxClose: { position: "absolute", top: 52, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  // Overlay / sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" },
  overlayScroll: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, marginBottom: 4 },
  sheetSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginBottom: 20 },

  input: { borderWidth: 1, borderRadius: 10, padding: 13, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10 },
  inputCaption: { height: 72, textAlignVertical: "top" },
  pinLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },

  // Upload preview
  uploadPreview: { borderRadius: 12, overflow: "hidden", marginBottom: 14 },
  uploadPreviewImg: { width: "100%", height: 180 },
  compressNote: { borderTopWidth: 1, padding: 8 },
  compressNoteText: { fontFamily: "DM_Sans_400Regular", fontSize: 12 },

  // Delete PIN
  deletePreviewRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  deleteThumb: { width: 52, height: 52, borderRadius: 8 },
  deleteAuthorText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  deleteCaptionText: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  pinErrorText: { fontFamily: "DM_Sans_400Regular", fontSize: 12, textAlign: "center", marginTop: 8 },

  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
