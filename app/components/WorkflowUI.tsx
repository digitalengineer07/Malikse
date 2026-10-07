import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { AppTheme } from "../constants/theme";
import { premiumStyles } from "../constants/typography";
import AppHeader from "./AppHeader";

export function WorkflowScreen({ title, children, contentStyle, titleStyle, backgroundColor = AppTheme.colors.background }: { title: string; children: React.ReactNode; contentStyle?: StyleProp<ViewStyle>; titleStyle?: StyleProp<TextStyle>; backgroundColor?: string }) {
  return <View style={{ flex: 1, backgroundColor }}><AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, contentStyle]}><Text accessibilityRole="header" style={[ui.title, titleStyle]}>{title}</Text>{children}</ScrollView>
  </View>;
}
export function Action({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[ui.button, secondary && ui.secondary, disabled && { opacity: 0.5 }]}><Text style={[ui.buttonText, secondary && { color: AppTheme.colors.primaryDark }]}>{title}</Text></TouchableOpacity>;
}
export function Field({ label, value, onChangeText, numeric = false, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean; multiline?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={[ui.input, multiline && { minHeight: 90, textAlignVertical: "top" }]} value={value} onChangeText={onChangeText} keyboardType={numeric ? "numbers-and-punctuation" : "default"} multiline={multiline} /></View>;
}
export function Check({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={ui.check}><Text style={ui.text}>{checked ? "☑" : "☐"} {label}</Text></TouchableOpacity>;
}
export const ui = premiumStyles({
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 20, paddingBottom: 48, gap: 16 },
  title: { color: AppTheme.colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  heading: { color: AppTheme.colors.text, fontSize: 19, fontWeight: "700", letterSpacing: -0.3, marginBottom: 4 },
  text: { color: AppTheme.colors.textSecondary, fontSize: 15, lineHeight: 24 },
  muted: { color: AppTheme.colors.textMuted, fontSize: 14, lineHeight: 22 },
  error: { color: AppTheme.colors.danger, fontSize: 14, lineHeight: 22, fontWeight: "500" },
  card: { backgroundColor: AppTheme.colors.card, borderRadius: AppTheme.radius.xl, borderWidth: 1, borderColor: AppTheme.colors.cardBorder, padding: 24, gap: 14, ...AppTheme.shadows.soft, ...AppTheme.glass },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  button: { backgroundColor: AppTheme.colors.primary, paddingVertical: 14, paddingHorizontal: 20, borderRadius: AppTheme.radius.full, alignSelf: "flex-start", alignItems: "center", justifyContent: "center", ...AppTheme.shadows.soft, ...AppTheme.glass },
  secondary: { backgroundColor: AppTheme.colors.primaryLight },
  buttonText: { color: AppTheme.colors.white, fontWeight: "700", fontSize: 15 },
  label: { color: AppTheme.colors.textSecondary, fontWeight: "600", fontSize: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: AppTheme.colors.border, backgroundColor: AppTheme.colors.white, borderRadius: AppTheme.radius.md, padding: 14, color: AppTheme.colors.text, fontSize: 16, minHeight: 52 },
  check: { paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
});
