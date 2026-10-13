import React from "react";
import { View, Platform } from "react-native";

interface CitySkylineProps {
  width?: number | string;
  height?: number;
  opacity?: number;
}

export default function CitySkyline({
  width = 440,
  height = 140,
  opacity = 0.55,
}: CitySkylineProps) {
  if (Platform.OS === "web") {
    return (
      <svg
        viewBox="0 0 500 150"
        width={width}
        height={height}
        style={{
          display: "block",
          overflow: "visible",
          opacity,
          pointerEvents: "none",
        }}
      >
        <defs>
          <linearGradient id="skylineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A90C4" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#7CBCE4" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#BCE0F7" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="skylineBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9BCDEB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#D5ECFA" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Distant Background Towers */}
        <g fill="url(#skylineBack)">
          <rect x="40" y="45" width="28" height="105" rx="1" />
          <rect x="80" y="30" width="36" height="120" rx="1" />
          <rect x="140" y="20" width="42" height="130" rx="1" />
          <rect x="220" y="15" width="48" height="135" rx="1" />
          <polygon points="244,0 242,15 246,15" />
          <rect x="300" y="25" width="40" height="125" rx="1" />
          <rect x="370" y="40" width="34" height="110" rx="1" />
          <rect x="420" y="55" width="40" height="95" rx="1" />
        </g>

        {/* Foreground Modern Buildings with Detailed Windows */}
        <g fill="url(#skylineGrad)">
          {/* Building 1 (Far Left) */}
          <rect x="10" y="70" width="30" height="80" rx="2" />
          <line x1="16" y1="78" x2="16" y2="135" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <line x1="25" y1="78" x2="25" y2="135" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 2 */}
          <rect x="52" y="52" width="34" height="98" rx="2" />
          <line x1="60" y1="60" x2="60" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="69" y1="60" x2="69" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="78" y1="60" x2="78" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 3 with Spire */}
          <rect x="98" y="38" width="42" height="112" rx="2" />
          <polygon points="119,16 117,38 121,38" />
          <line x1="106" y1="48" x2="106" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="119" y1="48" x2="119" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="132" y1="48" x2="132" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 4 (Tiered Skyscraper) */}
          <rect x="154" y="28" width="48" height="122" rx="2" />
          <rect x="162" y="14" width="32" height="14" rx="1" />
          <line x1="178" y1="2" x2="178" y2="14" stroke="#4A90C4" strokeWidth="2" />
          <line x1="164" y1="38" x2="164" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="178" y1="38" x2="178" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="192" y1="38" x2="192" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 5 (Tall Tower) */}
          <rect x="216" y="20" width="44" height="130" rx="2" />
          <line x1="225" y1="30" x2="225" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="238" y1="30" x2="238" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="251" y1="30" x2="251" y2="140" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 6 */}
          <rect x="274" y="34" width="40" height="116" rx="2" />
          <line x1="284" y1="44" x2="284" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="294" y1="44" x2="294" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="304" y1="44" x2="304" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 7 */}
          <rect x="328" y="44" width="44" height="106" rx="2" />
          <line x1="338" y1="54" x2="338" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="350" y1="54" x2="350" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />
          <line x1="362" y1="54" x2="362" y2="138" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 8 (Tiered) */}
          <rect x="384" y="58" width="38" height="92" rx="2" />
          <rect x="392" y="46" width="22" height="12" rx="1" />
          <line x1="394" y1="66" x2="394" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <line x1="404" y1="66" x2="404" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <line x1="414" y1="66" x2="414" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />

          {/* Building 9 (Far Right) */}
          <rect x="434" y="68" width="34" height="82" rx="2" />
          <line x1="442" y1="76" x2="442" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <line x1="452" y1="76" x2="452" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
          <line x1="461" y1="76" x2="461" y2="136" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,3" opacity="0.6" />
        </g>

        {/* Base Hill / Foliage Ribbon */}
        <path
          d="M0,150 Q120,138 250,144 Q380,136 500,146 L500,150 L0,150 Z"
          fill="#78B6E0"
          opacity="0.4"
        />
        {/* Soft Tree Clusters at base */}
        <circle cx="94" cy="144" r="8" fill="#5A9FD4" opacity="0.5" />
        <circle cx="150" cy="144" r="9" fill="#5A9FD4" opacity="0.5" />
        <circle cx="212" cy="144" r="8" fill="#5A9FD4" opacity="0.5" />
        <circle cx="270" cy="144" r="9" fill="#5A9FD4" opacity="0.5" />
        <circle cx="380" cy="144" r="8" fill="#5A9FD4" opacity="0.5" />
      </svg>
    );
  }

  return <View style={{ width: typeof width === "number" ? width : 440, height }} />;
}
