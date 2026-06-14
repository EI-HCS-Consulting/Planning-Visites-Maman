import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, Share } from "react-native";
import { useVisitorSpace } from "@/lib/VisitorContext";
import { themes } from "@/lib/themes";

export default function VisitorInfoScreen() {
  const { space } = useVisitorSpace();
  const C = themes[space?.theme ?? "blue"];

  if (!space) return null;

  const rules = (space.visit_rules || "").split("\n").filter(Boolean);
  const notes = (space.admin_notes || "").trim();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={styles.scroll}>
      {/* Patient card */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.gold }]}>Patient</Text>
        <Text style={[styles.patientName, { color: "#fff" }]}>
          {space.patient_firstname} {space.patient_lastname}
        </Text>
      </View>

      {/* Hospital */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.gold }]}>📍 Hôpital</Text>
        <Text style={[styles.bodyText, { color: C.text }]}>{space.hospital_name}</Text>
        {space.hospital_service ? (
          <Text style={[styles.mutedText, { color: C.muted }]}>{space.hospital_service}</Text>
        ) : null}
        {space.hospital_room ? (
          <Text style={[styles.mutedText, { color: C.muted }]}>{space.hospital_room}</Text>
        ) : null}
        {space.hospital_address ? (
          <Text style={[styles.mutedText, { color: C.muted }]}>{space.hospital_address}</Text>
        ) : null}
        {space.hospital_maps_url ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(space.hospital_maps_url)}
            style={{ marginTop: 10 }}
          >
            <Text style={[styles.link, { color: C.accent }]}>Ouvrir dans Google Maps →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32, paddingTop: 56 },
  card: { borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 12 },
  sectionLabel: { fontFamily: "DM_Sans_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  patientName: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22 },
  bodyText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22 },
  mutedText: { fontFamily: "DM_Sans_400Regular", fontSize: 13, lineHeight: 20, marginTop: 2 },
  link: { fontFamily: "DM_Sans_600SemiBold", fontSize: 13 },
  ruleRow: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  ruleBullet: { fontFamily: "DM_Sans_700Bold", fontSize: 16, lineHeight: 22 },
  ruleText: { fontFamily: "DM_Sans_400Regular", fontSize: 14, lineHeight: 22, flex: 1 },
  sensitiveWarning: { fontFamily: "DM_Sans_400Regular", fontSize: 11, marginTop: 10, fontStyle: "italic" },
});
