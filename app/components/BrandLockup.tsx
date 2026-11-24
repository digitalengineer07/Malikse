import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export const brandHeader = { gap: 12, headingSize: 27, headingLineHeight: 32 };

export function BrandLockup({ style, lightBackground = false }: {
  style?: StyleProp<ViewStyle>;
  lightBackground?: boolean;
}) {
  return (
    <View style={[styles.row, style]}>
      <Image source={require("../assets/images/icon.png")} style={styles.logo} accessible={false} />
      <Text
        style={[styles.wordmark, lightBackground && styles.darkWordmark]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        MalikSe<Text style={styles.accent}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  logo: { width: 32, height: 32, borderRadius: 10 },
  wordmark: { fontFamily: "Fraunces", fontSize: 30, color: "#fff", flexShrink: 1 },
  darkWordmark: { color: "#14263E" },
  accent: { color: "#FCC61C" },
});
