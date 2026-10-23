import { renderAppScreen } from "../components/AppScreen";
import React, { useState, useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";
import AppOpeningScreen from "../components/AppOpeningScreen";
import { useAuthStore } from "../src/store/authStore";
import { authService } from "../src/services/authService";

import AppBackground from "../components/AppBackground";

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
  const fontId = "google-fonts-malikse";
  if (!document.getElementById(fontId)) {
    const link = document.createElement("link");
    link.id = fontId;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }

  const styleOverrideId = "google-maps-attribution-override";
  if (!document.getElementById(styleOverrideId)) {
    const style = document.createElement("style");
    style.id = styleOverrideId;
    style.innerHTML = `
      .leaflet-control-attribution {
        background: rgba(255, 255, 255, 0.92) !important;
        font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
        font-size: 10.5px !important;
        color: #5F6368 !important;
        padding: 2px 8px !important;
        border-top-left-radius: 4px !important;
        border: 1px solid rgba(0,0,0,0.08) !important;
        border-right: none !important;
        border-bottom: none !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
      }
      .leaflet-control-attribution a {
        color: #1A73E8 !important;
        text-decoration: none !important;
      }
      .leaflet-control-attribution a:hover {
        text-decoration: underline !important;
      }
      .leaflet-control-attribution a[href*="leafletjs.com"],
      .leaflet-control-attribution a[href*="openstreetmap.org"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Preload Google Maps Platform JS SDK if API key is provided
  if (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    const mapsScriptId = "google-maps-js-sdk";
    if (!document.getElementById(mapsScriptId)) {
      const script = document.createElement("script");
      script.id = mapsScriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PoppinsRegular: require("../assets/fonts/Poppins-Regular.ttf"),
    PoppinsMedium: require("../assets/fonts/Poppins-Medium.ttf"),
    PoppinsSemiBold: require("../assets/fonts/Poppins-SemiBold.ttf"),
    PoppinsBold: require("../assets/fonts/Poppins-Bold.ttf"),
  });
  const [showOpeningScreen, setShowOpeningScreen] = useState(Platform.OS !== "web");
  const hydrated = useAuthStore(state => state.hydrated);

  useEffect(() => {
    useAuthStore.getState().hydrateSession().then(() => {
      if (useAuthStore.getState().accessToken) authService.getMe().catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: "transparent" }}>
      <AppBackground />
      <Stack screenLayout={renderAppScreen} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="property/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="listing/create" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="kyc" options={{ headerShown: false }} />
        <Stack.Screen name="insights" options={{ headerShown: false }} />
        <Stack.Screen name="advisor" options={{ headerShown: false }} />
        <Stack.Screen name="verifier" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      <StatusBar style="dark" />

      {/* Opening screen only on native mobile app */}
      {showOpeningScreen && (
        <AppOpeningScreen ready={hydrated} onFinish={() => setShowOpeningScreen(false)} />
      )}
    </SafeAreaProvider>
  );
}
