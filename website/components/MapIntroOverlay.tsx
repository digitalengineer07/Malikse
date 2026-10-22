import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface MapIntroOverlayProps {
  totalCount?: number;
  activeStateName?: string;
}

export default function MapIntroOverlay({
  totalCount,
  activeStateName,
}: MapIntroOverlayProps) {
  const displayCount =
    totalCount && totalCount > 0
      ? `${totalCount.toLocaleString("en-IN")}+`
      : "12,000+";

  return (
    <View style={styles.card}>
      {/* Decorative Compass in Top Right */}
      <View style={styles.compassContainer}>
        {Platform.OS === "web" ? (
          <svg width="34" height="34" viewBox="0 0 40 40" style={{ opacity: 0.35 }}>
            <circle cx="20" cy="20" r="18" fill="none" stroke="#D9EEFC" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="13" fill="none" stroke="#D9EEFC" strokeWidth="1" strokeDasharray="2,2" />
            <polygon points="20,5 23,17 35,20 23,23 20,35 17,23 5,20 17,17" fill="#D9EEFC" />
            <polygon points="20,5 23,17 20,20 17,17" fill="#FFFFFF" />
            <circle cx="20" cy="20" r="2.5" fill="#102B52" />
          </svg>
        ) : (
          <MaterialIcons name="explore" size={28} color="rgba(217, 238, 252, 0.4)" />
        )}
      </View>

      {/* Main Title */}
      <Text style={styles.title}>
        {activeStateName
          ? `Properties in ${activeStateName}`
          : "Explore Properties Across India"}
      </Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        {activeStateName
          ? "Browse verified parcels, flats, homes and commercial opportunities in this region."
          : "Search by state to discover lands, flats, houses, shops and offices."}
      </Text>

      {/* Verified Properties Stat Badge Card */}
      <View style={styles.statsCard}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="apartment" size={20} color="#D9EEFC" />
        </View>
        <View style={styles.statsTextWrap}>
          <Text style={styles.statsNumber}>{displayCount}</Text>
          <Text style={styles.statsLabel}>
            {activeStateName
              ? `Verified Listings in ${activeStateName}`
              : "Verified Properties Across India"}
          </Text>
        </View>
      </View>

      {/* Trust Micro-Badge */}
      <View style={styles.trustBadge}>
        <MaterialIcons name="verified" size={14} color="#38BDF8" style={{ marginRight: 6 }} />
        <Text style={styles.trustText}>Survey of India Verified Coordinates</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(3, 69, 108, 0.92)",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    padding: 22,
    maxWidth: 310,
    width: "100%",
    position: "relative",
    overflow: "hidden",
    ...Platform.select({
      web: {
        backdropFilter: "blur(14px)",
        boxShadow: "0 16px 36px rgba(10, 25, 47, 0.35)",
      },
      default: {
        shadowColor: "#0A192F",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  compassContainer: {
    position: "absolute",
    top: 14,
    right: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    lineHeight: 26,
    paddingRight: 24,
  },
  subtitle: {
    fontSize: 13,
    color: "#E0F2FE",
    lineHeight: 19,
    marginTop: 8,
    fontWeight: "400",
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(2, 132, 199, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statsTextWrap: {
    flex: 1,
  },
  statsNumber: {
    fontSize: 19,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#BAE6FD",
    marginTop: 1,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.14)",
  },
  trustText: {
    fontSize: 11,
    color: "#E0F2FE",
    fontWeight: "500",
  },
});
