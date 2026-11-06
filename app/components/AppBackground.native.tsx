import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from "react-native-svg";

export default function AppBackground() {
  return (
    <View accessible={false} style={[StyleSheet.absoluteFill, { overflow: "hidden", pointerEvents: "none" }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#f4f5f7" />
            <Stop offset="55%" stopColor="#e6e9ee" />
            <Stop offset="82%" stopColor="#dde1e8" />
            <Stop offset="100%" stopColor="#e3e6ec" />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill="url(#bgGrad)" />
      </Svg>
      <View style={{ position: "absolute", top: 0, right: 0, width: "100%", height: "100%", maxWidth: 650, opacity: 0.40 }}>
        <Svg width="100%" height="100%" preserveAspectRatio="xMaxYMin meet" viewBox="0 0 424 707">
          <Defs>
            <LinearGradient id="gradDark" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0b68b0" />
              <Stop offset="40%" stopColor="#065c99" />
              <Stop offset="80%" stopColor="#04467d" />
              <Stop offset="100%" stopColor="#043d70" />
            </LinearGradient>
            <LinearGradient id="gradLight" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#14a0dc" />
              <Stop offset="45%" stopColor="#0b8ac8" />
              <Stop offset="80%" stopColor="#0872ab" />
              <Stop offset="100%" stopColor="#06689f" />
            </LinearGradient>
            <LinearGradient id="gradWedge1" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#07508a" />
              <Stop offset="100%" stopColor="#0a62a2" />
            </LinearGradient>
            <LinearGradient id="gradWedge2" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#0873ad" />
              <Stop offset="100%" stopColor="#0b8dca" />
            </LinearGradient>
          </Defs>
          {/* Back dark arrow shadow */}
          <Polygon points="347.4,82.1 450.8,168.4 450.4,589.7 260.4,589.7 260.4,204.4 200.7,204.4" fill="rgba(16,28,48,0.30)" />
          {/* Back dark arrow */}
          <Polygon points="363.4,72.1 466.8,158.4 466.4,579.7 276.4,579.7 276.4,194.4 216.7,194.4" fill="url(#gradDark)" />
          {/* Front light arrow shadow */}
          <Polygon points="293.3,260.4 475.6,108.4 475.6,587.7 341.2,587.7 341.2,260.4" fill="rgba(0,28,58,0.35)" />
          {/* Front light arrow */}
          <Polygon points="305.3,252.4 487.6,100.4 487.6,579.7 353.2,579.7 353.2,252.4" fill="url(#gradLight)" />
          {/* Floor wedges shadow */}
          <Polygon points="266.4,585.7 343.2,585.7 240.2,713 163.8,713" fill="rgba(16,28,48,0.22)" />
          {/* Floor wedges */}
          <Polygon points="276.4,579.7 353.2,579.7 250.2,707 173.8,707" fill="url(#gradWedge1)" />
          <Polygon points="353.2,579.7 466.4,579.7 466.4,707 250.2,707" fill="url(#gradWedge2)" />
        </Svg>
      </View>
    </View>
  );
}
