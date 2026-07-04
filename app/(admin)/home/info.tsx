import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSpace } from "@/lib/SpaceContext";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";
import type { SlotConfig } from "@/lib/types";

const WEEKDAY_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

function buildSlotRules(cfg: SlotConfig): string[] {
  const lines: string[] = [];
  lines.push(`Visites de ${cfg.visit_start_hour}h à ${cfg.visit_end_hour}h`);
  lines.push(`Durée max. par visite : ${formatDuration(cfg.slot_duration_minutes)}`);
  if (cfg.min_gap_minutes > 0) {
    const step = cfg.gap_includes_duration ? cfg.slot_duration_minutes + cfg.min_gap_minutes : cfg.min_gap_minutes;
    lines.push(`Un créneau toutes les ${formatDuration(step)}`);
  }
  lines.push(
    `${cfg.max_visitors_per_slot} visiteur${cfg.max_visitors_per_slot > 1 ? "s" : ""} max par créneau`,
  );
  if (cfg.allowed_weekdays && cfg.allowed_weekdays.length < 7) {
    const ordered = [1, 2, 3, 4, 5, 6, 0];
    const labels = ordered
      .filter((d) => cfg.allowed_weekdays.includes(d))
      .map((d) => WEEKDAY_FR[d]);
    lines.push(`Jours autorisés : ${labels.join(", ")}`);
  }
  if (cfg.night_enabled) lines.push(`Nuitées possibles (${cfg.night_start_hour ?? 19}h → ${cfg.night_end_hour ?? 8}h)`);
  if (cfg.blocked_dates && cfg.blocked_dates.length > 0) {
    const formatted = cfg.blocked_dates
      .map((iso) =>
        new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        }),
      )
      .join(", ");
    lines.push(`Dates bloquées : ${formatted}`);
  }
  return lines;
}

export default function AdminInfoScreen() {
  const { space, slotConfig, hasSpace } = useSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!hasSpace || !space) return null;

  const generatedRules = slotConfig ? buildSlotRules(slotConfig) : [];
  const freeText = (space.visit_rules || "").trim();
  const isEmpty = generatedRules.length === 0 && !freeText;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SpaceHeader space={space} active="info" basePath="/(admin)/home" C={C} />
      <ScrollView contentContainerStyle={styles.scroll}>

        {generatedRules.length > 0 && (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.sectionLabel, { color: C.gold }]}>Consignes de visite</Text>
            {generatedRules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={[styles.ruleBullet, { color: C.accent }]}>•</Text>
                <Text style={[styles.ruleText, { color: C.text }]}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        {freeText ? (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.sectionLabel, { color: C.gold }]}>Informations</Text>
            <Text style={[styles.bodyText, { color: C.text }]}>{freeText}</Text>
          </View>
        ) : null}

        {isEmpty && (
          <Text style={[styles.emptyText, { color: C.muted }]}>
            Aucune consigne renseignée. Ajoute-les depuis Compte → Paramètres.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 12 },
  sectionLabel: {
    fontFamily: "DM_Sans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  bodyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22 },
  ruleRow: { flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" },
  ruleBullet: { fontFamily: "DM_Sans_700Bold", fontSize: 16, lineHeight: 22 },
  ruleText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22, flex: 1 },
  freeText: {
    fontFamily: "DM_Sans_400Regular",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    paddingTop: 10,
  },
  emptyText: {
    fontFamily: "DM_Sans_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 40,
  },
});
