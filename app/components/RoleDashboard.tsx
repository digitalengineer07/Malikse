import { premiumStyles } from "../constants/typography";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import type { UserRole } from "../src/types/auth.types";
import { authService } from "../src/services/authService";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

type Section = { title: string; description: string; route?: Href };
const icons: React.ComponentProps<typeof MaterialIcons>["name"][] = ["space-dashboard", "fact-check", "home-work", "add-home-work", "folder-open", "swap-horiz"];

export default function RoleDashboard({ role, title, subtitle, sections }: {
  role: UserRole; title: string; subtitle: string; sections: Section[];
}) {
  const router = useRouter();
  const { user, authState } = useAuthStore();
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const cardWidth = compact ? "100%" : width < 1000 ? "48%" : "31.8%";

  if (authState !== "AUTHENTICATED" || user?.role !== role) {
    return <View style={styles.screen}><AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton />
      <View style={styles.accessPanel}><View style={styles.iconBox}><MaterialIcons name="lock-outline" size={28} color="#294B65" /></View>
        <Text style={styles.title}>Sign in as {role}</Text><Text style={styles.subtitle}>This dashboard is available to the {role} role.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.darkButton} onPress={() => router.replace("/login")}><Text style={styles.darkLabel}>Go to sign in</Text><MaterialIcons name="arrow-forward" size={18} color="white" /></TouchableOpacity>
      </View></View>;
  }

  return <View style={styles.screen}>
    <AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton />
    <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={styles.topline}><Text style={styles.eyebrow}>MALIKSE / YOUR WORKSPACE</Text><View style={styles.rolePill}><View style={styles.roleDot} /><Text style={styles.roleText}>{role}</Text></View></View>
      <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <Image source={require("../assets/saved_villa_house.jpg")} style={styles.heroBackground} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.heroCopy}><View style={styles.welcomeRow}><View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.charAt(0).toUpperCase()}</Text></View><Text style={styles.welcome}>Welcome, {user.name}</Text></View>
          <Text style={styles.heroTitle}>A place for{ "\n" }your next chapter.</Text>
          <Text style={styles.heroDescription}>Your properties, your people, and the tools you need to move forward.</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.whiteButton} onPress={() => router.replace("/home")}><Text style={styles.whiteLabel}>Explore verified properties</Text><MaterialIcons name="north-east" size={18} color="#111827" /></TouchableOpacity>
        </View>

      </View>
      <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>YOUR TOOLS</Text><Text accessibilityRole="header" style={styles.sectionTitle}>Make your next move.</Text></View><Text style={styles.sectionNote}>Built around your role</Text></View>
      <View style={styles.grid}>{sections.map((section, index) => <TouchableOpacity key={section.title} accessibilityRole="button" accessibilityState={{ disabled: !section.route }} style={[styles.card, { width: cardWidth }, index === 0 && styles.primaryCard, !section.route && styles.disabledCard]} disabled={!section.route} onPress={() => section.route && router.push(section.route)}>
        <View style={styles.cardTop}><View style={[styles.iconBox, index === 0 && styles.primaryIcon]}><MaterialIcons name={icons[index % icons.length]} size={24} color={index === 0 ? "#FFFFFF" : "#416980"} /></View><Text style={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</Text></View>
        <Text style={styles.cardTitle}>{section.title}</Text><Text style={styles.cardDescription}>{section.description}</Text>
        <View style={styles.cardBottom}><Text style={styles.cardAction}>{section.route ? "Open workspace" : "Coming later"}</Text><View style={styles.arrowCircle}><MaterialIcons name={section.route ? "north-east" : "schedule"} size={18} color="#111827" /></View></View>
      </TouchableOpacity>)}</View>
      <View style={[styles.accountBar, compact && styles.accountCompact]}><View style={styles.accountIdentity}><View style={styles.accountIcon}><MaterialIcons name="person-outline" size={24} color="#345A76" /></View><View><Text style={styles.accountTitle}>Your account</Text><Text style={styles.accountDescription}>Profile details and session settings</Text></View></View>
        <View style={styles.accountActions}><TouchableOpacity accessibilityRole="button" style={styles.profileButton} onPress={() => router.push("/profile")}><Text style={styles.whiteLabel}>My profile</Text><MaterialIcons name="north-east" size={15} color="#111827" /></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.signOut} onPress={() => { authService.logout().finally(() => router.replace("/login")); }}><Text style={styles.signOutLabel}>Sign out</Text></TouchableOpacity></View>
      </View>
    </ScrollView><BottomNav />
  </View>;
}

