import { StyleSheet } from "react-native";

// Explicit font faces keep the geometric typography consistent on web and native.
export function premiumStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  return StyleSheet.create(styles);
}
