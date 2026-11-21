import React, { createContext, useContext, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, type ViewInstance } from "react-native";
import { BlurTargetView, BlurView, type BlurViewProps } from "expo-blur";
import AppBackground from "./AppBackground";

const GlassTarget = createContext<React.RefObject<ViewInstance | null> | undefined>(undefined);

/** Only capture the backdrop, never a glass surface sampling itself. */
export function GlassBackdrop({ children, androidOnly = false }: { children: ReactNode; androidOnly?: boolean }) {
  const target = useRef<ViewInstance>(null);
  if (androidOnly && Platform.OS !== "android") return <>{children}</>;
  return <GlassTarget.Provider value={target}>
    {Platform.OS === "android"
      ? <BlurTargetView ref={target} accessible={false} style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}><AppBackground /></BlurTargetView>
      : <AppBackground />}
    {children}
  </GlassTarget.Provider>;
}

export default function GlassSurface({ style, ...props }: BlurViewProps) {
  const target = useContext(GlassTarget);
  return <BlurView {...props}
    {...(Platform.OS === "android" && target ? { blurTarget: target, blurMethod: "dimezisBlurView" as const } : {})}
    style={[style, { overflow: "hidden" }]} />;
}
