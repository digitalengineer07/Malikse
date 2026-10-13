import React from "react";
import { Platform } from "react-native";

interface BiharHeritageWatermarkProps {
  width?: number;
  height?: number;
  opacity?: number;
}

export default function BiharHeritageWatermark({
  width = 150,
  height = 42,
  opacity = 0.55,
}: BiharHeritageWatermarkProps) {
  if (Platform.OS !== "web") return null;

  return (
    <svg
      viewBox="0 0 200 52"
      width={width}
      height={height}
      style={{
        display: "block",
        overflow: "visible",
        opacity: opacity,
      }}
    >
      <defs>
        <linearGradient id="biharSkylineGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#475569" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#64748B" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g fill="url(#biharSkylineGrad)">
        {/* 1. Left Stupa & Nalanda Ancient Stepped Architecture */}
        <path d="M0,52 L0,44 L10,44 L10,40 L16,40 L16,34 L22,34 L22,26 L23,26 L23,19 L25,19 L25,26 L26,26 L26,34 L32,34 L32,40 L38,40 L38,44 L45,44 L45,52 Z" />

        {/* 2. Left Heritage Chhatri Pavilion */}
        <path d="M48,52 L48,32 Q58,16 68,32 L68,52 L64,52 L64,35 Q58,23 52,35 L52,52 Z" />
        <path d="M57,17 L57,10 L59,10 L59,17 Z" />
        <circle cx="58" cy="8" r="2" />

        {/* 3. Ashoka Stambh Column / Minaret of Bihar */}
        <rect x="71" y="16" width="4" height="36" />
        <path d="M69,16 L77,16 L75,12 L71,12 Z" />
        <circle cx="73" cy="9" r="2.5" />

        {/* 4. Centerpiece: The Iconic Bihar Golghar Beehive Dome */}
        <path d="M78,52 L78,42 C80,24 95,6 110,6 C125,6 140,24 142,42 L142,52 Z" />
        {/* Golghar Viewing Deck & Kalash Spire */}
        <rect x="105" y="4" width="10" height="3" rx="1" />
        <path d="M109,4 L109,0 L111,0 L111,4 Z" />
        <circle cx="110" cy="0" r="1.5" />
        {/* Architectural Arch Detail */}
        <path
          d="M86,52 C88,38 98,28 110,28 C122,28 132,38 134,52 L130,52 C128,41 120,32 110,32 C100,32 92,41 90,52 Z"
          opacity="0.35"
        />

        {/* 5. Right Bodh Gaya Mahabodhi Stepped Temple Tower */}
        <path d="M144,52 L148,38 L152,38 L154,28 L156,28 L157,18 L159,18 L159,8 L161,8 L161,18 L163,18 L164,28 L166,28 L168,38 L172,38 L176,52 Z" />
        <polygon points="159,7 161,7 160,2" />

        {/* 6. Rightmost Heritage Torana Gateway */}
        <rect x="180" y="32" width="3" height="20" />
        <rect x="194" y="32" width="3" height="20" />
        <path d="M176,32 L198,32 L198,28 L176,28 Z" />
        <path d="M178,26 L196,26 L196,23 L178,23 Z" />
        <path d="M185,23 Q187,17 189,23 Z" />
      </g>
    </svg>
  );
}
