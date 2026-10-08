import AppBackground from "./AppBackground";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Platform,
  Pressable,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { AppTheme } from "../constants/theme";


interface AppOpeningScreenProps {
  onFinish?: () => void;
}

export default function AppOpeningScreen({ onFinish }: AppOpeningScreenProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const [activeDot, setActiveDot] = useState(0);
  const finishedRef = useRef(false);

  // Inject Google Fonts for authentic cursive script on web
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const fontId = "google-fonts-malikse-cursive";
      if (!document.getElementById(fontId)) {
        const link = document.createElement("link");
        link.id = fontId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Kalam:wght@400;700&display=swap";
        document.head.appendChild(link);
      }
    }
  }, []);

  const finishAndDismiss = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    // Smoothly fade out the overlay
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      onFinish?.();
    });
  };

  useEffect(() => {
    // Fade in content
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Animate active progress bar from 0 to 1 over ~2.2 seconds
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setTimeout(() => {
          finishAndDismiss();
        }, 150);
      }
    });

    // Cycle progress dots
    const dotInterval = setInterval(() => {
      setActiveDot((prev) => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(dotInterval);
  }, []);

  // Interpolate progress width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
      <Pressable style={styles.pressableContainer} onPress={finishAndDismiss}>
        <AppBackground />

        {/* 3. Top-Right Cursive Handwriting with Green Curved Swoosh */}
        <View style={styles.topRightCursiveWrap}>
          <Text style={styles.topRightCursiveText}>
            Your Land.{"\n"}A Safer Future.
          </Text>
          <Svg width="88" height="14" viewBox="0 0 88 14" style={styles.cursiveSwoosh}>
            <Path
              d="M 2 4 Q 44 14 86 2"
              stroke={AppTheme.colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </View>

        {/* 4. Center Brand & Active Loading Area */}
        <Animated.View style={[styles.centerContent, { opacity: contentFadeAnim }]}>
          {/* App Logo Squircle */}
          <View style={styles.logoSquircle}>
            <Svg viewBox="0 0 44 48" width={46} height={50}>
              {/* White outer shield */}
              <Path
                d="M22 2 L40 9 V22 C40 33 22 45 22 45 C22 45 4 33 4 22 V9 Z"
                fill="#FFFFFF"
              />
              {/* Inner green brand leaf / sprout cutout */}
              <Path
                d="M22 9 C22 9 32 15 32 23 C32 29 22 37 22 37 C22 37 17 31 17 24 C17 17 22 9 22 9 Z"
                fill="#047857"
              />
            </Svg>
          </View>

          {/* Brand Name */}
          <View style={styles.brandNameRow}>
            <Text style={styles.brandNameBlack}>Malik</Text>
            <Text style={styles.brandNameGreen}>Se</Text>
          </View>

          {/* Tagline */}
          <Text style={styles.brandTagline}>Your Land. A Safer Future.</Text>

          {/* Active Loading Bar */}
          <View style={styles.loadingBarTrack}>
            <Animated.View
              style={[
                styles.loadingBarProgress,
                { width: progressWidth },
              ]}
            />
          </View>

          {/* Loading text */}
          <Text style={styles.loadingStatusText}>Loading your experience...</Text>

          {/* 4 Pagination / Progress Dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((dotIndex) => {
              const isDotActive = activeDot === dotIndex;
              return (
                <View
                  key={dotIndex}
                  style={[
                    styles.dot,
                    isDotActive ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>

          {/* 3 Pillars Feature Row */}
          <View style={styles.pillarsRow}>
            {/* Pillar 1: Buy Smarter */}
            <View style={styles.pillarItem}>
              <View style={styles.pillarIconBox}>
                <MaterialIcons name="home" size={19} color={AppTheme.colors.primary} />
              </View>
              <Text style={styles.pillarLabel}>Buy Smarter</Text>
            </View>

            {/* Vertical Divider */}
            <View style={styles.pillarDivider} />

            {/* Pillar 2: Deal Safer */}
            <View style={styles.pillarItem}>
              <View style={styles.pillarIconBox}>
                <MaterialIcons name="verified-user" size={18} color={AppTheme.colors.primary} />
              </View>
              <Text style={styles.pillarLabel}>Deal Safer</Text>
            </View>

            {/* Vertical Divider */}
            <View style={styles.pillarDivider} />

            {/* Pillar 3: Grow Together */}
            <View style={styles.pillarItem}>
              <View style={styles.pillarIconBox}>
                <MaterialIcons name="groups" size={19} color={AppTheme.colors.primary} />
              </View>
              <Text style={styles.pillarLabel}>Grow Together</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: "transparent",
  },
  pressableContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },

  /* Top Right Cursive Script & Swoosh */
  topRightCursiveWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    right: 20,
    zIndex: 10,
    alignItems: "flex-end",
  },
  topRightCursiveText: {
    fontFamily: Platform.OS === "web" ? "Caveat, Kalam, 'Segoe Script', cursive" : (Platform.OS === "ios" ? "Snell Roundhand" : "serif"),
    fontSize: 20,
    lineHeight: 22,
    color: "#166534",
    fontStyle: "italic",
    fontWeight: "700",
    textAlign: "right",
    transform: [{ rotate: "-8deg" }],
  },
  cursiveSwoosh: {
    marginTop: 2,
    marginRight: 4,
    transform: [{ rotate: "-8deg" }],
  },

  /* Center Brand & Loading Content */
  centerContent: {
    position: "absolute",
    top: "23%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
    paddingHorizontal: 20,
  },
  logoSquircle: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: "#047857",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: AppTheme.colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  brandNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandNameBlack: {
    fontSize: 36,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  brandNameGreen: {
    fontSize: 36,
    fontWeight: "900",
    color: "#059669",
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#475569",
    letterSpacing: 0.2,
    marginTop: 4,
    marginBottom: 24,
  },

  /* Active Loading Bar */
  loadingBarTrack: {
    width: 230,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.colors.primaryLight,
    overflow: "hidden",
    position: "relative",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  loadingBarProgress: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: AppTheme.colors.primary,
  },
  loadingStatusText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
    marginTop: 10,
    letterSpacing: 0.2,
  },

  /* 4 Progress Dots */
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    marginBottom: 22,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.colors.primary,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppTheme.colors.primaryLight,
  },

  /* 3 Pillars Feature Row */
  pillarsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    paddingHorizontal: 12,
  },
  pillarItem: {
    alignItems: "center",
    minWidth: 80,
  },
  pillarIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(230, 244, 234, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(167, 243, 208, 0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pillarLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 7,
    textAlign: "center",
  },
  pillarDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(148, 163, 184, 0.4)",
    marginHorizontal: 16,
    marginBottom: 10,
  },
});
