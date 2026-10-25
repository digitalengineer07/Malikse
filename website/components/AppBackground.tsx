import React from "react";
import { Platform, StyleSheet, View, Image, useWindowDimensions } from "react-native";

export interface AppBackgroundProps {
  intensity?: "default" | "subtle" | "none";
  hideWatermarks?: boolean;
  hideWaves?: boolean;
}

const leftWatermarkAsset = require("../assets/malikse-left-bottom-watermark.png");
const rightWatermarkAsset = require("../assets/malikse-right-bottom-watermark.png");

export default function AppBackground({
  intensity = "default",
  hideWatermarks = false,
  hideWaves = false,
}: AppBackgroundProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const leftUri = React.useMemo(() => {
    try {
      const source = Image.resolveAssetSource(leftWatermarkAsset);
      return source?.uri || "/assets/assets/malikse-left-bottom-watermark.png";
    } catch {
      return "/assets/assets/malikse-left-bottom-watermark.png";
    }
  }, []);

  const rightUri = React.useMemo(() => {
    try {
      const source = Image.resolveAssetSource(rightWatermarkAsset);
      return source?.uri || "/assets/assets/malikse-right-bottom-watermark.png";
    } catch {
      return "/assets/assets/malikse-right-bottom-watermark.png";
    }
  }, []);

  const watermarkOpacity = intensity === "subtle"
    ? (isMobile ? 0.20 : 0.25)
    : (isMobile ? 0.30 : 0.38);

  if (Platform.OS === "web") {
    return (
      <div
        id="malikse-app-background"
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
          background: "linear-gradient(180deg, #DCEFFD 0%, #EFF7FE 48%, #FFFFFF 100%)",
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
            background: "radial-gradient(circle, rgba(186, 224, 253, 0.45) 0%, rgba(224, 242, 254, 0.18) 45%, rgba(255, 255, 255, 0) 70%)",
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
            background: "radial-gradient(circle, rgba(207, 233, 254, 0.40) 0%, rgba(255, 255, 255, 0) 65%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />

        {/* Layered Translucent Waves at Bottom */}
        {!hideWaves && (
          <svg
            viewBox="0 0 1440 380"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: isMobile ? "40%" : "46%",
              display: "block",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <defs>
              <linearGradient id="malikseWaveTop" x1="0" y1="0" x2="1" y2="0.8">
                <stop offset="0%" stopColor="#C8E2FA" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#D9ECFD" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#BDDCF8" stopOpacity="0.60" />
              </linearGradient>
              <linearGradient id="malikseWaveMid" x1="0" y1="0" x2="1" y2="0.8">
                <stop offset="0%" stopColor="#A8D5F6" stopOpacity="0.50" />
                <stop offset="50%" stopColor="#BFE0FA" stopOpacity="0.40" />
                <stop offset="100%" stopColor="#9ACDF3" stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="malikseWaveBot" x1="0" y1="0" x2="1" y2="0.8">
                <stop offset="0%" stopColor="#8AC6F2" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#A3D4F7" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#7ABCEF" stopOpacity="0.50" />
              </linearGradient>
            </defs>

            {/* Upper Sweeping Arch */}
            <path
              d="M0,135 C380,45 720,45 1060,130 C1240,175 1360,145 1440,115 L1440,380 L0,380 Z"
              fill="url(#malikseWaveTop)"
            />

            {/* Middle Translucent Wave */}
            <path
              d="M0,205 C340,135 700,210 1040,170 C1240,145 1360,190 1440,185 L1440,380 L0,380 Z"
              fill="url(#malikseWaveMid)"
            />

            {/* Lower Rolling Hills Wave */}
            <path
              d="M0,275 C300,235 640,290 1000,250 C1220,225 1350,265 1440,260 L1440,380 L0,380 Z"
              fill="url(#malikseWaveBot)"
            />
          </svg>
        )}

        {/* Left Bottom Architectural Watermark (India Gate, Taj Mahal, Trees, Birds) */}
        {!hideWatermarks && (
          <div
            id="malikse-left-watermark"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: isMobile ? "min(52vw, 240px)" : "min(36vw, 520px)",
              height: isMobile ? "min(22vh, 180px)" : "min(38vh, 360px)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-start",
              overflow: "hidden",
              opacity: watermarkOpacity,
              zIndex: 2,
            }}
          >
            <img
              src={leftUri}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = "true";
                  target.src = "/assets/malikse-left-bottom-watermark.png";
                }
              }}
              alt="MalikSe Heritage Watermark Left"
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "left bottom",
                display: "block",
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        {/* Right Bottom Architectural Watermark (Taj Mahal, Minaret, Palace, Trees, Birds) */}
        {!hideWatermarks && (
          <div
            id="malikse-right-watermark"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: isMobile ? "min(52vw, 240px)" : "min(36vw, 520px)",
              height: isMobile ? "min(22vh, 180px)" : "min(38vh, 360px)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              overflow: "hidden",
              opacity: watermarkOpacity,
              zIndex: 2,
            }}
          >
            <img
              src={rightUri}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = "true";
                  target.src = "/assets/malikse-right-bottom-watermark.png";
                }
              }}
              alt="MalikSe Heritage Watermark Right"
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
        )}
      </div>
    );
  }

  // Native iOS / Android Layout
  return (
    <View pointerEvents="none" accessible={false} style={styles.nativeBackground}>
      {!hideWaves && (
        <>
          <View style={styles.nativeWaveTop} />
          <View style={styles.nativeWaveMid} />
          <View style={styles.nativeWaveBottom} />
        </>
      )}

      {!hideWatermarks && (
        <>
          <View style={[styles.nativeLeftContainer, { opacity: watermarkOpacity }]} pointerEvents="none">
            <Image source={leftWatermarkAsset} style={styles.nativeWatermarkImg} resizeMode="contain" />
          </View>
          <View style={[styles.nativeRightContainer, { opacity: watermarkOpacity }]} pointerEvents="none">
            <Image source={rightWatermarkAsset} style={styles.nativeWatermarkImg} resizeMode="contain" />
          </View>
        </>
      )}
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
    backgroundColor: "#EDF7FE",
    overflow: "hidden",
  },
  nativeWaveTop: {
    position: "absolute",
    bottom: "22%",
    left: "-25%",
    width: "150%",
    height: "32%",
    borderTopLeftRadius: "50%",
    borderTopRightRadius: "50%",
    backgroundColor: "rgba(200, 226, 250, 0.5)",
  },
  nativeWaveMid: {
    position: "absolute",
    bottom: "12%",
    left: "-15%",
    width: "135%",
    height: "28%",
    borderTopLeftRadius: "48%",
    borderTopRightRadius: "48%",
    backgroundColor: "rgba(168, 213, 246, 0.45)",
  },
  nativeWaveBottom: {
    position: "absolute",
    bottom: 0,
    left: "-10%",
    width: "120%",
    height: "18%",
    borderTopLeftRadius: "45%",
    borderTopRightRadius: "45%",
    backgroundColor: "rgba(138, 198, 242, 0.4)",
  },
  nativeLeftContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "48%",
    height: 180,
    justifyContent: "flex-end",
  },
  nativeRightContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "48%",
    height: 180,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  nativeWatermarkImg: {
    width: "100%",
    height: "100%",
  },
});
