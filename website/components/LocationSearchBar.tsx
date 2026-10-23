import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { LocationSuggestion } from "../src/services/regionService";

interface LocationSearchBarProps {
  query: string;
  onChangeQuery: (text: string) => void;
  onSearch: () => void;
  suggestions: LocationSuggestion[];
  suggesting: boolean;
  suggestionError: boolean;
  onSelectSuggestion: (item: LocationSuggestion) => void;
  onCurrentLocation?: () => void;
  locating?: boolean;
}

export default function LocationSearchBar({
  query,
  onChangeQuery,
  onSearch,
  suggestions,
  suggesting,
  suggestionError,
  onSelectSuggestion,
  onCurrentLocation,
  locating = false,
}: LocationSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const showDropdown = isFocused && query.trim().length >= 2;

  return (
    <View style={styles.wrapper}>
      {/* Enhanced Luxury Search Input Bar */}
      <View style={[styles.bar, isFocused && styles.barFocused]}>
        {/* Left Compass/Explore Icon Badge */}
        <View style={styles.iconBadge}>
          <MaterialIcons name="explore" size={20} color="#0284C7" />
        </View>

        {/* Input Field */}
        <TextInput
          accessibilityLabel="Search city, area, district or corridor"
          placeholder="Search city, area, corridor or district (e.g. Patna, Bihta, Gaya)..."
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSearch}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 250);
          }}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />

        {/* Clear query button */}
        {query.trim().length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear search input"
            onPress={() => onChangeQuery("")}
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={18} color="#64748B" />
          </TouchableOpacity>
        )}

        {/* Current Location GPS Button */}
        {onCurrentLocation && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            onPress={onCurrentLocation}
            style={styles.locateBtn}
            disabled={locating}
            activeOpacity={0.7}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#0284C7" />
            ) : (
              <>
                <MaterialIcons name="my-location" size={16} color="#0284C7" />
                <Text style={styles.locateBtnText}>Near me</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Prominent Search Action Button */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Search location on map"
          onPress={onSearch}
          style={styles.searchBtn}
          activeOpacity={0.88}
        >
          <MaterialIcons name="search" size={17} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Autocomplete Suggestions Dropdown */}
      {showDropdown && (
        <View
          style={styles.dropdown}
          {...(Platform.OS === "web"
            ? ({ onMouseDown: (e: any) => e.preventDefault() } as any)
            : {})}
        >
          {/* Section Header */}
          <View style={styles.dropdownHeader}>
            <MaterialIcons name="near-me" size={13} color="#0284C7" style={{ marginRight: 5 }} />
            <Text style={styles.dropdownHeaderText}>SUGGESTED REAL-ESTATE LOCATIONS</Text>
          </View>

          {suggesting && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#0284C7" />
              <Text style={styles.statusText}>Searching verified areas & coordinates…</Text>
            </View>
          )}

          {suggestionError && (
            <View style={styles.statusRow}>
              <MaterialIcons name="info-outline" size={16} color="#DC2626" />
              <Text style={[styles.statusText, { color: "#DC2626" }]}>
                Could not load suggestions. Press Search to locate on map.
              </Text>
            </View>
          )}

          {!suggesting && !suggestionError && suggestions.length > 0 && (
            <ScrollView
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              style={styles.suggestionScroll}
              showsVerticalScrollIndicator={false}
            >
              {suggestions.map((item, index) => {
                const iconName =
                  item.kind === "district"
                    ? "location-city"
                    : item.kind === "pincode"
                    ? "pin-drop"
                    : "place";

                const isDistrict = item.kind === "district";

                return (
                  <TouchableOpacity
                    key={`${item.kind}:${item.label}:${index}`}
                    accessibilityRole="button"
                    onPress={() => onSelectSuggestion(item)}
                    style={styles.suggestionItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionLeft}>
                      <View
                        style={[
                          styles.suggestionIconCircle,
                          isDistrict && styles.suggestionIconCircleDistrict,
                        ]}
                      >
                        <MaterialIcons
                          name={iconName}
                          size={16}
                          color={isDistrict ? "#0284C7" : "#059669"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={styles.suggestionSublabel}>
                          {item.district
                            ? `${item.district} District · Bihar`
                            : item.state === "Bihar"
                            ? "Bihar Real Estate Hub"
                            : "Verified Location"}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.kindBadge,
                        isDistrict ? styles.kindBadgeDistrict : styles.kindBadgeAddress,
                      ]}
                    >
                      <Text
                        style={[
                          styles.kindText,
                          isDistrict ? styles.kindTextDistrict : styles.kindTextAddress,
                        ]}
                      >
                        {isDistrict ? "City / District" : "Verified Area"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {!suggesting && !suggestionError && suggestions.length === 0 && (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>
                No exact match found. Press Search to locate on the map.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    position: "relative",
    zIndex: 50,
    marginBottom: 16,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
    minHeight: 56,
    ...Platform.select({
      web: {
        boxShadow: "0 8px 30px rgba(3, 69, 108, 0.09), 0 2px 8px rgba(15, 23, 42, 0.04)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      },
      default: {
        shadowColor: "#03456C",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
      },
    }),
  },
  barFocused: {
    borderColor: "#0284C7",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 36px rgba(2, 132, 199, 0.18), 0 0 0 3px rgba(2, 132, 199, 0.12)",
      },
      default: {
        elevation: 6,
      },
    }),
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: "#0F172A",
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...(Platform.OS === "web" ? { outlineWidth: 0 } : {}),
  },
  clearBtn: {
    padding: 6,
    marginRight: 4,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  locateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginRight: 8,
    borderRadius: 9999,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    gap: 5,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "background-color 0.15s ease",
      },
    }),
  },
  locateBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#03456C",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 9999,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        boxShadow: "0 4px 14px rgba(3, 69, 108, 0.35)",
      },
      default: {
        elevation: 3,
      },
    }),
  },
  searchBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  dropdown: {
    position: "absolute",
    top: 66,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingVertical: 8,
    maxHeight: 320,
    zIndex: 100,
    overflow: "hidden",
    ...Platform.select({
      web: {
        backdropFilter: "blur(20px)",
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.16)",
      },
      default: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownHeaderText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
  },
  suggestionScroll: {
    maxHeight: 250,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "background-color 0.15s ease",
      },
    }),
  },
  suggestionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  suggestionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  suggestionIconCircleDistrict: {
    backgroundColor: "#E0F2FE",
  },
  suggestionLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 18,
  },
  suggestionSublabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  kindBadgeDistrict: {
    backgroundColor: "#E0F2FE",
  },
  kindBadgeAddress: {
    backgroundColor: "#ECFDF5",
  },
  kindText: {
    fontSize: 10,
    fontWeight: "700",
  },
  kindTextDistrict: {
    color: "#0284C7",
  },
  kindTextAddress: {
    color: "#059669",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  statusText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
});
