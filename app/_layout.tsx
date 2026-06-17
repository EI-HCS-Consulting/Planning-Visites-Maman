import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import {
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular,
} from "@expo-google-fonts/playfair-display";

export default function RootLayout() {
  // Clés explicites avec underscore ("DM_Sans_...") pour matcher les noms de
  // famille déjà référencés dans tous les StyleSheets — les exports du
  // package utilisent "DMSans_..." (sans underscore après DM).
  const [fontsLoaded, fontError] = useFonts({
    DM_Sans_400Regular: DMSans_400Regular,
    DM_Sans_600SemiBold: DMSans_600SemiBold,
    DM_Sans_700Bold: DMSans_700Bold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular,
  });

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: "#0D1B2E" }} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(visitor)" />
      </Stack>
    </>
  );
}
