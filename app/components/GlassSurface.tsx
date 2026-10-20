import React, { createContext, useContext, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurTargetView, BlurView, type BlurViewProps } from "expo-blur";
import AppBackground from "./AppBackground";

const GlassTarget = createContext<React.RefObject<View | null> | undefined>(undefined);

/** Only capture the backdrop, never a glass surface sampling itself. */
export function GlassBackdrop({ children, androidOnly = false }: { children: ReactNode; androidOnly?: boolean }) {
  const target = useRef<View>(null);
  if (androidOnly && Platform.OS !== "android") return <>{children}</>;
  return <GlassTarget.Provider value={target}>
    {Platform.OS === "android"
      ? <BlurTargetView ref={target} pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}><AppBackground /></BlurTargetView>
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
