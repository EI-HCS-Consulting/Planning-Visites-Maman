import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, Modal, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import type { Task, SupportMessage } from "@/lib/types";
import type { Theme } from "@/lib/themes";

// ─── Constantes ───────────────────────────────────────────────────────────────
type Section = "entraide" | "soutien";
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  spaceId: string;
  C: Theme;
  isAdmin: boolean;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function EntraideSoutien({ spaceId, C, isAdmin }: Props) {
  const [section, setSection] = useState<Section>("entraide");

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Support messages
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(true);

  // Task form (create / edit)
  const [taskForm, setTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCat, setFCat] = useState<TaskCategory>("autre");
  const [taskSaving, setTaskSaving] = useState(false);

  // Claim modal
  const [claimTarget, setClaimTarget] = useState<Task | null>(null);
  const [claimPrenom, setClaimPrenom] = useState("");
  const [claimNom, setClaimNom] = useState("");
  const [claimPin, setClaimPin] = useState("");
  const [claimSaving, setClaimSaving] = useState(false);

  // Unclaim / done PIN modal
  const [pinModal, setPinModal] = useState<{ task: Task; action: "unclaim" | "done" } | null>(null);
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState(false);

  // Support message form
  const [msgText, setMsgText] = useState("");
  const [msgPrenom, setMsgPrenom] = useState("");
  const [msgNom, setMsgNom] = useState("");
  const [msgSaving, setMsgSaving] = useState(false);

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Load tasks ─────────────────────────────────────────────────────────────
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

  // ── Load messages ──────────────────────────────────────────────────────────
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

  useEffect(() => {
    loadTasks();
    loadMessages();
  }, [loadTasks, loadMessages]);

  // Realtime
  useEffect(() => {
    const ch1 = supabase
      .channel(`tasks:${spaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `space_id=eq.${spaceId}` }, loadTasks)
      .subscribe();
    const ch2 = supabase
      .channel(`support:${spaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `space_id=eq.${spaceId}` }, loadMessages)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [spaceId, loadTasks, loadMessages]);

  // ── Task form helpers ──────────────────────────────────────────────────────
  function openCreateTask() {
    setEditTask(null);
    setFTitle(""); setFDesc(""); setFCat("autre");
    setTaskForm(true);
  }

  function openEditTask(t: Task) {
    setEditTask(t);
    setFTitle(t.title); setFDesc(t.description); setFCat(t.category);
    setTaskForm(true);
  }

  async function saveTask() {
    if (!fTitle.trim()) return;
    setTaskSaving(true);
    if (editTask) {
      await supabase.from("tasks").update({ title: fTitle.trim(), description: fDesc.trim(), category: fCat }).eq("id", editTask.id);
      showToast("Besoin modifié ✓");
    } else {
      await supabase.from("tasks").insert({
        space_id: spaceId,
        title: fTitle.trim(),
        description: fDesc.trim(),
        category: fCat,
        status: "ouvert",
        created_by: isAdmin ? "admin" : "visiteur",
      });
      showToast("Besoin créé ✓");
    }
    setTaskSaving(false);
    setTaskForm(false);
    loadTasks();
  }

  async function deleteTask(t: Task) {
    Alert.alert("Supprimer ce besoin ?", t.title, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          await supabase.from("tasks").delete().eq("id", t.id);
          showToast("Besoin supprimé");
          loadTasks();
        },
      },
    ]);
  }

  async function adminSetStatus(t: Task, status: TaskStatus) {
    await supabase.from("tasks").update({ status }).eq("id", t.id);
    loadTasks();
  }

  // ── Claim ──────────────────────────────────────────────────────────────────
  function openClaim(t: Task) {
    setClaimTarget(t);
    setClaimPrenom(""); setClaimNom(""); setClaimPin("");
  }

  async function handleClaim() {
    if (!claimTarget || !claimPrenom.trim() || !claimNom.trim() || claimPin.length < 4) return;
    setClaimSaving(true);
    await supabase.from("tasks").update({
      status: "pris_en_charge",
      claimed_by_prenom: claimPrenom.trim(),
      claimed_by_nom: claimNom.trim(),
      claimed_by_pin: claimPin,
    }).eq("id", claimTarget.id);
    setClaimSaving(false);
    setClaimTarget(null);
    showToast("Merci ! Tu t'en occupes 💛");
    loadTasks();
  }

  // ── Pin modal (unclaim / done) ─────────────────────────────────────────────
  function openPinModal(task: Task, action: "unclaim" | "done") {
    setPinModal({ task, action });
    setPinEntry(""); setPinError(false);
  }

  async function checkPin() {
    if (!pinModal) return;
    if (pinEntry === pinModal.task.claimed_by_pin) {
      const { task, action } = pinModal;
      setPinModal(null);
      if (action === "done") {
        await supabase.from("tasks").update({ status: "fait" }).eq("id", task.id);
        showToast("Marqué comme fait ✓");
      } else {
        await supabase.from("tasks").update({
          status: "ouvert",
          claimed_by_prenom: null,
          claimed_by_nom: null,
          claimed_by_pin: null,
        }).eq("id", task.id);
        showToast("Tu t'es désinscrit ✓");
      }
      loadTasks();
    } else {
      setPinError(true);
      setPinEntry("");
    }
  }

  // ── Support message ────────────────────────────────────────────────────────
  async function postMessage() {
    if (!msgText.trim() || !msgPrenom.trim() || !msgNom.trim()) return;
    setMsgSaving(true);
    await supabase.from("support_messages").insert({
      space_id: spaceId,
      message: msgText.trim(),
      author_prenom: msgPrenom.trim(),
      author_nom: msgNom.trim(),
    });
    setMsgSaving(false);
    setMsgText(""); setMsgPrenom(""); setMsgNom("");
    showToast("Message posté ✓");
    loadMessages();
  }

  async function deleteMessage(m: SupportMessage) {
    Alert.alert("Supprimer ce message ?", `"${m.message.slice(0, 60)}…"`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          await supabase.from("support_messages").delete().eq("id", m.id);
          loadMessages();
          showToast("Message supprimé");
        },
      },
    ]);
  }

  // ── Task card render ───────────────────────────────────────────────────────
  function renderTask(t: Task) {
    const statusColors = STATUS_COLORS(C);
    return (
      <View key={t.id} style={[styles.taskCard, { backgroundColor: C.card, borderColor: t.status === "fait" ? "rgba(122,143,166,0.2)" : C.border }]}>
        {/* Header */}
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
              <TouchableOpacity onPress={() => deleteTask(t)} style={[styles.iconBtn, { borderColor: "rgba(233,69,96,0.3)" }]}>
                <Text style={{ fontSize: 13, color: "#e94560" }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={[styles.taskTitle, { color: t.status === "fait" ? C.muted : "#fff" }]}>{t.title}</Text>
        {t.description ? (
          <Text style={[styles.taskDesc, { color: C.muted }]}>{t.description}</Text>
        ) : null}

        {/* Claimer info */}
        {t.status !== "ouvert" && t.claimed_by_prenom && (
          <View style={[styles.claimerRow, { borderColor: C.border, backgroundColor: `${C.accent}11` }]}>
            <Text style={[styles.claimerText, { color: C.text }]}>
              👤 {t.claimed_by_prenom} {t.claimed_by_nom} s'en occupe
            </Text>
          </View>
        )}

        {/* Actions */}
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
              onPress={() => openPinModal(t, "done")}
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
            onPress={() => adminSetStatus(t, "fait")}
          >
            <Text style={[styles.actionSmallText, { color: C.success }]}>✓ Marquer fait</Text>
          </TouchableOpacity>
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Text style={[styles.headerTitle, { color: "#fff" }]}>🤝 Entraide & Soutien</Text>
      </View>

      {/* Section tabs */}
      <View style={[styles.tabs, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity
          style={[styles.tab, section === "entraide" && { borderBottomColor: C.accent, borderBottomWidth: 2 }]}
          onPress={() => setSection("entraide")}
        >
          <Text style={[styles.tabText, { color: section === "entraide" ? C.accent : C.muted }]}>Besoins</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, section === "soutien" && { borderBottomColor: C.accent, borderBottomWidth: 2 }]}
          onPress={() => setSection("soutien")}
        >
          <Text style={[styles.tabText, { color: section === "soutien" ? C.accent : C.muted }]}>Mur de soutien 💛</Text>
        </TouchableOpacity>
      </View>

      {/* ── SECTION ENTRAIDE ──────────────────────────────────────────────── */}
      {section === "entraide" && (
        <>
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
          ) : tasks.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🤝</Text>
              <Text style={[styles.emptyText, { color: C.muted }]}>Aucun besoin pour l'instant.</Text>
              <Text style={[styles.emptyHint, { color: C.muted }]}>Crée un besoin si tu as besoin d'aide.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listPad}>
              {tasks.map(renderTask)}
            </ScrollView>
          )}
        </>
      )}

      {/* ── SECTION MUR DE SOUTIEN ────────────────────────────────────────── */}
      {section === "soutien" && (
        <ScrollView contentContainerStyle={styles.listPad} keyboardShouldPersistTaps="handled">
          {/* Formulaire post */}
          <View style={[styles.msgForm, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.msgFormTitle, { color: C.gold }]}>💛 Laisser un message de soutien</Text>
            <TextInput
              style={[styles.input, styles.msgArea, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
              placeholder="Un mot d'encouragement pour la famille et le patient…"
              placeholderTextColor={C.muted}
              value={msgText}
              onChangeText={setMsgText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
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
            <TouchableOpacity
              style={[
                styles.postBtn,
                { backgroundColor: C.gold },
                (!msgText.trim() || !msgPrenom.trim() || !msgNom.trim() || msgSaving) && { opacity: 0.5 },
              ]}
              onPress={postMessage}
              disabled={!msgText.trim() || !msgPrenom.trim() || !msgNom.trim() || msgSaving}
            >
              {msgSaving
                ? <ActivityIndicator color="#0D1B2E" size="small" />
                : <Text style={styles.postBtnText}>Envoyer 💛</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Messages */}
          {msgsLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 24 }} />
          ) : messages.length === 0 ? (
            <View style={[styles.centered, { marginTop: 32 }]}>
              <Text style={{ fontSize: 32, marginBottom: 10 }}>💛</Text>
              <Text style={[styles.emptyText, { color: C.muted }]}>Aucun message de soutien.</Text>
              <Text style={[styles.emptyHint, { color: C.muted }]}>Sois le premier à en laisser un !</Text>
            </View>
          ) : (
            messages.map((m) => (
              <View key={m.id} style={[styles.msgCard, { backgroundColor: C.card, borderColor: C.border }]}>
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
                  {isAdmin && (
                    <TouchableOpacity onPress={() => deleteMessage(m)} style={[styles.iconBtn, { borderColor: "rgba(233,69,96,0.3)" }]}>
                      <Text style={{ fontSize: 13, color: "#e94560" }}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[styles.msgText, { color: C.text }]}>{m.message}</Text>
              </View>
            ))
          )}
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

                  {/* Category picker */}
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

      {/* ── MODAL PIN (désinscrire / marquer fait) ────────────────────────── */}
      <Modal visible={!!pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent }]}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🔐</Text>
              <Text style={[styles.sheetTitle, { color: "#fff" }]}>Confirmer avec ton PIN</Text>
              <Text style={[styles.sheetSub, { color: C.muted }]}>
                {pinModal?.action === "done"
                  ? "Saisis ton PIN pour marquer ce besoin comme fait."
                  : "Saisis ton PIN pour te désinscrire de ce besoin."}
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
                  { backgroundColor: pinModal?.action === "done" ? C.success : C.accent },
                  pinEntry.length < 4 && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {pinModal?.action === "done" ? "✓ Fait !" : "Me désinscrire"}
                </Text>
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
  emptyText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 15, textAlign: "center", marginBottom: 6 },
  emptyHint: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textAlign: "center" },

  header: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },

  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },

  sectionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  sectionCount: { fontFamily: "DM_Sans_400Regular", fontSize: 12 },
  createBtn: { borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  createBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#fff" },

  listPad: { padding: 14, paddingBottom: 40 },

  // Task card
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
  claimerRow: { borderWidth: 1, borderRadius: 8, padding: 8, marginVertical: 8 },
  claimerText: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
  claimBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 8 },
  claimBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 13, color: "#fff" },
  actionSmall: { borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  actionSmallText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },

  // Support message
  msgForm: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  msgFormTitle: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
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

  // Form
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10 },
  descArea: { height: 80, textAlignVertical: "top" },
  fieldLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  catOption: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, minWidth: "45%" },
  catOptionIcon: { fontSize: 16 },
  catOptionLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },

  // PIN context
  pinContext: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  pinContextText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  pinContextSub: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 4 },
  pinErrorText: { fontFamily: "DM_Sans_400Regular", fontSize: 12, textAlign: "center", marginTop: 8 },

  // Overlay / sheet
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
