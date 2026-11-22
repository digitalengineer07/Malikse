import React from "react";
import { Platform, StyleSheet, View } from "react-native";

export default function AppBackground() {
  if (Platform.OS === "web") {
    return (
      <div className="ms-bg" aria-hidden="true">
        <div className="stage" style={{ opacity: 0.4 }}>
          <b className="a1"><i /></b>
          <b className="a2"><i /></b>
          <b className="a3"><i /></b>
          <b className="a4"><i /></b>
        </div>
      </div>
    );
  }

  return (
    <View accessible={false} style={[styles.nativeBackground, { pointerEvents: "none", opacity: 0.4 }]}>
      <View style={styles.arrowBack} />
      <View style={styles.arrowFront} />
      <View style={styles.floorWedge} />
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
    backgroundColor: "#f2f6ff",
    overflow: "hidden",
  },
  arrowBack: {
    position: "absolute",
    top: -50,
    right: -80,
    width: 260,
    height: 380,
    backgroundColor: "#07467d",
    transform: [{ rotate: "-24deg" }],
    borderRadius: 36,
    opacity: 0.85,
  },
  arrowFront: {
    position: "absolute",
    top: 40,
    right: -40,
    width: 220,
    height: 340,
    backgroundColor: "#14a0dc",
    transform: [{ rotate: "-24deg" }],
    borderRadius: 32,
    opacity: 0.9,
  },
  floorWedge: {
    position: "absolute",
    bottom: -60,
    right: -30,
    width: 280,
    height: 200,
    backgroundColor: "#0a62a2",
    transform: [{ rotate: "18deg" }],
    borderRadius: 30,
    opacity: 0.75,
  },
});
