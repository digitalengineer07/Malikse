import React, { useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import AppBackground from "./AppBackground";

/** Keep text readable even on platforms where native blur is unavailable. */
export default function FrostedChatBackground() {
  const target = useRef<View>(null);
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    {Platform.OS === "android" && <BlurTargetView ref={target} style={StyleSheet.absoluteFill}><AppBackground /></BlurTargetView>}
    <BlurView tint="light" intensity={55} {...(Platform.OS === "android" ? { blurMethod: "dimezisBlurViewSdk31Plus" as const, blurTarget: target } : {})}
      style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(232,243,252,0.60)" }]} />
  </View>;
}
