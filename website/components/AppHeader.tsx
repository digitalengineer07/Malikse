import React from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguageStore } from "../src/store/languageStore";
import { useAuthStore } from "../src/store/authStore";

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
  const { authState, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const showNavLinks = props.showNavLinks ?? isDesktop;
  const showPostProperty = props.showPostPropertyBtn ?? isDesktop;

  const showBack = props.showBack ?? (!["/home", "/", "/search"].includes(pathname));

  const isHomeActive = pathname === "/home" || pathname === "/";
  const isSearchActive = pathname === "/search";
  const isSavedActive = pathname === "/saved";
  const isMessagesActive = pathname === "/messages";

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.headerInner}>
        {/* Left: Back button + MalikSe Logo */}
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
              <MaterialIcons name="arrow-back" size={20} color="#0A192F" />
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
                <path d="M3,16 L16,5 L29,16 L25.5,16 L16,8.2 L6.5,16 Z" fill="#03456C" />
                <rect x="22" y="7" width="3" height="6" fill="#03456C" rx="0.5" />
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

        {/* Center: Desktop Website Navigation Links */}
        {showNavLinks && (
          <View style={styles.navLinksRow}>
            <TouchableOpacity
              style={[styles.navLink, isHomeActive && styles.navLinkActive]}
              onPress={() => router.replace("/home")}
              activeOpacity={0.7}
            >
              <Text style={[styles.navLinkText, isHomeActive && styles.navLinkTextActive]}>
                {language === "hi" ? "होम" : "Home"}
              </Text>
              {isHomeActive && <View style={styles.navActiveDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navLink, isSearchActive && styles.navLinkActive]}
              onPress={() => router.replace("/search")}
              activeOpacity={0.7}
            >
              <Text style={[styles.navLinkText, isSearchActive && styles.navLinkTextActive]}>
                {language === "hi" ? "एक्सप्लोर" : "Explore"}
              </Text>
              {isSearchActive && <View style={styles.navActiveDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navLink, isSavedActive && styles.navLinkActive]}
              onPress={() => router.push("/saved")}
              activeOpacity={0.7}
            >
              <Text style={[styles.navLinkText, isSavedActive && styles.navLinkTextActive]}>
                {language === "hi" ? "सहेजे गए" : "Saved"}
              </Text>
              {isSavedActive && <View style={styles.navActiveDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navLink, isMessagesActive && styles.navLinkActive]}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/messages" : "/login")}
              activeOpacity={0.7}
            >
              <Text style={[styles.navLinkText, isMessagesActive && styles.navLinkTextActive]}>
                {language === "hi" ? "संदेश" : "Messages"}
              </Text>
              {isMessagesActive && <View style={styles.navActiveDot} />}
            </TouchableOpacity>
          </View>
        )}

        {/* Right Element: Post Button, Profile, Language Toggle */}
        <View style={styles.rightContainer}>
          {showPostProperty && (
            <TouchableOpacity
              style={styles.postBtn}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/listing/create" : "/login")}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.postBtnText}>
                {language === "hi" ? "प्रॉपर्टी पोस्ट करें" : "Post Property"}
              </Text>
            </TouchableOpacity>
          )}

          {isDesktop && (
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/profile" : "/login")}
              activeOpacity={0.8}
            >
              <MaterialIcons name="account-circle" size={22} color="#03456C" />
              <Text style={styles.profileBtnText}>
                {authState === "AUTHENTICATED" ? (user?.name?.split(" ")[0] || "Account") : (language === "hi" ? "लॉग इन" : "Sign In")}
              </Text>
            </TouchableOpacity>
          )}

          {props.rightElement ||
            (props.showLanguageToggle !== false && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={language === "en" ? "Switch to Hindi" : "Switch to English"}
                onPress={toggleLanguage}
                style={styles.langBtn}
                activeOpacity={0.75}
              >
                <MaterialIcons name="translate" size={16} color="#03456C" style={{ marginRight: 4 }} />
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
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  navLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  navLink: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    position: "relative",
    alignItems: "center",
  },
  navLinkActive: {},
  navLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    letterSpacing: -0.2,
  },
  navLinkTextActive: {
    color: "#03456C",
    fontWeight: "800",
  },
  navActiveDot: {
    position: "absolute",
    bottom: -4,
    width: 16,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#03456C",
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#03456C",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  postBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  profileBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A192F",
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  langText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A192F",
  },
});
