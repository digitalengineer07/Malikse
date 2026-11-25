import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { GlassBackdrop } from "./GlassSurface";
import { marketplaceBackground } from "../constants/theme";

// Each navigation scene owns an opaque backdrop, including during transitions.
export default function AppScreen({ children, glass = true }: { children: ReactNode; glass?: boolean }) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "android" ? "height" : undefined}>
      {glass ? <GlassBackdrop>{content}</GlassBackdrop> : content}
    </KeyboardAvoidingView>
  );
}

export function renderAppScreen({ children }: { children: ReactNode }) {
  return <AppScreen>{children}</AppScreen>;
}

export function renderMarketplaceTab({ children }: { children: ReactNode }) {
  return <AppScreen glass={false}>{children}</AppScreen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, position: "relative", overflow: "hidden", backgroundColor: marketplaceBackground },
  content: { flex: 1, position: "relative", backgroundColor: "transparent" },
});
