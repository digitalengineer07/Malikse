import { premiumStyles } from "../constants/typography";
import { dashboardRoutes } from "../src/utils/accountRoutes";
import React from "react";
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";

import BiharHeritageWatermark from "./BiharHeritageWatermark";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web"
    ? 0
    : Math.max(insets.bottom, Platform.OS === "android" ? 16 : 20);

  const { authState, user } = useAuthStore();
  const { language } = useLanguageStore();

  const isHomeActive = pathname === "/home" || pathname === "/";
  const isSearchActive = pathname === "/search";
  const isMessagesActive = pathname === "/messages";
  const isProfileActive = pathname === "/profile";

  if (authState === "AUTHENTICATED" && user && user.role !== "user") {
    return <View style={{ flexDirection: "row", justifyContent: "space-around", padding: 16, paddingBottom: bottomInset + 12, backgroundColor: "white" }}>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/home")}><Text style={{ color: "#111111", fontWeight: "700" }}>Marketplace</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push(dashboardRoutes[user.role])}><Text style={{ color: "#111111", fontWeight: "700" }}>Profile / Dashboard</Text></TouchableOpacity>
    </View>;
  }

  if (isDesktop) {
    return (
      <View style={styles.webWrapper}>
        <View style={styles.webFooterContainer}>
          {/* Left Watermark: Bihar Heritage Monument Skyline (Golghar, Mahabodhi) + caption */}
          <View style={styles.leftWatermark}>
            <BiharHeritageWatermark width={140} height={42} opacity={0.45} />
            <Text style={styles.watermarkText}>
              {language === "hi"
                ? "हर वर्गफ़ीट में\nविश्वास का निर्माण"
                : "Building Trust in\nEvery Square Foot"}
            </Text>
          </View>

          {/* Center Floating Dock */}
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
                color={isHomeActive ? "#111111" : "#64748B"}
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
                color={isSearchActive ? "#111111" : "#64748B"}
              />
              <Text style={[styles.dockLabel, isSearchActive && styles.dockLabelActive]}>
                {language === "hi" ? "खोज" : "Search"}
              </Text>
              {isSearchActive && <View style={styles.dockActiveBar} />}
            </TouchableOpacity>

            {/* Post (Elevated Green Plus) */}
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
                <MaterialIcons name="add" size={22} color="#FFFFFF" />
              </View>
              <Text style={[styles.dockLabel, { color: "#284B68", fontWeight: "700" }]}>
                {language === "hi" ? "पोस्ट" : "Post"}
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
                size={20}
                color={isMessagesActive ? "#111111" : "#64748B"}
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
                  router.push(user ? dashboardRoutes[user.role] : "/login");
                }
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="person-outline"
                size={22}
                color={isProfileActive ? "#111111" : "#64748B"}
              />
              <Text style={[styles.dockLabel, isProfileActive && styles.dockLabelActive]}>
                {language === "hi" ? "प्रोफ़ाइल" : "Profile"}
              </Text>
              {isProfileActive && <View style={styles.dockActiveBar} />}
            </TouchableOpacity>
          </View>

          {/* Right Watermark: Cursive Signature */}
          <View style={styles.rightWatermark}>
            <Text style={styles.cursiveTagline}>
              {language === "hi"
                ? "सत्यापित ज़मीन\nउज्ज्वल भविष्य"
                : "Verified Land\nBrighter Tomorrows"}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Mobile navigation
  return (
    <View style={[styles.mobileWrapper, { paddingBottom: bottomInset }]}>
      <View style={styles.mobileContainer}>
        <TouchableOpacity style={styles.tab} onPress={() => router.replace("/home")} activeOpacity={0.7}>
          <MaterialIcons name="home" size={22} color={isHomeActive ? "#111111" : "#64748B"} />
          <Text style={[styles.label, isHomeActive && styles.activeLabel]}>
            {language === "hi" ? "होम" : "Home"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={() => router.replace("/search")} activeOpacity={0.7}>
          <MaterialIcons name="search" size={22} color={isSearchActive ? "#111111" : "#64748B"} />
          <Text style={[styles.label, isSearchActive && styles.activeLabel]}>
            {language === "hi" ? "खोज" : "Search"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            if (authState !== "AUTHENTICATED") {
              router.push("/login");
            } else {
              router.push("/listing/create");
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.dockPostBtn}>
            <MaterialIcons name="add" size={20} color="#FFFFFF" />
          </View>
          <Text style={[styles.label, { color: "#284B68", fontWeight: "700" }]}>
            {language === "hi" ? "पोस्ट" : "Post"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tab} onPress={() => router.push("/messages")} activeOpacity={0.7}>
          <MaterialIcons name="chat-bubble-outline" size={22} color={isMessagesActive ? "#111111" : "#64748B"} />
          <Text style={[styles.label, isMessagesActive && styles.activeLabel]}>
            {language === "hi" ? "संदेश" : "Messages"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            if (authState !== "AUTHENTICATED") {
              router.push("/login");
            } else {
              router.push(user ? dashboardRoutes[user.role] : "/login");
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="person-outline" size={22} color={isProfileActive ? "#111111" : "#64748B"} />
          <Text style={[styles.label, isProfileActive && styles.activeLabel]}>
            {language === "hi" ? "प्रोफ़ाइल" : "Profile"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = premiumStyles({
  /* Web Desktop Floating Dock Layout */
  webWrapper: {
    backgroundColor: "transparent",
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 28,
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
    gap: 12,
    width: 250,
  },
  watermarkText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    lineHeight: 15,
    height: 30,
  },
  floatingDock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  dockItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    position: "relative",
    width: 54,
  },
  dockLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
    lineHeight: 13,
  },
  dockLabelActive: {
    color: "#111111",
    fontWeight: "700",
  },
  dockActiveBar: {
    position: "absolute",
    bottom: -4,
    width: 20,
    height: 2.5,
    backgroundColor: "#111111",
    borderRadius: 2,
  },
  dockPostBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rightWatermark: {
    alignItems: "flex-end",
    width: 220,
    opacity: 0.7,
  },
  cursiveTagline: {
    fontFamily: Platform.OS === "web" ? "Kalam, Caveat, 'Segoe Script', cursive" : "System",
    fontSize: 14,
    lineHeight: 17,
    height: 34,
    color: "#64748B",
    fontStyle: "italic",
    textAlign: "right",
    transform: [{ rotate: "-4deg" }],
  },

  /* Mobile Bottom Tab Bar */
  mobileWrapper: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  mobileContainer: {
    flexDirection: "row",
    height: 54,
    paddingTop: 4,
    paddingBottom: 2,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tab: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 2,
  },
  label: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  activeLabel: {
    color: "#111111",
    fontWeight: "800",
  },
});
