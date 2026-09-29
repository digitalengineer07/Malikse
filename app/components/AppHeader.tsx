import { dashboardRoutes } from "../src/utils/accountRoutes";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, StatusBar as RNStatusBar } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTheme } from "../constants/theme";
import { useLanguageStore } from "../src/store/languageStore";
import { useAuthStore } from "../src/store/authStore";
import { t } from "../src/i18n/translations";

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
  showHomeButton?: boolean;
  showNavLinks?: boolean;
  showPostPropertyBtn?: boolean;
}

export default function AppHeader({
  title,
  subtitle,
  badge,
  badgeColor = AppTheme.colors.primary,
  showBack = false,
  onBackPress,
  fallbackRoute = "/search",
  rightElement,
  showLanguageToggle = true,
  showHomeButton = false,
  showNavLinks = true,
  showPostPropertyBtn = true,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web"
    ? 0
    : Math.max(insets.top, Platform.OS === "android" ? (RNStatusBar.currentHeight || 28) : 44);

  const { language, toggleLanguage } = useLanguageStore();
  const { user, authState } = useAuthStore();

  const isExploreActive = pathname === "/search" || pathname === "/" || pathname === "/(tabs)/search";
  const isMyListingsActive = pathname === "/my-properties" || pathname === "/(tabs)/my-properties" || Boolean(pathname?.includes("my-properties"));
  const isSavedActive = pathname === "/saved" || pathname === "/(tabs)/saved" || Boolean(pathname?.includes("saved"));
  const isMessagesActive = pathname === "/messages" || pathname === "/(tabs)/messages" || Boolean(pathname?.includes("messages"));
  const isInsightsActive = pathname === "/insights" || Boolean(pathname?.includes("insights"));

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as any);
    }
  };

  const displayName = user?.name || (language === "hi" ? "साइन इन करें" : "Sign in");
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingTop: Platform.OS === "web" ? 10 : topInset + 4,
          paddingBottom: 10,
        },
      ]}
    >
      <View style={[styles.container, !isDesktop && styles.containerMobile]}>
        {/* Left Section: Brand Logo or Back Button */}
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={20} color="#1E293B" />
              {Platform.OS === "web" && (
                <Text style={styles.backText}>{language === "hi" ? "वापस" : "Back"}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.brandRow}
              onPress={() => router.replace("/search")}
              activeOpacity={0.8}
            >
              <View style={[styles.logoIcon, !isDesktop && styles.logoIconMobile]}>
                <FontAwesome5 name="shield-alt" size={isDesktop ? 18 : 15} color="#FFFFFF" />
              </View>
              <View style={styles.brandTextCol}>
                <Text style={[styles.brandName, !isDesktop && styles.brandNameMobile]}>MalikSe</Text>
                <Text style={[styles.brandTagline, !isDesktop && styles.brandTaglineMobile]}>
                  {t(language, "brand_tagline") || "Your Land. A Safer Future."}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Center Section: Desktop Nav Links OR Title */}
        {title ? (
          <View style={styles.centerSection}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {badge && (
                <View style={[styles.badge, { backgroundColor: `${badgeColor}15`, borderColor: badgeColor }]}>
                  <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
                </View>
              )}
            </View>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : isDesktop && showNavLinks ? (
          <View style={styles.navLinksRow}>
            {/* Explore Plots */}
            <TouchableOpacity
              style={[styles.navLink, isExploreActive && styles.navLinkActive]}
              onPress={() => router.replace("/search")}
              activeOpacity={0.8}
            >
              <Text style={[styles.navLinkText, isExploreActive && styles.navLinkTextActive]}>
                {t(language, "nav_explore_plots") || "Explore Plots"}
              </Text>
              {isExploreActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>

            {/* My Listings */}
            <TouchableOpacity
              style={[
                styles.navLink,
                isMyListingsActive
                  ? {
                      backgroundColor: "#EFF7FD",
                      borderRadius: 9999,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: "#D5E9F8",
                    }
                  : null,
              ]}
              onPress={() => router.push("/my-properties")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.navLinkText,
                  isMyListingsActive && { color: "#284B68", fontWeight: "700" },
                ]}
              >
                {t(language, "nav_my_listings") || "My Listings"}
              </Text>
            </TouchableOpacity>

            {/* Saved */}
            <TouchableOpacity
              style={[
                styles.navLink,
                isSavedActive
                  ? {
                      backgroundColor: "#EFF7FD",
                      borderRadius: 9999,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: "#D5E9F8",
                    }
                  : null,
              ]}
              onPress={() => router.push("/saved")}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={isSavedActive ? "favorite" : "favorite-border"}
                size={15}
                color={isSavedActive ? "#111111" : "#475569"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.navLinkText,
                  isSavedActive && { color: "#284B68", fontWeight: "700" },
                ]}
              >
                {t(language, "nav_saved_plots") || "Saved"}
              </Text>
            </TouchableOpacity>

            {/* Messages */}
            <TouchableOpacity
              style={[
                styles.navLink,
                isMessagesActive
                  ? {
                      backgroundColor: "#EFF7FD",
                      borderRadius: 9999,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: "#D5E9F8",
                    }
                  : null,
              ]}
              onPress={() => router.push("/messages")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.navLinkText,
                  isMessagesActive && { color: "#284B68", fontWeight: "700" },
                ]}
              >
                {t(language, "nav_messages") || "Messages"}
              </Text>
              <View
                style={{
                  backgroundColor: "#111111",
                  borderRadius: 9999,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  marginLeft: 5,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "700" }}>3</Text>
              </View>
            </TouchableOpacity>

            {/* Insights */}
            <TouchableOpacity
              style={[
                styles.navLink,
                isInsightsActive
                  ? {
                      backgroundColor: "#EFF7FD",
                      borderRadius: 9999,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: "#D5E9F8",
                    }
                  : null,
              ]}
              onPress={() => router.push("/insights")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.navLinkText,
                  isInsightsActive && { color: "#284B68", fontWeight: "700" },
                ]}
              >
                {t(language, "nav_insights") || "Insights"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Right Section: Post Land (Free), Language Pill, User Profile Pill */}
        <View style={[styles.rightSection, !isDesktop && styles.rightSectionMobile]}>
          {/* + Post Land (Free) Button - Desktop only */}
          {showPostPropertyBtn && isDesktop && !rightElement && (
            <TouchableOpacity
              style={styles.postPropertyBtn}
              onPress={() => {
                if (authState !== "AUTHENTICATED" || !user) {
                  router.push("/login");
                } else {
                  router.push("/listing/create");
                }
              }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={17} color="#284B68" />
              <Text style={styles.postPropertyBtnText}>
                {t(language, "post_land_free") || "Post Land (Free)"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Language Pill (Both mobile & desktop) */}
          {showLanguageToggle && (
            <TouchableOpacity
              style={[styles.langBtn, !isDesktop && styles.langBtnMobile]}
              onPress={toggleLanguage}
              activeOpacity={0.8}
            >
              <Text style={styles.langSymbol}>文A</Text>
              <Text style={styles.langText}>{language === "en" ? "हिंदी" : "Eng"}</Text>
            </TouchableOpacity>
          )}

          {/* User Profile Pill or custom rightElement */}
          {rightElement ? (
            rightElement
          ) : (
            <TouchableOpacity
              style={[styles.userProfilePill, !isDesktop && styles.userProfilePillMobile]}
              accessibilityRole="button"
              accessibilityLabel={authState === "AUTHENTICATED" ? "Profile / Dashboard" : "Sign in"}
              onPress={() => {
                if (authState !== "AUTHENTICATED") {
                  router.push("/login");
                } else {
                  router.push(user ? dashboardRoutes[user.role] : "/login");
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.userAvatarCircle}>
                <Text style={styles.userAvatarText}>{avatarLetter}</Text>
              </View>
              {isDesktop && (
                <>
                  <Text style={styles.userProfileName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={17} color="#284B68" />
                </>
              )}
            </TouchableOpacity>
          )}

          {showHomeButton && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.replace("/search")}
              activeOpacity={0.7}
            >
              <MaterialIcons name="home" size={20} color="#475569" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: "center",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    maxWidth: 1480,
    width: "100%",
    alignSelf: "center",
  },
  containerMobile: {
    paddingHorizontal: 12,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF4FC",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#D5E9F8",
    gap: 5,
  },
  backText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#284B68",
  },
  /* Left Brand */
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  logoIconMobile: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandTextCol: {
    justifyContent: "center",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  brandNameMobile: {
    fontSize: 18,
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 1,
    lineHeight: 14,
    height: 14,
  },
  brandTaglineMobile: {
    fontSize: 9,
    lineHeight: 11,
    height: 11,
  },

  /* Center Nav Links (Desktop) */
  navLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
  },
  navLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    position: "relative",
  },
  navLinkActive: {
    backgroundColor: "transparent",
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  navLinkTextActive: {
    color: "#111111",
    fontWeight: "700",
  },
  activeIndicator: {
    position: "absolute",
    bottom: -2,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#111111",
    borderRadius: 2,
  },

  /* Center Title */
  centerSection: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },

  /* Right Section */
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  },
  rightSectionMobile: {
    gap: 6,
  },
  postPropertyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EAF4FC",
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#D5E9F8",
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
    justifyContent: "center",
  },
  postPropertyBtnText: {
    color: "#284B68",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: "#EAF4FC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#D5E9F8",
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF4FC",
    paddingHorizontal: 6,
    height: 36,
    width: 94,
    justifyContent: "center",
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#D5E9F8",
    gap: 5,
  },
  langBtnMobile: {
    width: "auto",
    paddingHorizontal: 8,
    height: 32,
    gap: 4,
  },
  langSymbol: {
    fontSize: 13,
    fontWeight: "800",
    color: "#284B68",
    lineHeight: 15,
  },
  langText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#284B68",
    lineHeight: 15,
  },
  userProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 9999,
    backgroundColor: "#EAF4FC",
    borderWidth: 1.5,
    borderColor: "#D5E9F8",
    justifyContent: "center",
  },
  userProfilePillMobile: {
    height: 32,
    paddingHorizontal: 5,
    gap: 4,
  },
  userAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#284B68",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "800",
  },
  userProfileName: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#284B68",
    maxWidth: 130,
  },
});
