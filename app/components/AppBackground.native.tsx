import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";

// Match the web palette and wave paths without browser-only CSS or SVG tags.
export default function AppBackground() {
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
    <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs><LinearGradient id="background" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#C2DCF6" /><Stop offset="26%" stopColor="#D8EAFC" />
        <Stop offset="50%" stopColor="#E9F3FC" /><Stop offset="64%" stopColor="#EDF5FD" />
        <Stop offset="74%" stopColor="#E2EFF9" /><Stop offset="88%" stopColor="#C7E0F4" />
        <Stop offset="100%" stopColor="#B4D5EF" />
      </LinearGradient></Defs>
      <Rect width="100" height="100" fill="url(#background)" />
    </Svg>
    <View style={{ position: "absolute", bottom: 0, width: "100%", height: "46%" }}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 380" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="top" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#CDE5FA" stopOpacity="0.85" /><Stop offset="50%" stopColor="#BEDDF6" stopOpacity="0.75" /><Stop offset="100%" stopColor="#A8CEEE" stopOpacity="0.9" />
          </LinearGradient>
          <LinearGradient id="bottom" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#A4CDEC" stopOpacity="0.95" /><Stop offset="50%" stopColor="#87BCE4" stopOpacity="0.9" /><Stop offset="100%" stopColor="#6DA8DA" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>
        <Path d="M0,130 C320,60 540,190 920,110 C1200,50 1340,140 1440,120 L1440,380 L0,380 Z" fill="url(#top)" />
        <Path d="M0,230 C260,170 580,290 960,200 C1240,130 1380,240 1440,220 L1440,380 L0,380 Z" fill="url(#bottom)" />
      </Svg>
    </View>
  </View>;
}
