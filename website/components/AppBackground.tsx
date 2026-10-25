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
          background: "linear-gradient(180deg, #D5E8FA 0%, #E2F0FC 22%, #EEF6FD 45%, #F7FAFE 70%, #FFFFFF 100%)",
        }}
      >
        {/* Ambient Radiant Sunburst in Top-Right */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "5%",
            width: "60vw",
            height: "60vw",
            maxWidth: "800px",
            maxHeight: "800px",
            background: "radial-gradient(circle, rgba(186, 224, 253, 0.55) 0%, rgba(224, 242, 254, 0.25) 45%, rgba(255, 255, 255, 0) 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        {/* Ambient Soft Cyan Aura in Top-Left */}
        <div
          style={{
            position: "absolute",
            top: "5%",
            left: "-5%",
            width: "45vw",
            height: "45vw",
            maxWidth: "600px",
            maxHeight: "600px",
            background: "radial-gradient(circle, rgba(207, 233, 254, 0.45) 0%, rgba(255, 255, 255, 0) 65%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />

        {/* Elegant Organic Waves at Bottom */}
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "32%",
            display: "block",
            opacity: 0.65,
          }}
        >
          <defs>
            <linearGradient id="waveGradTop" x1="0" y1="0" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#C3E0FA" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#D2E8FC" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#B6DAF8" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="waveGradBottom" x1="0" y1="0" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#9BCBF3" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#87BDEB" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#76B0E3" stopOpacity="0.65" />
            </linearGradient>
          </defs>

          {/* Upper Soft Wave */}
          <path
            d="M0,140 C320,80 620,180 980,120 C1200,80 1340,140 1440,125 L1440,320 L0,320 Z"
            fill="url(#waveGradTop)"
          />

          {/* Lower Deep Blue Wave */}
          <path
            d="M0,210 C280,160 600,240 990,185 C1220,150 1350,195 1440,190 L1440,320 L0,320 Z"
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
