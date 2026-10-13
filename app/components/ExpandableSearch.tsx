import React, { useState } from "react";
import { Keyboard, Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AppTheme } from "../constants/theme";

export default function ExpandableSearch({ value, onChangeText, language = "en", label, placeholder, onOpen, onClose }: {
  value: string; onChangeText: (value: string) => void; language?: string;
  label?: string; placeholder?: string; onOpen?: () => void; onClose?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const close = () => { onChangeText(""); setExpanded(false); setFocused(false); Keyboard.dismiss(); onClose?.(); };
  if (!expanded && !value) return <TouchableOpacity accessibilityRole="button"
    accessibilityLabel={label || (language === "hi" ? "संदेश खोजें" : "Search messages")} accessibilityState={{ expanded: false }}
    onPress={() => { setExpanded(true); onOpen?.(); }} style={styles.iconButton}>
    <MaterialIcons name="search" size={22} color={AppTheme.colors.primary} />
  </TouchableOpacity>;
  return <View style={[styles.search, focused && { borderWidth: 0 }]}>
    <MaterialIcons name="search" size={20} color={AppTheme.colors.primary} />
    <TextInput autoFocus value={value} onChangeText={onChangeText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      accessibilityLabel={label || (language === "hi" ? "संदेश खोजें" : "Search messages")}
      placeholder={placeholder || (language === "hi" ? "नाम, संपत्ति या संदेश खोजें" : "Name, property or message")}
      maxLength={200}
      placeholderTextColor={AppTheme.colors.textMuted} returnKeyType="search" autoCorrect={false}
      onSubmitEditing={() => Keyboard.dismiss()} onKeyPress={event => { if (event.nativeEvent.key === "Escape") close(); }} style={[styles.input, Platform.OS === "web" && { outlineStyle: "none" } as any]} />
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={language === "hi" ? "खोज बंद करें" : "Close search"} onPress={close} style={styles.close}>
      <MaterialIcons name="close" size={20} color={AppTheme.colors.primary} />
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  iconButton: { width: 48, minHeight: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)" },
  search: { flexGrow: 1, flexShrink: 1, flexBasis: 240, maxWidth: "100%", minHeight: 52, borderRadius: 26, paddingLeft: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: AppTheme.colors.border },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 12, fontSize: 16, color: AppTheme.colors.text, borderWidth: 0, backgroundColor: "transparent" },
  close: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
