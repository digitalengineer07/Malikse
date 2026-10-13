import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { AppTheme } from "../constants/theme";

interface BadgeChipProps {
  label: string;
  active: boolean;
  icon: string;
  color?: string;
}

export default function BadgeChip({ label, active, icon, color = AppTheme.colors.primary }: BadgeChipProps) {
  return (
    <View style={[styles.chip, active ? [styles.chipActive, { backgroundColor: `${color}14`, borderColor: `${color}40` }] : styles.chipInactive]}>
      {active ? (
        <FontAwesome5 
          name={icon} 
          size={12} 
          color={color} 
          style={styles.icon} 
        />
      ) : (
        <MaterialIcons
          name="radio-button-unchecked"
          size={13}
          color={AppTheme.colors.textMuted}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, active ? [styles.labelActive, { color }] : styles.labelInactive]}>
        {label}
      </Text>
      {active && (
        <MaterialIcons name="check-circle" size={13} color={color} style={{ marginLeft: 4 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: AppTheme.radius.full,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: AppTheme.colors.primaryLight,
    borderColor: AppTheme.colors.primary,
  },
  chipInactive: {
    backgroundColor: AppTheme.colors.divider,
    borderColor: AppTheme.colors.border,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
  labelActive: {
    fontWeight: "700",
  },
  labelInactive: {
    color: AppTheme.colors.textMuted,
  },
});
