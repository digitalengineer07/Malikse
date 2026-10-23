import React, { useRef } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { PropertyType } from "../src/types/property.types";

const choices: {
  value: PropertyType | undefined;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { value: undefined, label: "All properties", icon: "dashboard" },
  { value: "land", label: "Land", icon: "landscape" },
  { value: "flat", label: "Flats", icon: "apartment" },
  { value: "house", label: "Houses", icon: "cottage" },
  { value: "shop", label: "Shops", icon: "storefront" },
  { value: "office", label: "Offices", icon: "business" },
];

export default function PropertyTypeTabs({
  value,
  onChange,
}: {
  value?: PropertyType;
  onChange: (value?: PropertyType) => void;
}) {
  const scroll = useRef<ScrollView>(null);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {choices.map((choice) => {
          const isSelected = value === choice.value;
          return (
            <TouchableOpacity
              key={choice.label}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${choice.label}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(choice.value)}
              activeOpacity={0.8}
              style={[
                styles.pill,
                isSelected ? styles.activePill : styles.inactivePill,
              ]}
            >
              <MaterialIcons
                name={choice.icon}
                size={16}
                color={isSelected ? "#38BDF8" : "#0284C7"}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.pillText,
                  isSelected ? styles.activePillText : styles.inactivePillText,
                ]}
              >
                {choice.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 12,
    marginTop: 6,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 9999,
    justifyContent: "center",
    minHeight: 40,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    }),
  },
  activePill: {
    backgroundColor: "#03456C",
    borderWidth: 1.5,
    borderColor: "#0284C7",
    ...Platform.select({
      web: {
        boxShadow: "0 6px 16px rgba(3, 69, 108, 0.32)",
        transform: "scale(1.02)",
      },
      default: {
        shadowColor: "#03456C",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  inactivePill: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
      },
      default: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
      },
    }),
  },
  pillText: {
    fontSize: 13.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  activePillText: {
    color: "#FFFFFF",
  },
  inactivePillText: {
    color: "#1E293B",
  },
});
