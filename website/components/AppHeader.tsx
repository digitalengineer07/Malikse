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
  const isDesktop = width >= 880;
  const showNavLinks = props.showNavLinks ?? isDesktop;
  const showPostProperty = props.showPostPropertyBtn ?? (width >= 640);

  const showBack = props.showBack ?? (!["/home", "/", "/search"].includes(pathname));

  const isHomeActive = pathname === "/home" || pathname === "/";
  const isSearchActive = pathname === "/search";
  const isSavedActive = pathname === "/saved";
  const isMessagesActive = pathname === "/messages";
  const isMyListingsActive = pathname === "/my-properties" || pathname?.startsWith("/my-properties");
  const isDashboardActive = pathname === "/dashboard" || pathname?.startsWith("/dashboard");
  const isProfileActive = pathname === "/profile";

  const { hasListings, checkUserListings } = useUserListingsStore();

  React.useEffect(() => {
    if (authState === "AUTHENTICATED" && user?.id && user?.role === "user") {
      void checkUserListings(user.id, user.role);
    }
  }, [authState, user?.id, user?.role, checkUserListings]);

  return (
    <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 14) }]}>
      <View style={styles.headerInner}>
        {/* Left: Back button + MalikSe Brand Lockup */}
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
              <MaterialIcons name="arrow-back" size={20} color="#0B1B3F" />
            </TouchableOpacity>
          )}

          {/* MalikSe Luxury Brand Lockup with Roof Icon + Dot + Tagline */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.replace("/home")}
            activeOpacity={0.85}
            style={styles.brandLockup}
          >
            <View style={styles.logoIcon}>
              <MaterialIcons name="roofing" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.brandTextCol}>
              <Text style={styles.brandTitle}>
                MalikSe<Text style={{ color: "#10B981" }}>.</Text>
              </Text>
              {width >= 640 && (
                <Text style={styles.brandTagline} numberOfLines={1}>
                  {language === "hi" ? "सत्यापित ज़मीन · विश्वसनीय रिश्ते" : "Verified spaces · Trusted connections"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Center: Desktop Website Navigation Links (Curved Segmented Pill) */}
        {showNavLinks && (
          <View style={styles.navLinksRow}>
            <TouchableOpacity
              style={[styles.navLink, isHomeActive && styles.navLinkActive]}
              onPress={() => router.replace("/home")}
              activeOpacity={0.75}
            >
              <Text style={[styles.navLinkText, isHomeActive && styles.navLinkTextActive]}>
                {language === "hi" ? "होम" : "Home"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navLink, isSearchActive && styles.navLinkActive]}
              onPress={() => router.replace("/search")}
              activeOpacity={0.75}
            >
              <Text style={[styles.navLinkText, isSearchActive && styles.navLinkTextActive]}>
                {language === "hi" ? "एक्सप्लोर" : "Explore"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navLink, isMessagesActive && styles.navLinkActive]}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/messages" : "/login")}
              activeOpacity={0.75}
            >
              <Text style={[styles.navLinkText, isMessagesActive && styles.navLinkTextActive]}>
                {language === "hi" ? "संदेश" : "Chats"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navLink, isSavedActive && styles.navLinkActive]}
              onPress={() => router.push("/saved")}
              activeOpacity={0.75}
            >
              <Text style={[styles.navLinkText, isSavedActive && styles.navLinkTextActive]}>
                {language === "hi" ? "सहेजे गए" : "Saved"}
              </Text>
            </TouchableOpacity>

            {authState === "AUTHENTICATED" && user?.role === "user" && hasListings && (
              <TouchableOpacity
                style={[styles.navLink, isMyListingsActive && styles.navLinkActive]}
                onPress={() => router.push("/my-properties")}
                activeOpacity={0.75}
              >
                <Text style={[styles.navLinkText, isMyListingsActive && styles.navLinkTextActive]}>
                  {language === "hi" ? "मेरी लिस्टिंग" : "My Listings"}
                </Text>
              </TouchableOpacity>
            )}

            {authState === "AUTHENTICATED" && (
              <TouchableOpacity
                style={[styles.navLink, isDashboardActive && styles.navLinkActive]}
                onPress={() => router.push(user?.role ? (dashboardRoutes[user.role] as any) : "/dashboard")}
                activeOpacity={0.75}
              >
                <Text style={[styles.navLinkText, isDashboardActive && styles.navLinkTextActive]}>
                  {language === "hi" ? "डैशबोर्ड" : "Dashboard"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Right Element: Post Property Pill, Profile / Sign In Pill, Language Toggle */}
        <View style={styles.rightContainer}>
          {showPostProperty && (
            <TouchableOpacity
              style={styles.postBtn}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/listing/create" : "/login")}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.postBtnText}>
                {language === "hi" ? "प्रॉपर्टी पोस्ट करें" : "Post Property"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.profileBtn, isProfileActive && styles.profileBtnActive]}
            onPress={() => router.push(authState === "AUTHENTICATED" ? "/profile" : "/login")}
            activeOpacity={0.85}
          >
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>
                {user?.name?.[0]?.toUpperCase() || (authState === "AUTHENTICATED" ? "U" : "M")}
              </Text>
            </View>
            {width >= 560 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={[styles.profileBtnText, isProfileActive && styles.profileBtnTextActive]} numberOfLines={1}>
                  {authState === "AUTHENTICATED"
                    ? (user?.name?.split(" ")[0] || "Account")
                    : (language === "hi" ? "लॉग इन" : "Sign In")}
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={16}
                  color={isProfileActive ? "#FFFFFF" : "#64748B"}
                />
              </View>
            )}
          </TouchableOpacity>

          {props.rightElement ||
            (props.showLanguageToggle !== false && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={language === "en" ? "Switch to Hindi" : "Switch to English"}
                onPress={toggleLanguage}
                style={styles.langBtn}
                activeOpacity={0.75}
              >
                <MaterialIcons name="translate" size={15} color="#03456C" style={{ marginRight: 4 }} />
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
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 4,
    zIndex: 100,
  },
  headerInner: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    minHeight: 66,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(11, 27, 63, 0.06)",
      },
      default: {
        shadowColor: "#0B1B3F",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 3,
      },
    }),
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#03456C",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 10px rgba(3, 69, 108, 0.25)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  brandTextCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "#CBD5E1",
  },
  navLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 2,
  },
  navLink: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  navLinkActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(11, 27, 63, 0.08)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  navLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  navLinkTextActive: {
    color: "#03456C",
    fontWeight: "700",
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
    borderRadius: 999,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(3, 69, 108, 0.2)",
      },
      default: {
        elevation: 3,
      },
    }),
  },
  postBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  profileBtnActive: {
    backgroundColor: "#102B52",
    borderColor: "#102B52",
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#03456C",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  profileBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B1B3F",
    maxWidth: 90,
  },
  profileBtnTextActive: {
    color: "#FFFFFF",
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  langText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
});
