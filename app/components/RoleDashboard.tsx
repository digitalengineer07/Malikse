import NotificationFailures from "./NotificationFailures";
import NotificationBell from "./NotificationBell";
import { marketplaceBackground } from "../constants/theme";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, Linking, Share } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/authStore";
import type { UserRole } from "../src/types/auth.types";
import { authService } from "../src/services/authService";
import { useLanguageStore } from "../src/store/languageStore";
import BottomNav from "./BottomNav";

type Section = { title: string; description: string; route?: Href };
const icons: React.ComponentProps<typeof MaterialIcons>["name"][] = ["space-dashboard", "fact-check", "home-work", "add-home-work", "folder-open", "swap-horiz"];
const navy = "#14263E";
const yellow = "#FCC61C";
const muted = "#536174";

export default function RoleDashboard({ role, title, subtitle, sections }: {
  role: UserRole; title: string; subtitle: string; sections: Section[];
}) {
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { user, authState } = useAuthStore();
  const { language, toggleLanguage } = useLanguageStore();
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const cardWidth = compact ? "100%" : width < 1000 || sections.length === 2 ? "48%" : "31.8%";
  const hasAccess = authState === "AUTHENTICATED" && user?.role === role;

  React.useEffect(() => {
    if (hasAccess) {
      void authService.getMe().catch(() => {});
    }
  }, [hasAccess]);

  return <View style={styles.screen}>
    {focused && <StatusBar style="light" />}
    <ScrollView contentContainerStyle={{ paddingBottom: hasAccess ? 20 : insets.bottom + 20 }}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.sun} pointerEvents="none" />
        <View style={styles.ray} pointerEvents="none" />
        <View style={[styles.headerInner, compact && styles.horizontalCompact]}>
          <View style={styles.topline}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}
              onPress={() => router.canGoBack() ? router.back() : router.replace("/home")}>
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="MalikSe home" style={styles.brand}
              onPress={() => router.replace("/home")}>
              <View style={styles.brandIcon}><MaterialIcons name="roofing" size={20} color={navy} /></View>
              <Text style={styles.brandText}>MalikSe<Text style={{ color: yellow }}>.</Text></Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={language === "en" ? "Switch to Hindi" : "Switch to English"}
              style={styles.language} onPress={toggleLanguage}>
              <Text style={styles.buttonLabel}>{language === "en" ? "H" : "E"}</Text>
            </TouchableOpacity>
            {hasAccess && <NotificationBell />}
          </View>
          {hasAccess && <>
            <View style={styles.workspace}>
              <Text style={[styles.eyebrow, styles.onNavy]}>MALIKSE / YOUR WORKSPACE</Text>
              <View style={styles.rolePill}><View style={styles.roleDot} /><Text style={styles.roleText}>{role}</Text></View>
            </View>
            <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </>}
        </View>
      </View>
      <View style={[styles.content, compact && styles.horizontalCompact]}>
      {!hasAccess ? (
        <View style={styles.accessPanel}>
          <View style={styles.iconBox}><MaterialIcons name="lock-outline" size={24} color={navy} /></View>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Sign in as {role}</Text>
          <Text style={styles.cardDescription}>This dashboard is available to the {role} role.</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => router.replace("/login")}>
            <Text style={styles.buttonLabel}>Go to sign in</Text><MaterialIcons name="arrow-forward" size={18} color={navy} />
          </TouchableOpacity>
        </View>
      ) : <>
      {role === "admin" && <NotificationFailures />}
      <View style={styles.hero}>
        <Image source={require("../assets/saved_villa_house.jpg")} style={styles.heroBackground} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.heroCopy}><View style={styles.welcomeRow}><View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.charAt(0).toUpperCase()}</Text></View><Text style={styles.welcome}>Welcome, {user.name}</Text></View>
          <Text style={styles.heroTitle}>A place for{ "\n" }your next chapter.</Text>
          <Text style={styles.heroDescription}>Your properties, your people, and the tools you need to move forward.</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={() => router.replace("/home")}><Text style={styles.buttonLabel}>Explore verified properties</Text><MaterialIcons name="north-east" size={18} color={navy} /></TouchableOpacity>
        </View>

      </View>
      {role === 'advisor' && (
        <View style={styles.advisorCard}>
          <View style={styles.advisorCardHeader}>
            <View style={styles.advisorBadge}>
              <MaterialIcons name="verified-user" size={16} color={navy} />
              <Text style={styles.advisorBadgeText}>YOUR UNIQUE ADVISOR ID</Text>
            </View>
            <Text style={styles.advisorDistrictText}>
              {user.assignedDistricts?.length ? "Districts: " + user.assignedDistricts.join(", ") : "Coverage: All Districts"}
            </Text>
          </View>
          <Text style={styles.advisorCodeText}>{user.advisorCode || "ADV-Pending"}</Text>
          <Text style={styles.advisorHelpText}>
            Share this ID with property sellers so their listings are assigned directly to you for review, offers, and chat.
          </Text>
          <View style={styles.advisorActionRow}>
            <TouchableOpacity
              style={styles.advisorShareBtn}
              accessibilityRole="button"
              accessibilityLabel="Share on WhatsApp"
              onPress={() => {
                if (user.advisorCode) {
                  const msg = "Hi! You can use my MalikSe Advisor ID *" + user.advisorCode + "* when listing your property on MalikSe to assign me directly as your advisor.";
                  Linking.openURL("https://wa.me/?text=" + encodeURIComponent(msg)).catch(() => {});
                }
              }}
            >
              <MaterialIcons name="chat" size={18} color="#fff" />
              <Text style={styles.advisorShareLabel}>Share on WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.advisorCopyBtn}
              accessibilityRole="button"
              accessibilityLabel="Share Advisor ID"
              onPress={() => {
                if (user.advisorCode) {
                  Share.share({
                    message: "My MalikSe Advisor ID is " + user.advisorCode + ". Enter this ID when submitting your property on MalikSe.",
                  }).catch(() => {});
                }
              }}
            >
              <MaterialIcons name="share" size={18} color={navy} />
              <Text style={styles.advisorCopyLabel}>Share ID</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>YOUR TOOLS</Text><Text accessibilityRole="header" style={styles.sectionTitle}>Make your next move.</Text></View><Text style={styles.sectionNote}>Built around your role</Text></View>
      <View style={styles.grid}>{sections.map((section, index) => <TouchableOpacity key={section.title} accessibilityRole="button" accessibilityState={{ disabled: !section.route }} style={[styles.card, { width: cardWidth }, index === 0 && styles.primaryCard, !section.route && styles.disabledCard]} disabled={!section.route} onPress={() => section.route && router.push(section.route)}>
        <View style={styles.cardTop}><View style={[styles.iconBox, index === 0 && styles.primaryIcon]}><MaterialIcons name={icons[index % icons.length]} size={24} color={navy} /></View><Text style={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</Text></View>
        <Text style={styles.cardTitle}>{section.title}</Text><Text style={styles.cardDescription}>{section.description}</Text>
        <View style={styles.cardBottom}><Text style={styles.cardAction}>{section.route ? "Open workspace" : "Coming later"}</Text><View style={styles.arrowCircle}><MaterialIcons name={section.route ? "north-east" : "schedule"} size={18} color="#111827" /></View></View>
      </TouchableOpacity>)}</View>
      <View style={[styles.accountBar, compact && styles.accountCompact]}><View style={styles.accountIdentity}><View style={styles.accountIcon}><MaterialIcons name="person-outline" size={24} color="#345A76" /></View><View><Text style={styles.accountTitle}>Your account</Text><Text style={styles.accountDescription}>Profile details and session settings</Text></View></View>
        <View style={styles.accountActions}><TouchableOpacity accessibilityRole="button" style={styles.profileButton} onPress={() => router.push("/profile")}><Text style={styles.buttonLabel}>My profile</Text><MaterialIcons name="north-east" size={15} color={navy} /></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.signOut} onPress={() => { authService.logout().finally(() => router.replace("/login")); }}><Text style={styles.signOutLabel}>Sign out</Text></TouchableOpacity></View>
      </View>
      </>}
      </View>
    </ScrollView>{hasAccess && <BottomNav themedStaff />}
  </View>;
}

