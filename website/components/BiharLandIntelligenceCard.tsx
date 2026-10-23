import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface BiharLandIntelligenceCardProps {
  totalCount?: number;
  activeDistrictName?: string;
  onSelectQuickHub?: (district: string, lat: number, lng: number, zoom: number) => void;
  onResetView?: () => void;
}

const QUICK_HUBS = [
  { name: "Patna & Bihta", district: "Patna", lat: 25.5688, lng: 84.8694, zoom: 11.5, icon: "flight-takeoff" as const },
  { name: "Muzaffarpur NH-28", district: "Muzaffarpur", lat: 26.1209, lng: 85.3647, zoom: 11.5, icon: "store" as const },
  { name: "Bodh Gaya Node", district: "Gaya", lat: 24.6961, lng: 84.9869, zoom: 11.5, icon: "business" as const },
  { name: "Darbhanga Airport", district: "Darbhanga", lat: 26.1542, lng: 85.8918, zoom: 11.5, icon: "local-airport" as const },
  { name: "Hajipur Paswan Chowk", district: "Vaishali", lat: 25.6858, lng: 85.2146, zoom: 11.5, icon: "precision-manufacturing" as const },
];

export default function BiharLandIntelligenceCard({
  totalCount = 14,
  activeDistrictName,
  onSelectQuickHub,
  onResetView,
}: BiharLandIntelligenceCardProps) {
  const displayCount =
    typeof totalCount === "number" && totalCount > 0
      ? `${totalCount.toLocaleString("en-IN")}`
      : "14";

  return (
    <View style={styles.card}>
      {/* Decorative Compass Overlay */}
      <View style={styles.compassContainer}>
        {Platform.OS === "web" ? (
          <svg width="38" height="38" viewBox="0 0 40 40" style={{ opacity: 0.22 }}>
            <circle cx="20" cy="20" r="18" fill="none" stroke="#0284C7" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="13" fill="none" stroke="#0284C7" strokeWidth="1" strokeDasharray="2,2" />
            <polygon points="20,4 23,17 36,20 23,23 20,36 17,23 4,20 17,17" fill="#0284C7" />
            <polygon points="20,4 23,17 20,20 17,17" fill="#03456C" />
            <circle cx="20" cy="20" r="3" fill="#0F172A" />
          </svg>
        ) : (
          <MaterialIcons name="explore" size={30} color="rgba(2, 132, 199, 0.25)" />
        )}
      </View>

      {/* Market Focus Indicator */}
      <View style={styles.badgeRow}>
        <View style={styles.marketBadge}>
          <View style={styles.livePulseDot} />
          <Text style={styles.marketBadgeText}>BIHAR STATE FOCUS</Text>
        </View>
        <Text style={styles.stateCodePill}>BR · 38 Districts</Text>
      </View>

      {/* Main Title */}
      <Text style={styles.title}>
        {activeDistrictName ? `${activeDistrictName} Land Hub` : "Bihar Property & Land Hub"}
      </Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        {activeDistrictName
          ? `Verified commercial corridors, residential plots and registry land parcels in ${activeDistrictName}.`
          : "Discover high-growth investment corridors, highway commercial plots & residential lands across Bihar."}
      </Text>

      {/* Live Verified Stat Banner */}
      <View style={styles.statsCard}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="verified" size={20} color="#0284C7" />
        </View>
        <View style={styles.statsTextWrap}>
          <View style={styles.statCountRow}>
            <Text style={styles.statsNumber}>{displayCount}</Text>
            <Text style={styles.statsUnit}>Live Listings</Text>
          </View>
          <Text style={styles.statsLabel}>
            {activeDistrictName ? `Verified in ${activeDistrictName}` : "100% On-Ground Verified Listings"}
          </Text>
        </View>
      </View>

      {/* Key Corridors Quick Filter Strip */}
      <View style={styles.quickHubsSection}>
        <Text style={styles.quickHubsHeader}>TOP INVESTMENT CORRIDORS</Text>
        <View style={styles.quickHubsWrap}>
          {QUICK_HUBS.map((hub) => {
            const isActive = activeDistrictName === hub.district;
            return (
              <TouchableOpacity
                key={hub.name}
                style={[styles.quickHubChip, isActive && styles.quickHubChipActive]}
                onPress={() => onSelectQuickHub?.(hub.district, hub.lat, hub.lng, hub.zoom)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Zoom to ${hub.name}`}
              >
                <MaterialIcons
                  name={hub.icon}
                  size={12}
                  color={isActive ? "#FFFFFF" : "#0284C7"}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.quickHubText, isActive && styles.quickHubTextActive]}>
                  {hub.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Reset State Action if District Selected */}
      {!!activeDistrictName && onResetView && (
        <TouchableOpacity
          style={styles.resetDistrictBtn}
          onPress={onResetView}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <MaterialIcons name="zoom-out-map" size={14} color="#0284C7" />
          <Text style={styles.resetDistrictText}>View Entire Bihar</Text>
        </TouchableOpacity>
      )}

      {/* Trust & Boundary Demarcation Footer */}
      <View style={styles.trustBadge}>
        <MaterialIcons name="shield" size={13} color="#059669" style={{ marginRight: 6 }} />
        <Text style={styles.trustText}>Bhu-Naksha & Revenue Survey GIS Demarcated</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 20,
    maxWidth: 320,
    width: "100%",
    position: "relative",
    overflow: "hidden",
    ...Platform.select({
      web: {
        backdropFilter: "blur(20px)",
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
      },
      default: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  compassContainer: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 1,
    pointerEvents: "none",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingRight: 40,
  },
  marketBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  marketBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
  },
  stateCodePill: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 26,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
    marginBottom: 14,
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  statsTextWrap: {
    flex: 1,
  },
  statCountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  statsNumber: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  statsUnit: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7",
  },
  statsLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 1,
  },
  quickHubsSection: {
    marginBottom: 14,
  },
  quickHubsHeader: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  quickHubsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  quickHubChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  quickHubChipActive: {
    backgroundColor: "#03456C",
    borderColor: "#03456C",
  },
  quickHubText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#334155",
  },
  quickHubTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resetDistrictBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingVertical: 8,
    gap: 6,
    marginBottom: 12,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  resetDistrictText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0284C7",
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  trustText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
    flexShrink: 1,
  },
});
