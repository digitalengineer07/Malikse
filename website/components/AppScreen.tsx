import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import AppBackground from "./AppBackground";

// Each navigation scene owns an opaque backdrop, including during transitions.
export default function AppScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <AppBackground />
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
