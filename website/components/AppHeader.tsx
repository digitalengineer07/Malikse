import React from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "@/web/safeArea";
import { useRouter, usePathname } from "@/web/navigation";
import { MaterialIcons } from "@/web/icons";
import { useLanguageStore } from "../src/store/languageStore";
import { useAuthStore } from "../src/store/authStore";
import { useUserListingsStore } from "../src/store/userListingsStore";
import { dashboardRoutes } from "../src/utils/accountRoutes";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../constants/typography";

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
  const { language } = useLanguageStore();
  const { authState, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const showNavLinks = props.showNavLinks ?? isDesktop;
  const showPostProperty = props.showPostPropertyBtn ?? (width >= 640);

  const showBack = props.showBack === true;

  const isHomeActive = pathname === "/home" || pathname === "/";
  const isSearchActive = pathname === "/search";
  const isMessagesActive = pathname === "/messages";
  const isSavedActive = pathname === "/saved";
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
    <View style={[styles.headerWrapper, { paddingTop: Math.max(insets.top, 14) }]}>
      <View style={styles.header}>
        {/* Left: Back button + MalikSe Brand Lockup */}
        <View style={styles.leftGroup}>
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
              <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
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
              <MaterialIcons name="roofing" size={22} color="#14263E" />
            </View>
            <View style={styles.brandTextCol}>
              <Text style={styles.brandTitle}>
                Malik<Text style={{ color: "#FCC61C" }}>Se</Text>
              </Text>
              {width >= 640 && (
                <Text style={styles.brandTagline} numberOfLines={1}>
                  {language === "hi" ? "सत्यापित संपत्तियां · विश्वसनीय संबंध" : "Verified spaces · Trusted connections"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Center: Desktop Website Navigation Links (Segmented Pill) */}
        {showNavLinks && (
          <View style={styles.topNavRow}>
            <TouchableOpacity
              style={[styles.topNavItem, isHomeActive && styles.topNavItemActive]}
              onPress={() => router.replace("/home")}
              activeOpacity={0.75}
            >
              <Text style={[styles.topNavText, isHomeActive && styles.topNavTextActive]}>
                {language === "hi" ? "होम" : "Home"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topNavItem, isSearchActive && styles.topNavItemActive]}
              onPress={() => router.replace("/search")}
              activeOpacity={0.75}
            >
              <Text style={[styles.topNavText, isSearchActive && styles.topNavTextActive]}>
                {language === "hi" ? "एक्सप्लोर" : "Explore"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topNavItem, isMessagesActive && styles.topNavItemActive]}
              onPress={() => router.push(authState === "AUTHENTICATED" ? "/messages" : "/login")}
              activeOpacity={0.75}
            >
              <Text style={[styles.topNavText, isMessagesActive && styles.topNavTextActive]}>
                {language === "hi" ? "संदेश" : "Chats"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topNavItem, isSavedActive && styles.topNavItemActive]}
              onPress={() => router.push("/saved")}
              activeOpacity={0.75}
            >
              <Text style={[styles.topNavText, isSavedActive && styles.topNavTextActive]}>
                {language === "hi" ? "सहेजे गए" : "Saved"}
              </Text>
            </TouchableOpacity>

            {authState === "AUTHENTICATED" && user?.role === "user" && hasListings && (
              <TouchableOpacity
                style={[styles.topNavItem, isMyListingsActive && styles.topNavItemActive]}
                onPress={() => router.push("/my-properties")}
                activeOpacity={0.75}
              >
                <Text style={[styles.topNavText, isMyListingsActive && styles.topNavTextActive]}>
                  {language === "hi" ? "मेरी लिस्टिंग" : "My Listings"}
                </Text>
              </TouchableOpacity>
            )}

            {authState === "AUTHENTICATED" && (
              <TouchableOpacity
                style={[styles.topNavItem, isDashboardActive && styles.topNavItemActive]}
                onPress={() => router.push(user?.role ? (dashboardRoutes[user.role] as any) : "/dashboard")}
                activeOpacity={0.75}
              >
                <Text style={[styles.topNavText, isDashboardActive && styles.topNavTextActive]}>
                  {language === "hi" ? "डैशबोर्ड" : "Dashboard"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Right Element: Post Property Pill, Profile / Sign In Pill */}
        <View style={styles.rightGroup}>
          {showPostProperty && (
            <TouchableOpacity
              style={styles.topPostBtn}
              onPress={() =>
                router.push(
                  authState === "AUTHENTICATED"
                    ? "/post"
                    : ({ pathname: "/login", params: { returnTo: "/post" } } as any)
                )
              }
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={16} color="#14263E" />
              <Text style={styles.topPostBtnText}>
                {language === "hi" ? "प्रॉपर्टी पोस्ट करें" : "Post Property"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.topProfileBtn, isProfileActive && styles.topProfileBtnActive]}
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
                <Text style={[styles.topProfileName, isProfileActive && styles.topProfileNameActive]} numberOfLines={1}>
                  {authState === "AUTHENTICATED"
                    ? (user?.name?.split(" ")[0] || "Account")
                    : (language === "hi" ? "लॉग इन" : "Sign In")}
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={16}
                  color={isProfileActive ? "#14263E" : "rgba(255,255,255,0.7)"}
                />
              </View>
            )}
          </TouchableOpacity>

          {props.rightElement}
        </View>
      </View>
    </View>
  );
}

const font = FONT_BODY;
const fontDisplay = FONT_DISPLAY;
const fontMono = FONT_MONO;

const styles = StyleSheet.create({
  headerWrapper: {
    width: "100%",
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: "#14263E",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 100,
    ...Platform.select({
      web: {
        position: "sticky" as any,
        top: 0,
      },
    }),
  },
  header: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 2,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FCC61C",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(252, 198, 28, 0.28)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  brandTextCol: {
    justifyContent: "center",
  },
  brandTitle: {
    fontFamily: fontDisplay,
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.6,
    lineHeight: 24,
  },
  brandTagline: {
    fontFamily: fontMono,
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.62)",
    letterSpacing: 1.0,
    lineHeight: 13,
    textTransform: "uppercase",
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  topNavItem: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topNavItemActive: {
    backgroundColor: "#FCC61C",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(252, 198, 28, 0.25)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  topNavText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.82)",
    letterSpacing: -0.1,
  },
  topNavTextActive: {
    color: "#14263E",
    fontWeight: "800",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FCC61C",
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 999,
    ...Platform.select({
      web: {
        boxShadow: "0 8px 16px -6px rgba(232, 174, 0, 0.65), inset 0 1px 0 rgba(255,255,255,0.45)",
      },
      default: {
        elevation: 3,
      },
    }),
  },
  topPostBtnText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "800",
    color: "#14263E",
    letterSpacing: -0.1,
  },
  topProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  topProfileBtnActive: {
    backgroundColor: "#FCC61C",
    borderColor: "#FCC61C",
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FCC61C",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    fontWeight: "800",
    color: "#14263E",
    fontSize: 12,
  },
  topProfileName: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    maxWidth: 90,
  },
  topProfileNameActive: {
    color: "#14263E",
  },
});
