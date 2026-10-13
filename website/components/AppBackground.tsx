import React from "react";
import { Platform, StyleSheet, View } from "react-native";

export default function AppBackground() {
  if (Platform.OS === "web") {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          background: "linear-gradient(180deg, #C2DCF6 0%, #D8EAFC 26%, #E9F3FC 50%, #EDF5FD 64%, #E2EFF9 74%, #C7E0F4 88%, #B4D5EF 100%)",
        }}
      >
        {/* Upper Floating Wave Layer */}
        <svg
          viewBox="0 0 1440 380"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "46%",
            display: "block",
          }}
        >
          <defs>
            <linearGradient id="waveGradTop" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#CDE5FA" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#BEDDF6" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#A8CEEE" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="waveGradBottom" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A4CDEC" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#87BCE4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6DA8DA" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Upper Graceful Wave */}
          <path
            d="M0,130 C320,60 540,190 920,110 C1200,50 1340,140 1440,120 L1440,380 L0,380 Z"
            fill="url(#waveGradTop)"
          />

          {/* Lower Deep Blue Wave */}
          <path
            d="M0,230 C260,170 580,290 960,200 C1240,130 1380,240 1440,220 L1440,380 L0,380 Z"
            fill="url(#waveGradBottom)"
          />
        </svg>
      </div>
    );
  }

  return (
    <View pointerEvents="none" accessible={false} style={styles.nativeBackground}>
      <View style={styles.nativeWaveTop} />
      <View style={styles.nativeWaveBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  nativeBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#DCEAFC",
    overflow: "hidden",
  },
  nativeWaveTop: {
    position: "absolute",
    bottom: "16%",
    left: "-20%",
    width: "140%",
    height: "36%",
    borderTopLeftRadius: "50%",
    borderTopRightRadius: "50%",
    backgroundColor: "rgba(190, 221, 246, 0.8)",
  },
  nativeWaveBottom: {
    position: "absolute",
    bottom: 0,
    left: "-15%",
    width: "130%",
    height: "26%",
    borderTopLeftRadius: "45%",
    borderTopRightRadius: "45%",
    backgroundColor: "#87BCE4",
  },
});
