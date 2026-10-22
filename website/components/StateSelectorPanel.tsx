import React, { useMemo, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { INDIA_STATES_DATA, type IndiaStateInfo } from "../src/data/indiaStatesData";

interface StateSelectorPanelProps {
  selectedState?: string;
  onSelectState: (state: IndiaStateInfo) => void;
  onClearState?: () => void;
  stateCounts?: Record<string, number>;
}

export default function StateSelectorPanel({
  selectedState,
  onSelectState,
  onClearState,
  stateCounts = {},
}: StateSelectorPanelProps) {
  const [filterText, setFilterText] = useState("");

  const filteredStates = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    if (!term) return INDIA_STATES_DATA;
    return INDIA_STATES_DATA.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.capital.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term)
    );
  }, [filterText]);

  return (
    <View style={styles.card}>
      {/* Panel Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.mapIconCircle}>
            <MaterialIcons name="map" size={18} color="#03456C" />
          </View>
          <Text style={styles.headerTitle}>All States</Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>36 States & UTs</Text>
        </View>
      </View>

      {/* Selected State Notice with Clear option */}
      {!!selectedState && (
        <View style={styles.activeBanner}>
          <View style={styles.activeBannerLeft}>
            <MaterialIcons name="check-circle" size={16} color="#0284C7" />
            <Text style={styles.activeBannerText} numberOfLines={1}>
              Selected: <Text style={{ fontWeight: "700" }}>{selectedState}</Text>
            </Text>
          </View>
          {onClearState && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Reset to All States"
              onPress={onClearState}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Search Input Field */}
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={18} color="#64748B" style={{ marginRight: 6 }} />
        <TextInput
          accessibilityLabel="Search state or union territory"
          placeholder="Search state or union territory..."
          placeholderTextColor="#94A3B8"
          value={filterText}
          onChangeText={setFilterText}
          autoCorrect={false}
          style={styles.searchInput}
        />
        {filterText.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear state search"
            onPress={() => setFilterText("")}
            style={styles.searchClear}
          >
            <MaterialIcons name="close" size={16} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable State List */}
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
      >
        {filteredStates.map((state) => {
          const isSelected =
            selectedState?.toLowerCase() === state.name.toLowerCase() ||
            selectedState?.toLowerCase() === state.code.toLowerCase();
          const count = stateCounts[state.name] || stateCounts[state.code];

          return (
            <TouchableOpacity
              key={state.code}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectState(state)}
              activeOpacity={0.8}
              style={[
                styles.stateItem,
                isSelected ? styles.stateItemSelected : styles.stateItemDefault,
              ]}
            >
              {/* Regional Thumbnail */}
              {state.image ? (
                <Image
                  source={{ uri: state.image }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.thumbnail,
                    {
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? "#E0F2FE" : "#F1F5F9",
                    },
                  ]}
                >
                  <MaterialIcons
                    name="location-city"
                    size={22}
                    color={isSelected ? "#03456C" : "#64748B"}
                  />
                </View>
              )}

              {/* State Name and Subtitle */}
              <View style={styles.stateInfo}>
                <View style={styles.nameRow}>
                  <Text
                    style={[
                      styles.stateName,
                      isSelected && styles.stateNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {state.name}
                  </Text>
                  {state.type === "ut" && (
                    <View style={styles.utBadge}>
                      <Text style={styles.utText}>UT</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.stateSubtitle} numberOfLines={1}>
                  {count !== undefined && count > 0
                    ? `${count} verified listing${count === 1 ? "" : "s"}`
                    : "Explore properties"}
                </Text>
              </View>

              {/* Right Chevron */}
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={isSelected ? "#03456C" : "#94A3B8"}
              />
            </TouchableOpacity>
          );
        })}

        {filteredStates.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No state found matching &quot;{filterText}&quot;</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: "100%",
    maxWidth: 340,
    maxHeight: 580,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 30px rgba(10, 25, 47, 0.08)",
      },
      default: {
        shadowColor: "#0A192F",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 6,
      },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  mapIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03456C",
  },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#BAE6FD",
  },
  activeBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  activeBannerText: {
    fontSize: 12,
    color: "#0A192F",
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#E0F2FE",
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03456C",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 2,
    ...(Platform.OS === "web" ? { outlineWidth: 0 } : {}),
  },
  searchClear: {
    padding: 2,
  },
  listScroll: {
    flex: 1,
    maxHeight: 460,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 6,
  },
  stateItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  stateItemDefault: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F1F5F9",
  },
  stateItemSelected: {
    backgroundColor: "#F0F9FF",
    borderColor: "#0284C7",
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    marginRight: 12,
  },
  stateInfo: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stateName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A192F",
  },
  stateNameSelected: {
    color: "#03456C",
    fontWeight: "800",
  },
  utBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  utText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
  },
  stateSubtitle: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 2,
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
  },
});
