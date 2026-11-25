import { BrandLockup, brandHeader } from "./BrandLockup";
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.replace("/home")}
            activeOpacity={0.8}
            style={styles.logoRow}
          >
            <BrandLockup lightBackground />
          </TouchableOpacity>
        </View>

        {/* Right Element: Compact language toggle */}
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
                  {language === "en" ? "H" : "E"}
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
    paddingBottom: brandHeader.gap,
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
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  langBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  langText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A192F",
  },
});
