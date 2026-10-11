import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguageStore } from "../src/store/languageStore";
import { AppTheme } from "../constants/theme";
interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  fallbackRoute?: string;
  rightElement?: React.ReactNode;
  showLanguageToggle?: boolean;
  showHomeButton?: boolean;
  showNavLinks?: boolean;
  showPostPropertyBtn?: boolean;
}


export default function AppHeader(props: AppHeaderProps) {
  const { language, toggleLanguage } = useLanguageStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const back = props.showBack ?? !["/home", "/", "/search"].includes(pathname);
  return <View style={{ paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: "rgba(255,255,255,0.25)", borderBottomWidth: 1, borderBottomColor: AppTheme.colors.border }}>
    <View style={{ width: "100%", maxWidth: 1200, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 12 }}>
      {back && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: AppTheme.colors.primaryLight }} onPress={() => {
        if (props.onBackPress) props.onBackPress();
        else if (router.canGoBack()) router.back();
        else router.replace((props.fallbackRoute || "/home") as any);
      }}><MaterialIcons name="arrow-back" size={22} color={AppTheme.colors.primary} /></TouchableOpacity>}
      <Text accessibilityRole="header" style={{ flex: 1, minWidth: 0, fontSize: 21, fontWeight: "700", color: AppTheme.colors.text }}>{props.title || "MalikSe"}</Text>
      {props.rightElement || (props.showLanguageToggle !== false && <TouchableOpacity accessibilityRole="button" accessibilityLabel={language === "en" ? "Switch to Hindi" : "Switch to English"} onPress={toggleLanguage} style={{ minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: 24 }}><Text style={{ color: AppTheme.colors.primary, fontWeight: "600" }}>{language === "en" ? "हिंदी" : "EN"}</Text></TouchableOpacity>)}
    </View>
  </View>;
}
