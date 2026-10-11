import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguageStore } from "../src/store/languageStore";
import AppBackground from "./AppBackground";

const villaPhoto = { uri: "https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTl8fHZpbGxhfGVufDB8fDB8fHww" };

export default function AppOpeningScreen({ onFinish, ready = true }: { onFinish?: () => void; ready?: boolean }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const language = useLanguageStore(state => state.language);
  const hi = language === "hi";
  const compact = height < 650;
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [sweep] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReducedMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    const timer = setTimeout(() => setMinimumElapsed(true), 2400);
    return () => { mounted = false; clearTimeout(timer); listener.remove(); };
  }, []);

  useEffect(() => {
    if (reducedMotion !== false) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, sweep]);

  useEffect(() => {
    if (!minimumElapsed || !ready) return;
    const animation = Animated.timing(opacity, { toValue: 0, duration: reducedMotion ? 0 : 350, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) finishRef.current?.(); });
    return () => animation.stop();
  }, [minimumElapsed, ready, reducedMotion, opacity]);

  return (
    <Animated.View testID="app-loading-screen" accessibilityViewIsModal style={[styles.overlay, { opacity, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <AppBackground />
      <View style={[styles.card, { height: Math.min(780, height - insets.top - insets.bottom - 32) }]}>
        <Image source={villaPhoto} resizeMode="cover" style={styles.photo} accessible={false} />
        <View pointerEvents="none" style={styles.tint} />
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><MaterialIcons name="wb-sunny" size={22} color="#26382F" /></View>
          <Text style={styles.brand}>MalikSe</Text>
        </View>
        <View style={styles.photoCaption}>
          <Text style={styles.eyebrow}>{hi ? "नई शुरुआत की ओर" : "THE START OF SOMETHING NEW"}</Text>
          <Text style={[styles.photoTitle, compact && styles.photoTitleCompact]}>{hi ? "सपनों का ठिकाना।\nअपना एक आशियाना।" : "Space to dream.\nRoom to grow."}</Text>
        </View>
        <View style={[styles.panel, compact && styles.panelCompact]}>
          <View style={styles.curve} />
          <View style={styles.smallMark}><MaterialIcons name="home" size={22} color="#52745D" /></View>
          <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>{hi ? "आपका अगला अध्याय।" : "Your next chapter."}</Text>
          <Text style={styles.description}>{hi ? "आपकी ज़मीन। सुरक्षित भविष्य।" : "Your land. A safer future."}</Text>
          <View accessibilityRole="progressbar" accessibilityLabel={hi ? "MalikSe लोड हो रहा है" : "Loading MalikSe"} accessibilityState={{ busy: true }} style={styles.track}>
            <Animated.View style={[styles.indicator, { transform: [{ translateX: reducedMotion ? 68 : sweep.interpolate({ inputRange: [0, 1], outputRange: [-64, 200] }) }] }]} />
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.loadingText}>{hi ? "आपके लिए सब तैयार कर रहे हैं…" : "Making you feel at home…"}</Text>
          {!compact && <View style={styles.footer}><View style={styles.dot} /><Text style={styles.footerText}>{hi ? "खोजें · जुड़ें · अपना बनाएं" : "DISCOVER  ·  CONNECT  ·  BELONG"}</Text></View>}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 100, backgroundColor: "#DCE8EF", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: { width: "100%", maxWidth: 460, borderRadius: 40, overflow: "hidden", backgroundColor: "#718E83", shadowColor: "#203A30", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 8 },
  photo: { position: "absolute", top: 0, left: 0, width: "100%", height: "76%" },
  tint: { position: "absolute", top: 0, left: 0, right: 0, height: "76%", backgroundColor: "rgba(13,32,27,0.27)" },
  brandRow: { position: "absolute", top: 26, left: 25, flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F9FBF4", alignItems: "center", justifyContent: "center" },
  brand: { color: "white", fontFamily: "PoppinsSemiBold", fontSize: 22, letterSpacing: -0.7 },
  photoCaption: { position: "absolute", bottom: "41%", left: 27, right: 20 },
  eyebrow: { color: "#F2F6EC", fontFamily: "PoppinsMedium", fontSize: 9, letterSpacing: 2, marginBottom: 12 },
  photoTitle: { color: "white", fontFamily: "PoppinsSemiBold", fontSize: 34, lineHeight: 43, letterSpacing: -1.1, textShadowColor: "rgba(0,0,0,0.25)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 },
  photoTitleCompact: { fontSize: 28, lineHeight: 35 },
  panel: { position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", backgroundColor: "#FEFFFC", alignItems: "center", paddingTop: 14, paddingHorizontal: 22 },
  panelCompact: { height: "37%", paddingTop: 4 },
  curve: { position: "absolute", top: -27, left: "-10%", width: "120%", height: 56, borderTopLeftRadius: "50%", borderTopRightRadius: "50%", backgroundColor: "#FEFFFC" },
  smallMark: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EFF3EA", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontFamily: "PoppinsSemiBold", color: "#2C382E", fontSize: 25, letterSpacing: -0.8 },
  titleCompact: { fontSize: 22 },
  description: { color: "#8A9287", fontFamily: "PoppinsRegular", fontSize: 12, marginTop: 5 },
  track: { width: 200, height: 4, borderRadius: 2, backgroundColor: "#E8EDE3", overflow: "hidden", marginTop: 24 },
  indicator: { height: 4, width: 64, borderRadius: 2, backgroundColor: "#718C60" },
  loadingText: { color: "#788571", fontFamily: "PoppinsRegular", fontSize: 10, marginTop: 12 },
  footer: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 22 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#8FA77E" },
  footerText: { color: "#A0A799", fontFamily: "PoppinsMedium", fontSize: 8, letterSpacing: 1.4 },
});
