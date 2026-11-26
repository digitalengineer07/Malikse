import { Platform, StyleSheet } from "react-native";

/** Editorial serif display face matching the HTML specification (Fraunces). */
export const FONT_DISPLAY =
  Platform.OS === "web"
    ? "'Fraunces', Georgia, serif"
    : "PoppinsBold";

/** Primary sans-serif UI face matching the HTML specification (Manrope). */
export const FONT_BODY =
  Platform.OS === "web"
    ? "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif"
    : "PoppinsRegular";

/** Numeric & price face (Manrope extrabold/bold with clean geometric numerals). */
export const FONT_NUMERIC =
  Platform.OS === "web"
    ? "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif"
    : "PoppinsSemiBold";

/** Uppercase eyebrow & pill label face (Manrope wide-tracked uppercase). */
export const FONT_MONO =
  Platform.OS === "web"
    ? "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif"
    : "PoppinsMedium";

// Explicit font faces keep the geometric typography consistent on web and native.
export function premiumStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  return StyleSheet.create(styles);
}
