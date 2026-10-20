import React from "react";
import Svg, { Defs, LinearGradient, Stop, G, Rect, Polygon, Line, Path, Circle } from "react-native-svg";

interface CitySkylineProps {
  width?: number | `${number}%`;
  height?: number;
  opacity?: number;
}

export default function CitySkyline({
  width = 440,
  height = 140,
  opacity = 0.55,
}: CitySkylineProps) {

    return (
      <Svg
        viewBox="0 0 500 150"
        width={width}
        height={height}
        opacity={opacity}
      >
        <Defs>
          <LinearGradient id="skylineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#4A90C4" stopOpacity="0.75" />
            <Stop offset="60%" stopColor="#7CBCE4" stopOpacity="0.45" />
            <Stop offset="100%" stopColor="#BCE0F7" stopOpacity="0.1" />
          </LinearGradient>
          <LinearGradient id="skylineBack" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#9BCDEB" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#D5ECFA" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Distant Background Towers */}
        <G fill="url(#skylineBack)">
          <Rect x="40" y="45" width="28" height="105" rx="1" />
          <Rect x="80" y="30" width="36" height="120" rx="1" />
          <Rect x="140" y="20" width="42" height="130" rx="1" />
          <Rect x="220" y="15" width="48" height="135" rx="1" />
          <Polygon points="244,0 242,15 246,15" />
          <Rect x="300" y="25" width="40" height="125" rx="1" />
          <Rect x="370" y="40" width="34" height="110" rx="1" />
          <Rect x="420" y="55" width="40" height="95" rx="1" />
        </G>

        {/* Foreground Modern Buildings with Detailed Windows */}
        <G fill="url(#skylineGrad)">
          {/* Building 1 (Far Left) */}
          <Rect x="10" y="70" width="30" height="80" rx="2" />
          <Line x1="16" y1="78" x2="16" y2="135" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="25" y1="78" x2="25" y2="135" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 2 */}
          <Rect x="52" y="52" width="34" height="98" rx="2" />
          <Line x1="60" y1="60" x2="60" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="69" y1="60" x2="69" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="78" y1="60" x2="78" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 3 with Spire */}
          <Rect x="98" y="38" width="42" height="112" rx="2" />
          <Polygon points="119,16 117,38 121,38" />
          <Line x1="106" y1="48" x2="106" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="119" y1="48" x2="119" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="132" y1="48" x2="132" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 4 (Tiered Skyscraper) */}
          <Rect x="154" y="28" width="48" height="122" rx="2" />
          <Rect x="162" y="14" width="32" height="14" rx="1" />
          <Line x1="178" y1="2" x2="178" y2="14" stroke="#4A90C4" strokeWidth="2" />
          <Line x1="164" y1="38" x2="164" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="178" y1="38" x2="178" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="192" y1="38" x2="192" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 5 (Tall Tower) */}
          <Rect x="216" y="20" width="44" height="130" rx="2" />
          <Line x1="225" y1="30" x2="225" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="238" y1="30" x2="238" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="251" y1="30" x2="251" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 6 */}
          <Rect x="274" y="34" width="40" height="116" rx="2" />
          <Line x1="284" y1="44" x2="284" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="294" y1="44" x2="294" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="304" y1="44" x2="304" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 7 */}
          <Rect x="328" y="44" width="44" height="106" rx="2" />
          <Line x1="338" y1="54" x2="338" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="350" y1="54" x2="350" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="362" y1="54" x2="362" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 8 (Tiered) */}
          <Rect x="384" y="58" width="38" height="92" rx="2" />
          <Rect x="392" y="46" width="22" height="12" rx="1" />
          <Line x1="394" y1="66" x2="394" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="404" y1="66" x2="404" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="414" y1="66" x2="414" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 9 (Far Right) */}
          <Rect x="434" y="68" width="34" height="82" rx="2" />
          <Line x1="442" y1="76" x2="442" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="452" y1="76" x2="452" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <Line x1="461" y1="76" x2="461" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
        </G>

        {/* Base Hill / Foliage Ribbon */}
        <Path
          d="M0,150 Q120,138 250,144 Q380,136 500,146 L500,150 L0,150 Z"
          fill="#78B6E0"
          opacity="0.4"
        />
        {/* Soft Tree Clusters at base */}
        <Circle cx="94" cy="144" r="8" fill="#5A9FD4" opacity="0.5" />
        <Circle cx="150" cy="144" r="9" fill="#5A9FD4" opacity="0.5" />
        <Circle cx="212" cy="144" r="8" fill="#5A9FD4" opacity="0.5" />
        <Circle cx="270" cy="144" r="9" fill="#5A9FD4" opacity="0.5" />
        <Circle cx="380" cy="144" r="8" fill="#5A9FD4" opacity="0.5" />
      </Svg>
    );
}
