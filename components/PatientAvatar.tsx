import { View, Text, Image, StyleSheet } from "react-native";
import type { Theme } from "@/lib/themes";

interface Props {
  photoUrl: string | null | undefined;
  firstname: string;
  lastname: string;
  size?: number;
  C: Theme;
}

export default function PatientAvatar({ photoUrl, firstname, lastname, size = 42, C }: Props) {
  const initials = `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.photo,
          { width: size, height: size, borderRadius: size / 2, borderColor: C.gold },
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.initials,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${C.accent}33`,
          borderColor: C.gold,
        },
      ]}
    >
      <Text style={[styles.initialsText, { color: C.gold, fontSize: size * 0.36 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { borderWidth: 2 },
  initials: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  initialsText: { fontFamily: "PlayfairDisplay_700Bold" },
});
