import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import AppBackground from "./AppBackground";

// Root layout provides single fixed AppBackground on web; native scenes render backdrop for transitions.
export default function AppScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      {Platform.OS !== "web" && <AppBackground />}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function renderAppScreen({ children }: { children: ReactNode }) {
  return <AppScreen>{children}</AppScreen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, position: "relative", overflow: "hidden", backgroundColor: "transparent" },
  content: { flex: 1, position: "relative", backgroundColor: "transparent" },
});
