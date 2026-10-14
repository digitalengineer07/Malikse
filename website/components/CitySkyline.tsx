import React from "react";
import { View, Image, Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

interface CitySkylineProps {
  width?: number | string;
  height?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

const skylineAsset = require("../assets/city_skyline_hero.png");

export default function CitySkyline({
  width = 540,
  height = 155,
  opacity = 0.95,
  style,
}: CitySkylineProps) {
  if (Platform.OS === "web") {
    let resolvedUri = "";
    try {
      const source = Image.resolveAssetSource(skylineAsset);
      resolvedUri = source?.uri || "";
    } catch {
      resolvedUri = typeof skylineAsset === "string" ? skylineAsset : skylineAsset?.uri || "";
    }

    return (
      <div
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          height: `${height}px`,
          position: "relative",
          overflow: "hidden",
          pointerEvents: "none",
          opacity,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-end",
          ...(style as any),
        }}
      >
        {/* Photographic Skyline with Feathered Left & Bottom Fade Masks */}
        <img
          src={resolvedUri}
          alt="MalikSe City Skyline"
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "right 35%",
            display: "block",
            // Proper feathered edge effects around the image matching the reference:
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.05) 10%, rgba(0, 0, 0, 0.45) 30%, rgba(0, 0, 0, 0.9) 55%, #000 78%), linear-gradient(to bottom, #000 68%, rgba(0, 0, 0, 0.4) 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.05) 10%, rgba(0, 0, 0, 0.45) 30%, rgba(0, 0, 0, 0.9) 55%, #000 78%), linear-gradient(to bottom, #000 68%, rgba(0, 0, 0, 0.4) 88%, transparent 100%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
            filter: "contrast(1.02) brightness(1.02) saturate(0.92)",
          }}
        />

        {/* Soft atmospheric mist / sky gradient overlay for seamless blending into MalikSe sky */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to right, rgba(235, 245, 253, 0.85) 0%, rgba(217, 238, 252, 0.3) 38%, transparent 72%)",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />

        {/* Subtle lower mist blending towards the white main container */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "28%",
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(238, 247, 254, 0.5) 60%, rgba(255, 255, 255, 0.8) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  // React Native Native Fallback
  return (
    <View style={[styles.container, { width: width as any, height, opacity }, style]}>
      <Image source={skylineAsset} style={styles.image} resizeMode="cover" />
      <View style={styles.leftFade} />
      <View style={styles.bottomFade} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  leftFade: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "45%",
    backgroundColor: "rgba(235, 245, 253, 0.6)",
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "25%",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
});
