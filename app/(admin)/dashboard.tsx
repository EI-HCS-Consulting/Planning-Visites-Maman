import { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, Alert, TextInput, Share, Linking,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useRouter } from "expo-router";
import { useSpace } from "@/lib/SpaceContext";
import { supabase } from "@/lib/supabase";
import {
  getDayStatus, getSlotOccupancy, getNightReservation,
  findNextAvailableSlot, getDaysInMonth, toISO, toFrLong, toFrShort, addDays,
} from "@/lib/slotUtils";
import { themes } from "@/lib/themes";
import PatientAvatar from "@/components/PatientAvatar";
import type { Reservation, SlotConfig } from "@/lib/types";
import type { Theme } from "@/lib/themes";

type DashView = "calendar" | "day";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const WEB_BASE = "https://avectoi.care";

function inviteLink(token: string) {
  return `${WEB_BASE}/invite?token=${token}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { space, slotConfig, slots, reservations, loading, hasSpace, refreshReservations } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const startDate = useMemo(
    () => space ? new Date(space.start_date + "T00:00:00") : today,
    [space, today],
  );
  const initialDay = useMemo(() => (today >= startDate ? today : startDate), [today, startDate]);

  const [view, setView] = useState<DashView>("calendar");
  const [calMonth, setCalMonth] = useState({ year: initialDay.getFullYear(), month: initialDay.getMonth() });
  const [selectedDay, setSelectedDay] = useState<Date>(initialDay);

  // Prochaine dispo modal
  const [nextDispoModal, setNextDispoModal] = useState<{ date: Date; iso: string; slot: string } | null>(null);

  // Invite modal
  const [inviteModal, setInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Admin add reservation
  const [addSlot, setAddSlot] = useState<string | null>(null);
  const [addPrenom, setAddPrenom] = useState("");
  const [addNom, setAddNom] = useState("");
  const [addTel, setAddTel] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleDayPress(day: Date) {
    setSelectedDay(day);
    setView("day");
  }

  function handleNextDispo() {
    if (!slotConfig) return;
    const result = findNextAvailableSlot(reservations, slotConfig, slots, startDate);
    if (result) {
      setNextDispoModal(result);
    } else {
      Alert.alert("Aucune disponibilité", "Aucun créneau libre dans les 90 prochains jours.");
    }
  }

  // ── Invite ─────────────────────────────────────────────────────────────────
  async function handleCopyLink() {
    if (!space) return;
    const link = inviteLink(space.invite_token);
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShareLink() {
    if (!space) return;
    const link = inviteLink(space.invite_token);
    await Share.share({
      message: `Rejoins l'espace AvecToi pour ${space.patient_firstname} ${space.patient_lastname} :\n${link}`,
      url: link,
    });
  }

  async function handleWhatsApp() {
    if (!space) return;
    const link = inviteLink(space.invite_token);
    const msg = encodeURIComponent(
      `Voici le lien pour suivre les visites de ${space.patient_firstname} : ${link}`,
    );
    Linking.openURL(`whatsapp://send?text=${msg}`).catch(() =>
      Alert.alert("WhatsApp non disponible", "Installe WhatsApp pour partager via l'appli."),
    );
  }

  async function handleSMS() {
    if (!space) return;
    const link = inviteLink(space.invite_token);
    const msg = encodeURIComponent(`Rejoins l'espace AvecToi : ${link}`);
    Linking.openURL(`sms:?body=${msg}`);
  }

  // ── Admin add reservation ──────────────────────────────────────────────────
  function openAddResa(slot: string) {
    setAddSlot(slot);
    setAddPrenom(""); setAddNom(""); setAddTel("");
  }

  async function handleAddResa() {
    if (!space || !addSlot || !addPrenom.trim() || !addNom.trim()) return;
    setAddSaving(true);
    const { error } = await supabase.from("reservations").insert({
      space_id: space.id,
      date: toISO(selectedDay),
      creneau: addSlot,
      prenom: addPrenom.trim(),
      nom: addNom.trim(),
      telephone: addTel.trim(),
      type: "Visite",
      pin: "ADMIN",
    });
    setAddSaving(false);
    if (error) { showToast("Erreur lors de l'ajout."); return; }
    showToast("Réservation ajoutée ✓");
    setAddSlot(null);
    await refreshReservations();
  }

  async function handleDeleteResa(r: Reservation) {
    Alert.alert(
      "Supprimer cette réservation ?",
      `${r.prenom} ${r.nom} · ${r.creneau}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            await supabase.from("reservations").delete().eq("id", r.id);
            await refreshReservations();
            showToast("Réservation supprimée ✓");
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!hasSpace) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Text style={[styles.emptyTitle, { color: "#fff" }]}>Votre espace patient</Text>
        <Text style={[styles.emptyText, { color: C.muted }]}>
          Connectez-vous à votre espace pour gérer le planning des visites.{"\n\n"}
          Votre espace sera affiché ici une fois activé.
        </Text>
      </View>
    );
  }

  const monthDays = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDow = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(calMonth.year, calMonth.month, 1)
    .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const link = inviteLink(space!.invite_token);

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <PatientAvatar
          photoUrl={space!.patient_photo_url}
          firstname={space!.patient_firstname}
          lastname={space!.patient_lastname}
          size={44}
          C={C}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: "#fff" }]}>
            {space!.patient_firstname} {space!.patient_lastname}
          </Text>
          <Text style={[styles.headerSub, { color: C.gold }]}>
            {space!.hospital_room} · {space!.hospital_name.split("·")[0].trim()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.inviteBtn, { borderColor: C.accent }]}
          onPress={() => setInviteModal(true)}
        >
          <Text style={[styles.inviteBtnText, { color: C.accent }]}>🔗 Inviter</Text>
        </TouchableOpacity>
      </View>

      {view === "calendar" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Prochaine dispo */}
          <TouchableOpacity
            style={[styles.nextDispoBtn, { backgroundColor: C.accent }]}
            onPress={handleNextDispo}
            activeOpacity={0.85}
          >
            <Text style={styles.nextDispoText}>⚡ Prochaine disponibilité</Text>
          </TouchableOpacity>

          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setCalMonth((m) => {
                const d = new Date(m.year, m.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
              style={[styles.navBtn, { borderColor: C.border }]}
            >
              <Text style={[styles.navBtnText, { color: C.text }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.monthName, { color: "#fff" }]}>{monthName}</Text>
            <TouchableOpacity
              onPress={() => setCalMonth((m) => {
                const d = new Date(m.year, m.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
              style={[styles.navBtn, { borderColor: C.border }]}
            >
              <Text style={[styles.navBtnText, { color: C.text }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day labels */}
          <View style={styles.dayLabels}>
            {DAY_LABELS.map((d, i) => (
              <Text key={i} style={[styles.dayLabel, { color: C.muted }]}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {Array(firstDow).fill(null).map((_, i) => <View key={`e${i}`} style={styles.cell} />)}
            {monthDays.map((day) => {
              const iso = toISO(day);
              const status = getDayStatus(reservations, iso, day, slotConfig!, slots, startDate);
              const isToday = toISO(day) === toISO(today);
              const isSelected = toISO(day) === toISO(selectedDay);
              const isPast = status === "past";
              const dotColor =
                status === "full" ? C.danger :
                status === "partial" ? C.orange :
                status === "empty" ? C.success : "transparent";

              return (
                <TouchableOpacity
                  key={iso}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isSelected ? C.accent : isPast ? "transparent" : C.card,
                      borderColor: isSelected ? C.accent : isToday ? C.gold : C.border,
                      borderWidth: isToday ? 2 : 1,
                      opacity: isPast ? 0.3 : 1,
                    },
                  ]}
                  onPress={() => !isPast && handleDayPress(day)}
                  disabled={isPast}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cellDate, { color: isSelected ? "#fff" : isToday ? C.gold : C.text }]}>
                    {day.getDate()}
                  </Text>
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {([[C.success, "Dispo"], [C.orange, "Partiel"], [C.danger, "Complet"]] as [string, string][]).map(
              ([color, label]) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={[styles.legendLabel, { color: C.muted }]}>{label}</Text>
                </View>
              ),
            )}
          </View>
        </ScrollView>
      ) : (
        <DayView
          day={selectedDay}
          reservations={reservations}
          slots={slots}
          slotConfig={slotConfig!}
          spaceId={space!.id}
          C={C}
          onBack={() => setView("calendar")}
          onPrevDay={() => {
            const prev = addDays(selectedDay, -1);
            if (prev >= startDate) setSelectedDay(prev);
          }}
          onNextDay={() => setSelectedDay(addDays(selectedDay, 1))}
          startDate={startDate}
          onAddResa={openAddResa}
          onDeleteResa={handleDeleteResa}
          onNavigateNews={() => router.navigate("/(admin)/news")}
        />
      )}

      {/* ── MODAL PROCHAINE DISPO ─────────────────────────────────────────── */}
      <Modal transparent visible={!!nextDispoModal} animationType="fade" onRequestClose={() => setNextDispoModal(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setNextDispoModal(null)}>
          <View style={[styles.modal, { backgroundColor: C.card, borderColor: C.accent }]}>
            <Text style={styles.modalEmoji}>⚡</Text>
            <Text style={[styles.modalLabel, { color: C.gold }]}>Prochaine disponibilité</Text>
            <Text style={[styles.modalDate, { color: "#fff" }]}>
              {nextDispoModal && toFrLong(nextDispoModal.date)}
            </Text>
            <Text style={[styles.modalSlot, { color: C.gold }]}>{nextDispoModal?.slot}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtnSecondary, { borderColor: C.border }]}
                onPress={() => {
                  if (nextDispoModal) {
                    setSelectedDay(nextDispoModal.date);
                    setCalMonth({ year: nextDispoModal.date.getFullYear(), month: nextDispoModal.date.getMonth() });
                  }
                  setNextDispoModal(null);
                }}
              >
                <Text style={[styles.modalBtnSecondaryText, { color: C.muted }]}>Calendrier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: C.accent }]}
                onPress={() => {
                  if (nextDispoModal) {
                    setSelectedDay(nextDispoModal.date);
                    setView("day");
                  }
                  setNextDispoModal(null);
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>Voir le jour →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL INVITATION ─────────────────────────────────────────────── */}
      <Modal transparent visible={inviteModal} animationType="slide" onRequestClose={() => setInviteModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setInviteModal(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.inviteSheet, { backgroundColor: C.card, borderColor: C.accent }]}>
              <Text style={[styles.inviteTitle, { color: "#fff" }]}>🔗 Partager l'invitation</Text>

              {space?.premium ? (
                <>
                  <Text style={[styles.inviteSub, { color: C.muted }]}>
                    Envoie ce lien aux proches pour qu'ils rejoignent l'espace.
                  </Text>

                  {/* QR Code */}
                  <View style={[styles.qrContainer, { backgroundColor: "#fff", borderColor: C.border }]}>
                    <QRCode value={link} size={160} backgroundColor="#fff" color="#0D1B2E" />
                  </View>

                  {/* Link display */}
                  <View style={[styles.linkBox, { backgroundColor: C.bg, borderColor: C.border }]}>
                    <Text style={[styles.linkText, { color: C.muted }]} numberOfLines={1} ellipsizeMode="middle">
                      {link}
                    </Text>
                  </View>

                  {/* Action buttons */}
                  <TouchableOpacity
                    style={[styles.inviteActionBtn, { backgroundColor: C.accent }]}
                    onPress={handleCopyLink}
                  >
                    <Text style={styles.inviteActionBtnText}>
                      {copied ? "✓ Copié !" : "📋 Copier le lien"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.inviteRow}>
                    <TouchableOpacity
                      style={[styles.inviteSmallBtn, { backgroundColor: "#25D366" }]}
                      onPress={handleWhatsApp}
                    >
                      <Text style={styles.inviteSmallBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.inviteSmallBtn, { backgroundColor: C.border }]}
                      onPress={handleSMS}
                    >
                      <Text style={[styles.inviteSmallBtnText, { color: C.text }]}>💬 SMS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.inviteSmallBtn, { backgroundColor: C.border }]}
                      onPress={handleShareLink}
                    >
                      <Text style={[styles.inviteSmallBtnText, { color: C.text }]}>⬆️ Partager</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.lockedInvite}>
                  <Text style={styles.lockedEmoji}>🔒</Text>
                  <Text style={[styles.lockedText, { color: C.muted }]}>
                    Le partage sera disponible une fois votre espace validé. Consultez l'email envoyé à votre adresse.
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL AJOUT RÉSERVATION (admin) ──────────────────────────────── */}
      <Modal visible={!!addSlot} transparent animationType="slide" onRequestClose={() => setAddSlot(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !addSaving && setAddSlot(null)}>
            <TouchableOpacity activeOpacity={1}>
              <View style={[styles.inviteSheet, { backgroundColor: C.card, borderColor: C.accent }]}>
                <Text style={[styles.inviteTitle, { color: "#fff" }]}>
                  ➕ Ajouter une visite — {addSlot}
                </Text>
                <Text style={[styles.inviteSub, { color: C.muted }]}>
                  {toFrLong(selectedDay)}
                </Text>

                <TextInput
                  style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Prénom *"
                  placeholderTextColor={C.muted}
                  value={addPrenom}
                  onChangeText={setAddPrenom}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Nom *"
                  placeholderTextColor={C.muted}
                  value={addNom}
                  onChangeText={setAddNom}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                  placeholder="Téléphone (optionnel)"
                  placeholderTextColor={C.muted}
                  value={addTel}
                  onChangeText={setAddTel}
                  keyboardType="phone-pad"
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtnSecondary, { borderColor: C.border }]}
                    onPress={() => setAddSlot(null)}
                    disabled={addSaving}
                  >
                    <Text style={[styles.modalBtnSecondaryText, { color: C.muted }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalBtnPrimary,
                      { backgroundColor: C.accent },
                      (!addPrenom.trim() || !addNom.trim() || addSaving) && { opacity: 0.5 },
                    ]}
                    onPress={handleAddResa}
                    disabled={!addPrenom.trim() || !addNom.trim() || addSaving}
                  >
                    {addSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.modalBtnPrimaryText}>Ajouter</Text>
                    }
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

// ─── DayView component ────────────────────────────────────────────────────────
interface DayViewProps {
  day: Date;
  reservations: Reservation[];
  slots: string[];
  slotConfig: SlotConfig;
  spaceId: string;
  C: Theme;
  onBack: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  startDate: Date;
  onAddResa: (slot: string) => void;
  onDeleteResa: (r: Reservation) => void;
  onNavigateNews: () => void;
}

function DayView({
  day, reservations, slots, slotConfig, C,
  onBack, onPrevDay, onNextDay, startDate,
  onAddResa, onDeleteResa, onNavigateNews,
}: DayViewProps) {
  const iso = toISO(day);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Nav bar */}
      <View style={styles.dayViewTop}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: C.muted }]}>← Calendrier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.newsBtn, { borderColor: "rgba(240,180,41,0.4)", backgroundColor: "rgba(240,180,41,0.1)" }]}
          onPress={onNavigateNews}
        >
          <Text style={[styles.newsBtnText, { color: C.gold }]}>📰 Nouvelles</Text>
        </TouchableOpacity>
      </View>

      {/* Day nav */}
      <View style={[styles.dayNav, { backgroundColor: C.card, borderColor: C.border }]}>
        <TouchableOpacity
          onPress={onPrevDay}
          disabled={toISO(day) === toISO(startDate)}
          style={[styles.navBtn, { borderColor: C.border }]}
        >
          <Text style={[styles.navBtnText, { color: C.text }]}>‹</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.dayTitle, { color: "#fff" }]}>{toFrLong(day)}</Text>
          <Text style={[styles.daySub, { color: C.muted }]}>{toFrShort(day)}</Text>
        </View>
        <TouchableOpacity onPress={onNextDay} style={[styles.navBtn, { borderColor: C.border }]}>
          <Text style={[styles.navBtnText, { color: C.text }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Slots */}
      {slots.map((slot) => {
        const occ = getSlotOccupancy(reservations, iso, slot);
        const full = occ.length >= slotConfig.max_visitors_per_slot;

        return (
          <View
            key={slot}
            style={[styles.slotCard, { backgroundColor: C.card, borderColor: full ? "rgba(233,69,96,0.3)" : C.border }]}
          >
            <View style={styles.slotHeader}>
              <Text style={[styles.slotTime, { color: C.gold }]}>{slot}</Text>
              <Text style={[styles.slotCount, { color: C.muted }]}>
                {occ.length}/{slotConfig.max_visitors_per_slot}
              </Text>
              {!full && (
                <TouchableOpacity
                  style={[styles.addResaBtn, { backgroundColor: C.accent }]}
                  onPress={() => onAddResa(slot)}
                >
                  <Text style={styles.addResaBtnText}>+ Ajouter</Text>
                </TouchableOpacity>
              )}
              {full && (
                <Text style={[styles.fullTag, { color: C.danger }]}>Complet</Text>
              )}
            </View>

            {occ.length === 0
              ? <Text style={[styles.slotEmpty, { color: C.muted }]}>Aucun visiteur inscrit</Text>
              : occ.map((r) => (
                <View key={r.id} style={[styles.resaRow, { borderColor: C.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resaName, { color: C.success }]}>● {r.prenom} {r.nom}</Text>
                    {r.telephone ? (
                      <Text style={[styles.resaTel, { color: C.muted }]}>{r.telephone}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteResaBtn, { borderColor: "rgba(233,69,96,0.4)" }]}
                    onPress={() => onDeleteResa(r)}
                  >
                    <Text style={{ color: "#e94560", fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            }
          </View>
        );
      })}

      {/* Night slot */}
      {slotConfig.night_enabled && (() => {
        const night = getNightReservation(reservations, iso);
        return (
          <View
            style={[styles.slotCard, {
              backgroundColor: C.card,
              borderColor: night ? "rgba(233,69,96,0.3)" : "rgba(240,180,41,0.3)",
            }]}
          >
            <View style={styles.slotHeader}>
              <Text style={[styles.slotTime, { color: C.gold }]}>🌙 Nuit</Text>
              <Text style={[styles.slotCount, { color: C.muted }]}>18h → 11h</Text>
              {!night && (
                <TouchableOpacity
                  style={[styles.addResaBtn, { backgroundColor: C.gold }]}
                  onPress={() => onAddResa("🌙 Nuit")}
                >
                  <Text style={[styles.addResaBtnText, { color: "#0D1B2E" }]}>+ Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
            {night ? (
              <View style={[styles.resaRow, { borderColor: C.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resaName, { color: C.success }]}>● {night.prenom} {night.nom}</Text>
                  {night.telephone ? (
                    <Text style={[styles.resaTel, { color: C.muted }]}>{night.telephone}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[styles.deleteResaBtn, { borderColor: "rgba(233,69,96,0.4)" }]}
                  onPress={() => onDeleteResa(night)}
                >
                  <Text style={{ color: "#e94560", fontSize: 13 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.slotEmpty, { color: C.muted }]}>Aucun visiteur inscrit</Text>
            )}
          </View>
        );
      })()}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  scroll: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 17 },
  headerSub: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 2 },
  inviteBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  inviteBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  emptyTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, marginBottom: 16, textAlign: "center" },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Calendar
  nextDispoBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
  nextDispoText: { fontFamily: "DM_Sans_700Bold", fontSize: 15, color: "#fff" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  monthName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 17, textTransform: "capitalize" },
  navBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  navBtnText: { fontSize: 18, fontWeight: "600" },
  dayLabels: { flexDirection: "row", marginBottom: 6 },
  dayLabel: { flex: 1, textAlign: "center", fontFamily: "DM_Sans_600SemiBold", fontSize: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginBottom: 16 },
  cell: {
    width: "13.28%", aspectRatio: 1, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center", paddingVertical: 4,
  },
  cellDate: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  legend: { flexDirection: "row", justifyContent: "center", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: "DM_Sans_400Regular", fontSize: 11 },

  // Modals
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 340, borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center" },
  modalEmoji: { fontSize: 32, marginBottom: 8 },
  modalLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  modalDate: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, textTransform: "capitalize", textAlign: "center", marginBottom: 6 },
  modalSlot: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 36, marginBottom: 20 },
  modalButtons: { flexDirection: "row", gap: 10, width: "100%", marginTop: 16 },
  modalBtnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  modalBtnSecondaryText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },
  modalBtnPrimary: { flex: 1.3, borderRadius: 10, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  modalBtnPrimaryText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },

  // Invite sheet
  inviteSheet: {
    width: "100%", maxWidth: 380, borderRadius: 20, borderWidth: 1,
    padding: 24, paddingBottom: 36, alignItems: "center",
  },
  inviteTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, marginBottom: 6, textAlign: "center" },
  inviteSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, textAlign: "center", marginBottom: 20 },
  qrContainer: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  linkBox: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, width: "100%", marginBottom: 12 },
  linkText: { fontFamily: "DM_Sans_400Regular", fontSize: 11 },
  inviteActionBtn: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: 20, width: "100%", alignItems: "center", marginBottom: 10 },
  inviteActionBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 14, color: "#fff" },
  inviteRow: { flexDirection: "row", gap: 8, width: "100%" },
  inviteSmallBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  inviteSmallBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 12, color: "#fff" },

  // Locked invite (non-premium)
  lockedInvite: { alignItems: "center", paddingVertical: 24, width: "100%" },
  lockedEmoji: { fontSize: 40, marginBottom: 16 },
  lockedText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Add resa form (reuses inviteSheet)
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: "DM_Sans_400Regular", fontSize: 15, marginBottom: 10, width: "100%" },

  // Day view
  dayViewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backBtn: {},
  backText: { fontFamily: "DM_Sans_400Regular", fontSize: 14 },
  newsBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  newsBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  dayNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16,
  },
  dayTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, textTransform: "capitalize" },
  daySub: { fontFamily: "DM_Sans_400Regular", fontSize: 12, marginTop: 2 },
  slotCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  slotHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  slotTime: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, flex: 1 },
  slotCount: { fontFamily: "DM_Sans_400Regular", fontSize: 12 },
  slotEmpty: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
  fullTag: { fontFamily: "DM_Sans_600SemiBold", fontSize: 12 },
  addResaBtn: { borderRadius: 7, paddingVertical: 6, paddingHorizontal: 10 },
  addResaBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 12, color: "#fff" },
  resaRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderTopWidth: 1, paddingTop: 8, marginTop: 6,
  },
  resaName: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  resaTel: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 2 },
  deleteResaBtn: { width: 28, height: 28, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  toast: {
    position: "absolute", bottom: 24, alignSelf: "center",
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
  },
  toastText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13, color: "#fff" },
});
