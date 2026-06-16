import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";
import SpaceHeader from "@/components/SpaceHeader";

export default function VisitorInfoScreen() {
  const { space } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!space) return null;

  const rules = (space.visit_rules || "").split("\n").filter(Boolean);
  const notes = (space.admin_notes || "").trim();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SpaceHeader space={space} active="info" basePath="/(visitor)/home" C={C} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Visit rules */}
        {rules.length > 0 && (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.sectionLabel, { color: C.gold }]}>Consignes de visite</Text>
            {rules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={[styles.ruleBullet, { color: C.accent }]}>•</Text>
                <Text style={[styles.ruleText, { color: C.text }]}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Admin notes */}
        {notes ? (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.sectionLabel, { color: C.gold }]}>Informations</Text>
            <Text style={[styles.bodyText, { color: C.text }]}>{notes}</Text>
            <Text style={[styles.sensitiveWarning, { color: C.muted }]}>
              ⚠️ Ces informations sont partagées par l'organisateur.
            </Text>
          </View>
        ) : null}

        {rules.length === 0 && !notes && (
          <Text style={[styles.emptyText, { color: C.muted }]}>
            Aucune consigne particulière pour le moment.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 12 },
  sectionLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  bodyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22 },
  ruleRow: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  ruleBullet: { fontFamily: "DM_Sans_700Bold", fontSize: 16, lineHeight: 22 },
  ruleText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22, flex: 1 },
  sensitiveWarning: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 10, fontStyle: "italic" },
  emptyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, textAlign: "center", marginTop: 40 },
});
