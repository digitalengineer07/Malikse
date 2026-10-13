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
      {/* Search Input Bar */}
      <View style={[styles.bar, isFocused && styles.barFocused]}>
        {/* Left Search Icon */}
        <View style={styles.iconWrap}>
          <MaterialIcons name="search" size={22} color="#075D91" />
        </View>

        {/* Input Field */}
        <TextInput
          accessibilityLabel="Search state, district, pincode or address"
          placeholder="Search state, district, pincode or address"
          placeholderTextColor="#7E9EB8"
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSearch}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 200);
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
            <MaterialIcons name="close" size={18} color="#64809E" />
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
              <ActivityIndicator size="small" color="#075D91" />
            ) : (
              <MaterialIcons name="my-location" size={20} color="#075D91" />
            )}
          </TouchableOpacity>
        )}

        {/* Prominent Blue Search Button */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={onSearch}
          style={styles.searchBtn}
          activeOpacity={0.88}
        >
          <MaterialIcons name="search" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Autocomplete Suggestions Dropdown */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {suggesting && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#075D91" />
              <Text style={styles.statusText}>Searching matching locations…</Text>
            </View>
          )}

          {suggestionError && (
            <View style={styles.statusRow}>
              <MaterialIcons name="info-outline" size={16} color="#DC2626" />
              <Text style={[styles.statusText, { color: "#DC2626" }]}>
                Could not search addresses. Press Enter to search anyway.
              </Text>
            </View>
          )}

          {!suggesting && !suggestionError && suggestions.length > 0 && (
            <ScrollView
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              style={styles.suggestionScroll}
            >
              {suggestions.map((item, index) => {
                const iconName =
                  item.kind === "state"
                    ? "map"
                    : item.kind === "district"
                    ? "location-city"
                    : item.kind === "pincode"
                    ? "pin-drop"
                    : "place";

                return (
                  <TouchableOpacity
                    key={`${item.kind}:${item.label}:${index}`}
                    accessibilityRole="button"
                    onPress={() => onSelectSuggestion(item)}
                    style={styles.suggestionItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionLeft}>
                      <View style={styles.suggestionIconCircle}>
                        <MaterialIcons name={iconName} size={16} color="#075D91" />
                      </View>
                      <Text style={styles.suggestionLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>
                    <View style={styles.kindBadge}>
                      <Text style={styles.kindText}>{item.kind}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {!suggesting && !suggestionError && suggestions.length === 0 && (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>
                No matching areas found. Press Search to search listings.
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
    marginBottom: 20,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#D9E7F3",
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 56,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(7, 93, 145, 0.08)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      },
      default: {
        shadowColor: "#075D91",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
  },
  barFocused: {
    borderColor: "#075D91",
    ...Platform.select({
      web: {
        boxShadow: "0 6px 24px rgba(7, 93, 145, 0.16)",
      },
      default: {
        elevation: 6,
      },
    }),
  },
  iconWrap: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#102B52",
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...(Platform.OS === "web" ? ({ outline: "none" } as any) : {}),
  },
  clearBtn: {
    padding: 6,
    marginRight: 4,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  locateBtn: {
    padding: 8,
    marginRight: 6,
    borderRadius: 999,
    backgroundColor: "#EEF7FE",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#075D91",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 9999,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "background-color 0.2s ease, transform 0.1s ease",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  searchBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  dropdown: {
    position: "absolute",
    top: 64,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E7F3",
    paddingVertical: 8,
    maxHeight: 280,
    zIndex: 100,
    ...Platform.select({
      web: {
        boxShadow: "0 12px 32px rgba(16, 43, 82, 0.14)",
      },
      default: {
        shadowColor: "#102B52",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  suggestionScroll: {
    maxHeight: 260,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  suggestionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  suggestionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EEF7FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  suggestionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#102B52",
    flex: 1,
  },
  kindBadge: {
    backgroundColor: "#D9EEFC",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kindText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#075D91",
    textTransform: "uppercase",
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
    color: "#64809E",
    fontWeight: "500",
  },
});
