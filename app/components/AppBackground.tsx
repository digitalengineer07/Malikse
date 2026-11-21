import { StyleSheet, View } from "react-native";
import { marketplaceBackground } from "../constants/theme";

export default function AppBackground() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: marketplaceBackground }]} />
  );
}