const surface = {
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: "rgba(20,38,62,0.12)",
  borderRadius: 22,
  shadowColor: navy,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: marketplaceBackground },
  header: { backgroundColor: navy, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden" },
  headerInner: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32, paddingBottom: 24, gap: 8 },
  horizontalCompact: { paddingHorizontal: 20 },
  sun: { position: "absolute", width: 176, height: 176, borderRadius: 88, right: -55, top: -65, backgroundColor: yellow },
  ray: { position: "absolute", width: 76, height: 214, borderRadius: 40, right: 62, top: 66, backgroundColor: "#1C3556", transform: [{ rotate: "-30deg" }] },
  topline: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#244268", alignItems: "center", justifyContent: "center" },
  brand: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  brandIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: yellow, alignItems: "center", justifyContent: "center" },
  brandText: { color: "#fff", fontFamily: "Fraunces", fontSize: 24 },
  language: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF1C0", alignItems: "center", justifyContent: "center" },
  workspace: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  eyebrow: { color: muted, fontFamily: "ManropeExtraBold", fontSize: 10, letterSpacing: 1.3 },
  onNavy: { color: "#E7EDF5" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#FFF1C0", borderRadius: 20 },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: navy },
  roleText: { textTransform: "capitalize", color: navy, fontSize: 12, fontFamily: "ManropeBold" },
  title: { color: "#fff", fontSize: 38, fontFamily: "Fraunces" },
  titleCompact: { fontSize: 31 },
  subtitle: { color: "#E7EDF5", fontFamily: "Manrope", fontSize: 14, lineHeight: 21, maxWidth: 680 },
  content: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32, paddingTop: 20, gap: 18 },
  hero: { borderRadius: 24, backgroundColor: navy, overflow: "hidden" },
  heroBackground: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20,38,62,0.76)" },
  heroCopy: { padding: 20, gap: 12 },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { backgroundColor: "#FFF1C0", height: 32, width: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, color: navy, fontFamily: "ManropeExtraBold" },
  welcome: { fontSize: 13, fontFamily: "ManropeBold", color: "#fff", flexShrink: 1 },
  heroTitle: { fontSize: 28, lineHeight: 34, fontFamily: "Fraunces", color: "#fff" },
  heroDescription: { color: "#E7EDF5", fontSize: 14, lineHeight: 21, fontFamily: "Manrope", maxWidth: 420 },
  primaryButton: { maxWidth: "100%", alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: yellow, borderRadius: 24 },
  buttonLabel: { color: navy, fontSize: 13, fontFamily: "ManropeExtraBold", flexShrink: 1 },
  sectionHeading: { flexWrap: "wrap", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  sectionTitle: { color: navy, fontFamily: "Fraunces", fontSize: 24, marginTop: 3 },
  sectionNote: { color: muted, fontFamily: "Manrope", fontSize: 12, flexShrink: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  card: { ...surface, padding: 16, gap: 8 },
  primaryCard: { borderColor: "#E6B622" },
  disabledCard: { backgroundColor: "#FAF8F2" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF1C0", alignItems: "center", justifyContent: "center" },
  primaryIcon: { backgroundColor: yellow },
  cardIndex: { color: muted, fontSize: 11, fontFamily: "ManropeBold" },
  cardTitle: { color: navy, fontSize: 17, lineHeight: 23, fontFamily: "ManropeExtraBold" },
  cardDescription: { color: muted, fontSize: 13, lineHeight: 20, fontFamily: "Manrope" },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto" },
  cardAction: { color: navy, fontSize: 12, fontFamily: "ManropeBold" },
  arrowCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: marketplaceBackground, alignItems: "center", justifyContent: "center" },
  accountBar: { ...surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, gap: 14 },
  accountCompact: { flexDirection: "column", alignItems: "stretch" },
  accountIdentity: { flexShrink: 1, flexWrap: "wrap", flexDirection: "row", alignItems: "center", gap: 10 },
  accountIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF1C0", alignItems: "center", justifyContent: "center" },
  accountTitle: { color: navy, fontFamily: "ManropeExtraBold", fontSize: 15 },
  accountDescription: { color: muted, fontFamily: "Manrope", fontSize: 12, marginTop: 4 },
  accountActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  profileButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: marketplaceBackground, borderRadius: 24, paddingHorizontal: 14, minHeight: 44 },
  signOut: { paddingHorizontal: 14, minHeight: 44, borderRadius: 24, justifyContent: "center", borderWidth: 1, borderColor: "rgba(20,38,62,0.16)" },
  signOutLabel: { color: navy, fontSize: 13, fontFamily: "ManropeBold" },
  accessPanel: { ...surface, width: "100%", maxWidth: 550, alignSelf: "center", padding: 20, gap: 10 },
  advisorCard: {
    backgroundColor: navy,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 2,
    borderColor: yellow,
    marginTop: 10,
    marginBottom: 10,
  },
  advisorCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  advisorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: yellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  advisorBadgeText: {
    fontSize: 11,
    fontFamily: "ManropeExtraBold",
    color: navy,
    letterSpacing: 0.5,
  },
  advisorDistrictText: {
    fontSize: 12,
    fontFamily: "ManropeBold",
    color: "#E2E8F0",
  },
  advisorCodeText: {
    fontSize: 32,
    fontFamily: "ManropeExtraBold",
    color: yellow,
    letterSpacing: 2,
  },
  advisorHelpText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Manrope",
    color: "#CBD5E1",
  },
  advisorActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  advisorShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#25D366",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  advisorShareLabel: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "ManropeBold",
  },
  advisorCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  advisorCopyLabel: {
    color: navy,
    fontSize: 13,
    fontFamily: "ManropeBold",
  },

});
