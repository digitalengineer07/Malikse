import React, { useRef } from "react";
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import type { PropertyType } from "../src/types/property.types";

const choices: { value: PropertyType | undefined; label: string }[] = [
  { value: undefined, label: "All properties" },
  { value: "land", label: "Land" },
  { value: "flat", label: "Flats" },
  { value: "house", label: "Houses" },
  { value: "shop", label: "Shops" },
  { value: "office", label: "Offices" },
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
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(choice.value)}
              activeOpacity={0.85}
              style={[
                styles.pill,
                isSelected ? styles.activePill : styles.inactivePill,
              ]}
            >
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
    marginBottom: 10,
    marginTop: 8,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 9999,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 42,
  },
  activePill: {
    backgroundColor: "#03456C",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  inactivePill: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  activePillText: {
    color: "#FFFFFF",
  },
  inactivePillText: {
    color: "#1E293B",
  },
});