const styles = premiumStyles({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: 32, paddingTop: 32, paddingBottom: 44 },
  contentCompact: { paddingHorizontal: 20, paddingTop: 22 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 },
  eyebrow: { color: "#6B8295", fontSize: 10, fontWeight: "600", letterSpacing: 1.6 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#EDF6FC", borderRadius: 20 },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#6AA0C3" }, roleText: { textTransform: "capitalize", color: "#38556E", fontSize: 11, fontWeight: "600" },
  title: { color: "#101622", fontSize: 38, fontWeight: "800", letterSpacing: -1.3 }, titleCompact: { fontSize: 30 },
  subtitle: { color: "#6A7785", fontSize: 13, lineHeight: 22, marginTop: 9, maxWidth: 700 },
  hero: { marginTop: 30, marginBottom: 42, borderRadius: 32, backgroundColor: "#1D617B", padding: 12, minHeight: 400, flexDirection: "row", overflow: "hidden" },
  heroBackground: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "#102E46A8" },
  heroCompact: { flexDirection: "column", borderRadius: 28 },
  heroCopy: { flex: 1, padding: 24, gap: 17 }, welcomeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { backgroundColor: "transparent", height: 35, width: 35, borderRadius: 18, alignItems: "center", justifyContent: "center" }, avatarText: { fontSize: 13, color: "#224561", fontWeight: "700" },
  welcome: { fontSize: 12, color: "#E6F3FC", flexShrink: 1 },
  heroTitle: { fontSize: 44, lineHeight: 49, fontWeight: "700", letterSpacing: -1.2, color: "#FFFFFF" },
  heroDescription: { color: "#E0EFF8", fontSize: 15, lineHeight: 21, maxWidth: 310 },
  whiteButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14, paddingHorizontal: 19, backgroundColor: "transparent", borderRadius: 30, marginTop: 4 },
  whiteLabel: { color: "#111827", fontSize: 12, fontWeight: "600" },
  heroVisual: { flex: 0.85, minHeight: 300, borderRadius: 25, overflow: "hidden", backgroundColor: "#AECBDC" },
  heroVisualCompact: { flex: undefined, minHeight: 220 }, heroImage: { width: "100%", height: "100%", position: "absolute" },
  glassCaption: { position: "absolute", bottom: 14, left: 14, right: 14, padding: 17, backgroundColor: "#182F4AC9", borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  captionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" }, captionText: { color: "#DBE8F2", fontSize: 10, marginTop: 5 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 15, marginBottom: 23 },
  sectionTitle: { color: "#111827", fontWeight: "700", fontSize: 24, letterSpacing: -0.7, marginTop: 9 }, sectionNote: { color: "#7C8D9D", fontSize: 10, flexShrink: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  card: { minHeight: 250, borderRadius: 28, padding: 24, backgroundColor: "#F3F8FC", borderWidth: 1, borderColor: "#EBF1F6" },
  primaryCard: { backgroundColor: "#DFEEFA", borderColor: "#DFEEFA" }, disabledCard: { backgroundColor: "#F7F8FA" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 23 },
  iconBox: { width: 46, height: 46, borderRadius: 23, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" }, primaryIcon: { backgroundColor: "#142131" },
  cardIndex: { color: "#7F97AA", fontSize: 11 }, cardTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#142131", lineHeight: 25 },
  cardDescription: { color: "#657A8E", fontSize: 12, lineHeight: 20, marginTop: 10, flex: 1 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22 },
  cardAction: { color: "#233E54", fontSize: 11, fontWeight: "600" }, arrowCircle: { width: 33, height: 33, borderRadius: 17, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  accountBar: { marginTop: 35, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 23, borderWidth: 1, borderColor: "#E8EFF5", borderRadius: 26, gap: 20 },
  accountCompact: { flexDirection: "column", alignItems: "stretch" }, accountIdentity: { flexDirection: "row", alignItems: "center", gap: 13 },
  accountIcon: { width: 43, height: 43, borderRadius: 22, backgroundColor: "#EFF6FC", alignItems: "center", justifyContent: "center" },
  accountTitle: { fontSize: 15, fontWeight: "600", color: "#142131" }, accountDescription: { fontSize: 11, color: "#788B9D", marginTop: 5 },
  accountActions: { flexDirection: "row", alignItems: "center", gap: 20 }, profileButton: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "#EFF6FC", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12 },
  signOut: { padding: 10 }, signOutLabel: { fontSize: 12, color: "#6C7B88" },
  accessPanel: { width: "100%", maxWidth: 550, alignSelf: "center", padding: 30, marginTop: 40, gap: 15 },
  darkButton: { backgroundColor: "#111827", borderRadius: 28, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15 }, darkLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
});
