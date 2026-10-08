import { premiumStyles } from "../constants/typography";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguageStore } from "../src/store/languageStore";
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

export default function AppHeader(_props: AppHeaderProps) {
  const { language, toggleLanguage } = useLanguageStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    if (_props.onBackPress) _props.onBackPress();
    else if (router.canGoBack()) router.back();
    else if (_props.fallbackRoute) router.replace(_props.fallbackRoute as any);
    else router.replace("/home");
  };

  const shouldShowBack = _props.showBack ?? (pathname !== "/home" && pathname !== "/" && pathname !== "/search");

  return <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
    <View style={styles.row}>
      <View style={styles.leftGroup}>
        {shouldShowBack && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={handleBack} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        )}
        <View><Text style={styles.brand}>✳ MalikSe</Text><Text style={styles.caption}>YOUR LAND. A SAFER FUTURE.</Text></View>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Toggle language" onPress={toggleLanguage} style={styles.language}><Text style={styles.label}>文A  {language === "en" ? "हिंदी" : "English"}</Text></TouchableOpacity>
    </View>
  </View>;
}
const styles = premiumStyles({
  header: { backgroundColor: "transparent", paddingBottom: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "#EDF2F6" },
  row: { width: "100%", maxWidth: 1200, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leftGroup: { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F2F6F9", alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 23, fontWeight: "800", color: "#111827", letterSpacing: -0.8 },
  caption: { fontSize: 8, letterSpacing: 1.3, color: "#63788A", marginTop: 5 },
  language: { backgroundColor: "#EDF6FC", paddingHorizontal: 17, paddingVertical: 12, borderRadius: 24 }, label: { color: "#223F55", fontWeight: "600" },
});
