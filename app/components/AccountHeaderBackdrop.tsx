import { StyleSheet, View } from "react-native";

export function AccountHeaderBackdrop({ top }: { top: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.sun, { top }]} />
      <View style={styles.orbit}>
        <View style={styles.innerRing} />
      </View>
    </View>
  );
}

const divider = { paddingTop: 12, borderTopWidth: 1, borderTopColor: "#FFFFFF26" };

export const accountHeaderStyle = StyleSheet.create({
  divider,
  titleGroup: { ...divider, gap: 6 },
  heading: { fontSize: 29, lineHeight: 35 },
});

const styles = StyleSheet.create({
  sun: { position: "absolute", right: -82, width: 166, height: 166, borderRadius: 83, backgroundColor: "#FCC61C" },
  orbit: {
    position: "absolute", right: -52, bottom: -76, width: 224, height: 224,
    borderRadius: 112, backgroundColor: "#1A304D", borderWidth: 1, borderColor: "#345479",
    alignItems: "center", justifyContent: "center",
  },
  innerRing: { width: 178, height: 178, borderRadius: 89, borderWidth: 1, borderColor: "#345479" },
});
