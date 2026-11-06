import React from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "@/web/safeArea";
import { useRouter, usePathname } from "@/web/navigation";
import { MaterialIcons } from "@/web/icons";
import { useLanguageStore } from "../src/store/languageStore";
import { useAuthStore } from "../src/store/authStore";
import { useUserListingsStore } from "../src/store/userListingsStore";
import { dashboardRoutes } from "../src/utils/accountRoutes";

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
  const isDesktop = width >= 768;
  const showNavLinks = props.showNavLinks ?? isDesktop;
  const showPostProperty = props.showPostPropertyBtn ?? isDesktop;

  const showBack = props.showBack ?? (!["/home", "/", "/search"].includes(pathname));

  const isHomeActive = pathname === "/home" || pathname === "/";
  const isSearchActive = pathname === "/search";
  const isSavedActive = pathname === "/saved";
  const isMessagesActive = pathname === "/messages";
  const isMyListingsActive = pathname === "/my-properties" || pathname?.startsWith("/my-properties");
  const isDashboardActive = pathname === "/dashboard" || pathname?.startsWith("/dashboard");
  const isProfileActive = pathname === "/profile";
  const isKycActive = pathname === "/kyc";

  const { hasListings, checkUserListings } = useUserListingsStore();

  React.useEffect(() => {
    if (authState === "AUTHENTICATED" && user?.id && user?.role === "user") {
      void checkUserListings(user.id, user.role);
    }
  }, [authState, user?.id, user?.role, checkUserListings]);

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

            <TouchableOpacity
              style={[styles.navLink, isKycActive && styles.navLinkActive]}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/kyc" : "/login")}
              activeOpacity={0.7}
            >
              <Text style={[styles.navLinkText, isKycActive && styles.navLinkTextActive]}>
                {language === "hi" ? "सत्यापन (KYC)" : "Trust & KYC"}
              </Text>
              {isKycActive && <View style={styles.navActiveDot} />}
            </TouchableOpacity>

            {authState === "AUTHENTICATED" && user?.role === "user" && hasListings && (
              <TouchableOpacity
                style={[styles.navLink, isMyListingsActive && styles.navLinkActive]}
                onPress={() => router.push("/my-properties")}
                activeOpacity={0.7}
              >
                <Text style={[styles.navLinkText, isMyListingsActive && styles.navLinkTextActive]}>
                  {language === "hi" ? "मेरी लिस्टिंग" : "My Listings"}
                </Text>
                {isMyListingsActive && <View style={styles.navActiveDot} />}
              </TouchableOpacity>
            )}

            {authState === "AUTHENTICATED" && (
              <TouchableOpacity
                style={[styles.navLink, isDashboardActive && styles.navLinkActive]}
                onPress={() => router.push(user?.role ? (dashboardRoutes[user.role] as any) : "/dashboard")}
                activeOpacity={0.7}
              >
                <Text style={[styles.navLinkText, isDashboardActive && styles.navLinkTextActive]}>
                  {language === "hi" ? "डैशबोर्ड" : "Dashboard"}
                </Text>
                {isDashboardActive && <View style={styles.navActiveDot} />}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Right Element: Post Button, Profile, Wishlist, Language Toggle */}
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

            {!isDesktop && (
          <TouchableOpacity
            accessibilityLabel="Wishlist"
            style={styles.mobileIconBtn}
            onPress={() => router.push("/saved")}
            activeOpacity={0.75}
          >
            <MaterialIcons name="favorite-border" size={20} color="#0A192F" />
          </TouchableOpacity>
          )}

          {isDesktop ? (
            <TouchableOpacity
              style={[styles.profileBtn, isProfileActive && styles.profileBtnActive]}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/profile" : "/login")}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="account-circle"
                size={22}
                color={isProfileActive ? "#FFFFFF" : "#03456C"}
              />
              <Text style={[styles.profileBtnText, isProfileActive && styles.profileBtnTextActive]}>
                {authState === "AUTHENTICATED" ? (user?.name?.split(" ")[0] || "Account") : (language === "hi" ? "लॉग इन" : "Sign In")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityLabel="Profile"
              style={styles.mobileAvatar}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/profile" : "/login")}
              activeOpacity={0.8}
            >
              <Text style={styles.mobileAvatarText}>
                {user?.name?.[0]?.toUpperCase() || "M"}
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
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(10, 69, 181, 0.10)",
    paddingBottom: 10,
    paddingHorizontal: 24,
    zIndex: 20,
    ...Platform.select({
      web: {
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: "0 4px 20px -8px rgba(10, 42, 107, 0.12)",
        position: "sticky" as any,
        top: 0,
      },
    }),
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
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
  },
  navLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.12)",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 42, 107, 0.05)",
      },
    }),
  },
  navLink: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    position: "relative",
    alignItems: "center",
  },
  navLinkActive: {},
  navLinkText: {
    fontSize: 13.5,
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
    backgroundColor: "#0a45b5",
    paddingHorizontal: 16,
    paddingVertical: 8.5,
    borderRadius: 18,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 14px -3px rgba(10, 69, 181, 0.40)",
      },
    }),
  },
  postBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  profileBtnActive: {
    backgroundColor: "#102B52",
    borderColor: "#102B52",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(8, 115, 185, 0.20)",
      },
    }),
  },
  profileBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A192F",
  },
  profileBtnTextActive: {
    color: "#FFFFFF",
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  langText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0A192F",
  },
  mobileIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mobileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(10, 69, 181, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0a45b5",
  },
});
