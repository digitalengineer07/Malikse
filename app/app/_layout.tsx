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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PoppinsRegular: require("../assets/fonts/Poppins-Regular.ttf"),
    PoppinsMedium: require("../assets/fonts/Poppins-Medium.ttf"),
    PoppinsSemiBold: require("../assets/fonts/Poppins-SemiBold.ttf"),
    PoppinsBold: require("../assets/fonts/Poppins-Bold.ttf"),
  });
  const [showOpeningScreen, setShowOpeningScreen] = useState(true);

  useEffect(() => {
    // Hide native splash screen immediately so our scenic opening UI renders
    SplashScreen.hideAsync().catch(() => {});
    useAuthStore.getState().hydrateSession().then(() => {
      if (useAuthStore.getState().accessToken) authService.getMe().catch(() => {});
    });
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
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

      {/* Opening Screen with Scenic Image & Active Loading Bar */}
      {showOpeningScreen && (
        <AppOpeningScreen onFinish={() => setShowOpeningScreen(false)} />
      )}
    </SafeAreaProvider>
  );
}
