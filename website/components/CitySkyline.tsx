import React from "react";
import { View, Image, Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

interface CitySkylineProps {
  width?: number | string;
  maxWidth?: number | string;
  height?: number | string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

const skylineAsset = require("../assets/city_skyline_hero.png");

export default function CitySkyline({
  width = "100%",
  maxWidth = 560,
  height = 160,
  opacity = 0.96,
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
          maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
          height: typeof height === "number" ? `${height}px` : height,
          position: "relative",
          pointerEvents: "none",
          opacity,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-end",
          ...(style as any),
        }}
      >
        <img
          src={resolvedUri}
          alt="MalikSe City Skyline"
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "right bottom",
            display: "block",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  // Native Fallback
  return (
    <View
      style={[
        styles.container,
        {
          width: width as any,
          maxWidth: maxWidth as any,
          height: height as any,
          opacity,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Image source={skylineAsset} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
