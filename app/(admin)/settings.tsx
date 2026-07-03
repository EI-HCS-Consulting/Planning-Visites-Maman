import { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Image, TextInput, Switch,
  Linking, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/lib/SpaceContext";
import { themes, themeLabels } from "@/lib/themes";
import PatientAvatar from "@/components/PatientAvatar";
import type { ThemeKey } from "@/lib/themes";

// ─── Historique des champs hospitaliers ───────────────────────────────────────
interface FieldHistoryEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  hospital_room: "Chambre",
  hospital_service: "Service",
  hospital_sector: "Secteur",
};
const FIELD_ICONS: Record<string, string> = {
  hospital_room: "🛏️",
  hospital_service: "🏥",
  hospital_sector: "📍",
};

// ─── Swatches de prévisualisation par thème ───────────────────────────────────
const THEME_SWATCHES: Record<ThemeKey, string> = {
  blue: "#2E75B6",
  red: "#C0392B",
  pink: "#E91E8C",
  green: "#27AE60",
  yellow: "#D4A017",
  orange: "#E67E22",
};

const THEME_ORDER: ThemeKey[] = ["blue", "red", "pink", "green", "yellow", "orange"];

export default function SettingsScreen() {
  const router = useRouter();
  const { space, slotConfig, loading, hasSpace, refreshSlotConfig } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  const [themeUpdating, setThemeUpdating] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  // undefined = use space value; null = cleared locally; string = new URL (immediate preview before Realtime)
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null | undefined>(undefined);
  const displayPhotoUrl = localPhotoUrl !== undefined ? localPhotoUrl : (space?.patient_photo_url ?? null);
  const [prolonging, setProlonging] = useState(false);
  const [toast, setToast] = useState("");

  // Admin notes
  const notesInit = useRef(false);
  const [visitRules, setVisitRules] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  useEffect(() => {
    if (space && !notesInit.current) {
      notesInit.current = true;
      setVisitRules(space.visit_rules ?? "");
    }
  }, [space]);

  // Infos hospitalières (room / service / secteur)
  const hospitalInfosInit = useRef(false);
  const [room, setRoom] = useState("");
  const [service, setService] = useState("");
  const [sector, setSector] = useState("");
  const [hospitalInfosSaving, setHospitalInfosSaving] = useState(false);
  useEffect(() => {
    if (space && !hospitalInfosInit.current) {
      hospitalInfosInit.current = true;
      setRoom(space.hospital_room ?? "");
      setService(space.hospital_service ?? "");
      setSector(space.hospital_sector ?? "");
    }
  }, [space]);

  // Coordonnées de l'hôpital (name / address / maps url)
  const hospitalCoordsInit = useRef(false);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [hospitalCoordsSaving, setHospitalCoordsSaving] = useState(false);
  useEffect(() => {
    if (space && !hospitalCoordsInit.current) {
      hospitalCoordsInit.current = true;
      setHospitalName(space.hospital_name ?? "");
      setHospitalAddress(space.hospital_address ?? "");
      setMapsUrl(space.hospital_maps_url ?? "");
    }
  }, [space]);

  // Modal changement de nom
  const [nameChangeModal, setNameChangeModal] = useState(false);
  const [nameChangeFirstname, setNameChangeFirstname] = useState("");
  const [nameChangeLastname, setNameChangeLastname] = useState("");
  const [nameChangeReason, setNameChangeReason] = useState("");

  // Historique des champs hospitaliers
  const [fieldHistory, setFieldHistory] = useState<FieldHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Nuitées toggle
  const [nightToggling, setNightToggling] = useState(false);

  // Règles des créneaux
  const slotRulesInit = useRef(false);
  const [visitStartHour, setVisitStartHour] = useState(9);
  const [visitEndHour, setVisitEndHour] = useState(20);
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotGap, setSlotGap] = useState(0);
  const [gapIsCustom, setGapIsCustom] = useState(false);
  const [gapCustomHours, setGapCustomHours] = useState(0);
  const [gapCustomMinutes, setGapCustomMinutes] = useState(0);
  const [maxVisitors, setMaxVisitors] = useState(2);
  const [allowedWeekdays, setAllowedWeekdays] = useState<number[]>([0,1,2,3,4,5,6]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [slotRulesSaving, setSlotRulesSaving] = useState(false);
  useEffect(() => {
    if (slotConfig && !slotRulesInit.current) {
      slotRulesInit.current = true;
      setVisitStartHour(slotConfig.visit_start_hour);
      setVisitEndHour(slotConfig.visit_end_hour);
      setSlotDuration(slotConfig.slot_duration_minutes);
      const gap = slotConfig.min_gap_minutes || 0;
      setSlotGap(gap);
      const presets = [0, 15, 30, 60, 120];
      if (!presets.includes(gap)) {
        setGapIsCustom(true);
        setGapCustomHours(Math.floor(gap / 60));
        setGapCustomMinutes(gap % 60);
      }
      setMaxVisitors(slotConfig.max_visitors_per_slot);
      setAllowedWeekdays(slotConfig.allowed_weekdays ?? [0,1,2,3,4,5,6]);
      setBlockedDates(slotConfig.blocked_dates ?? []);
    }
  }, [slotConfig]);

  // Modal calendrier pour ajouter une date bloquée
  const [blockPickerVisible, setBlockPickerVisible] = useState(false);
  const [blockPickerDate, setBlockPickerDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Historique ─────────────────────────────────────────────────────────────
  async function loadHistory() {
    if (!space) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("space_field_history")
      .select("*")
      .eq("space_id", space.id)
      .order("changed_at", { ascending: false })
      .limit(50);
    setFieldHistory(data || []);
    setHistoryLoading(false);
  }

  useEffect(() => { if (space) loadHistory(); }, [space?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function logFieldChange(fieldName: string, oldValue: string | null | undefined, newValue: string | null) {
    const old = oldValue?.trim() || null;
    const next = newValue?.trim() || null;
    if (old === next) return;
    await supabase.from("space_field_history").insert({
      space_id: space!.id,
      field_name: fieldName,
      old_value: old,
      new_value: next,
    });
  }

  // ── Chambre ────────────────────────────────────────────────────────────────
  async function handleSaveHospitalInfos() {
    if (!space) return;
    setHospitalInfosSaving(true);
    const nextRoom = room.trim() || null;
    const nextService = service.trim() || null;
    const nextSector = sector.trim() || null;
    const logChanges: Promise<void>[] = [];
    if (nextRoom !== space.hospital_room) logChanges.push(logFieldChange("hospital_room", space.hospital_room, nextRoom));
    if (nextService !== space.hospital_service) logChanges.push(logFieldChange("hospital_service", space.hospital_service, nextService));
    if (nextSector !== space.hospital_sector) logChanges.push(logFieldChange("hospital_sector", space.hospital_sector, nextSector));
    await Promise.all(logChanges);
    const { error } = await supabase
      .from("patient_spaces")
      .update({ hospital_room: nextRoom, hospital_service: nextService, hospital_sector: nextSector })
      .eq("id", space.id);
    setHospitalInfosSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else { showToast("Infos hospitalières enregistrées ✓"); loadHistory(); }
  }

  // ── Admin notes ────────────────────────────────────────────────────────────
  async function handleSaveNotes() {
    if (!space) return;
    setNotesSaving(true);
    const { error } = await supabase
      .from("patient_spaces")
      .update({ visit_rules: visitRules.trim() })
      .eq("id", space.id);
    setNotesSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else showToast("Message enregistré ✓");
  }

  // ── Coordonnées hôpital ────────────────────────────────────────────────────
  async function handleSaveHospitalCoords() {
    if (!space) return;
    setHospitalCoordsSaving(true);
    const { error } = await supabase
      .from("patient_spaces")
      .update({
        hospital_name: hospitalName.trim() || null,
        hospital_address: hospitalAddress.trim() || null,
        hospital_maps_url: mapsUrl.trim() || null,
      })
      .eq("id", space.id);
    setHospitalCoordsSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else showToast("Coordonnées enregistrées ✓");
  }

  function handleOpenNameChange() {
    setNameChangeFirstname("");
    setNameChangeLastname("");
    setNameChangeReason("");
    setNameChangeModal(true);
  }

  function handleSendNameChange() {
    if (!space) return;
    const subject = encodeURIComponent(`Demande de changement de nom — espace ${space.patient_firstname} ${space.patient_lastname}`);
    const body = encodeURIComponent(
      `Nom actuel : ${space.patient_firstname} ${space.patient_lastname}\n` +
      `Nouveau prénom souhaité : ${nameChangeFirstname.trim()}\n` +
      `Nouveau nom souhaité : ${nameChangeLastname.trim()}\n\n` +
      `Raison du changement :\n${nameChangeReason.trim()}\n\n` +
      `ID espace : ${space.id}`
    );
    Linking.openURL(`mailto:support@avectoi.care?subject=${subject}&body=${body}`);
    setNameChangeModal(false);
  }

  // ── Nuitées toggle ─────────────────────────────────────────────────────────
  async function handleToggleNight() {
    if (!slotConfig) return;
    setNightToggling(true);
    const { error } = await supabase
      .from("slot_config")
      .update({ night_enabled: !slotConfig.night_enabled })
      .eq("id", slotConfig.id);
    setNightToggling(false);
    if (error) showToast("Erreur lors de la mise à jour.");
    else showToast(slotConfig.night_enabled ? "Nuitées suspendues ✓" : "Nuitées activées ✓");
  }

  // ── Règles des créneaux ───────────────────────────────────────────────────
  function toggleWeekday(day: number) {
    setAllowedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function toggleBlockedDate(iso: string) {
    setBlockedDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort()
    );
  }

  async function handleSaveSlotRules() {
    if (!slotConfig) return;
    setSlotRulesSaving(true);

    // Première update : champs existants (toujours présents en DB)
    const { error: e1 } = await supabase.from("slot_config").update({
      visit_start_hour: visitStartHour,
      visit_end_hour: visitEndHour,
      slot_duration_minutes: slotDuration,
      min_gap_minutes: slotGap,
      max_visitors_per_slot: maxVisitors,
    }).eq("id", slotConfig.id);

    if (e1) {
      setSlotRulesSaving(false);
      showToast("Erreur : " + e1.message);
      return;
    }

    // Deuxième update : nouvelles colonnes (requiert la migration SQL)
    const { error: e2 } = await supabase.from("slot_config").update({
      allowed_weekdays: allowedWeekdays,
      blocked_dates: blockedDates,
    }).eq("id", slotConfig.id);

    setSlotRulesSaving(false);
    refreshSlotConfig();
    if (e2) {
      showToast("Horaires enregistrés ✓ — exécutez la migration SQL pour activer les jours/dates.");
    } else {
      showToast("Règles de visite enregistrées ✓");
    }
  }

  // ── Theme switch ───────────────────────────────────────────────────────────
  async function handleThemeChange(key: ThemeKey) {
    if (!space || key === space.theme) return;
    setThemeUpdating(true);
    const { error } = await supabase
      .from("patient_spaces")
      .update({ theme: key })
      .eq("id", space.id);
    setThemeUpdating(false);
    if (error) showToast("Erreur lors du changement de thème.");
    // Realtime in SpaceContext will update space automatically
  }

  // ── Patient photo upload ───────────────────────────────────────────────────
  async function handlePhotoUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setPhotoUploading(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      // fetch(localUri).blob() est peu fiable sur expo-file-system v19
      // (échoue souvent en "Network request failed") — lecture directe
      // du fichier local via la nouvelle API File, sans passer par le réseau.
      const fileData = await new File(compressed.uri).arrayBuffer();
      const storagePath = `${space!.id}/photo.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("patient-photos")
        .upload(storagePath, fileData, {
          contentType: "image/jpeg",
          cacheControl: "0",
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("patient-photos")
        .getPublicUrl(storagePath);

      // Bust cache with a timestamp
      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("patient_spaces")
        .update({ patient_photo_url: photoUrl })
        .eq("id", space!.id);

      if (dbErr) throw dbErr;

      setLocalPhotoUrl(photoUrl);
      showToast("Photo mise à jour ✓");
    } catch (e: any) {
      showToast("Erreur : " + (e?.message ?? "inconnue"));
    }
    setPhotoUploading(false);
  }

  async function handleRemovePhoto() {
    if (!space?.patient_photo_url) return;
    Alert.alert("Supprimer la photo ?", "La photo du patient sera retirée de l'app.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.storage.from("patient-photos").remove([`${space.id}/photo.jpg`]);
          await supabase.from("patient_spaces").update({ patient_photo_url: null }).eq("id", space.id);
          setLocalPhotoUrl(null);
          showToast("Photo supprimée ✓");
        },
      },
    ]);
  }

  // ── Prolongation RGPD ─────────────────────────────────────────────────────
  function handleProlong() {
    if (!space) return;
    Alert.alert(
      "Prolonger l'espace",
      "Ajouter 30 jours à la date de conservation ? Toutes les données seront conservées 30 jours de plus.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Prolonger",
          onPress: async () => {
            setProlonging(true);

            const currentPurge = new Date(space.purge_scheduled_at);
            const newPurge = new Date(currentPurge);
            newPurge.setDate(newPurge.getDate() + 30);

            const currentEnd = new Date(space.end_date + "T00:00:00");
            const newEnd = new Date(currentEnd);
            newEnd.setDate(newEnd.getDate() + 30);

            const { error } = await supabase
              .from("patient_spaces")
              .update({
                purge_scheduled_at: newPurge.toISOString(),
                end_date: newEnd.toISOString().split("T")[0],
              })
              .eq("id", space.id);

            setProlonging(false);
            if (error) {
              showToast("Erreur lors de la prolongation.");
            } else {
              showToast("Espace prolongé de 30 jours ✓");
            }
          },
        },
      ],
    );
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  function handleLogout() {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/");
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: C.muted }]}>← Compte</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>⚙️ Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {hasSpace && space ? (
          <>
            {/* ── Section : Patient ────────────────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Patient</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={styles.patientRow}>
                <PatientAvatar photoUrl={displayPhotoUrl} firstname={space.patient_firstname} lastname={space.patient_lastname} size={56} C={C} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.patientName, { color: "#fff" }]}>{space.patient_firstname} {space.patient_lastname}</Text>
                  <Text style={[styles.patientHospital, { color: C.muted }]}>{space.hospital_name}{space.hospital_room ? ` · ${space.hospital_room}` : ""}</Text>
                </View>
              </View>
              <Text style={[styles.cardDesc, { color: C.muted, marginBottom: 0 }]}>
                Le nom et prénom du patient ne peuvent pas être modifiés directement. En cas d'erreur ou de changement, contactez le service client.
              </Text>
              <TouchableOpacity
                style={[styles.saveNotesBtn, { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: C.border }]}
                onPress={handleOpenNameChange}
              >
                <Text style={[styles.saveNotesBtnText, { color: C.muted }]}>✏️ Demander un changement de nom</Text>
              </TouchableOpacity>
            </View>

            {/* ── Section : Photo patient ───────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Photo du patient</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Affichée en avatar dans l'app pour tous les visiteurs. Ronde, centrée sur le visage.
              </Text>

              <View style={styles.photoRow}>
                <PatientAvatar
                  photoUrl={displayPhotoUrl}
                  firstname={space.patient_firstname}
                  lastname={space.patient_lastname}
                  size={72}
                  C={C}
                />
                <View style={{ flex: 1, gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: C.accent }]}
                    onPress={handlePhotoUpload}
                    disabled={photoUploading}
                  >
                    {photoUploading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.photoBtnText}>
                          {displayPhotoUrl ? "Changer la photo" : "Ajouter une photo"}
                        </Text>
                    }
                  </TouchableOpacity>
                  {displayPhotoUrl && (
                    <TouchableOpacity
                      style={[styles.photoBtn, { borderWidth: 1, borderColor: "rgba(233,69,96,0.4)", backgroundColor: "rgba(233,69,96,0.08)" }]}
                      onPress={handleRemovePhoto}
                    >
                      <Text style={[styles.photoBtnText, { color: "#e94560" }]}>Supprimer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* ── Section : Coordonnées de l'hôpital ──────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Coordonnées de l'hôpital</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>Nom, adresse et lien Google Maps affichés dans l'app.</Text>

              <Text style={[styles.fieldLabel, { color: C.gold }]}>🏥 Nom de l'hôpital</Text>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : CHU de Grenoble"
                placeholderTextColor={C.muted}
                value={hospitalName}
                onChangeText={setHospitalName}
              />

              <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

              <Text style={[styles.fieldLabel, { color: C.gold }]}>📍 Adresse</Text>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : Avenue de Maquis du Grésivaudan, Grenoble"
                placeholderTextColor={C.muted}
                value={hospitalAddress}
                onChangeText={setHospitalAddress}
              />

              <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

              <Text style={[styles.fieldLabel, { color: C.gold }]}>🗺️ Lien Google Maps (optionnel)</Text>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="https://maps.google.com/..."
                placeholderTextColor={C.muted}
                value={mapsUrl}
                onChangeText={setMapsUrl}
                autoCapitalize="none"
                keyboardType="url"
              />

              <TouchableOpacity
                style={[styles.saveNotesBtn, { backgroundColor: C.accent, marginTop: 8 }, hospitalCoordsSaving && { opacity: 0.6 }]}
                onPress={handleSaveHospitalCoords}
                disabled={hospitalCoordsSaving}
              >
                {hospitalCoordsSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveNotesBtnText}>Enregistrer les coordonnées</Text>
                }
              </TouchableOpacity>
            </View>

            {/* ── Section : Thème ───────────────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Thème de couleur</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Appliqué en temps réel pour tous les visiteurs.
              </Text>
              {themeUpdating && (
                <ActivityIndicator color={C.accent} style={{ marginBottom: 12 }} />
              )}
              <View style={styles.themeGrid}>
                {THEME_ORDER.map((key) => {
                  const isActive = space.theme === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.themeOption,
                        {
                          backgroundColor: C.bg,
                          borderColor: isActive ? THEME_SWATCHES[key] : C.border,
                          borderWidth: isActive ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleThemeChange(key)}
                      disabled={themeUpdating}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.themeSwatch, { backgroundColor: THEME_SWATCHES[key] }]} />
                      <Text style={[styles.themeLabel, { color: isActive ? "#fff" : C.muted }]}>
                        {themeLabels[key]}
                      </Text>
                      {isActive && (
                        <Text style={[styles.themeCheck, { color: THEME_SWATCHES[key] }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {/* ── Section : Infos hospitalières ─────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Infos hospitalières</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Affichées dans le bandeau de l'app. Chaque modification est datée et conservée.
              </Text>

              {/* Chambre */}
              <Text style={[styles.fieldLabel, { color: C.gold }]}>🛏️ Chambre</Text>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : 205 B"
                placeholderTextColor={C.muted}
                value={room}
                onChangeText={setRoom}
              />

              <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

              {/* Service médical */}
              <Text style={[styles.fieldLabel, { color: C.gold }]}>🏥 Service médical</Text>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : NEUROLOGIE"
                placeholderTextColor={C.muted}
                value={service}
                onChangeText={setService}
                autoCapitalize="characters"
              />

              <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

              {/* Secteur */}
              <Text style={[styles.fieldLabel, { color: C.gold }]}>📍 Secteur</Text>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : Secteur A"
                placeholderTextColor={C.muted}
                value={sector}
                onChangeText={setSector}
              />

              <TouchableOpacity
                style={[styles.saveNotesBtn, { backgroundColor: C.accent, marginTop: 8 }, hospitalInfosSaving && { opacity: 0.6 }]}
                onPress={handleSaveHospitalInfos}
                disabled={hospitalInfosSaving}
              >
                {hospitalInfosSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveNotesBtnText}>Enregistrer les infos hospitalières</Text>
                }
              </TouchableOpacity>

              {/* Historique */}
              <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />
              <Text style={[styles.fieldLabel, { color: C.gold }]}>🕐 Historique des changements</Text>
              {historyLoading ? (
                <ActivityIndicator color={C.accent} style={{ marginVertical: 8 }} />
              ) : fieldHistory.length === 0 ? (
                <Text style={[styles.historyEmpty, { color: C.muted }]}>Aucun changement enregistré.</Text>
              ) : (
                fieldHistory.map((h) => (
                  <View key={h.id} style={[styles.historyRow, { borderLeftColor: C.accent }]}>
                    <Text style={[styles.historyField, { color: "#fff" }]}>
                      {FIELD_ICONS[h.field_name] ?? "✏️"} {FIELD_LABELS[h.field_name] ?? h.field_name}
                      {h.new_value ? ` → "${h.new_value}"` : " → (vide)"}
                    </Text>
                    {h.old_value != null && (
                      <Text style={[styles.historyOld, { color: C.muted }]}>était : {h.old_value || "(vide)"}</Text>
                    )}
                    <Text style={[styles.historyDate, { color: C.muted }]}>
                      {new Date(h.changed_at).toLocaleString("fr-FR", {
                        day: "numeric", month: "long", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* ── Section : Consignes de visite / Infos ─────────────────────── */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Consignes de visite / Infos</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.cardDesc, { color: C.muted }]}>
                Affiché dans le bloc "Informations" de l'onglet Infos, sous les consignes automatiques.
              </Text>
              <Text style={[styles.warningText, { color: C.orange }]}>
                ⚠️ N'indiquez pas d'informations médicales sensibles.
              </Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                placeholder="Ex : La chambre se trouve au 3ème étage, aile B…"
                placeholderTextColor={C.muted}
                value={visitRules}
                onChangeText={setVisitRules}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.saveNotesBtn, { backgroundColor: C.accent }, notesSaving && { opacity: 0.6 }]}
                onPress={handleSaveNotes}
                disabled={notesSaving}
              >
                {notesSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveNotesBtnText}>Enregistrer les consignes</Text>
                }
              </TouchableOpacity>
            </View>

            {/* ── Section : Règles de visite ──────────────────────────────────── */}
            {slotConfig && (
              <>
                <Text style={[styles.sectionTitle, { color: C.gold }]}>Règles de visite</Text>
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>

                  {/* Horaires */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>⏰ Horaires des visites</Text>
                  <View style={styles.hourRow}>
                    <View style={styles.hourBlock}>
                      <Text style={[styles.hourLabel, { color: C.muted }]}>Début</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setVisitStartHour((h) => Math.max(6, h - 1))}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.stepValue, { color: "#fff" }]}>{String(visitStartHour).padStart(2,"0")}:00</Text>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setVisitStartHour((h) => Math.min(visitEndHour - 1, h + 1))}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.hourSep, { color: C.muted }]}>→</Text>
                    <View style={styles.hourBlock}>
                      <Text style={[styles.hourLabel, { color: C.muted }]}>Fin</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setVisitEndHour((h) => Math.max(visitStartHour + 1, h - 1))}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.stepValue, { color: "#fff" }]}>{String(visitEndHour).padStart(2,"0")}:00</Text>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setVisitEndHour((h) => Math.min(23, h + 1))}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Durée d'une visite */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>⏱ Durée d'une visite</Text>
                  <View style={styles.pillRow}>
                    {[20, 30, 45, 60, 90, 120].map((min) => (
                      <TouchableOpacity
                        key={min}
                        onPress={() => setSlotDuration(min)}
                        style={[styles.pill, { borderColor: slotDuration === min ? C.accent : C.border, backgroundColor: slotDuration === min ? C.accent : "transparent" }]}
                      >
                        <Text style={[styles.pillText, { color: slotDuration === min ? "#fff" : C.muted }]}>
                          {min < 60 ? `${min} min` : `${min / 60}h${min % 60 ? (min % 60) : ""}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Fréquence des créneaux */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>🔄 Un créneau toutes les</Text>
                  <View style={styles.pillRow}>
                    {([{ label: "Dos à dos", val: 0 }, { label: "30 min", val: 30 }, { label: "1h", val: 60 }, { label: "1h30", val: 90 }, { label: "2h", val: 120 }] as { label: string; val: number }[]).map(({ label, val }) => {
                      const active = !gapIsCustom && slotGap === val;
                      return (
                        <TouchableOpacity
                          key={val}
                          onPress={() => { setSlotGap(val); setGapIsCustom(false); }}
                          style={[styles.pill, { borderColor: active ? C.accent : C.border, backgroundColor: active ? C.accent : "transparent" }]}
                        >
                          <Text style={[styles.pillText, { color: active ? "#fff" : C.muted }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      onPress={() => {
                        setGapIsCustom(true);
                        setGapCustomHours(Math.floor(slotGap / 60));
                        setGapCustomMinutes(slotGap % 60);
                      }}
                      style={[styles.pill, { borderColor: gapIsCustom ? C.accent : C.border, backgroundColor: gapIsCustom ? C.accent : "transparent" }]}
                    >
                      <Text style={[styles.pillText, { color: gapIsCustom ? "#fff" : C.muted }]}>Personnalisée</Text>
                    </TouchableOpacity>
                  </View>
                  {gapIsCustom && (
                    <View style={styles.hourRow}>
                      <View style={styles.hourBlock}>
                        <Text style={[styles.hourLabel, { color: C.muted }]}>Heures</Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                            onPress={() => { const h = Math.max(0, gapCustomHours - 1); setGapCustomHours(h); setSlotGap(h * 60 + gapCustomMinutes); }}
                          >
                            <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                          </TouchableOpacity>
                          <Text style={[styles.stepValue, { color: "#fff" }]}>{gapCustomHours}h</Text>
                          <TouchableOpacity
                            style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                            onPress={() => { const h = Math.min(8, gapCustomHours + 1); setGapCustomHours(h); setSlotGap(h * 60 + gapCustomMinutes); }}
                          >
                            <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.hourSep, { color: C.muted }]}>+</Text>
                      <View style={styles.hourBlock}>
                        <Text style={[styles.hourLabel, { color: C.muted }]}>Minutes</Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                            onPress={() => { const m = Math.max(0, gapCustomMinutes - 15); setGapCustomMinutes(m); setSlotGap(gapCustomHours * 60 + m); }}
                          >
                            <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                          </TouchableOpacity>
                          <Text style={[styles.stepValue, { color: "#fff" }]}>{String(gapCustomMinutes).padStart(2, "0")} min</Text>
                          <TouchableOpacity
                            style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                            onPress={() => { const m = Math.min(45, gapCustomMinutes + 15); setGapCustomMinutes(m); setSlotGap(gapCustomHours * 60 + m); }}
                          >
                            <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Visiteurs max */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>👥 Visiteurs max par créneau</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={() => setMaxVisitors((v) => Math.max(1, v - 1))}
                    >
                      <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepValue, { color: "#fff", minWidth: 32, textAlign: "center" }]}>{maxVisitors}</Text>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={() => setMaxVisitors((v) => Math.min(10, v + 1))}
                    >
                      <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Jours de visite autorisés */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>📅 Jours de visite autorisés</Text>
                  <Text style={[styles.cardDesc, { color: C.muted, marginBottom: 10, marginTop: -4 }]}>
                    Désactivez les jours sans visites possibles.
                  </Text>
                  <View style={styles.weekdayRow}>
                    {[
                      { label: "Lun", js: 1 }, { label: "Mar", js: 2 }, { label: "Mer", js: 3 },
                      { label: "Jeu", js: 4 }, { label: "Ven", js: 5 }, { label: "Sam", js: 6 }, { label: "Dim", js: 0 },
                    ].map(({ label, js }) => {
                      const active = allowedWeekdays.includes(js);
                      return (
                        <TouchableOpacity
                          key={js}
                          onPress={() => toggleWeekday(js)}
                          style={[
                            styles.weekdayBtn,
                            { borderColor: active ? C.accent : C.border, backgroundColor: active ? C.accent : "transparent" },
                          ]}
                        >
                          <Text style={[styles.weekdayBtnText, { color: active ? "#fff" : C.muted }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Dates spécifiquement bloquées */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>🚫 Dates sans visites</Text>
                  <Text style={[styles.cardDesc, { color: C.muted, marginBottom: 10, marginTop: -4 }]}>
                    Bloquez ponctuellement une date (jour férié, indisponibilité…).
                  </Text>
                  {blockedDates.length > 0 && (
                    <View style={styles.blockedChipRow}>
                      {blockedDates.sort().map((iso) => (
                        <TouchableOpacity
                          key={iso}
                          onPress={() => toggleBlockedDate(iso)}
                          style={[styles.blockedChip, { backgroundColor: "rgba(233,69,96,0.12)", borderColor: "rgba(233,69,96,0.4)" }]}
                        >
                          <Text style={[styles.blockedChipText, { color: "#e94560" }]}>
                            {new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ✕
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => { setBlockPickerDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setBlockPickerVisible(true); }}
                    style={[styles.saveNotesBtn, { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: C.border, marginTop: 4 }]}
                  >
                    <Text style={[styles.saveNotesBtnText, { color: C.muted }]}>+ Ajouter une date bloquée</Text>
                  </TouchableOpacity>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Résumé des créneaux générés */}
                  <Text style={[styles.cardDesc, { color: C.muted, marginBottom: 0 }]}>
                    {`Créneaux générés : ${(() => {
                      const step = slotGap > 0 ? slotGap : slotDuration;
                      return Array.from({ length: Math.max(0, Math.floor((visitEndHour * 60 - visitStartHour * 60) / step)) }).map((_, i) => {
                        const m = visitStartHour * 60 + i * step;
                        return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                      }).join(" · ") || "Aucun — vérifiez les horaires.";
                    })()}`}
                  </Text>

                  <TouchableOpacity
                    style={[styles.saveNotesBtn, { backgroundColor: C.accent, marginTop: 8 }, slotRulesSaving && { opacity: 0.6 }]}
                    onPress={handleSaveSlotRules}
                    disabled={slotRulesSaving}
                  >
                    {slotRulesSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveNotesBtnText}>Enregistrer les règles de visite</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Section : Nuitées ─────────────────────────────────────────── */}
            {slotConfig && (
              <>
                <Text style={[styles.sectionTitle, { color: C.gold }]}>Nuitées</Text>
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={styles.nightRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.nightLabel, { color: "#fff" }]}>
                        {slotConfig.night_enabled ? "Nuitées activées" : "Nuitées suspendues"}
                      </Text>
                      <Text style={[styles.nightDesc, { color: C.muted }]}>
                        {slotConfig.night_enabled
                          ? "Les visiteurs peuvent réserver une nuit (18h → 11h)."
                          : "Le bloc nuit est masqué pour les visiteurs."}
                      </Text>
                    </View>
                    {nightToggling
                      ? <ActivityIndicator color={C.accent} />
                      : <Switch
                          value={slotConfig.night_enabled}
                          onValueChange={handleToggleNight}
                          trackColor={{ false: C.border, true: C.accent }}
                          thumbColor="#fff"
                        />
                    }
                  </View>
                </View>
              </>
            )}
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.cardDesc, { color: C.muted }]}>
              Aucun espace patient actif.{"\n"}Rendez-vous sur avectoi.care pour créer votre espace.
            </Text>
          </View>
        )}

        {/* ── Section : Conservation RGPD ──────────────────────────────────── */}
        {hasSpace && space && (() => {
          const purgeDate = new Date(space.purge_scheduled_at);
          const todayMs = new Date().setHours(0, 0, 0, 0);
          const daysLeft = Math.ceil((purgeDate.getTime() - todayMs) / (1000 * 60 * 60 * 24));
          const purgeDateFr = purgeDate.toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric",
          });
          const isUrgent = daysLeft <= 7;
          const isWarning = daysLeft <= 30;
          const alertColor = isUrgent ? "#e94560" : isWarning ? C.orange : C.muted;

          return (
            <>
              <Text style={[styles.sectionTitle, { color: C.gold }]}>Conservation des données</Text>
              <View style={[styles.card, {
                backgroundColor: C.card,
                borderColor: isUrgent ? "rgba(233,69,96,0.5)" : isWarning ? "rgba(230,126,34,0.4)" : C.border,
              }]}>
                <View style={styles.rgpdRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rgpdLabel, { color: C.muted }]}>Suppression prévue le</Text>
                    <Text style={[styles.rgpdDate, { color: isUrgent ? "#e94560" : "#fff" }]}>
                      {purgeDateFr}
                    </Text>
                    <Text style={[styles.rgpdDays, { color: alertColor }]}>
                      {daysLeft > 0
                        ? `J-${daysLeft}${isUrgent ? " ⚠️  Suppression imminente" : isWarning ? " — Pensez à prolonger" : ""}`
                        : "Expiration dépassée"
                      }
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardDesc, { marginTop: 12, marginBottom: 14 }]}>
                  Planning, souvenirs et messages seront définitivement supprimés à cette date. Conforme RGPD.
                </Text>

                <TouchableOpacity
                  style={[styles.prolongBtn, { backgroundColor: C.accent }, prolonging && { opacity: 0.6 }]}
                  onPress={handleProlong}
                  disabled={prolonging}
                >
                  {prolonging
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.prolongBtnText}>⏳ Prolonger de 30 jours (renouvelable gratuitement)</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          );
        })()}

        {/* ── Section : Compte ─────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: C.gold }]}>Compte</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: "rgba(233,69,96,0.4)" }]}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Text style={[styles.logoutText, { color: "#e94560" }]}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── MODAL CALENDRIER DATES BLOQUÉES ─────────────────────────────── */}
      <Modal visible={blockPickerVisible} transparent animationType="slide" onRequestClose={() => setBlockPickerVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setBlockPickerVisible(false)}>
            <TouchableOpacity activeOpacity={1}>
              <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
                {/* Navigation mois */}
                <View style={styles.calNavRow}>
                  <TouchableOpacity
                    onPress={() => setBlockPickerDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                    style={styles.calNavBtn}
                  >
                    <Text style={[styles.calNavText, { color: C.muted }]}>‹</Text>
                  </TouchableOpacity>
                  <Text style={[styles.calMonthTitle, { color: "#fff" }]}>
                    {blockPickerDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setBlockPickerDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                    style={styles.calNavBtn}
                  >
                    <Text style={[styles.calNavText, { color: C.muted }]}>›</Text>
                  </TouchableOpacity>
                </View>

                {/* En-tête jours */}
                <View style={styles.calHeaderRow}>
                  {["L","M","M","J","V","S","D"].map((d, i) => (
                    <Text key={i} style={[styles.calHeaderCell, { color: C.muted }]}>{d}</Text>
                  ))}
                </View>

                {/* Grille jours */}
                {(() => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const year = blockPickerDate.getFullYear();
                  const month = blockPickerDate.getMonth();
                  const firstDay = new Date(year, month, 1);
                  // Padding (JS Sunday=0 → French Mon=0, shift: (jsDay + 6) % 7)
                  const firstWeekdayFr = (firstDay.getDay() + 6) % 7;
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells: (number | null)[] = [
                    ...Array(firstWeekdayFr).fill(null),
                    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                  ];
                  // Pad to full rows
                  while (cells.length % 7 !== 0) cells.push(null);

                  const rows: (number | null)[][] = [];
                  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

                  return rows.map((row, ri) => (
                    <View key={ri} style={styles.calRow}>
                      {row.map((day, ci) => {
                        if (!day) return <View key={ci} style={styles.calCell} />;
                        const d = new Date(year, month, day);
                        d.setHours(0,0,0,0);
                        const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                        const isPast = d < today;
                        const isBlocked = blockedDates.includes(iso);
                        return (
                          <TouchableOpacity
                            key={ci}
                            style={[
                              styles.calCell,
                              isBlocked && { backgroundColor: "rgba(233,69,96,0.18)", borderRadius: 20 },
                            ]}
                            onPress={() => { if (!isPast) { toggleBlockedDate(iso); } }}
                            disabled={isPast}
                            activeOpacity={isPast ? 1 : 0.7}
                          >
                            <Text style={[
                              styles.calDayText,
                              { color: isPast ? C.border : isBlocked ? "#e94560" : C.text },
                            ]}>
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ));
                })()}

                <TouchableOpacity
                  onPress={() => setBlockPickerVisible(false)}
                  style={[styles.saveNotesBtn, { backgroundColor: C.accent, marginTop: 16 }]}
                >
                  <Text style={styles.saveNotesBtnText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL CHANGEMENT DE NOM ──────────────────────────────────────── */}
      <Modal visible={nameChangeModal} transparent animationType="slide" onRequestClose={() => setNameChangeModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setNameChangeModal(false)}>
            <TouchableOpacity activeOpacity={1}>
              <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                <Text style={[styles.sheetTitle, { color: "#fff" }]}>✏️ Demande de changement de nom</Text>
                <Text style={[styles.sheetSub, { color: C.muted }]}>
                  Nom actuel : {space?.patient_firstname} {space?.patient_lastname}
                </Text>
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Nouveau prénom"
                  placeholderTextColor={C.muted}
                  value={nameChangeFirstname}
                  onChangeText={setNameChangeFirstname}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Nouveau nom"
                  placeholderTextColor={C.muted}
                  value={nameChangeLastname}
                  onChangeText={setNameChangeLastname}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.sheetInput, styles.sheetTextarea, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Raison du changement (obligatoire)"
                  placeholderTextColor={C.muted}
                  value={nameChangeReason}
                  onChangeText={setNameChangeReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.sheetBtns}>
                  <TouchableOpacity onPress={() => setNameChangeModal(false)} style={[styles.btnSecondary, { borderColor: C.border }]}>
                    <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSendNameChange}
                    disabled={!nameChangeFirstname.trim() || !nameChangeLastname.trim() || !nameChangeReason.trim()}
                    style={[
                      styles.btnPrimary,
                      { backgroundColor: C.accent },
                      (!nameChangeFirstname.trim() || !nameChangeLastname.trim() || !nameChangeReason.trim()) && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={styles.btnPrimaryText}>Envoyer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { marginBottom: 8 },
  backBtnText: { fontFamily: "DM_Sans_400Regular", fontSize: 14 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },

  scroll: { padding: 16, paddingBottom: 48 },
  sectionTitle: {
    fontFamily: "DM_Sans_600SemiBold", fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 10, marginTop: 20,
  },
  card: {
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 4,
  },
  cardDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 20, marginBottom: 14 },

  // Patient row
  patientRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  patientName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16 },
  patientHospital: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginTop: 2 },

  // Photo
  photoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  photoBtn: {
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: "center", justifyContent: "center",
  },
  photoBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },

  // Theme grid
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  themeOption: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    minWidth: "46%",
  },
  themeSwatch: { width: 18, height: 18, borderRadius: 9 },
  themeLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, flex: 1 },
  themeCheck: { fontFamily: "DM_Sans_700Bold", fontSize: 14 },

  // RGPD
  rgpdRow: { flexDirection: "row", alignItems: "flex-start" },
  rgpdLabel: { fontFamily: "DM_Sans_400Regular", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  rgpdDate: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 17 },
  rgpdDays: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, marginTop: 4 },
  prolongBtn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  prolongBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },

  // Infos hospitalières
  fieldLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
  fieldDivider: { height: 1, marginVertical: 16 },
  sectorInput: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontFamily: "DM_Sans_400Regular", fontSize: 14,
    marginBottom: 12,
  },
  historyEmpty: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginBottom: 4, fontStyle: "italic" },
  historyRow: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 12 },
  historyField: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, marginBottom: 2 },
  historyOld: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginBottom: 2, fontStyle: "italic" },
  historyDate: { fontFamily: "DM_Sans_400Regular", fontSize: 11 },

  // Admin notes
  warningText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, marginBottom: 10 },
  notesInput: {
    borderWidth: 1, borderRadius: 10, padding: 12,
    fontFamily: "DM_Sans_400Regular", fontSize: 14,
    minHeight: 100, marginBottom: 12,
  },
  saveNotesBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  saveNotesBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },

  // Nuitées
  nightRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nightLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, marginBottom: 4 },
  nightDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 18 },

  // Logout
  logoutBtn: {
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 14, alignItems: "center",
  },
  logoutText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15 },

  toast: {
    position: "absolute", bottom: 24, alignSelf: "center",
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
  },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },

  // Règles de visite
  hourRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  hourBlock: { flex: 1, gap: 6 },
  hourLabel: { fontFamily: "DM_Sans_400Regular", fontSize: 12, textAlign: "center" },
  hourSep: { fontFamily: "DM_Sans_700Bold", fontSize: 18, marginTop: 20 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 36, height: 36, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 18, lineHeight: 20 },
  stepValue: { fontFamily: "DM_Sans_700Bold", fontSize: 16, minWidth: 48, textAlign: "center" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  pill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  pillText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  weekdayRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  weekdayBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  weekdayBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 12 },
  blockedChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  blockedChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  blockedChipText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },

  // Calendrier date picker
  calNavRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  calNavBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  calNavText: { fontFamily: "DM_Sans_700Bold", fontSize: 22 },
  calMonthTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16 },
  calHeaderRow: { flexDirection: "row", marginBottom: 6 },
  calHeaderCell: { flex: 1, textAlign: "center", fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  calRow: { flexDirection: "row", marginBottom: 4 },
  calCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDayText: { fontFamily: "DM_Sans_400Regular", fontSize: 14 },

  // Modal changement de nom
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, marginBottom: 4 },
  sheetSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginBottom: 16 },
  sheetInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10 },
  sheetTextarea: { height: 80, textAlignVertical: "top" },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
});
