import { renderAppScreen } from "../components/AppScreen";
import React, { useState, useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, LogBox, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";
import AppOpeningScreen from "../components/AppOpeningScreen";
import { useAuthStore } from "../src/store/authStore";
import { authService } from "../src/services/authService";

import AppBackground from "../components/AppBackground";
import { hydrateResume, resumeTabs, useResumeStore } from "../src/store/resumeStore";
import { preloadStartupResources } from "../src/services/startupPreload";
import { cachedMapAssets, preloadMapAssets } from "../src/services/mapAssets";
import { observePushOpens, registerPushDevice } from "../src/services/pushNotifications";

LogBox.ignoreLogs([
  '"shadow*" style props are deprecated. Use "boxShadow".',
  '"textShadow*" style props are deprecated. Use "textShadow".',
  "props.pointerEvents is deprecated. Use style.pointerEvents",
  "Animated: `useNativeDriver` is not supported",
]);

if (Platform.OS === "web" && typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes('"shadow*" style props are deprecated') ||
      msg.includes('"textShadow*" style props are deprecated') ||
      msg.includes("props.pointerEvents is deprecated") ||
      msg.includes("useNativeDriver")
    ) {
      return;
    }
    originalWarn(...args);
  };
}

// Prevent native splash screen from auto hiding before JS initializes
SplashScreen.preventAutoHideAsync().catch(() => {});

if (Platform.OS === "web" && typeof window !== "undefined") {
  const id = "leaflet-css";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
}

let openingCompleted = false;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PoppinsRegular: require("../assets/fonts/Poppins-Regular.ttf"),
    PoppinsMedium: require("../assets/fonts/Poppins-Medium.ttf"),
    PoppinsSemiBold: require("../assets/fonts/Poppins-SemiBold.ttf"),
    PoppinsBold: require("../assets/fonts/Poppins-Bold.ttf"),
  });
  const [showOpeningScreen, setShowOpeningScreen] = useState(!openingCompleted);
  const hydrated = useAuthStore(state => state.hydrated);
  const userId = useAuthStore(state => state.user?.id);
  const accessToken = useAuthStore(state => state.accessToken);
  const router = useRouter();
  const pathname = usePathname();
  const [resumeReady, setResumeReady] = useState(Platform.OS === "web");
  useEffect(() => { hydrateResume().finally(() => setResumeReady(true)); }, []);
  useEffect(() => {
    if (Platform.OS === "web") return;
    void preloadStartupResources();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active" && !cachedMapAssets()) preloadMapAssets().catch(() => {});
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (resumeReady && Platform.OS !== "web" && resumeTabs.includes(pathname as typeof resumeTabs[number])) {
      useResumeStore.getState().setTab(pathname as typeof resumeTabs[number]);
    }
  }, [pathname, resumeReady]);

  useEffect(() => {
    useAuthStore.getState().hydrateSession().then(() => {
      if (useAuthStore.getState().accessToken) authService.getMe().catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !userId || !accessToken || Platform.OS === "web") return;
    void registerPushDevice(userId);
    let active = true;
    let dispose: (() => void) | undefined;
    void observePushOpens((kind, id) => {
      if (kind === "inquiry") router.push({ pathname: "/(tabs)/messages", params: { inquiryId: id } });
      else router.push(`/deal/${id}` as Href);
    }).then(stop => { if (active) dispose = stop; else stop(); })
      .catch(error => console.warn("Could not observe push notifications", error));
    return () => { active = false; dispose?.(); };
  }, [hydrated, userId, accessToken, router]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && resumeReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError, resumeReady]);

  if ((!fontsLoaded && !fontError) || !resumeReady) return null;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: "transparent" }}>
      <AppBackground />
      <Stack screenLayout={renderAppScreen} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="property/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="listing/create" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="deal/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="kyc" options={{ headerShown: false }} />
        <Stack.Screen name="insights" options={{ headerShown: false }} />
        <Stack.Screen name="advisor" options={{ headerShown: false }} />
        <Stack.Screen name="verifier" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      <StatusBar style="dark" />

      {/* Opening screen with active loading bar */}
      {showOpeningScreen && (
        <AppOpeningScreen ready={hydrated} onFinish={() => { openingCompleted = true; setShowOpeningScreen(false); }} />
      )}
    </SafeAreaProvider>
  );
}
