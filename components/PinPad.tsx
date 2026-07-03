import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Theme } from "@/lib/themes";

interface Props {
  value: string;
  onChange: (val: string) => void;
  maxLength?: number;
  theme: Theme;
  hasError?: boolean;
  reveal?: boolean;
}

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"] as const;

export default function PinPad({ value, onChange, maxLength = 4, theme: C, hasError = false, reveal = false }: Props) {
  function press(k: typeof KEYS[number]) {
    if (k === "⌫") {
      onChange(value.slice(0, -1));
    } else if (k !== "" && value.length < maxLength) {
      onChange(value + String(k));
    }
  }

  return (
    <View>
      {/* PIN display dots */}
      <View style={styles.dots}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: hasError
                  ? C.danger
                  : value.length > i
                  ? C.accent
                  : C.border,
                backgroundColor: C.bg,
              },
            ]}
          >
            <Text style={{ color: hasError ? C.danger : C.text, fontSize: 20, fontWeight: "700" }}>
              {value[i] ? (reveal ? value[i] : "●") : ""}
            </Text>
          </View>
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.grid}>
        {KEYS.map((k, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => press(k)}
            disabled={k === ""}
            activeOpacity={k === "" ? 1 : 0.7}
            style={[
              styles.key,
              {
                backgroundColor:
                  k === ""
                    ? "transparent"
                    : k === "⌫"
                    ? "rgba(233,69,96,0.1)"
                    : C.bg,
                borderColor:
                  k === ""
                    ? "transparent"
                    : k === "⌫"
                    ? "rgba(233,69,96,0.3)"
                    : C.border,
                borderWidth: k === "" ? 0 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.keyText,
                { color: k === "⌫" ? C.danger : C.text },
              ]}
            >
              {k}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  dot: {
    width: 48,
    height: 54,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  key: {
    width: "30%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
