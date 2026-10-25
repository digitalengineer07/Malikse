import { AppTheme } from "../constants/theme";
import { premiumStyles } from "../constants/typography";
import React from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import type { UserRole } from "../src/types/auth.types";
import { authService } from "../src/services/authService";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

type Section = { title: string; description: string; route?: Href };
const icons: React.ComponentProps<typeof MaterialIcons>["name"][] = [
  "space-dashboard",
  "fact-check",
  "home-work",
  "add-home-work",
  "folder-open",
  "swap-horiz",
];

export default function RoleDashboard({
  role,
  title,
  subtitle,
  sections,
}: {
  role: UserRole;
  title: string;
  subtitle: string;
  sections: Section[];
}) {
  const router = useRouter();
  const { user, authState } = useAuthStore();
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const cardWidth = compact ? "100%" : width < 1000 ? "48%" : "31.8%";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  };

  if (authState !== "AUTHENTICATED" || user?.role !== role) {
    return (
      <View style={styles.screen}>
        <AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton showBack={false} />
        <View style={styles.accessPanel}>
          <View style={styles.iconBox}>
            <MaterialIcons name="lock-outline" size={28} color="#0873B9" />
          </View>
          <Text style={styles.title}>Sign in as {role}</Text>
          <Text style={styles.subtitle}>This dashboard is available to the {role} role.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.darkButton}
            onPress={() => router.replace("/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.darkLabel}>Go to sign in</Text>
            <MaterialIcons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Clean header without back button next to logo */}
      <AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton showBack={false} />

      <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
        {/* Workspace Topline Breadcrumb & Role Badge */}
        <View style={styles.topline}>
          <Text style={styles.eyebrow}>MALIKSE / YOUR WORKSPACE</Text>
          <View style={styles.rolePill}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>{role}</Text>
          </View>
        </View>

        {/* Title Row with Properly Located Back Button */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeftGroup}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.75}
            >
              <MaterialIcons name="arrow-back" size={20} color="#102B52" />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>
              {title}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Enhanced Hero Banner */}
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Image
            source={require("../assets/saved_villa_house.jpg")}
            style={styles.heroBackground}
            resizeMode="cover"
          />
          <View
            style={[
              styles.heroShade,
              Platform.OS === "web"
                ? ({
                    background:
                      "linear-gradient(90deg, rgba(16, 43, 82, 0.94) 0%, rgba(16, 43, 82, 0.78) 45%, rgba(16, 43, 82, 0.28) 100%)",
                  } as any)
                : undefined,
            ]}
          />
          <View style={styles.heroCopy}>
            <View style={styles.welcomePill}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name?.charAt(0).toUpperCase() || "U"}</Text>
              </View>
              <Text style={styles.welcome}>Welcome, {user.name || "User"}</Text>
            </View>
            <Text style={styles.heroTitle}>A place for{"\n"}your next chapter.</Text>
            <Text style={styles.heroDescription}>
              Your properties, your people, and the tools you need to move forward.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.whiteButton}
              onPress={() => router.replace("/home")}
              activeOpacity={0.85}
            >
              <Text style={styles.whiteLabel}>Explore verified properties</Text>
              <MaterialIcons name="north-east" size={18} color="#0873B9" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>YOUR TOOLS</Text>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Make your next move.
            </Text>
          </View>
          <Text style={styles.sectionNote}>Built around your role</Text>
        </View>

        {/* Tools Cards Grid */}
        <View style={styles.grid}>
          {sections.map((section, index) => {
            const isPrimary = index === 0;
            const isEnabled = Boolean(section.route);
            return (
              <TouchableOpacity
                key={section.title}
                accessibilityRole="button"
                accessibilityState={{ disabled: !isEnabled }}
                style={[
                  styles.card,
                  { width: cardWidth },
                  isPrimary && styles.primaryCard,
                  !isEnabled && styles.disabledCard,
                ]}
                disabled={!isEnabled}
                onPress={() => section.route && router.push(section.route)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, isPrimary && styles.primaryIcon]}>
                    <MaterialIcons
                      name={icons[index % icons.length]}
                      size={24}
                      color={isPrimary ? "#FFFFFF" : "#0873B9"}
                    />
                  </View>
                  <Text style={[styles.cardIndex, isPrimary && styles.primaryCardIndex]}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{section.title}</Text>
                <Text style={styles.cardDescription}>{section.description}</Text>
                <View style={styles.cardBottom}>
                  <Text style={[styles.cardAction, isPrimary && styles.primaryCardAction]}>
                    {isEnabled ? "Open workspace" : "Coming later"}
                  </Text>
                  <View style={[styles.arrowCircle, isPrimary && styles.primaryArrowCircle]}>
                    <MaterialIcons
                      name={isEnabled ? "north-east" : "schedule"}
                      size={18}
                      color={isPrimary ? "#FFFFFF" : "#0873B9"}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Enhanced Account Bar */}
        <View style={[styles.accountBar, compact && styles.accountCompact]}>
          <View style={styles.accountIdentity}>
            <View style={styles.accountIcon}>
              <MaterialIcons name="person-outline" size={24} color="#0873B9" />
            </View>
            <View>
              <Text style={styles.accountTitle}>Your account</Text>
              <Text style={styles.accountDescription}>Profile details and session settings</Text>
            </View>
          </View>
          <View style={styles.accountActions}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.profileButton}
              onPress={() => router.push("/profile")}
              activeOpacity={0.8}
            >
              <Text style={styles.profileButtonLabel}>My profile</Text>
              <MaterialIcons name="north-east" size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.signOut}
              onPress={() => {
                authService.logout().finally(() => router.replace("/login"));
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.signOutLabel}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = premiumStyles({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 96,
  },
  contentCompact: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 80 },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  eyebrow: {
    color: "#0873B9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#EDF7FE",
    borderWidth: 1,
    borderColor: "#D4E9F9",
    borderRadius: 20,
  },
  roleDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#0873B9" },
  roleText: { textTransform: "capitalize", color: "#102B52", fontSize: 12, fontWeight: "700" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#DCEAF7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    cursor: "pointer",
  },
  title: { color: "#102B52", fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  titleCompact: { fontSize: 28 },
  subtitle: {
    color: "#64809E",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 720,
    fontWeight: "500",
  },
  hero: {
    marginTop: 26,
    marginBottom: 38,
    borderRadius: 30,
    backgroundColor: "#102B52",
    minHeight: 380,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    shadowColor: "#102B52",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 6,
  },
  heroBackground: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(16, 43, 82, 0.75)" },
  heroCompact: { flexDirection: "column", borderRadius: 24, minHeight: 340 },
  heroCopy: { flex: 1, padding: 32, gap: 18, justifyContent: "center" },
  welcomePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  avatar: {
    backgroundColor: "#0873B9",
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, color: "#FFFFFF", fontWeight: "800" },
  welcome: { fontSize: 13, color: "#FFFFFF", fontWeight: "600" },
  heroTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: "#FFFFFF",
  },
  heroDescription: {
    color: "#D9EEFC",
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 440,
  },
  whiteButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
    cursor: "pointer",
  },
  whiteLabel: { color: "#102B52", fontSize: 13.5, fontWeight: "700" },
  sectionHeading: {
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 15,
    marginBottom: 22,
  },
  sectionTitle: {
    color: "#102B52",
    fontWeight: "800",
    fontSize: 26,
    letterSpacing: -0.6,
    marginTop: 6,
  },
  sectionNote: { color: "#64809E", fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  card: {
    minHeight: 240,
    borderRadius: 24,
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EDF7",
    shadowColor: "#102B52",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
    cursor: "pointer",
  },
  primaryCard: {
    backgroundColor: "#F0F7FE",
    borderColor: "#BAE0FD",
    borderWidth: 1.5,
  },
  disabledCard: { backgroundColor: "#F8FAFC", opacity: 0.7 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F7FE",
    borderWidth: 1,
    borderColor: "#DCECFB",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryIcon: { backgroundColor: "#0873B9", borderColor: "#0873B9" },
  cardIndex: { color: "#8FA8BE", fontSize: 12, fontWeight: "700" },
  primaryCardIndex: { color: "#0873B9" },
  cardTitle: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: "#102B52",
    lineHeight: 25,
  },
  cardDescription: {
    color: "#5B738B",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    flex: 1,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  cardAction: { color: "#0873B9", fontSize: 13, fontWeight: "700" },
  primaryCardAction: { color: "#0873B9" },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F0F7FE",
    borderWidth: 1,
    borderColor: "#DCECFB",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryArrowCircle: {
    backgroundColor: "#0873B9",
    borderColor: "#0873B9",
  },
  accountBar: {
    marginTop: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EDF7",
    borderRadius: 24,
    gap: 20,
    shadowColor: "#102B52",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  accountCompact: { flexDirection: "column", alignItems: "stretch" },
  accountIdentity: {
    flexShrink: 1,
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  accountIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F0F7FE",
    borderWidth: 1,
    borderColor: "#DCECFB",
    alignItems: "center",
    justifyContent: "center",
  },
  accountTitle: { fontSize: 16, fontWeight: "800", color: "#102B52" },
  accountDescription: { fontSize: 13, color: "#64809E", marginTop: 3 },
  accountActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#102B52",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    cursor: "pointer",
  },
  profileButtonLabel: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },
  signOut: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#FECDD3",
    shadowColor: "#E11D48",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    cursor: "pointer",
  },
  signOutLabel: { fontSize: 13.5, color: "#E11D48", fontWeight: "700" },
  accessPanel: {
    width: "100%",
    maxWidth: 550,
    alignSelf: "center",
    padding: 32,
    marginTop: 40,
    gap: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E1EDF7",
    shadowColor: "#102B52",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  darkButton: {
    backgroundColor: "#102B52",
    borderRadius: 28,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 15,
    cursor: "pointer",
  },
  darkLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
