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
          background: "linear-gradient(180deg, #C5DEF7 0%, #D8EAFC 22%, #EAF3FC 48%, #EDF5FD 62%, #E0EEF9 74%, #C7E0F4 88%, #B4D5EF 100%)",
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
            height: "44%",
            display: "block",
          }}
        >
          <defs>
            <linearGradient id="waveGradTop" x1="0" y1="0" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#CBE4FA" stopOpacity="0.88" />
              <stop offset="40%" stopColor="#D5ECFC" stopOpacity="0.8" />
              <stop offset="80%" stopColor="#BCE0F8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#A8CEEE" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="waveGradBottom" x1="0" y1="0" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#9DCBEF" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#82B9E3" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#6CA7DA" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Upper Graceful Wave */}
          <path
            d="M0,150 C340,95 620,210 1000,145 C1210,105 1340,165 1440,150 L1440,380 L0,380 Z"
            fill="url(#waveGradTop)"
          />

          {/* Lower Deep Blue Wave */}
          <path
            d="M0,245 C300,195 620,295 1020,225 C1240,180 1360,235 1440,225 L1440,380 L0,380 Z"
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
