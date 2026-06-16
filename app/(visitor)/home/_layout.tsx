import { Stack } from "expo-router";

// Zone "home" du visiteur : Calendrier / Créneaux / Nuits / Infos / Partager.
// Pas de barre d'onglets ici — chaque écran rend son propre <SpaceHeader>
// (logo, infos hôpital, rangée d'onglets) et navigue via router.replace.
export default function VisitorHomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
