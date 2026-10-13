import React from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import { dashboardRoutes } from "../src/utils/accountRoutes";
import BiharHeritageWatermark from "./BiharHeritageWatermark";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web"
    ? 16
    : Math.max(insets.bottom, Platform.OS === "android" ? 16 : 20);

  const { authState, user } = useAuthStore();
  const { language } = useLanguageStore();

  const isHomeActive = pathname === "/home" || pathname === "/";
  const isSearchActive = pathname === "/search";
  const isMessagesActive = pathname === "/messages";
  const isProfileActive = pathname === "/profile";

  if (authState === "AUTHENTICATED" && user && user.role !== "user") {
    return (
      <View style={[styles.staffBar, { paddingBottom: bottomInset }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/home")}>
          <Text style={styles.staffLink}>Marketplace</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push(dashboardRoutes[user.role] as any)}>
          <Text style={styles.staffLink}>Profile / Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isDesktop) {
    return (
      <View style={[styles.webWrapper, { paddingBottom: bottomInset }]} pointerEvents="box-none">
        <View style={styles.webFooterContainer}>
          {/* Left Watermark: Monument + Vertical Divider + Text */}
          <View style={styles.leftWatermark}>
            <BiharHeritageWatermark width={125} height={38} opacity={0.65} />
            <View style={styles.dividerBar} />
            <View>
              <Text style={styles.watermarkTextBold}>Building Trust in</Text>
              <Text style={styles.watermarkTextBold}>Every Square Foot</Text>
            </View>
          </View>

          {/* Center Floating Dock (Pure White Pill) */}
          <View style={styles.floatingDock}>
            {/* Home */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => router.replace("/home")}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="home"
                size={22}
                color={isHomeActive ? "#0A192F" : "#475569"}
              />
              <Text style={[styles.dockLabel, isHomeActive && styles.dockLabelActive]}>
                {language === "hi" ? "होम" : "Home"}
              </Text>
              {isHomeActive && <View style={styles.dockActiveBar} />}
            </TouchableOpacity>

            {/* Search */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => router.replace("/search")}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="search"
                size={22}
                color={isSearchActive ? "#0A192F" : "#475569"}
              />
              <Text style={[styles.dockLabel, isSearchActive && styles.dockLabelActive]}>
                {language === "hi" ? "खोज" : "Search"}
              </Text>
              {isSearchActive && <View style={styles.dockActiveBar} />}
            </TouchableOpacity>

            {/* Post (+ Button) */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => {
                if (authState !== "AUTHENTICATED") {
                  router.push("/login");
                } else {
                  router.push("/listing/create");
                }
              }}
              activeOpacity={0.85}
            >
              <View style={styles.dockPostBtn}>
                <MaterialIcons name="add" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.dockLabel}>
                {language === "hi" ? "जोड़ें" : "Post"}
              </Text>
            </TouchableOpacity>

            {/* Messages */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => router.push("/messages")}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="chat-bubble-outline"
                size={21}
                color={isMessagesActive ? "#0A192F" : "#475569"}
              />
              <Text style={[styles.dockLabel, isMessagesActive && styles.dockLabelActive]}>
                {language === "hi" ? "संदेश" : "Messages"}
              </Text>
              {isMessagesActive && <View style={styles.dockActiveBar} />}
            </TouchableOpacity>

            {/* Profile */}
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => {
                if (authState !== "AUTHENTICATED") {
                  router.push("/login");
                } else {
                  router.push(user ? dashboardRoutes[user.role] as any : "/login");
                }
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="person-outline"
                size={22}
                color={isProfileActive ? "#0A192F" : "#475569"}
              />
              <Text style={[styles.dockLabel, isProfileActive && styles.dockLabelActive]}>
                {language === "hi" ? "प्रोफ़ाइल" : "Profile"}
              </Text>
              {isProfileActive && <View style={styles.dockActiveBar} />}
            </TouchableOpacity>
          </View>

          {/* Right Watermark: Calligraphic Script Signature */}
          <View style={styles.rightWatermark}>
            <Text style={styles.cursiveTagline}>Verified Land,</Text>
            <Text style={styles.cursiveTagline}>Brighter Tomorrows</Text>
            {Platform.OS === "web" && (
              <svg width="150" height="8" viewBox="0 0 150 8" style={{ marginTop: 2, display: "block" }}>
                <path d="M4,5 Q50,1 95,4 Q130,6 148,2" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
              </svg>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Mobile Bottom Navigation
  return (
    <View style={[styles.mobileWrapper, { paddingBottom: bottomInset }]} pointerEvents="box-none">
      <View style={styles.mobileDock}>
        <TouchableOpacity style={styles.mobileTab} onPress={() => router.replace("/home")} activeOpacity={0.7}>
          <MaterialIcons name="home" size={24} color={isHomeActive ? "#0A192F" : "#64748B"} />
          <Text style={[styles.mobileLabel, isHomeActive && styles.mobileLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mobileTab} onPress={() => router.replace("/search")} activeOpacity={0.7}>
          <MaterialIcons name="search" size={24} color={isSearchActive ? "#0A192F" : "#64748B"} />
          <Text style={[styles.mobileLabel, isSearchActive && styles.mobileLabelActive]}>Search</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mobileTab}
          onPress={() => (authState !== "AUTHENTICATED" ? router.push("/login") : router.push("/listing/create"))}
          activeOpacity={0.7}
        >
          <View style={styles.dockPostBtn}>
            <MaterialIcons name="add" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.mobileLabel}>Post</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mobileTab} onPress={() => router.push("/messages")} activeOpacity={0.7}>
          <MaterialIcons name="chat-bubble-outline" size={23} color={isMessagesActive ? "#0A192F" : "#64748B"} />
          <Text style={[styles.mobileLabel, isMessagesActive && styles.mobileLabelActive]}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mobileTab}
          onPress={() => (authState !== "AUTHENTICATED" ? router.push("/login") : router.push(user ? dashboardRoutes[user.role] as any : "/login"))}
          activeOpacity={0.7}
        >
          <MaterialIcons name="person-outline" size={24} color={isProfileActive ? "#0A192F" : "#64748B"} />
          <Text style={[styles.mobileLabel, isProfileActive && styles.mobileLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    backgroundColor: "transparent",
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 28,
    position: "relative",
    zIndex: 100,
  },
  webFooterContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 1340,
    width: "100%",
    alignSelf: "center",
  },
  leftWatermark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: 280,
  },
  dividerBar: {
    width: 1.5,
    height: 34,
    backgroundColor: "rgba(100, 116, 139, 0.4)",
    marginHorizontal: 2,
  },
  watermarkTextBold: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    lineHeight: 16,
  },
  floatingDock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 26,
    paddingVertical: 8,
    gap: 22,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    shadowColor: "#0F2137",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  dockItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    position: "relative",
    minWidth: 52,
  },
  dockLabel: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
    marginTop: 2,
  },
  dockLabelActive: {
    color: "#0A192F",
    fontWeight: "700",
  },
  dockActiveBar: {
    position: "absolute",
    bottom: -6,
    width: 22,
    height: 3,
    backgroundColor: "#0284C7",
    borderRadius: 2,
  },
  dockPostBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0A192F",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0A192F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  rightWatermark: {
    alignItems: "flex-end",
    width: 240,
  },
  cursiveTagline: {
    fontFamily: Platform.OS === "web" ? "'Segoe Script', 'Brush Script MT', 'Caveat', 'Kalam', cursive" : "System",
    fontSize: 19,
    lineHeight: 22,
    color: "#1E3A5F",
    fontWeight: "700",
    fontStyle: "italic",
    textAlign: "right",
  },
  mobileWrapper: {
    position: "relative",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  mobileDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingVertical: 8,
    width: "92%",
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  mobileTab: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  mobileLabel: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  mobileLabelActive: {
    color: "#0A192F",
    fontWeight: "700",
  },
  staffBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  staffLink: {
    color: "#0A192F",
    fontWeight: "700",
  },
});
