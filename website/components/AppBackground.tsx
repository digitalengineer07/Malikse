import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

// CSS gradients on web; the same gradient syntax is supported by native Views.
function gradient(backgroundImage: string): ViewStyle {
  return Platform.OS === "web"
    ? ({ backgroundImage } as ViewStyle)
    : { experimental_backgroundImage: backgroundImage };
}

/** Shared, non-interactive backdrop. No image assets or network requests. */
export default function AppBackground() {
  return (
    <View pointerEvents="none" accessible={false} style={styles.background}>
      <View style={styles.dune} />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    backgroundColor: "#F4F6F9",
    ...gradient("radial-gradient(ellipse at 88% 58%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 58%), linear-gradient(180deg, #AEC9DF 0%, #BBD0E3 22%, #DCE6F0 43%, #F0F3F8 60%, #F5F6F8 76%, #F1F4F7 100%)"),
  },
  dune: {
    position: "absolute",
    top: "76%",
    left: "-18%",
    width: "136%",
    height: "58%",
    borderTopLeftRadius: "50%",
    borderTopRightRadius: "50%",
    backgroundColor: "#85ACC9",
    ...gradient("radial-gradient(ellipse at 26% 0%, #F9FAFC 0%, rgba(240,244,248,0.96) 15%, rgba(208,223,234,0.70) 34%, rgba(133,174,204,0) 65%), linear-gradient(145deg, #D9E5ED 0%, #A7C3D8 35%, #719BBC 61%, #426F9E 100%)"),
  },
});
