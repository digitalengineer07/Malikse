import { Platform, StyleSheet } from "react-native";

/** Sleek geometric display sans for hero titles, wordmark, and section headers. */
export const FONT_DISPLAY =
  Platform.OS === "web"
    ? "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif"
    : "PoppinsBold";

/** Neutral neo-grotesque sans for crisp body copy, nav, inputs, and UI controls. */
export const FONT_BODY =
  Platform.OS === "web"
    ? "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    : "PoppinsRegular";

/** Clean geometric sans tuned for KPI stats, currency prices, and numeric badges. */
export const FONT_NUMERIC =
  Platform.OS === "web"
    ? "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif"
    : "PoppinsSemiBold";

/** Technical monospace accent for uppercase eyebrows, tags, and verified IDs. */
export const FONT_MONO =
  Platform.OS === "web"
    ? "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace"
    : "PoppinsMedium";

// Explicit font faces keep the geometric typography consistent on web and native.
export function premiumStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  return StyleSheet.create(styles);
}
