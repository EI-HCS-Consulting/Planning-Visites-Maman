import { Stack } from "expo-router";

// Zone "home" de l'admin : Calendrier / Créneaux / Nuits / Infos / Partager.
// Même pattern que app/(visitor)/home/_layout.tsx — pas de barre d'onglets
// ici, chaque écran rend son propre <SpaceHeader>.
export default function AdminHomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
