import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { GlassBackdrop } from "./GlassSurface";

// Each navigation scene owns an opaque backdrop, including during transitions.
export default function AppScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <GlassBackdrop><View style={styles.content}>{children}</View></GlassBackdrop>
    </View>
  );
}

export function renderAppScreen({ children }: { children: ReactNode }) {
  return <AppScreen>{children}</AppScreen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#F4F6F9" },
  content: { flex: 1, position: "relative" },
});
