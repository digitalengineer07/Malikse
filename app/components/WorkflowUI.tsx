import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import AppHeader from "./AppHeader";

export function WorkflowScreen({ title, children, contentStyle, titleStyle, backgroundColor = "#FFFFFF" }: { title: string; children: React.ReactNode; contentStyle?: StyleProp<ViewStyle>; titleStyle?: StyleProp<TextStyle>; backgroundColor?: string }) {
  return <View style={{ flex: 1, backgroundColor }}><AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, contentStyle]}><Text accessibilityRole="header" style={[ui.title, titleStyle]}>{title}</Text>{children}</ScrollView>
  </View>;
}
export function Action({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[ui.button, secondary && ui.secondary, disabled && { opacity: 0.5 }]}><Text style={[ui.buttonText, secondary && { color: "#047857" }]}>{title}</Text></TouchableOpacity>;
}
export function Field({ label, value, onChangeText, numeric = false, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean; multiline?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={[ui.input, multiline && { minHeight: 90, textAlignVertical: "top" }]} value={value} onChangeText={onChangeText} keyboardType={numeric ? "numbers-and-punctuation" : "default"} multiline={multiline} /></View>;
}
export function Check({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={ui.check}><Text style={ui.text}>{checked ? "☑" : "☐"} {label}</Text></TouchableOpacity>;
}
export const ui = StyleSheet.create({
  content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 20, paddingBottom: 48, gap: 16 },
  title: { color: "#111827", fontSize: 28, fontWeight: "800" },
  heading: { color: "#111827", fontSize: 19, fontWeight: "700" },
  text: { color: "#3E566B", fontSize: 15, lineHeight: 23 },
  muted: { color: "#6B7E90", lineHeight: 22 },
  error: { color: "#B91C1C", lineHeight: 22 },
  card: { backgroundColor: "#F3F8FC", borderRadius: 24, borderWidth: 1, borderColor: "#E3EEF6", padding: 20, gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  button: { backgroundColor: "#111827", padding: 14, borderRadius: 24, alignSelf: "flex-start" },
  secondary: { backgroundColor: "#EAF4FC" },
  buttonText: { color: "white", fontWeight: "700" },
  label: { color: "#3E566B", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#D3E3EE", backgroundColor: "white", borderRadius: 14, padding: 12, color: "#111827", fontSize: 16, minHeight: 46 },
  check: { paddingVertical: 10 },
});
