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
              <MaterialIcons name="add" size={16} color="#FFFFFF" />
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
                  color={isProfileActive ? "#FFFFFF" : "#64748B"}
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

const font = Platform.OS === "web" ? "Manrope, Inter, system-ui" : "PoppinsRegular";

const styles = StyleSheet.create({
  headerWrapper: {
    width: "100%",
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 4,
    backgroundColor: "transparent",
    zIndex: 100,
  },
  header: {
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
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(11, 27, 63, 0.05)",
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
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#0A45B5",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(10, 69, 181, 0.22)",
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
    fontFamily: font,
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  brandTagline: {
    fontFamily: font,
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.1,
    lineHeight: 14,
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  topNavItem: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topNavItemActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  topNavText: {
    fontFamily: font,
    fontSize: 13.5,
    fontWeight: "600",
    color: "#64748B",
  },
  topNavTextActive: {
    color: "#0A45B5",
    fontWeight: "700",
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0A45B5",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(10, 69, 181, 0.22)",
      },
      default: {
        elevation: 3,
      },
    }),
  },
  topPostBtnText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  topProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  topProfileBtnActive: {
    backgroundColor: "#0A45B5",
    borderColor: "#0A45B5",
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#0A45B5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    fontWeight: "800",
    color: "#FFFFFF",
    fontSize: 13,
  },
  topProfileName: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    maxWidth: 90,
  },
  topProfileNameActive: {
    color: "#FFFFFF",
  },
});
