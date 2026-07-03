import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { getVisitorSession, rememberAuthorPin, sessionPinMatches } from "@/lib/visitorSession";
import PinPad from "@/components/PinPad";
import type { Task } from "@/lib/types";
import type { Theme } from "@/lib/themes";

const PHOTO_BUCKET = "entraide-photos";

function taskPhotoUrl(spaceId: string, filename: string) {
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${spaceId}/${filename}`);
  return data.publicUrl;
}

// Section "Besoins" extraite de l'ancien EntraideSoutien.tsx (qui combinait
// Besoins + Mur de soutien sous un toggle interne) — voir components/Soutien.tsx
// pour l'autre moitié. Même logique, juste sans le toggle de section.

type TaskStatus = Task["status"];
type TaskCategory = Task["category"];

const CATEGORY_ICONS: Record<TaskCategory, string> = {
  repas: "🍽️",
  affaires: "👕",
  courses: "🛒",
  autre: "💡",
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  repas: "Repas",
  affaires: "Affaires",
  courses: "Courses",
  autre: "Autre",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  ouvert: "Ouvert",
  pris_en_charge: "Pris en charge",
  fait: "Fait ✓",
};

const STATUS_COLORS = (C: Theme): Record<TaskStatus, string> => ({
  ouvert: C.success,
  pris_en_charge: C.orange,
  fait: C.muted,
});

interface Props {
  spaceId: string;
  C: Theme;
  isAdmin: boolean;
}

export default function Entraide({ spaceId, C, isAdmin }: Props) {
  const { focusTaskId } = useLocalSearchParams<{ focusTaskId?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const taskOffsets = useRef<Record<string, number>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const focusedRef = useRef(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  // null = pas de filtre, affiche tous les besoins (existant). Cliquer à
  // nouveau sur l'onglet actif désélectionne.
  const [activeCat, setActiveCat] = useState<TaskCategory | null>(null);

  const [taskForm, setTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCat, setFCat] = useState<TaskCategory>("autre");
  const [fPhotoUri, setFPhotoUri] = useState<string | null>(null);
  const [fExistingPhoto, setFExistingPhoto] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);

  const [claimTarget, setClaimTarget] = useState<Task | null>(null);
  const [claimPrenom, setClaimPrenom] = useState("");
  const [claimNom, setClaimNom] = useState("");
  const [claimPin, setClaimPin] = useState("");
  const [claimPhotoUri, setClaimPhotoUri] = useState<string | null>(null);
  const [claimPickingPhoto, setClaimPickingPhoto] = useState(false);
  const [claimText, setClaimText] = useState("");
  const [claimSaving, setClaimSaving] = useState(false);

  const [pinModal, setPinModal] = useState<{ task: Task; action: "unclaim" } | null>(null);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState(false);

  const [doneTarget, setDoneTarget] = useState<Task | null>(null);
  const [donePhotoUri, setDonePhotoUri] = useState<string | null>(null);
  const [donePickingPhoto, setDonePickingPhoto] = useState(false);
  const [donePin, setDonePin] = useState("");
  const [donePinError, setDonePinError] = useState(false);
  const [donePinVerified, setDonePinVerified] = useState(false);
  const [doneSaving, setDoneSaving] = useState(false);

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false });
    setTasks(data || []);
    setTasksLoading(false);
  }, [spaceId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Arrivée depuis "Mon compte" via un lien profond (?focusTaskId=...) :
  // on retire un éventuel filtre de catégorie qui cacherait le besoin, on
  // scrolle jusqu'à sa carte et on la surligne brièvement. focusedRef évite
  // de re-déclencher le scroll à chaque rechargement realtime de tasks.
  useEffect(() => {
    if (!focusTaskId || focusedRef.current || tasksLoading) return;
    const target = tasks.find((t) => t.id === focusTaskId);
    if (!target) return;
    focusedRef.current = true;
    if (activeCat && activeCat !== target.category) setActiveCat(null);
    setHighlightId(focusTaskId);
    setTimeout(() => {
      const y = taskOffsets.current[focusTaskId];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
    }, 300);
    setTimeout(() => setHighlightId(null), 2500);
  }, [focusTaskId, tasks, tasksLoading, activeCat]);

  useEffect(() => {
    const ch = supabase
      .channel(`tasks:${spaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `space_id=eq.${spaceId}` }, loadTasks)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [spaceId, loadTasks]);

  function openCreateTask() {
    setEditTask(null);
    setFTitle(""); setFDesc(""); setFCat("autre");
    setFPhotoUri(null); setFExistingPhoto(null);
    setTaskForm(true);
  }

  function openEditTask(t: Task) {
    setEditTask(t);
    setFTitle(t.title); setFDesc(t.description); setFCat(t.category);
    setFPhotoUri(null); setFExistingPhoto(t.photo);
    setTaskForm(true);
  }

  async function pickTaskPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    setPickingPhoto(true);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    setPickingPhoto(false);
    if (!result.canceled && result.assets[0]) {
      setFPhotoUri(result.assets[0].uri);
      setFExistingPhoto(null);
    }
  }

  function removeTaskPhoto() {
    setFPhotoUri(null);
    setFExistingPhoto(null);
  }

  async function saveTask() {
    if (!fTitle.trim()) return;
    setTaskSaving(true);

    let photoFilename = fExistingPhoto;
    if (fPhotoUri) {
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          fPhotoUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const fileData = await new File(compressed.uri).arrayBuffer();
        const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(`${spaceId}/${fname}`, fileData, { contentType: "image/jpeg", cacheControl: "3600" });
        if (!error) photoFilename = fname;
        else Alert.alert("Photo non envoyée", "Le besoin sera enregistré sans la photo.");
      } catch {
        Alert.alert("Photo non envoyée", "Le besoin sera enregistré sans la photo.");
      }
    }

    if (editTask) {
      const removedFilename = editTask.photo && editTask.photo !== photoFilename ? editTask.photo : null;
      await supabase.from("tasks").update({
        title: fTitle.trim(), description: fDesc.trim(), category: fCat, photo: photoFilename,
      }).eq("id", editTask.id);
      if (removedFilename) {
        await supabase.storage.from(PHOTO_BUCKET).remove([`${spaceId}/${removedFilename}`]);
      }
      showToast("Besoin modifié ✓");
    } else {
      await supabase.from("tasks").insert({
        space_id: spaceId,
        title: fTitle.trim(),
        description: fDesc.trim(),
        category: fCat,
        status: "ouvert",
        created_by: isAdmin ? "admin" : "visiteur",
        photo: photoFilename,
      });
      showToast("Besoin créé ✓");
    }
    setTaskSaving(false);
    setTaskForm(false);
    loadTasks();
  }

  async function deleteTask(t: Task) {
    if (t.status === "fait") return;
    Alert.alert("Supprimer ce besoin ?", t.title, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          const toRemove = [t.photo, t.claimed_photo].filter((f): f is string => !!f);
          if (toRemove.length) await supabase.storage.from(PHOTO_BUCKET).remove(toRemove.map((f) => `${spaceId}/${f}`));
          await supabase.from("tasks").delete().eq("id", t.id);
          showToast("Besoin supprimé");
          loadTasks();
        },
      },
    ]);
  }

  async function adminSetStatus(t: Task, status: TaskStatus) {
    if (status === "ouvert" && t.done_photo) {
      await supabase.storage.from(PHOTO_BUCKET).remove([`${spaceId}/${t.done_photo}`]);
    }
    await supabase.from("tasks").update({
      status,
      ...(status === "ouvert" ? { done_photo: null } : {}),
    }).eq("id", t.id);
    loadTasks();
  }

  // Marquer un besoin "Fait", avec une photo optionnelle (ex: preuve du
  // repas livré). Accessible à l'admin directement, et au preneur via PIN.
  async function openDone(task: Task) {
    setDoneTarget(task);
    setDonePhotoUri(null);
    setDonePin("");
    setDonePinError(false);
    setDonePinVerified(!isAdmin && await sessionPinMatches(task.claimed_by_pin));
  }

  async function pickDonePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    setDonePickingPhoto(true);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    setDonePickingPhoto(false);
    if (!result.canceled && result.assets[0]) {
      setDonePhotoUri(result.assets[0].uri);
    }
  }

  function removeDonePhoto() {
    setDonePhotoUri(null);
  }

  async function confirmDone() {
    if (!doneTarget) return;
    if (!isAdmin && !donePinVerified && donePin !== doneTarget.claimed_by_pin) {
      setDonePinError(true);
      setDonePin("");
      return;
    }
    setDoneSaving(true);

    let doneFilename: string | null = null;
    if (donePhotoUri) {
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          donePhotoUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const fileData = await new File(compressed.uri).arrayBuffer();
        const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(`${spaceId}/${fname}`, fileData, { contentType: "image/jpeg", cacheControl: "3600" });
        if (!error) doneFilename = fname;
        else Alert.alert("DEBUG upload error", JSON.stringify(error));
      } catch (e: any) {
        Alert.alert("DEBUG catch error", String(e?.message || e));
      }
    }

    const { error: updateError } = await supabase.from("tasks").update({ status: "fait", done_photo: doneFilename }).eq("id", doneTarget.id);
    if (updateError) Alert.alert("DEBUG update error", JSON.stringify(updateError));
    setDoneSaving(false);
    setDoneTarget(null);
    showToast("Marqué comme fait ✓");
    loadTasks();
  }

  async function openClaim(t: Task) {
    setClaimTarget(t);
    setClaimPrenom(""); setClaimNom(""); setClaimPin(""); setClaimPhotoUri(null); setClaimText("");
    // Pré-remplit prénom/nom depuis la session visiteur (Mon compte) — reste
    // modifiable. Le PIN n'est jamais pré-rempli.
    if (!isAdmin) {
      const s = await getVisitorSession();
      if (s) { setClaimPrenom(s.prenom); setClaimNom(s.nom); }
    }
  }

  async function pickClaimPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les paramètres.");
      return;
    }
    setClaimPickingPhoto(true);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    setClaimPickingPhoto(false);
    if (!result.canceled && result.assets[0]) {
      setClaimPhotoUri(result.assets[0].uri);
    }
  }

  function removeClaimPhoto() {
    setClaimPhotoUri(null);
  }

  async function handleClaim() {
    if (!claimTarget || !claimPrenom.trim() || !claimNom.trim() || claimPin.length < 4) return;
    setClaimSaving(true);

    let claimedPhotoFilename: string | null = null;
    if (claimPhotoUri) {
      try {
        const compressed = await ImageManipulator.manipulateAsync(
          claimPhotoUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const fileData = await new File(compressed.uri).arrayBuffer();
        const fname = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(`${spaceId}/${fname}`, fileData, { contentType: "image/jpeg", cacheControl: "3600" });
        if (!error) claimedPhotoFilename = fname;
        else Alert.alert("Photo non envoyée", "Tu peux quand même confirmer sans la photo.");
      } catch {
        Alert.alert("Photo non envoyée", "Tu peux quand même confirmer sans la photo.");
      }
    }

    await supabase.from("tasks").update({
      status: "pris_en_charge",
      claimed_by_prenom: claimPrenom.trim(),
      claimed_by_nom: claimNom.trim(),
      claimed_by_pin: claimPin,
      claimed_photo: claimedPhotoFilename,
      claimed_text: claimText.trim() || null,
    }).eq("id", claimTarget.id);
    setClaimSaving(false);
    setClaimTarget(null);
    if (!isAdmin) await rememberAuthorPin(claimPrenom.trim(), claimNom.trim(), claimPin);
    showToast("Merci ! Tu t'en occupes 💛");
    loadTasks();
  }

  async function performUnclaim(task: Task) {
    if (task.claimed_photo) {
      await supabase.storage.from(PHOTO_BUCKET).remove([`${spaceId}/${task.claimed_photo}`]);
    }
    await supabase.from("tasks").update({
      status: "ouvert",
      claimed_by_prenom: null,
      claimed_by_nom: null,
      claimed_by_pin: null,
      claimed_photo: null,
      claimed_text: null,
    }).eq("id", task.id);
    showToast("Tu t'es désinscrit ✓");
    loadTasks();
  }

  async function openPinModal(task: Task, action: "unclaim") {
    if (!isAdmin && (await sessionPinMatches(task.claimed_by_pin))) {
      Alert.alert(
        "Te désinscrire de cette tâche ?",
        task.title,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Me désinscrire", style: "destructive", onPress: () => performUnclaim(task) },
        ],
      );
      return;
    }
    setPinModal({ task, action });
    setPinEntry(""); setPinError(false);
  }

  async function checkPin() {
    if (!pinModal) return;
    if (pinEntry === pinModal.task.claimed_by_pin) {
      const { task } = pinModal;
      setPinModal(null);
      await performUnclaim(task);
    } else {
      setPinError(true);
      setPinEntry("");
    }
  }

  function renderTask(t: Task) {
    const statusColors = STATUS_COLORS(C);
    const highlighted = highlightId === t.id;
    return (
      <View
        key={t.id}
        onLayout={(e) => { taskOffsets.current[t.id] = e.nativeEvent.layout.y; }}
        style={[
          styles.taskCard,
          { backgroundColor: C.card, borderColor: highlighted ? C.gold : (t.status === "fait" ? "rgba(122,143,166,0.2)" : C.border) },
          highlighted && { borderWidth: 2 },
        ]}
      >
        <View style={styles.taskHeader}>
          <View style={[styles.catBadge, { backgroundColor: `${C.accent}22` }]}>
            <Text style={styles.catIcon}>{CATEGORY_ICONS[t.category]}</Text>
            <Text style={[styles.catLabel, { color: C.accent }]}>{CATEGORY_LABELS[t.category]}</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColors[t.status] }]}>
            <Text style={[styles.statusLabel, { color: statusColors[t.status] }]}>{STATUS_LABELS[t.status]}</Text>
          </View>
          {isAdmin && (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <TouchableOpacity onPress={() => openEditTask(t)} style={[styles.iconBtn, { borderColor: C.border }]}>
                <Text style={{ fontSize: 13 }}>✏️</Text>
              </TouchableOpacity>
              {t.status !== "fait" && (
                <TouchableOpacity onPress={() => deleteTask(t)} style={[styles.iconBtn, { borderColor: "rgba(233,69,96,0.3)" }]}>
                  <Text style={{ fontSize: 13, color: "#e94560" }}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <Text style={[styles.taskTitle, { color: t.status === "fait" ? C.muted : "#fff" }]}>{t.title}</Text>
        {t.description ? (
          <Text style={[styles.taskDesc, { color: C.muted }]}>{t.description}</Text>
        ) : null}
        {t.photo && (
          <Image source={{ uri: taskPhotoUrl(spaceId, t.photo) }} style={styles.taskPhoto} resizeMode="cover" />
        )}

        {t.status !== "ouvert" && t.claimed_by_prenom && (
          <View style={[styles.claimerRow, { borderColor: C.border, backgroundColor: `${C.accent}11` }]}>
            <Text style={[styles.claimerText, { color: C.text }]}>
              👤 {t.claimed_by_prenom} {t.claimed_by_nom} s'en occupe
            </Text>
            {t.claimed_photo && (
              <Image source={{ uri: taskPhotoUrl(spaceId, t.claimed_photo) }} style={styles.claimedPhoto} resizeMode="cover" />
            )}
            {t.claimed_text && (
              <Text style={[styles.claimerText, { color: C.muted, marginTop: 4 }]}>{t.claimed_text}</Text>
            )}
          </View>
        )}

        {t.status === "ouvert" && (
          <TouchableOpacity
            style={[styles.claimBtn, { backgroundColor: C.accent }]}
            onPress={() => openClaim(t)}
            activeOpacity={0.85}
          >
            <Text style={styles.claimBtnText}>🙋 Je m'en occupe</Text>
          </TouchableOpacity>
        )}

        {t.status === "pris_en_charge" && !isAdmin && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.actionSmall, { borderColor: C.success, backgroundColor: `${C.success}18` }]}
              onPress={() => openDone(t)}
            >
              <Text style={[styles.actionSmallText, { color: C.success }]}>✓ C'est fait</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionSmall, { borderColor: C.border }]}
              onPress={() => openPinModal(t, "unclaim")}
            >
              <Text style={[styles.actionSmallText, { color: C.muted }]}>Se désinscrire</Text>
            </TouchableOpacity>
          </View>
        )}

        {t.status === "pris_en_charge" && isAdmin && (
          <TouchableOpacity
            style={[styles.actionSmall, { borderColor: C.success, backgroundColor: `${C.success}18`, marginTop: 10, alignSelf: "flex-start" }]}
            onPress={() => openDone(t)}
          >
            <Text style={[styles.actionSmallText, { color: C.success }]}>✓ Marquer fait</Text>
          </TouchableOpacity>
        )}

        {t.status === "fait" && t.done_photo && (
          <Image source={{ uri: taskPhotoUrl(spaceId, t.done_photo) }} style={styles.claimedPhoto} resizeMode="cover" />
        )}

        {t.status === "fait" && isAdmin && (
          <TouchableOpacity
            style={[styles.actionSmall, { borderColor: C.border, marginTop: 10, alignSelf: "flex-start" }]}
            onPress={() => adminSetStatus(t, "ouvert")}
          >
            <Text style={[styles.actionSmallText, { color: C.muted }]}>↩ Réouvrir</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const visibleTasks = activeCat ? tasks.filter((t) => t.category === activeCat) : tasks;

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>🤝 Entraide</Text>
      </View>

      <View style={[styles.catTabsBar, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity
          style={[
            styles.catTab,
            { backgroundColor: activeCat === null ? C.accent : "transparent", borderColor: activeCat === null ? C.accent : C.border },
          ]}
          onPress={() => setActiveCat(null)}
          activeOpacity={0.75}
        >
          <Text style={styles.catTabIcon}>📋</Text>
          <Text style={[styles.catTabLabel, { color: activeCat === null ? "#fff" : C.text }]}>Tous</Text>
        </TouchableOpacity>
        {(Object.keys(CATEGORY_ICONS) as TaskCategory[]).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catTab,
              { backgroundColor: activeCat === cat ? C.accent : "transparent", borderColor: activeCat === cat ? C.accent : C.border },
            ]}
            onPress={() => setActiveCat((prev) => (prev === cat ? null : cat))}
            activeOpacity={0.75}
          >
            <Text style={styles.catTabIcon}>{CATEGORY_ICONS[cat]}</Text>
            <Text style={[styles.catTabLabel, { color: activeCat === cat ? "#fff" : C.text }]}>{CATEGORY_LABELS[cat]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.sectionBar, { borderBottomColor: C.border }]}>
        <Text style={[styles.sectionCount, { color: C.muted }]}>
          {tasks.filter((t) => t.status !== "fait").length} besoin{tasks.filter((t) => t.status !== "fait").length !== 1 ? "s" : ""} ouvert{tasks.filter((t) => t.status !== "fait").length !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: C.accent }]}
          onPress={openCreateTask}
        >
          <Text style={styles.createBtnText}>+ Besoin</Text>
        </TouchableOpacity>
      </View>

      {tasksLoading ? (
        <View style={styles.centered}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : visibleTasks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🤝</Text>
          <Text style={[styles.emptyText, { color: C.muted }]}>
            {activeCat ? `Aucun besoin dans ${CATEGORY_LABELS[activeCat]} pour l'instant.` : "Aucun besoin pour l'instant."}
          </Text>
          <Text style={[styles.emptyHint, { color: C.muted }]}>Crée un besoin si tu as besoin d'aide.</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.listPad}>
          {visibleTasks.map(renderTask)}
        </ScrollView>
      )}

      {/* ── MODAL CRÉER / ÉDITER BESOIN ───────────────────────────────────── */}
      <Modal visible={taskForm} transparent animationType="slide" onRequestClose={() => setTaskForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !taskSaving && setTaskForm(false)}>
            <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                  <Text style={[styles.sheetTitle, { color: "#fff" }]}>
                    {editTask ? "✏️ Modifier le besoin" : "➕ Nouveau besoin"}
                  </Text>

                  <TextInput
                    style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Titre du besoin *"
                    placeholderTextColor={C.muted}
                    value={fTitle}
                    onChangeText={setFTitle}
                    autoFocus
                  />
                  <TextInput
                    style={[styles.input, styles.descArea, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Description (optionnelle)"
                    placeholderTextColor={C.muted}
                    value={fDesc}
                    onChangeText={setFDesc}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>Catégorie</Text>
                  <View style={styles.catGrid}>
                    {(Object.keys(CATEGORY_ICONS) as TaskCategory[]).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.catOption,
                          {
                            backgroundColor: fCat === cat ? C.accent : C.bg,
                            borderColor: fCat === cat ? C.accent : C.border,
                          },
                        ]}
                        onPress={() => setFCat(cat)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.catOptionIcon}>{CATEGORY_ICONS[cat]}</Text>
                        <Text style={[styles.catOptionLabel, { color: fCat === cat ? "#fff" : C.text }]}>
                          {CATEGORY_LABELS[cat]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>Photo (optionnelle)</Text>
                  {(fPhotoUri || fExistingPhoto) ? (
                    <View style={styles.photoPreviewRow}>
                      <Image
                        source={{ uri: fPhotoUri ?? taskPhotoUrl(spaceId, fExistingPhoto!) }}
                        style={styles.photoPreviewImg}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={[styles.photoPickRemove, { backgroundColor: "#e94560" }]}
                        onPress={removeTaskPhoto}
                      >
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.photoPickAdd, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={pickTaskPhoto}
                      disabled={pickingPhoto}
                    >
                      {pickingPhoto
                        ? <ActivityIndicator color={C.accent} size="small" />
                        : <Text style={[styles.photoPickAddText, { color: C.muted }]}>📷 Ajouter une photo</Text>
                      }
                    </TouchableOpacity>
                  )}

                  <View style={styles.sheetBtns}>
                    <TouchableOpacity
                      onPress={() => setTaskForm(false)}
                      disabled={taskSaving}
                      style={[styles.btnSecondary, { borderColor: C.border }]}
                    >
                      <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveTask}
                      disabled={!fTitle.trim() || taskSaving}
                      style={[
                        styles.btnPrimary,
                        { backgroundColor: C.accent },
                        (!fTitle.trim() || taskSaving) && { opacity: 0.5 },
                      ]}
                    >
                      {taskSaving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.btnPrimaryText}>{editTask ? "Enregistrer" : "Créer"}</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL CLAIM ───────────────────────────────────────────────────── */}
      <Modal visible={!!claimTarget} transparent animationType="slide" onRequestClose={() => setClaimTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !claimSaving && setClaimTarget(null)}>
            <ScrollView contentContainerStyle={styles.overlayScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={1}>
                <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                  <View style={{ alignItems: "center", marginBottom: 14 }}>
                    <Text style={{ fontSize: 32, marginBottom: 6 }}>🙋</Text>
                    <Text style={[styles.sheetTitle, { color: "#fff" }]}>Je m'en occupe</Text>
                    {claimTarget && (
                      <Text style={[styles.sheetSub, { color: C.muted }]}>
                        {CATEGORY_ICONS[claimTarget.category]} {claimTarget.title}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Prénom *"
                      placeholderTextColor={C.muted}
                      value={claimPrenom}
                      onChangeText={setClaimPrenom}
                      autoCapitalize="words"
                      autoFocus
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                      placeholder="Nom *"
                      placeholderTextColor={C.muted}
                      value={claimNom}
                      onChangeText={setClaimNom}
                      autoCapitalize="words"
                    />
                  </View>

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>Photo (optionnelle)</Text>
                  {claimPhotoUri ? (
                    <View style={styles.photoPreviewRow}>
                      <Image source={{ uri: claimPhotoUri }} style={styles.photoPreviewImg} resizeMode="cover" />
                      <TouchableOpacity
                        style={[styles.photoPickRemove, { backgroundColor: "#e94560" }]}
                        onPress={removeClaimPhoto}
                      >
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.photoPickAdd, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={pickClaimPhoto}
                      disabled={claimPickingPhoto}
                    >
                      {claimPickingPhoto
                        ? <ActivityIndicator color={C.accent} size="small" />
                        : <Text style={[styles.photoPickAddText, { color: C.muted }]}>📷 Ajouter une photo (ex : le plat préparé)</Text>
                      }
                    </TouchableOpacity>
                  )}

                  <TextInput
                    style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text, marginTop: 8 }]}
                    placeholder="Un petit mot sous la photo (optionnel)"
                    placeholderTextColor={C.muted}
                    value={claimText}
                    onChangeText={setClaimText}
                    multiline
                  />

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>
                    🔐 Code PIN (pour se désinscrire si besoin)
                  </Text>
                  <PinPad value={claimPin} onChange={setClaimPin} theme={C} />

                  <View style={styles.sheetBtns}>
                    <TouchableOpacity
                      onPress={() => setClaimTarget(null)}
                      disabled={claimSaving}
                      style={[styles.btnSecondary, { borderColor: C.border }]}
                    >
                      <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleClaim}
                      disabled={!claimPrenom.trim() || !claimNom.trim() || claimPin.length < 4 || claimSaving}
                      style={[
                        styles.btnPrimary,
                        { backgroundColor: C.accent },
                        (!claimPrenom.trim() || !claimNom.trim() || claimPin.length < 4 || claimSaving) && { opacity: 0.5 },
                      ]}
                    >
                      {claimSaving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.btnPrimaryText}>Confirmer</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL PIN (désinscrire) ────────────────────────── */}
      <Modal visible={!!pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🔐</Text>
              <Text style={[styles.sheetTitle, { color: "#fff" }]}>Confirmer avec ton PIN</Text>
              <Text style={[styles.sheetSub, { color: C.muted }]}>
                Saisis ton PIN pour te désinscrire de ce besoin.
              </Text>
            </View>

            {pinModal && (
              <View style={[styles.pinContext, { backgroundColor: C.bg, borderColor: C.border }]}>
                <Text style={[styles.pinContextText, { color: C.text }]}>
                  {CATEGORY_ICONS[pinModal.task.category]} {pinModal.task.title}
                </Text>
                <Text style={[styles.pinContextSub, { color: C.muted }]}>
                  Pris en charge par {pinModal.task.claimed_by_prenom} {pinModal.task.claimed_by_nom}
                </Text>
              </View>
            )}

            <PinPad value={pinEntry} onChange={setPinEntry} theme={C} hasError={pinError} />

            {pinError && (
              <Text style={[styles.pinErrorText, { color: "#e94560" }]}>PIN incorrect.</Text>
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
                  { backgroundColor: C.accent },
                  pinEntry.length < 4 && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>Me désinscrire</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL "Fait" (photo optionnelle + PIN si visiteur) ─────────────── */}
      <Modal visible={!!doneTarget} transparent animationType="fade" onRequestClose={() => setDoneTarget(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.success }]}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>✓</Text>
              <Text style={[styles.sheetTitle, { color: "#fff" }]}>Marquer comme fait</Text>
              <Text style={[styles.sheetSub, { color: C.muted }]}>
                Tu peux ajouter une photo (optionnel).
              </Text>
            </View>

            {donePhotoUri ? (
              <View style={styles.photoPreviewRow}>
                <Image source={{ uri: donePhotoUri }} style={styles.photoPreviewImg} resizeMode="cover" />
                <TouchableOpacity onPress={removeDonePhoto} style={[styles.photoPickRemove, { backgroundColor: "#e94560" }]}>
                  <Text style={{ color: "#fff", fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickDonePhoto}
                disabled={donePickingPhoto}
                style={[styles.photoPickAdd, { backgroundColor: C.bg, borderColor: C.border }]}
              >
                {donePickingPhoto
                  ? <ActivityIndicator color={C.accent} size="small" />
                  : <Text style={[styles.photoPickAddText, { color: C.muted }]}>📷 Ajouter une photo</Text>
                }
              </TouchableOpacity>
            )}

            {!isAdmin && !donePinVerified && (
              <>
                <Text style={[styles.sheetSub, { color: C.muted, marginTop: 16 }]}>
                  Saisis ton PIN pour confirmer.
                </Text>
                <PinPad value={donePin} onChange={setDonePin} theme={C} hasError={donePinError} />
                {donePinError && (
                  <Text style={[styles.pinErrorText, { color: "#e94560" }]}>PIN incorrect.</Text>
                )}
              </>
            )}

            <View style={[styles.sheetBtns, { marginTop: 16 }]}>
              <TouchableOpacity
                onPress={() => setDoneTarget(null)}
                disabled={doneSaving}
                style={[styles.btnSecondary, { borderColor: C.border }]}
              >
                <Text style={[styles.btnSecondaryText, { color: C.muted }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDone}
                disabled={doneSaving || (!isAdmin && !donePinVerified && donePin.length < 4)}
                style={[
                  styles.btnPrimary,
                  { backgroundColor: C.success },
                  (doneSaving || (!isAdmin && !donePinVerified && donePin.length < 4)) && { opacity: 0.5 },
                ]}
              >
                {doneSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>✓ Fait !</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, textAlign: "center", marginBottom: 6 },
  emptyHint: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textAlign: "center" },

  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },

  catTabsBar: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 10, gap: 8, borderBottomWidth: 1 },
  catTab: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  catTabIcon: { fontSize: 14 },
  catTabLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11 },

  sectionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  sectionCount: { fontFamily: "DM_Sans_400Regular", fontSize: 12 },
  createBtn: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  createBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#fff" },

  listPad: { padding: 14, paddingBottom: 40 },

  taskCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  taskHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catIcon: { fontSize: 14 },
  catLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11 },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11 },
  iconBtn: { width: 30, height: 30, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontFamily: "DM_Sans_700Bold", fontSize: 15, marginBottom: 4 },
  taskDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 20, marginBottom: 6 },
  taskPhoto: { width: "100%", height: 140, borderRadius: 10, marginBottom: 6 },
  claimerRow: { borderWidth: 1, borderRadius: 8, padding: 8, marginVertical: 8 },
  claimerText: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
  claimedPhoto: { width: "100%", height: 120, borderRadius: 8, marginTop: 8 },
  claimBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8 },
  claimBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#fff" },
  actionSmall: { borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  actionSmallText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },

  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10 },
  descArea: { height: 80, textAlignVertical: "top" },
  fieldLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  catOption: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, minWidth: "45%" },
  catOptionIcon: { fontSize: 16 },
  catOptionLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },

  photoPreviewRow: { position: "relative", marginBottom: 4 },
  photoPreviewImg: { width: "100%", height: 140, borderRadius: 10 },
  photoPickRemove: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  photoPickAdd: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 4 },
  photoPickAddText: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },

  pinContext: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  pinContextText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  pinContextSub: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 4 },
  pinErrorText: { fontFamily: "DM_Sans_400Regular", fontSize: 12, textAlign: "center", marginTop: 8 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" },
  overlayScroll: { flexGrow: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, marginBottom: 4 },
  sheetSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginBottom: 4, textAlign: "center" },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },

  toast: { position: "absolute", bottom: 24, alignSelf: "center", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
