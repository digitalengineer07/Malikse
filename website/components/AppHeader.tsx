import React from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguageStore } from "../src/store/languageStore";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  fallbackRoute?: string;
  rightElement?: React.ReactNode;
  showLanguageToggle?: boolean;
  showNavLinks?: boolean;
  showPostPropertyBtn?: boolean;
  showHomeButton?: boolean;
}

export default function AppHeader(props: AppHeaderProps) {
  const { language, toggleLanguage } = useLanguageStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const showBack = props.showBack ?? (!["/home", "/", "/search"].includes(pathname));

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.headerInner}>
        {/* Left: Back button or MalikSe Logo */}
        <View style={styles.leftContainer}>
          {showBack && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}
              onPress={() => {
                if (props.onBackPress) props.onBackPress();
                else if (router.canGoBack()) router.back();
                else router.replace((props.fallbackRoute || "/home") as any);
              }}
            >
              <MaterialIcons name="arrow-back" size={22} color="#0A192F" />
            </TouchableOpacity>
          )}

          {/* Logo with House Roof & Window Squares */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.replace("/home")}
            activeOpacity={0.8}
            style={styles.logoRow}
          >
            {Platform.OS === "web" ? (
              <svg width="32" height="32" viewBox="0 0 32 32" style={{ display: "block" }}>
                {/* Roof Gable with Chimney */}
                <path d="M3,16 L16,5 L29,16 L25.5,16 L16,8.2 L6.5,16 Z" fill="#03456C" />
                <rect x="22" y="7" width="3" height="6" fill="#03456C" rx="0.5" />
                {/* Window Four-Square Grid */}
                <rect x="8" y="18" width="6.5" height="5.5" fill="#0284C7" rx="0.8" />
                <rect x="16.5" y="18" width="6.5" height="5.5" fill="#0284C7" rx="0.8" />
                <rect x="8" y="24.8" width="6.5" height="5" fill="#38BDF8" rx="0.8" />
                <rect x="16.5" y="24.8" width="6.5" height="5" fill="#38BDF8" rx="0.8" />
              </svg>
            ) : (
              <MaterialIcons name="home" size={28} color="#03456C" />
            )}
            <Text style={styles.brandTitle}>MalikSe</Text>
          </TouchableOpacity>
        </View>

        {/* Right Element: Language Toggle ("हिन्दी") */}
        <View style={styles.rightContainer}>
          {props.rightElement ||
            (props.showLanguageToggle !== false && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={language === "en" ? "Switch to Hindi" : "Switch to English"}
                onPress={toggleLanguage}
                style={styles.langBtn}
              >
                <Text style={styles.langText}>
                  {language === "en" ? "हिन्दी" : "English"}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    width: "100%",
    backgroundColor: "transparent",
    paddingBottom: 10,
    paddingHorizontal: 28,
    zIndex: 20,
  },
  headerInner: {
    maxWidth: 1340,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  langText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A192F",
  },
});
