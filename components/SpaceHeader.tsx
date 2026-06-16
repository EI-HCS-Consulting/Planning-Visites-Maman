import { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, Modal } from "react-native";
import { useRouter } from "expo-router";
import type { PatientSpace } from "@/lib/types";
import type { Theme } from "@/lib/themes";

export type HomeTab = "calendar" | "slots" | "nights" | "info" | "share";

const TABS: { id: HomeTab; label: string }[] = [
  { id: "calendar", label: "📅 Calendrier" },
  { id: "slots", label: "🕐 Créneaux" },
  { id: "nights", label: "🌙 Nuits" },
  { id: "info", label: "ℹ️ Infos" },
  { id: "share", label: "📱 Partager" },
];

function googleMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * Bandeau partagé en haut de chaque écran de la zone "home" (Calendrier /
 * Créneaux / Nuits / Infos / Partager), admin et visiteur. Réplique le
 * header de la référence web (src/App.jsx) : logo + photo patient, titre,
 * ligne hôpital, adresse cliquable, rangée d'onglets.
 */
export default function SpaceHeader({
  space,
  active,
  basePath,
  C,
}: {
  space: PatientSpace;
  active: HomeTab;
  basePath: "/(visitor)/home" | "/(admin)/home";
  C: Theme;
}) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState(false);

  const infoParts = [space.hospital_service, space.hospital_sector, space.hospital_room]
    .filter((p): p is string => !!p && p.trim().length > 0);
  const infoLine = [infoParts.join(" | "), space.hospital_name].filter(Boolean).join(" · ");

  function openAddress() {
    const url = space.hospital_maps_url || (space.hospital_address ? googleMapsSearchUrl(space.hospital_address) : null);
    if (url) Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
      <TouchableOpacity onPress={() => setLightbox(true)} style={styles.logoWrap} activeOpacity={0.85}>
        {space.patient_photo_url ? (
          <>
            <Image source={{ uri: space.patient_photo_url }} style={styles.logoPhoto} resizeMode="cover" />
            {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
            <Image source={require("@/assets/icon-sans-512.png")} style={styles.logoFrame} resizeMode="contain" />
          </>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          <Image source={require("@/assets/icon.png")} style={styles.logoFrame} resizeMode="contain" />
        )}
      </TouchableOpacity>

      <Text style={[styles.title, { color: "#fff" }]}>
        Visites {space.patient_firstname}
      </Text>

      {!!infoLine && (
        <Text style={[styles.infoLine, { color: C.gold }]}>{infoLine}</Text>
      )}

      {!!space.hospital_address && (
        <TouchableOpacity onPress={openAddress} style={styles.addressRow}>
          <Text style={[styles.addressText, { color: C.accent }]}>📍 {space.hospital_address}</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.tabsRow, { borderTopColor: C.border }]}>
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={styles.tabBtn}
              onPress={() => router.replace(`${basePath}/${t.id}` as any)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? "#fff" : C.muted },
                  isActive && { borderBottomColor: C.accent, borderBottomWidth: 2 },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Lightbox photo patient ──────────────────────────────────────── */}
      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightbox(false)}>
          <View style={[styles.lightboxCircle, { borderColor: C.gold }]}>
            <Image
              source={space.patient_photo_url ? { uri: space.patient_photo_url } : require("@/assets/icon.png")}
              style={styles.lightboxImage}
              resizeMode="cover"
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 0,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    marginBottom: 8,
  },
  logoPhoto: {
    position: "absolute",
    top: "22%",
    left: "22%",
    width: "56%",
    height: "56%",
    borderRadius: 999,
  },
  logoFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    marginBottom: 2,
    textAlign: "center",
  },
  infoLine: {
    fontFamily: "DM_Sans_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 4,
  },
  addressRow: { marginBottom: 10 },
  addressText: { fontFamily: "DM_Sans_400Regular", fontSize: 12 },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
    borderTopWidth: 1,
  },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 10 },
  tabLabel: {
    fontFamily: "DM_Sans_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingBottom: 4,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  lightboxCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 4,
    overflow: "hidden",
  },
  lightboxImage: { width: "100%", height: "100%" },
});
