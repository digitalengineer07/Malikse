import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions, type StyleProp, type ViewStyle, type TextStyle, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FormInput from "./FormInput";
import { AppTheme } from "../constants/theme";
import { premiumStyles } from "../constants/typography";
import AppHeader from "./AppHeader";

export function WorkflowScreen({
  title,
  children,
  contentStyle,
  titleStyle,
  backgroundColor = AppTheme.colors.background,
  showBack = false,
  fallbackRoute,
  onBackPress,
  hideHeaderTitle = false,
}: {
  title?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  showBack?: boolean;
  fallbackRoute?: string;
  onBackPress?: () => void;
  hideHeaderTitle?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor }}>
      <AppHeader
        showBack={showBack}
        onBackPress={onBackPress}
        fallbackRoute={fallbackRoute}
        showNavLinks={false}
        showPostPropertyBtn={false}
        showHomeButton
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentContainerStyle={[
            ui.content,
            { paddingHorizontal: width < 400 ? 16 : 24, paddingBottom: insets.bottom + 32 },
            contentStyle,
          ]}
        >
          {!!title && !hideHeaderTitle && (
            <Text accessibilityRole="header" style={[ui.title, titleStyle]}>
              {title}
            </Text>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
export function Action({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[ui.button, secondary && ui.secondary, disabled && { opacity: 0.5 }]}><Text style={[ui.buttonText, secondary && { color: AppTheme.colors.primaryDark }]}>{title}</Text></TouchableOpacity>;
}
export function Field({ label, numeric = false, error, hint, ...props }: TextInputProps & { label: string; numeric?: boolean; error?: string; hint?: string }) {
  return <View style={{ gap: 6, minWidth: 0 }}><Text style={ui.label}>{label}</Text><FormInput accessibilityLabel={label} keyboardType={numeric ? "decimal-pad" : "default"} {...props} style={[ui.input, props.multiline && { minHeight: 112, textAlignVertical: "top" }, error ? { borderColor: AppTheme.colors.danger } : undefined, props.style]} />{(error || hint) && <Text accessibilityRole={error ? "alert" : undefined} style={error ? ui.error : ui.muted}>{error || hint}</Text>}</View>;
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
  card: { backgroundColor: AppTheme.colors.card, borderRadius: AppTheme.radius.xl, borderWidth: 1, borderColor: AppTheme.colors.cardBorder, padding: 18, gap: 16, ...AppTheme.shadows.soft, ...AppTheme.glass },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  button: { backgroundColor: AppTheme.colors.primary, minHeight: 50, maxWidth: "100%", flexShrink: 1, paddingVertical: 14, paddingHorizontal: 20, borderRadius: AppTheme.radius.full, alignSelf: "stretch", alignItems: "center", justifyContent: "center", ...AppTheme.shadows.soft, ...AppTheme.glass },
  secondary: { backgroundColor: AppTheme.colors.primaryLight },
  buttonText: { color: AppTheme.colors.white, fontWeight: "700", fontSize: 15, textAlign: "center" },
  label: { color: AppTheme.colors.textSecondary, fontWeight: "600", fontSize: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: AppTheme.colors.border, backgroundColor: AppTheme.colors.white, borderRadius: AppTheme.radius.md, padding: 14, color: AppTheme.colors.text, fontSize: 16, minHeight: 52 },
  check: { paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
});
