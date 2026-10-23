import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BIHAR_DISTRICTS_DATA, type BiharDistrictInfo } from "../src/data/biharDistrictsData";

interface BiharDistrictExplorerPanelProps {
  selectedDistrict?: string;
  onSelectDistrict: (district: BiharDistrictInfo) => void;
  onClearDistrict?: () => void;
  districtCounts?: Record<string, number>;
}

export default function BiharDistrictExplorerPanel({
  selectedDistrict,
  onSelectDistrict,
  onClearDistrict,
  districtCounts = {},
}: BiharDistrictExplorerPanelProps) {
  const [filterText, setFilterText] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "airports" | "industrial">("all");

  const filteredDistricts = useMemo(() => {
    let list = BIHAR_DISTRICTS_DATA;

    // Filter by category tab
    if (activeTab === "active") {
      list = list.filter((d) => (districtCounts[d.name] || 0) > 0 || d.highlight);
    } else if (activeTab === "airports") {
      list = list.filter(
        (d) =>
          d.name === "Patna" ||
          d.name === "Darbhanga" ||
          d.name === "Gaya" ||
          d.name === "Purnia" ||
          d.name === "Saran"
      );
    } else if (activeTab === "industrial") {
      list = list.filter(
        (d) =>
          d.name === "Muzaffarpur" ||
          d.name === "Vaishali" ||
          d.name === "Begusarai" ||
          d.name === "Gaya" ||
          d.name === "Rohtas" ||
          d.name === "Bhojpur"
      );
    }

    // Filter by text search
    const term = filterText.trim().toLowerCase();
    if (!term) {
      // Sort active listings to the top
      return [...list].sort((a, b) => {
        const countA = districtCounts[a.name] || (a.highlight ? 1 : 0);
        const countB = districtCounts[b.name] || (b.highlight ? 1 : 0);
        return countB - countA;
      });
    }

    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.headquarters.toLowerCase().includes(term) ||
        d.prominentHubs.toLowerCase().includes(term) ||
        d.tag.toLowerCase().includes(term)
    );
  }, [filterText, activeTab, districtCounts]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="location-city" size={18} color="#03456C" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Bihar Prime Districts</Text>
            <Text style={styles.headerSubtitle}>Key cities & economic corridors</Text>
          </View>
        </View>

        <View style={styles.activeHubBadge}>
          <Text style={styles.activeHubText}>5 Active Hubs</Text>
        </View>
      </View>

      {/* Selected District Banner with Clear action */}
      {!!selectedDistrict && (
        <View style={styles.activeBanner}>
          <View style={styles.activeBannerLeft}>
            <MaterialIcons name="check-circle" size={16} color="#0284C7" />
            <Text style={styles.activeBannerText} numberOfLines={1}>
              Active: <Text style={{ fontWeight: "700" }}>{selectedDistrict}</Text>
            </Text>
          </View>
          {onClearDistrict && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="View All Districts"
              onPress={onClearDistrict}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>Show All</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={18} color="#64748B" style={{ marginRight: 6 }} />
        <TextInput
          accessibilityLabel="Search city, district or corridor in Bihar"
          placeholder="Search city, district, corridor (e.g. Patna, Bihta, Gaya)..."
          placeholderTextColor="#94A3B8"
          value={filterText}
          onChangeText={setFilterText}
          autoCorrect={false}
          style={styles.searchInput}
        />
        {filterText.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setFilterText("")}
            style={styles.searchClear}
          >
            <MaterialIcons name="close" size={16} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Filter Category Pills */}
      <View style={styles.filterTabsRow}>
        <TouchableOpacity
          style={[styles.filterTabPill, activeTab === "all" && styles.filterTabPillActive]}
          onPress={() => setActiveTab("all")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterTabText, activeTab === "all" && styles.filterTabTextActive]}>
            All (38)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTabPill, activeTab === "active" && styles.filterTabPillActive]}
          onPress={() => setActiveTab("active")}
          activeOpacity={0.8}
        >
          <View style={styles.pulseDotGreen} />
          <Text style={[styles.filterTabText, activeTab === "active" && styles.filterTabTextActive]}>
            Active Hubs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTabPill, activeTab === "airports" && styles.filterTabPillActive]}
          onPress={() => setActiveTab("airports")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterTabText, activeTab === "airports" && styles.filterTabTextActive]}>
            Airports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTabPill, activeTab === "industrial" && styles.filterTabPillActive]}
          onPress={() => setActiveTab("industrial")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterTabText, activeTab === "industrial" && styles.filterTabTextActive]}>
            Industrial
          </Text>
        </TouchableOpacity>
      </View>

      {/* Districts Scrollable List */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {filteredDistricts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialIcons name="location-off" size={28} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No district found</Text>
            <Text style={styles.emptySubtitle}>Try searching Patna, Bihta, Gaya or Muzaffarpur</Text>
          </View>
        ) : (
          filteredDistricts.map((district) => {
            const count = districtCounts[district.name] ?? 0;
            const hasListings = count > 0;
            const isSelected = selectedDistrict?.toLowerCase() === district.name.toLowerCase();

            return (
              <TouchableOpacity
                key={district.id}
                style={[
                  styles.districtItem,
                  hasListings && styles.districtItemActive,
                  isSelected && styles.districtItemSelected,
                ]}
                onPress={() => onSelectDistrict(district)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${district.name} district, ${count} listings`}
              >
                {/* Left Icon */}
                <View
                  style={[
                    styles.districtIconWrap,
                    hasListings && styles.districtIconWrapActive,
                    isSelected && styles.districtIconWrapSelected,
                  ]}
                >
                  <MaterialIcons
                    name={hasListings ? "verified" : "apartment"}
                    size={17}
                    color={isSelected ? "#FFFFFF" : hasListings ? "#0284C7" : "#64748B"}
                  />
                </View>

                {/* District Content */}
                <View style={styles.districtContent}>
                  <View style={styles.districtTopRow}>
                    <Text
                      style={[
                        styles.districtName,
                        isSelected && styles.districtNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {district.name}
                    </Text>

                    {hasListings ? (
                      <View style={styles.verifiedCountPill}>
                        <Text style={styles.verifiedCountText}>
                          {count} {count === 1 ? "Listing" : "Listings"}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.surveyedTag}>Surveyed</Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.prominentHubsText,
                      isSelected && styles.prominentHubsTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {district.prominentHubs}
                  </Text>
                </View>

                {/* Right Arrow */}
                <MaterialIcons
                  name="chevron-right"
                  size={18}
                  color={isSelected ? "#0284C7" : "#CBD5E1"}
                />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 18,
    width: 330,
    maxHeight: 520,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  activeHubBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  activeHubText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#059669",
  },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  activeBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  activeBannerText: {
    fontSize: 12,
    color: "#0369A1",
  },
  clearBtn: {
    backgroundColor: "#0284C7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: "#0F172A",
    padding: 0,
    outlineStyle: "none" as any,
  },
  searchClear: {
    padding: 2,
  },
  filterTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 12,
  },
  filterTabPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 9999,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    gap: 4,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  filterTabPillActive: {
    backgroundColor: "#03456C",
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  pulseDotGreen: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
  },
  listScroll: {
    maxHeight: 330,
  },
  listContent: {
    gap: 6,
    paddingRight: 4,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  emptySubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },
  districtItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 10,
    gap: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  districtItemActive: {
    borderColor: "#E0F2FE",
    backgroundColor: "#F8FAFC",
  },
  districtItemSelected: {
    borderColor: "#38BDF8",
    backgroundColor: "#F0F9FF",
  },
  districtIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  districtIconWrapActive: {
    backgroundColor: "#E0F2FE",
  },
  districtIconWrapSelected: {
    backgroundColor: "#0284C7",
  },
  districtContent: {
    flex: 1,
    minWidth: 0,
  },
  districtTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  districtName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  districtNameSelected: {
    color: "#0284C7",
  },
  verifiedCountPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  surveyedTag: {
    fontSize: 9.5,
    color: "#94A3B8",
    fontWeight: "500",
  },
  prominentHubsText: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2,
  },
  prominentHubsTextSelected: {
    color: "#0369A1",
  },
});
