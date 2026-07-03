import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSpace } from "@/lib/SpaceContext";
import { themes } from "@/lib/themes";
import { supabase } from "@/lib/supabase";
import PatientAvatar from "@/components/PatientAvatar";
import type { Reservation, NewsEntry, SupportMessage, Task } from "@/lib/types";

const CAT_ICONS: Record<Task["category"], string> = {
  repas: "🍽️",
  affaires: "👕",
  courses: "🛒",
  autre: "💡",
};

export default function AdminAccountScreen() {
  const router = useRouter();
  const { space, loading, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  const [activityLoading, setActivityLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [news, setNews] = useState<NewsEntry[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!space) return;
    loadActivity(space.id);
  }, [space?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadActivity(spaceId: string) {
    setActivityLoading(true);
    const [resv, newsData, msgs, tasksData] = await Promise.all([
      supabase.from("reservations").select("*").eq("space_id", spaceId).order("date", { ascending: false }),
      supabase.from("news_entries").select("*").eq("space_id", spaceId).eq("author_pin", "ADMIN").order("created_at", { ascending: false }),
      supabase.from("support_messages").select("*").eq("space_id", spaceId).eq("author_pin", "ADMIN").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("space_id", spaceId).eq("created_by", "admin").order("created_at", { ascending: false }),
    ]);
    setReservations(resv.data || []);
    setNews(newsData.data || []);
    setMessages(msgs.data || []);
    setTasks(tasksData.data || []);
    setActivityLoading(false);
  }

  function handleOpenReservation(r: Reservation) {
    if (r.type === "Nuit") {
      router.push("/(admin)/home/nights" as any);
    } else {
      router.push("/(admin)/home/slots" as any);
    }
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
        <Text style={[styles.headerTitle, { color: "#fff" }]}>👤 Mon compte</Text>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: "rgba(255,255,255,0.08)", borderColor: C.border }]}
          onPress={() => router.push("/(admin)/settings")}
          activeOpacity={0.85}
        >
          <Text style={[styles.settingsBtnText, { color: C.muted }]}>⚙️ Paramètres</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {hasSpace && space ? (
          <>
            {/* Bandeau patient */}
            <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={styles.patientRow}>
                <PatientAvatar
                  photoUrl={space.patient_photo_url}
                  firstname={space.patient_firstname}
                  lastname={space.patient_lastname}
                  size={56}
                  C={C}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.patientName, { color: "#fff" }]}>
                    {space.patient_firstname} {space.patient_lastname}
                  </Text>
                  <Text style={[styles.patientSub, { color: C.muted }]}>
                    {space.premium ? "✨ Espace premium" : "Espace gratuit"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Section Mes contributions */}
            <Text style={[styles.sectionTitle, { color: C.gold }]}>Mes contributions</Text>

            {activityLoading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} />
            ) : (
              <>
                {/* Toutes les réservations de l'espace */}
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>
                    📅 Toutes les réservations ({reservations.length})
                  </Text>
                  {reservations.length === 0 ? (
                    <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucune réservation pour le moment.</Text>
                  ) : reservations.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.activityRow}
                      onPress={() => handleOpenReservation(r)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]}>
                        {r.type === "Nuit" ? "🌙" : "☀️"}{" "}
                        {new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} · {r.creneau}
                      </Text>
                      <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Nouvelles */}
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>
                    📰 Mes nouvelles ({news.length})
                  </Text>
                  {news.length === 0 ? (
                    <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucune nouvelle publiée pour le moment.</Text>
                  ) : news.map((entry) => (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.activityRow}
                      onPress={() => router.push("/(admin)/news" as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]} numberOfLines={2}>
                        {new Date(entry.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {entry.content}
                      </Text>
                      <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Messages de soutien */}
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>
                    💛 Mes messages de soutien ({messages.length})
                  </Text>
                  {messages.length === 0 ? (
                    <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucun message envoyé pour le moment.</Text>
                  ) : messages.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.activityRow}
                      onPress={() => router.push("/(admin)/soutien" as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]} numberOfLines={2}>
                        {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {m.message}
                      </Text>
                      <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Besoins publiés */}
                <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[styles.activityGroupTitle, { color: "#fff" }]}>
                    🤝 Besoins publiés ({tasks.length})
                  </Text>
                  {tasks.length === 0 ? (
                    <Text style={[styles.activityEmpty, { color: C.muted }]}>Aucun besoin publié pour le moment.</Text>
                  ) : tasks.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.activityRow}
                      onPress={() => router.push("/(admin)/entraide" as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.activityRowText, { color: C.text, flex: 1 }]} numberOfLines={1}>
                        {CAT_ICONS[t.category]} {t.title}
                      </Text>
                      <View style={[
                        styles.activityStatusBadge,
                        {
                          borderColor: t.status === "fait" ? C.success
                            : t.status === "pris_en_charge" ? C.accent
                            : C.orange,
                        },
                      ]}>
                        <Text style={[
                          styles.activityStatusText,
                          {
                            color: t.status === "fait" ? C.success
                              : t.status === "pris_en_charge" ? C.accent
                              : C.orange,
                          },
                        ]}>
                          {t.status === "fait" ? "✓ Fait"
                            : t.status === "pris_en_charge" ? "⏳ Pris en charge"
                            : "🔓 Ouvert"}
                        </Text>
                      </View>
                      <Text style={[styles.activityChevron, { color: C.muted }]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.cardDesc, { color: C.muted }]}>
              Aucun espace patient actif.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  header: {
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
  },
  headerTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20 },
  settingsBtn: {
    borderWidth: 1, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
    marginBottom: 2,
  },
  settingsBtnText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },

  scroll: { padding: 16, paddingBottom: 48 },
  sectionTitle: {
    fontFamily: "DM_Sans_600SemiBold", fontSize: 11,
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 10, marginTop: 20,
  },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 4, gap: 10 },
  cardDesc: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 20 },

  patientRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  patientName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18 },
  patientSub: { fontFamily: "DM_Sans_400Regular", fontSize: 13, marginTop: 2 },

  activityGroupTitle: { fontFamily: "DM_Sans_700Bold", fontSize: 13, marginBottom: 4 },
  activityEmpty: { fontFamily: "DM_Sans_400Regular", fontSize: 13 },
  activityRow: { paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  activityRowText: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 19 },
  activityStatusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  activityStatusText: { fontFamily: "DM_Sans_600SemiBold", fontSize: 10 },
  activityChevron: { fontFamily: "DM_Sans_700Bold", fontSize: 16 },
});
