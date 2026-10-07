import { StyleSheet } from "react-native";

// Explicit font faces keep the geometric typography consistent on web and native.
export function premiumStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const result = Object.fromEntries(Object.entries(styles).map(([key, value]) => {
    const style = value as Record<string, unknown>;
    if (!("fontSize" in style || "fontWeight" in style || "letterSpacing" in style)) return [key, style];
    const weight = Number(style.fontWeight || 400);
    const fontFamily = weight >= 700 ? "PoppinsBold" : weight >= 600 ? "PoppinsSemiBold" : weight >= 500 ? "PoppinsMedium" : "PoppinsRegular";
    return [key, { ...style, fontFamily, fontWeight: "normal" }];
  }));
  return StyleSheet.create(result as unknown as T);
}
