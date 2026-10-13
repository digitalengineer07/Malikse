import React, { useRef } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { PropertyType } from "../src/types/property.types";
import { AppTheme } from "../constants/theme";

const choices: { value: PropertyType | undefined; label: string }[] = [
  { value: undefined, label: "All properties" }, { value: "land", label: "Land" },
  { value: "flat", label: "Flats" }, { value: "house", label: "Houses" },
  { value: "shop", label: "Shops" }, { value: "office", label: "Offices" },
];
export default function PropertyTypeTabs({ value, onChange }: { value?: PropertyType; onChange: (value?: PropertyType) => void }) {
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  return <View style={{ minWidth: 0, width: "100%", marginBottom: 16 }}>
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingHorizontal: 2 }}>
      {choices.map(choice => <TouchableOpacity key={choice.label} accessibilityRole="button" accessibilityState={{ selected: value === choice.value }}
        onLayout={event => { positions.current[choice.label] = event.nativeEvent.layout.x; }}
        onFocus={() => scroll.current?.scrollTo({ x: Math.max(0, positions.current[choice.label] - 16), animated: true })}
        onPress={() => onChange(choice.value)} style={{ flexShrink: 0, minHeight: 48, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 12,
          borderRadius: 24, borderWidth: 1, borderColor: value === choice.value ? AppTheme.colors.primary : AppTheme.colors.border,
          backgroundColor: value === choice.value ? AppTheme.colors.primary : AppTheme.colors.card }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: value === choice.value ? "white" : AppTheme.colors.text }}>{choice.label}</Text>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}
