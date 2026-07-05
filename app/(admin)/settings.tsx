import { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Image, TextInput, Switch,
  Linking, Modal, KeyboardAvoidingView, Platform, Dimensions,
  PanResponder, Animated,
} from "react-native";

// Percentages ("85%") on the sheet don't resolve reliably since its parent
// TouchableOpacity has no defined height (hugs content) — use a pixel value
// so the ScrollView actually gets a bounded viewport to scroll within.
const SHEET_MAX_HEIGHT = Dimensions.get("window").height * 0.85;
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { useSpace } from "@/lib/SpaceContext";
import { themes, themeLabels } from "@/lib/themes";
import PatientAvatar from "@/components/PatientAvatar";
import { resolvePlaceFromMapsUrl } from "@/lib/address";
import type { ThemeKey } from "@/lib/themes";
import type { NewsEntry, Task, SupportMessage } from "@/lib/types";

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
  visit_rules: "Consignes de visite",
  home_care_mode: "Mode de soin",
  home_address: "Adresse du domicile",
  home_maps_url: "Lien Google Maps (domicile)",
};
const FIELD_ICONS: Record<string, string> = {
  hospital_room: "🛏️",
  hospital_service: "🏥",
  hospital_sector: "📍",
  visit_rules: "📝",
  home_care_mode: "🔄",
  home_address: "📍",
  home_maps_url: "🗺️",
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

const TASK_CAT_ICONS: Record<Task["category"], string> = {
  repas: "🍽️",
  affaires: "👕",
  courses: "🛒",
  autre: "💡",
};

// ─── Grille de réglages (remplace le long défilement par des tuiles) ─────────
type SectionKey = "soin" | "coord" | "hosp" | "consignes" | "regles" | "nuitees" | "hist" | "rgpd";

const SECTION_META: Record<SectionKey, { icon: string; label: string; hint: string }> = {
  soin: { icon: "🔄", label: "Mode de soin", hint: "Hôpital ou domicile" },
  coord: { icon: "📍", label: "Coordonnées", hint: "Adresse, lien Maps" },
  hosp: { icon: "🏥", label: "Infos hospitalières", hint: "Chambre, service, secteur" },
  consignes: { icon: "📝", label: "Consignes de visite", hint: "Message pour les visiteurs" },
  regles: { icon: "⏰", label: "Règles de visite", hint: "Horaires, durée, jours" },
  nuitees: { icon: "🌙", label: "Nuitées", hint: "Plage horaire de nuit" },
  hist: { icon: "🕐", label: "Historique", hint: "Modifications passées" },
  rgpd: { icon: "🔒", label: "Conservation des données", hint: "Suppression automatique" },
};

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

  // Section active de la grille de réglages (null = grille de tuiles affichée)
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

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

  // Coordonnées de l'hôpital (name / address / lien Maps collé manuellement par l'admin)
  const hospitalCoordsInit = useRef(false);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [hospitalAddressLine2, setHospitalAddressLine2] = useState("");
  const [hospitalPostalCode, setHospitalPostalCode] = useState("");
  const [hospitalCity, setHospitalCity] = useState("");
  const [hospitalCountry, setHospitalCountry] = useState("");
  const [hospitalMapsUrl, setHospitalMapsUrl] = useState("");
  const [hospitalNameResolving, setHospitalNameResolving] = useState(false);
  const [hospitalCoordsSaving, setHospitalCoordsSaving] = useState(false);
  useEffect(() => {
    if (space && !hospitalCoordsInit.current) {
      hospitalCoordsInit.current = true;
      setHospitalName(space.hospital_name ?? "");
      setHospitalAddress(space.hospital_address ?? "");
      setHospitalAddressLine2(space.hospital_address_line2 ?? "");
      setHospitalPostalCode(space.hospital_postal_code ?? "");
      setHospitalCity(space.hospital_city ?? "");
      setHospitalCountry(space.hospital_country ?? "");
      setHospitalMapsUrl(space.hospital_maps_url ?? "");
    }
  }, [space]);

  // Coordonnées du domicile (mode "Soin à domicile")
  const homeCoordsInit = useRef(false);
  const [homeAddress, setHomeAddress] = useState("");
  const [homeAddressLine2, setHomeAddressLine2] = useState("");
  const [homePostalCode, setHomePostalCode] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [homeCoordsSaving, setHomeCoordsSaving] = useState(false);
  useEffect(() => {
    if (space && !homeCoordsInit.current) {
      homeCoordsInit.current = true;
      setHomeAddress(space.home_address ?? "");
      setHomeAddressLine2(space.home_address_line2 ?? "");
      setHomePostalCode(space.home_postal_code ?? "");
      setHomeCity(space.home_city ?? "");
      setHomeCountry(space.home_country ?? "");
    }
  }, [space]);

  // Modal profil patient (photo + changement de nom + thème)
  const [editProfileModal, setEditProfileModal] = useState(false);

  // Modal changement de nom
  const [nameChangeModal, setNameChangeModal] = useState(false);
  const [nameChangeFirstname, setNameChangeFirstname] = useState("");
  const [nameChangeLastname, setNameChangeLastname] = useState("");
  const [nameChangeReason, setNameChangeReason] = useState("");

  // Historique des champs hospitaliers
  const [fieldHistory, setFieldHistory] = useState<FieldHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Historique (infos hospitalières + consignes + publications) — affiché en tuile
  const [historySearch, setHistorySearch] = useState("");
  const [pubLoading, setPubLoading] = useState(false);
  const [pubNews, setPubNews] = useState<NewsEntry[]>([]);
  const [pubTasks, setPubTasks] = useState<Task[]>([]);
  const [pubMessages, setPubMessages] = useState<SupportMessage[]>([]);

  // Soin à domicile toggle
  const [homeCareToggling, setHomeCareToggling] = useState(false);
  const [homeCareDraft, setHomeCareDraft] = useState(false);
  useEffect(() => {
    if (space) setHomeCareDraft(space.home_care_mode);
  }, [space?.home_care_mode]);
  const [homeCareTrackWidth, setHomeCareTrackWidth] = useState(0);
  const homeCareTrackWidthRef = useRef(0);
  const homeCareDraftRef = useRef(homeCareDraft);
  useEffect(() => { homeCareDraftRef.current = homeCareDraft; }, [homeCareDraft]);
  const homeCareTogglingRef = useRef(homeCareToggling);
  useEffect(() => { homeCareTogglingRef.current = homeCareToggling; }, [homeCareToggling]);
  const homeCareThumbX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(homeCareThumbX, { toValue: homeCareDraft ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
  }, [homeCareDraft]);
  const [homeCareLeftLabelWidth, setHomeCareLeftLabelWidth] = useState(0);
  const [homeCareRightLabelWidth, setHomeCareRightLabelWidth] = useState(0);
  const [homeCareDescHeightHospital, setHomeCareDescHeightHospital] = useState(0);
  const [homeCareDescHeightHome, setHomeCareDescHeightHome] = useState(0);
  const homeCareDragStart = useRef(0);
  const homeCarePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !homeCareTogglingRef.current,
      onMoveShouldSetPanResponder: () => !homeCareTogglingRef.current,
      onPanResponderGrant: (evt) => {
        const w = homeCareTrackWidthRef.current;
        if (w <= 0) return;
        const frac = Math.min(1, Math.max(0, evt.nativeEvent.locationX / w));
        homeCareDragStart.current = frac;
        homeCareThumbX.setValue(frac);
      },
      onPanResponderMove: (_, g) => {
        const w = homeCareTrackWidthRef.current;
        if (w <= 0) return;
        const frac = Math.min(1, Math.max(0, homeCareDragStart.current + g.dx / w));
        homeCareThumbX.setValue(frac);
      },
      onPanResponderRelease: (_, g) => {
        const w = homeCareTrackWidthRef.current;
        if (w <= 0) return;
        const frac = Math.min(1, Math.max(0, homeCareDragStart.current + g.dx / w));
        const next = frac >= 0.5;
        Animated.spring(homeCareThumbX, { toValue: next ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
        setHomeCareDraft(next);
      },
      onPanResponderTerminate: () => {
        Animated.spring(homeCareThumbX, { toValue: homeCareDraftRef.current ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
      },
    })
  ).current;

  // Nuitées toggle + heures
  const [nightToggling, setNightToggling] = useState(false);
  const nightHoursInit = useRef(false);
  const [nightStartHour, setNightStartHour] = useState(19);
  const [nightEndHour, setNightEndHour] = useState(8);
  const [nightHoursSaving, setNightHoursSaving] = useState(false);
  useEffect(() => {
    if (slotConfig && !nightHoursInit.current) {
      nightHoursInit.current = true;
      setNightStartHour(slotConfig.night_start_hour ?? 19);
      setNightEndHour(slotConfig.night_end_hour ?? 8);
    }
  }, [slotConfig]);

  // Règles des créneaux
  const slotRulesInit = useRef(false);
  const [visitStartHour, setVisitStartHour] = useState(9);
  const [visitEndHour, setVisitEndHour] = useState(20);
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotGap, setSlotGap] = useState(5);
  const [slotGapDragging, setSlotGapDragging] = useState(false);
  const slotGapScale = useRef(new Animated.Value(1)).current;
  const slotGapDragSteps = useRef(0);
  const slotGapPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        slotGapDragSteps.current = 0;
        setSlotGapDragging(true);
        Animated.spring(slotGapScale, { toValue: 1.12, friction: 5, useNativeDriver: true }).start();
      },
      onPanResponderMove: (_, g) => {
        const steps = Math.trunc(-g.dy / 12);
        const delta = steps - slotGapDragSteps.current;
        if (delta !== 0) {
          slotGapDragSteps.current = steps;
          setSlotGap((v) => Math.min(240, Math.max(5, v + delta * 5)));
        }
      },
      onPanResponderRelease: () => {
        setSlotGapDragging(false);
        Animated.spring(slotGapScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        setSlotGapDragging(false);
        Animated.spring(slotGapScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      },
    })
  ).current;
  const [gapIncludesDuration, setGapIncludesDuration] = useState(false);
  const chevronBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevronBounce, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(chevronBounce, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
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
      setSlotGap(Math.max(5, slotConfig.min_gap_minutes || 0));
      setGapIncludesDuration(slotConfig.gap_includes_duration ?? false);
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

  async function loadPublicationsHistory() {
    if (!space) return;
    setPubLoading(true);
    const [newsData, tasksData, msgsData] = await Promise.all([
      supabase.from("news_entries").select("*").eq("space_id", space.id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("space_id", space.id).order("created_at", { ascending: false }),
      supabase.from("support_messages").select("*").eq("space_id", space.id).order("created_at", { ascending: false }),
    ]);
    setPubNews(newsData.data || []);
    setPubTasks(tasksData.data || []);
    setPubMessages(msgsData.data || []);
    setPubLoading(false);
  }

  function openSection(key: SectionKey) {
    if (key === "hist") {
      setHistorySearch("");
      loadHistory();
      loadPublicationsHistory();
    }
    setActiveSection(key);
  }

  function matchesHistoryQuery(...values: (string | null | undefined)[]): boolean {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return values.some((v) => (v ?? "").toLowerCase().includes(q));
  }

  const hospitalFieldHistory = fieldHistory.filter((h) =>
    h.field_name !== "visit_rules" && matchesHistoryQuery(FIELD_LABELS[h.field_name] ?? h.field_name, h.old_value, h.new_value)
  );
  const visitRulesHistory = fieldHistory.filter((h) =>
    h.field_name === "visit_rules" && matchesHistoryQuery(h.old_value, h.new_value)
  );
  const filteredPubNews = pubNews.filter((n) => matchesHistoryQuery(n.content, n.author_prenom, n.author_nom));
  const filteredPubTasks = pubTasks.filter((t) => matchesHistoryQuery(t.title, t.description, t.category));
  const filteredPubMessages = pubMessages.filter((m) => matchesHistoryQuery(m.message, m.author_prenom, m.author_nom));

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
    const nextRules = visitRules.trim() || null;
    await logFieldChange("visit_rules", space.visit_rules, nextRules);
    const { error } = await supabase
      .from("patient_spaces")
      .update({ visit_rules: nextRules })
      .eq("id", space.id);
    setNotesSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else { showToast("Message enregistré ✓"); loadHistory(); }
  }

  // Dès que l'admin quitte le champ lien Maps, on tente de récupérer le nom
  // (lu dans l'URL) et l'adresse (géocodage inverse des coordonnées GPS de
  // l'URL via OpenStreetMap Nominatim) — sans écraser une saisie manuelle
  // en cours si la résolution échoue.
  async function handleHospitalMapsUrlBlur() {
    const url = hospitalMapsUrl.trim();
    if (!url) return;
    setHospitalNameResolving(true);
    const place = await resolvePlaceFromMapsUrl(url);
    setHospitalNameResolving(false);
    if (place.name) setHospitalName(place.name);
    if (place.street) setHospitalAddress(place.street);
    if (place.postalCode) setHospitalPostalCode(place.postalCode);
    if (place.city) setHospitalCity(place.city);
    if (place.country) setHospitalCountry(place.country);
    const gotAddress = !!(place.street || place.postalCode || place.city);
    if (place.name && gotAddress) showToast("Nom et adresse récupérés depuis le lien ✓");
    else if (place.name) showToast("Nom récupéré — adresse à compléter manuellement.");
    else if (gotAddress) showToast("Adresse récupérée depuis le lien ✓");
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
        hospital_address_line2: hospitalAddressLine2.trim() || null,
        hospital_postal_code: hospitalPostalCode.trim() || null,
        hospital_city: hospitalCity.trim() || null,
        hospital_country: hospitalCountry.trim() || null,
        hospital_maps_url: hospitalMapsUrl.trim() || null,
      })
      .eq("id", space.id);
    setHospitalCoordsSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else showToast("Coordonnées enregistrées ✓");
  }

  // ── Coordonnées domicile (mode Soin à domicile) ───────────────────────────
  async function handleSaveHomeCoords() {
    if (!space) return;
    setHomeCoordsSaving(true);
    const nextAddress = homeAddress.trim() || null;
    const nextAddressLine2 = homeAddressLine2.trim() || null;
    const nextPostalCode = homePostalCode.trim() || null;
    const nextCity = homeCity.trim() || null;
    const nextCountry = homeCountry.trim() || null;
    if (nextAddress !== space.home_address) await logFieldChange("home_address", space.home_address, nextAddress);
    const { error } = await supabase
      .from("patient_spaces")
      .update({
        home_address: nextAddress,
        home_address_line2: nextAddressLine2,
        home_postal_code: nextPostalCode,
        home_city: nextCity,
        home_country: nextCountry,
      })
      .eq("id", space.id);
    setHomeCoordsSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else { showToast("Coordonnées enregistrées ✓"); loadHistory(); }
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

  // ── Soin à domicile toggle ─────────────────────────────────────────────────
  async function handleConfirmHomeCare() {
    if (!space) return;
    setHomeCareToggling(true);
    const nextMode = homeCareDraft;
    const update: Record<string, string | boolean | null> = { home_care_mode: nextMode };
    if (nextMode) {
      update.home_address = homeAddress.trim() || null;
      update.home_address_line2 = homeAddressLine2.trim() || null;
      update.home_postal_code = homePostalCode.trim() || null;
      update.home_city = homeCity.trim() || null;
      update.home_country = homeCountry.trim() || null;
    } else {
      update.hospital_name = hospitalName.trim() || null;
      update.hospital_address = hospitalAddress.trim() || null;
      update.hospital_address_line2 = hospitalAddressLine2.trim() || null;
      update.hospital_postal_code = hospitalPostalCode.trim() || null;
      update.hospital_city = hospitalCity.trim() || null;
      update.hospital_country = hospitalCountry.trim() || null;
      update.hospital_maps_url = hospitalMapsUrl.trim() || null;
    }
    const { error } = await supabase
      .from("patient_spaces")
      .update(update)
      .eq("id", space.id);
    if (!error) {
      await logFieldChange(
        "home_care_mode",
        space.home_care_mode ? "Soin à domicile" : "Suivi hospitalier",
        nextMode ? "Soin à domicile" : "Suivi hospitalier"
      );
      loadHistory();
    }
    setHomeCareToggling(false);
    if (error) {
      showToast("Erreur lors de la mise à jour.");
      return;
    }
    showToast(nextMode ? "Soin à domicile activé ✓" : "Retour au suivi hospitalier ✓");
    setActiveSection(null);
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

  async function handleSaveNightHours() {
    if (!slotConfig) return;
    setNightHoursSaving(true);
    const { error } = await supabase.from("slot_config").update({
      night_start_hour: nightStartHour,
      night_end_hour: nightEndHour,
    }).eq("id", slotConfig.id);
    setNightHoursSaving(false);
    if (error) showToast("Erreur lors de la sauvegarde.");
    else { showToast("Heures de nuitée enregistrées ✓"); refreshSlotConfig(); }
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
      gap_includes_duration: gapIncludesDuration,
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
        <TouchableOpacity onPress={() => router.replace("/(admin)/account")} style={styles.backBtn}>
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
                  <Text style={[styles.patientHospital, { color: C.muted }]}>
                    {space.home_care_mode ? "🏠 Soin à domicile" : space.hospital_name}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.saveNotesBtn, { backgroundColor: C.accent, borderWidth: 1, borderColor: C.accent, marginTop: 14 }]}
                onPress={() => setEditProfileModal(true)}
              >
                <Text style={[styles.saveNotesBtnText, { color: "#fff" }]}>Profil Patient</Text>
              </TouchableOpacity>
            </View>

            {/* ── Grille de tuiles des réglages ─────────────────────────────── */}
            {activeSection === null && (
              <View style={styles.tileGrid}>
                {(
                  [
                    "soin",
                    "coord",
                    ...(!space.home_care_mode ? (["hosp"] as const) : []),
                    "consignes",
                    ...(slotConfig ? (["regles", "nuitees"] as const) : []),
                    "hist",
                    "rgpd",
                  ] as SectionKey[]
                ).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.tile, { backgroundColor: C.card, borderColor: C.border }]}
                    onPress={() => openSection(key)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.tileIcon, { backgroundColor: `${C.accent}22` }]}>
                      <Text style={styles.tileIconText}>{SECTION_META[key].icon}</Text>
                    </View>
                    <Text style={[styles.tileLabel, { color: "#fff" }]}>{SECTION_META[key].label}</Text>
                    <Text style={[styles.tileHint, { color: C.muted }]}>{SECTION_META[key].hint}</Text>
                    <Text style={[styles.tileChevron, { color: C.muted }]}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeSection !== null && (
              <TouchableOpacity style={styles.backToGrid} onPress={() => setActiveSection(null)} activeOpacity={0.7}>
                <Text style={[styles.backToGridText, { color: C.accent }]}>← Retour aux réglages</Text>
              </TouchableOpacity>
            )}

            {/* ── Section : Mode de soin ────────────────────────────────────── */}
            {activeSection === "soin" && (
            <>
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Mode de soin</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View
                style={{
                  minHeight: Math.max(homeCareDescHeightHospital, homeCareDescHeightHome) || undefined,
                  marginBottom: 4,
                }}
              >
                <Text
                  onLayout={(e) => setHomeCareDescHeightHospital(e.nativeEvent.layout.height)}
                  style={[
                    styles.nightDesc,
                    { color: C.muted },
                    homeCareDraft && styles.homeCareDescHidden,
                  ]}
                >
                  Activez si le patient quitte l'hôpital et que les visites se poursuivent à domicile.
                </Text>
                <Text
                  onLayout={(e) => setHomeCareDescHeightHome(e.nativeEvent.layout.height)}
                  style={[
                    styles.nightDesc,
                    { color: C.muted },
                    !homeCareDraft && styles.homeCareDescHidden,
                  ]}
                >
                  Activez si le patient doit faire un séjour hospitalier.
                </Text>
              </View>
              <View
                style={[styles.homeCareTrack, { borderColor: C.border, backgroundColor: C.bg }]}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  homeCareTrackWidthRef.current = w;
                  setHomeCareTrackWidth(w);
                }}
                {...homeCarePanResponder.panHandlers}
              >
                {homeCareTrackWidth > 0 && homeCareLeftLabelWidth > 0 && homeCareRightLabelWidth > 0 && (() => {
                  const padding = 24;
                  const thumbWidth = Math.max(homeCareLeftLabelWidth, homeCareRightLabelWidth) + padding;
                  const leftPos = 0;
                  const rightPos = homeCareTrackWidth - thumbWidth;
                  return (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.homeCareThumb,
                        {
                          backgroundColor: C.accent,
                          width: thumbWidth,
                          transform: [{
                            translateX: homeCareThumbX.interpolate({ inputRange: [0, 1], outputRange: [leftPos, rightPos] }),
                          }],
                        },
                      ]}
                    />
                  );
                })()}
                <View style={[styles.homeCareOption, { left: 0 }]} pointerEvents="none">
                  <Text
                    onLayout={(e) => setHomeCareLeftLabelWidth(e.nativeEvent.layout.width)}
                    style={[styles.homeCareOptionText, { color: !homeCareDraft ? "#fff" : C.muted }]}
                  >
                    Suivi hospitalier
                  </Text>
                </View>
                <View style={[styles.homeCareOption, { right: 0 }]} pointerEvents="none">
                  <Text
                    onLayout={(e) => setHomeCareRightLabelWidth(e.nativeEvent.layout.width)}
                    style={[styles.homeCareOptionText, { color: homeCareDraft ? "#fff" : C.muted }]}
                  >
                    Soin à domicile
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 16 }}>
                {homeCareDraft ? (
                  <>
                      <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 0 }]}>📍 Adresse</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Ex : 12 rue des Lilas"
                        placeholderTextColor={C.muted}
                        value={homeAddress}
                        onChangeText={setHomeAddress}
                      />
                      <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🏠 Complément d'adresse</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Ex : Bâtiment B, 2e étage"
                        placeholderTextColor={C.muted}
                        value={homeAddressLine2}
                        onChangeText={setHomeAddressLine2}
                      />
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: C.gold }]}>Code postal</Text>
                          <TextInput
                            style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                            placeholder="38000"
                            placeholderTextColor={C.muted}
                            value={homePostalCode}
                            onChangeText={setHomePostalCode}
                            keyboardType="number-pad"
                          />
                        </View>
                        <View style={{ flex: 2 }}>
                          <Text style={[styles.fieldLabel, { color: C.gold }]}>Ville</Text>
                          <TextInput
                            style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                            placeholder="Grenoble"
                            placeholderTextColor={C.muted}
                            value={homeCity}
                            onChangeText={setHomeCity}
                          />
                        </View>
                      </View>
                      <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🌍 Pays</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Laisser vide si France"
                        placeholderTextColor={C.muted}
                        value={homeCountry}
                        onChangeText={setHomeCountry}
                      />
                    </>
                  ) : (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 0 }]}>🗺️ Lien Google Maps</Text>
                        {hospitalNameResolving && <ActivityIndicator color={C.accent} size="small" />}
                      </View>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Colle ici le lien copié depuis Google Maps"
                        placeholderTextColor={C.muted}
                        value={hospitalMapsUrl}
                        onChangeText={setHospitalMapsUrl}
                        onBlur={handleHospitalMapsUrlBlur}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🏥 Nom de l'hôpital</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Ex : CHU de Grenoble"
                        placeholderTextColor={C.muted}
                        value={hospitalName}
                        onChangeText={setHospitalName}
                      />
                      <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>📍 Adresse</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Ex : Avenue de Maquis du Grésivaudan"
                        placeholderTextColor={C.muted}
                        value={hospitalAddress}
                        onChangeText={setHospitalAddress}
                      />
                      <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🏥 Complément d'adresse</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Ex : Bâtiment Chevalier, entrée C"
                        placeholderTextColor={C.muted}
                        value={hospitalAddressLine2}
                        onChangeText={setHospitalAddressLine2}
                      />
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: C.gold }]}>Code postal</Text>
                          <TextInput
                            style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                            placeholder="38000"
                            placeholderTextColor={C.muted}
                            value={hospitalPostalCode}
                            onChangeText={setHospitalPostalCode}
                            keyboardType="number-pad"
                          />
                        </View>
                        <View style={{ flex: 2 }}>
                          <Text style={[styles.fieldLabel, { color: C.gold }]}>Ville</Text>
                          <TextInput
                            style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                            placeholder="Grenoble"
                            placeholderTextColor={C.muted}
                            value={hospitalCity}
                            onChangeText={setHospitalCity}
                          />
                        </View>
                      </View>
                      <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🌍 Pays</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Laisser vide si France"
                        placeholderTextColor={C.muted}
                        value={hospitalCountry}
                        onChangeText={setHospitalCountry}
                      />
                    </>
                )}
              </View>
              {(() => {
                const homeCareChanged = homeCareDraft !== space.home_care_mode;
                return (
                  <TouchableOpacity
                    style={[
                      styles.saveNotesBtn,
                      homeCareChanged
                        ? { backgroundColor: C.accent, marginTop: 4 }
                        : { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: C.border, marginTop: 4 },
                      homeCareToggling && { opacity: 0.6 },
                    ]}
                    onPress={handleConfirmHomeCare}
                    disabled={homeCareToggling || !homeCareChanged}
                  >
                    {homeCareToggling
                      ? <ActivityIndicator color={homeCareChanged ? "#fff" : C.muted} size="small" />
                      : <Text style={[styles.saveNotesBtnText, !homeCareChanged && { color: C.muted }]}>Confirmer</Text>
                    }
                  </TouchableOpacity>
                );
              })()}
            </View>
            </>
            )}

            {activeSection === "coord" && (
            space.home_care_mode ? (
              <>
                {/* ── Section : Coordonnées (domicile) ─────────────────────── */}
                <Text style={[styles.sectionTitle, { color: C.gold }]}>Coordonnées</Text>
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[styles.cardDesc, { color: C.muted }]}>Adresse affichée dans l'app — le lien Google Maps est généré automatiquement.</Text>

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>📍 Adresse</Text>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ex : 12 rue des Lilas"
                    placeholderTextColor={C.muted}
                    value={homeAddress}
                    onChangeText={setHomeAddress}
                  />

                  <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🏠 Complément d'adresse</Text>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ex : Bâtiment B, 2e étage"
                    placeholderTextColor={C.muted}
                    value={homeAddressLine2}
                    onChangeText={setHomeAddressLine2}
                  />

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: C.gold }]}>Code postal</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="38000"
                        placeholderTextColor={C.muted}
                        value={homePostalCode}
                        onChangeText={setHomePostalCode}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.fieldLabel, { color: C.gold }]}>Ville</Text>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Grenoble"
                        placeholderTextColor={C.muted}
                        value={homeCity}
                        onChangeText={setHomeCity}
                      />
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🌍 Pays</Text>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Laisser vide si France"
                    placeholderTextColor={C.muted}
                    value={homeCountry}
                    onChangeText={setHomeCountry}
                  />

                  <TouchableOpacity
                    style={[styles.saveNotesBtn, { backgroundColor: C.accent, marginTop: 8 }, homeCoordsSaving && { opacity: 0.6 }]}
                    onPress={handleSaveHomeCoords}
                    disabled={homeCoordsSaving}
                  >
                    {homeCoordsSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveNotesBtnText}>Enregistrer les coordonnées</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* ── Section : Coordonnées de l'hôpital ───────────────────── */}
                <Text style={[styles.sectionTitle, { color: C.gold }]}>Coordonnées</Text>
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[styles.cardDesc, { color: C.muted }]}>Colle le lien Google Maps trouvé sur internet — le nom et l'adresse se remplissent automatiquement en dessous (à vérifier, l'adresse peut être approximative).</Text>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.fieldLabel, { color: C.gold }]}>🗺️ Lien Google Maps</Text>
                    {hospitalNameResolving && <ActivityIndicator color={C.accent} size="small" />}
                  </View>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Colle ici le lien copié depuis Google Maps"
                    placeholderTextColor={C.muted}
                    value={hospitalMapsUrl}
                    onChangeText={setHospitalMapsUrl}
                    onBlur={handleHospitalMapsUrlBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>🏥 Nom de l'hôpital</Text>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ex : CHU de Grenoble"
                    placeholderTextColor={C.muted}
                    value={hospitalName}
                    onChangeText={setHospitalName}
                  />

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.fieldLabel, { color: C.gold }]}>📍 Adresse</Text>
                    {hospitalNameResolving && <ActivityIndicator color={C.accent} size="small" />}
                  </View>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ex : Avenue de Maquis du Grésivaudan"
                    placeholderTextColor={C.muted}
                    value={hospitalAddress}
                    onChangeText={setHospitalAddress}
                  />

                  <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 12 }]}>🏥 Complément d'adresse</Text>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ex : Bâtiment Chevalier, entrée C"
                    placeholderTextColor={C.muted}
                    value={hospitalAddressLine2}
                    onChangeText={setHospitalAddressLine2}
                  />

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.fieldLabel, { color: C.gold }]}>Code postal</Text>
                        {hospitalNameResolving && <ActivityIndicator color={C.accent} size="small" />}
                      </View>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="38000"
                        placeholderTextColor={C.muted}
                        value={hospitalPostalCode}
                        onChangeText={setHospitalPostalCode}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.fieldLabel, { color: C.gold }]}>Ville</Text>
                        {hospitalNameResolving && <ActivityIndicator color={C.accent} size="small" />}
                      </View>
                      <TextInput
                        style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                        placeholder="Grenoble"
                        placeholderTextColor={C.muted}
                        value={hospitalCity}
                        onChangeText={setHospitalCity}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <Text style={[styles.fieldLabel, { color: C.gold }]}>🌍 Pays</Text>
                    {hospitalNameResolving && <ActivityIndicator color={C.accent} size="small" />}
                  </View>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Laisser vide si France"
                    placeholderTextColor={C.muted}
                    value={hospitalCountry}
                    onChangeText={setHospitalCountry}
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
              </>
            )
            )}

            {/* ── Section : Infos hospitalières ─────────────────────────────── */}
            {activeSection === "hosp" && !space.home_care_mode && (
              <>
                <Text style={[styles.sectionTitle, { color: C.gold }]}>Infos hospitalières</Text>
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[styles.cardDesc, { color: C.muted }]}>
                    Affichées dans le bandeau de l'app. Chaque modification est datée et conservée.
                  </Text>

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

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Chambre */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>🛏️ Chambre</Text>
                  <TextInput
                    style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text }]}
                    placeholder="Ex : 205 B"
                    placeholderTextColor={C.muted}
                    value={room}
                    onChangeText={setRoom}
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
                </View>
              </>
            )}

            {/* ── Section : Consignes de visite / Infos ─────────────────────── */}
            {activeSection === "consignes" && (
            <>
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
            </>
            )}

            {/* ── Section : Règles de visite ──────────────────────────────────── */}
            {activeSection === "regles" && slotConfig && (
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
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={() => setSlotDuration((d) => Math.max(5, d - 5))}
                    >
                      <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepValue, { color: "#fff" }]}>
                      {slotDuration < 60 ? `${slotDuration} min` : `${Math.floor(slotDuration / 60)}h${slotDuration % 60 ? slotDuration % 60 : ""}`}
                    </Text>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={() => setSlotDuration((d) => Math.min(240, d + 5))}
                    >
                      <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Intervalle entre les créneaux */}
                  <Text style={[styles.fieldLabel, { color: C.gold }]}>⏲ Intervalle entre deux créneaux</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={() => setSlotGap((g) => Math.max(5, g - 5))}
                    >
                      <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                    </TouchableOpacity>
                    <Animated.View
                      {...slotGapPanResponder.panHandlers}
                      style={[
                        styles.scrubValue,
                        {
                          backgroundColor: slotGapDragging ? `${C.accent}33` : C.bg,
                          borderColor: slotGapDragging ? C.accent : C.border,
                          transform: [{ scale: slotGapScale }],
                        },
                      ]}
                    >
                      <Animated.Text
                        style={[
                          styles.scrubChevron,
                          { color: slotGapDragging ? C.accent : C.gold, transform: [{ translateY: chevronBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
                        ]}
                      >
                        ⌃
                      </Animated.Text>
                      <Text style={[styles.stepValue, { color: "#fff", marginVertical: 0 }]}>
                        {slotGap < 60 ? `${slotGap} min` : `${Math.floor(slotGap / 60)}h${slotGap % 60 ? slotGap % 60 : ""}`}
                      </Text>
                      <Animated.Text
                        style={[
                          styles.scrubChevron,
                          { color: slotGapDragging ? C.accent : C.gold, transform: [{ translateY: chevronBounce.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }] },
                        ]}
                      >
                        ⌄
                      </Animated.Text>
                    </Animated.View>
                    <TouchableOpacity
                      style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                      onPress={() => setSlotGap((g) => Math.min(240, g + 5))}
                    >
                      <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.nightRow, { marginTop: 12 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.nightLabel, { color: "#fff" }]}>Ajouter la durée de visite à l'intervalle</Text>
                      <Text style={[styles.nightDesc, { color: C.muted }]}>
                        {gapIncludesDuration
                          ? `Ex. : visite de ${slotDuration} min + ${slotGap} min d'intervalle → créneau suivant ${slotDuration + slotGap} min plus tard.`
                          : `Actuellement, l'intervalle (${slotGap} min) est le seul écart entre deux créneaux, quelle que soit la durée de visite.`}
                      </Text>
                    </View>
                    <Switch
                      value={gapIncludesDuration}
                      onValueChange={setGapIncludesDuration}
                      trackColor={{ false: C.border, true: C.accent }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  {/* Résumé des créneaux générés */}
                  <Text style={[styles.cardDesc, { color: C.muted, marginBottom: 0 }]}>
                    {`Créneaux générés : ${(() => {
                      const step = gapIncludesDuration ? slotDuration + slotGap : (slotGap > 0 ? slotGap : slotDuration);
                      return Array.from({ length: Math.max(0, Math.floor((visitEndHour * 60 - visitStartHour * 60) / step)) }).map((_, i) => {
                        const m = visitStartHour * 60 + i * step;
                        return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                      }).join(" · ") || "Aucun — vérifiez les horaires.";
                    })()}`}
                  </Text>

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
            {activeSection === "nuitees" && slotConfig && (
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
                          ? `Les visiteurs peuvent réserver une nuit (${nightStartHour}h → ${nightEndHour}h).`
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

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>⏰ Heures de nuitée</Text>
                  <View style={styles.hourRow}>
                    <View style={styles.hourBlock}>
                      <Text style={[styles.hourLabel, { color: C.muted }]}>Début</Text>
                      <Text style={[styles.stepValue, { color: "#fff" }]}>{String(nightStartHour).padStart(2,"0")}:00</Text>
                      <View style={styles.stepperRow}>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setNightStartHour((h) => (h + 23) % 24)}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setNightStartHour((h) => (h + 1) % 24)}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.hourSep, { color: C.muted }]}>→</Text>
                    <View style={styles.hourBlock}>
                      <Text style={[styles.hourLabel, { color: C.muted }]}>Fin (lendemain)</Text>
                      <Text style={[styles.stepValue, { color: "#fff" }]}>{String(nightEndHour).padStart(2,"0")}:00</Text>
                      <View style={styles.stepperRow}>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setNightEndHour((h) => (h + 23) % 24)}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>−</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.stepBtn, { backgroundColor: C.bg, borderColor: C.border }]}
                          onPress={() => setNightEndHour((h) => (h + 1) % 24)}
                        >
                          <Text style={[styles.stepBtnText, { color: C.text }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.saveNotesBtn, { backgroundColor: C.accent, marginTop: 8 }, nightHoursSaving && { opacity: 0.6 }]}
                    onPress={handleSaveNightHours}
                    disabled={nightHoursSaving}
                  >
                    {nightHoursSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.saveNotesBtnText}>Enregistrer les heures de nuitée</Text>
                    }
                  </TouchableOpacity>
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

        {/* ── Section : Historique ─────────────────────────────────────── */}
        {hasSpace && space && activeSection === "hist" && (
          <>
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Historique</Text>
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <TextInput
                style={[styles.sectorInput, { backgroundColor: C.bg, borderColor: C.border, color: C.text, marginBottom: 16 }]}
                placeholder="🔍 Rechercher un mot-clé (toutes rubriques)…"
                placeholderTextColor={C.muted}
                value={historySearch}
                onChangeText={setHistorySearch}
              />

              {/* Bloc 1 : Infos hospitalières */}
              <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 0 }]}>🏥 Infos hospitalières</Text>
              {historyLoading ? (
                <ActivityIndicator color={C.accent} style={{ marginVertical: 8 }} />
              ) : hospitalFieldHistory.length === 0 ? (
                <Text style={[styles.historyEmpty, { color: C.muted }]}>Aucun changement trouvé.</Text>
              ) : (
                hospitalFieldHistory.map((h) => (
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

              <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

              {/* Bloc 2 : Consignes de visite */}
              <Text style={[styles.fieldLabel, { color: C.gold }]}>📝 Consignes de visite</Text>
              {historyLoading ? (
                <ActivityIndicator color={C.accent} style={{ marginVertical: 8 }} />
              ) : visitRulesHistory.length === 0 ? (
                <Text style={[styles.historyEmpty, { color: C.muted }]}>Aucune modification enregistrée.</Text>
              ) : (
                visitRulesHistory.map((h) => (
                  <View key={h.id} style={[styles.historyRow, { borderLeftColor: C.accent }]}>
                    <Text style={[styles.historyField, { color: "#fff" }]}>
                      {h.new_value ? `→ "${h.new_value}"` : "→ (vide)"}
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

              <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

              {/* Bloc 3 : Publications */}
              <Text style={[styles.fieldLabel, { color: C.gold }]}>📢 Publications</Text>
              {pubLoading ? (
                <ActivityIndicator color={C.accent} style={{ marginVertical: 8 }} />
              ) : (
                <>
                  <Text style={[styles.historySubGroup, { color: C.muted }]}>📰 Nouvelles du jour ({filteredPubNews.length})</Text>
                  {filteredPubNews.length === 0 ? (
                    <Text style={[styles.historyEmpty, { color: C.muted }]}>Aucune nouvelle trouvée.</Text>
                  ) : (
                    filteredPubNews.map((n) => (
                      <View key={n.id} style={[styles.historyRow, { borderLeftColor: C.accent }]}>
                        <Text style={[styles.historyField, { color: "#fff" }]} numberOfLines={2}>{n.content}</Text>
                        <Text style={[styles.historyDate, { color: C.muted }]}>
                          {n.author_prenom} {n.author_nom} · {new Date(n.created_at).toLocaleString("fr-FR", {
                            day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    ))
                  )}

                  <Text style={[styles.historySubGroup, { color: C.muted, marginTop: 10 }]}>🤝 Entraide — besoins ({filteredPubTasks.length})</Text>
                  {filteredPubTasks.length === 0 ? (
                    <Text style={[styles.historyEmpty, { color: C.muted }]}>Aucun besoin trouvé.</Text>
                  ) : (
                    filteredPubTasks.map((t) => (
                      <View key={t.id} style={[styles.historyRow, { borderLeftColor: C.accent }]}>
                        <Text style={[styles.historyField, { color: "#fff" }]} numberOfLines={1}>
                          {TASK_CAT_ICONS[t.category]} {t.title}
                        </Text>
                        <Text style={[styles.historyDate, { color: C.muted }]}>
                          {new Date(t.created_at).toLocaleString("fr-FR", {
                            day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    ))
                  )}

                  <Text style={[styles.historySubGroup, { color: C.muted, marginTop: 10 }]}>💛 Mur de soutien ({filteredPubMessages.length})</Text>
                  {filteredPubMessages.length === 0 ? (
                    <Text style={[styles.historyEmpty, { color: C.muted }]}>Aucun message trouvé.</Text>
                  ) : (
                    filteredPubMessages.map((m) => (
                      <View key={m.id} style={[styles.historyRow, { borderLeftColor: C.accent }]}>
                        <Text style={[styles.historyField, { color: "#fff" }]} numberOfLines={2}>{m.message}</Text>
                        <Text style={[styles.historyDate, { color: C.muted }]}>
                          {m.author_prenom} {m.author_nom} · {new Date(m.created_at).toLocaleString("fr-FR", {
                            day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          </>
        )}

        {/* ── Section : Conservation RGPD ──────────────────────────────────── */}
        {hasSpace && space && activeSection === "rgpd" && (() => {
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
                padding: 12,
              }]}>
                <View style={styles.rgpdRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rgpdLabel, { color: C.muted }]}>Suppression prévue le</Text>
                    <Text style={[styles.rgpdDate, { color: isUrgent ? "#e94560" : "#fff", fontSize: 15 }]}>
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

                <Text style={[styles.cardDesc, { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 8, marginBottom: 10 }]}>
                  Planning, souvenirs et messages seront définitivement supprimés à cette date. Conforme RGPD.
                </Text>

                <TouchableOpacity
                  style={[styles.prolongBtn, { backgroundColor: C.accent, paddingVertical: 10 }, prolonging && { opacity: 0.6 }]}
                  onPress={handleProlong}
                  disabled={prolonging}
                >
                  {prolonging
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={[styles.prolongBtnText, { textAlign: "center" }]}>⏳ Prolonger de 30 jours{"\n"}(renouvelable gratuitement)</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          );
        })()}

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

      {/* ── MODAL PROFIL PATIENT (photo + nom + thème) ──────────────────── */}
      <Modal visible={editProfileModal} transparent animationType="slide" onRequestClose={() => setEditProfileModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setEditProfileModal(false)}
            />
            <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.accent, maxHeight: SHEET_MAX_HEIGHT }]}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[styles.sheetTitle, { color: "#fff" }]}>✏️ Modifier le profil patient</Text>

                  <Text style={[styles.fieldLabel, { color: C.gold, marginTop: 0 }]}>Photo</Text>
                  <Text style={[styles.cardDesc, { color: C.muted }]}>
                    Affichée en avatar dans l'app pour tous les visiteurs. Ronde, centrée sur le visage.
                  </Text>
                  <View style={styles.photoRow}>
                    <PatientAvatar
                      photoUrl={displayPhotoUrl}
                      firstname={space?.patient_firstname ?? ""}
                      lastname={space?.patient_lastname ?? ""}
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

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>Nom du patient</Text>
                  <Text style={[styles.cardDesc, { color: C.muted, marginBottom: 8 }]}>
                    Le nom et prénom ne peuvent pas être modifiés directement. En cas d'erreur ou de changement, contactez le service client.
                  </Text>
                  <TouchableOpacity
                    style={[styles.saveNotesBtn, { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: C.border }]}
                    onPress={handleOpenNameChange}
                  >
                    <Text style={[styles.saveNotesBtnText, { color: C.muted }]}>✏️ Demander un changement de nom</Text>
                  </TouchableOpacity>

                  <View style={[styles.fieldDivider, { backgroundColor: C.border }]} />

                  <Text style={[styles.fieldLabel, { color: C.gold }]}>Thème de couleur</Text>
                  <Text style={[styles.cardDesc, { color: C.muted }]}>
                    Appliqué en temps réel pour tous les visiteurs.
                  </Text>
                  {themeUpdating && (
                    <ActivityIndicator color={C.accent} style={{ marginBottom: 12 }} />
                  )}
                  <View style={styles.themeGrid}>
                    {THEME_ORDER.map((key) => {
                      const isActive = space?.theme === key;
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

                  <TouchableOpacity
                    onPress={() => setEditProfileModal(false)}
                    style={[styles.saveNotesBtn, { backgroundColor: C.accent, marginTop: 8 }]}
                  >
                    <Text style={styles.saveNotesBtnText}>Fermer</Text>
                  </TouchableOpacity>
                </ScrollView>
            </View>
          </View>
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

  // Grille de tuiles des réglages
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
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

  backToGrid: { alignSelf: "flex-start", marginTop: 16, marginBottom: 4, paddingVertical: 4 },
  backToGridText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 14 },

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
  historySubGroup: { fontFamily: "DM_Sans_700Bold", fontSize: 12, marginBottom: 8 },

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

  homeCareTrack: {
    width: "100%", height: 48,
    borderWidth: 1, borderRadius: 24, overflow: "hidden", position: "relative",
  },
  homeCareThumb: {
    position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 24,
  },
  homeCareOption: { position: "absolute", top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 12 },
  homeCareOptionText: { fontFamily: "DM_Sans_700Bold", fontSize: 13 },
  homeCareDescHidden: { position: "absolute", left: 0, right: 0, opacity: 0 },

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
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  stepBtn: { width: 36, height: 36, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontFamily: "DM_Sans_700Bold", fontSize: 18, lineHeight: 20 },
  stepValue: { fontFamily: "DM_Sans_700Bold", fontSize: 16, minWidth: 48, textAlign: "center" },
  scrubValue: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderRadius: 18, paddingVertical: 4, paddingHorizontal: 14, minWidth: 72 },
  scrubChevron: { fontSize: 11, lineHeight: 12, fontFamily: "DM_Sans_700Bold" },
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
