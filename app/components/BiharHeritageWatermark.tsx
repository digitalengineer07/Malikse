import React from "react";
import { Platform } from "react-native";

interface BiharHeritageWatermarkProps {
  width?: number;
  height?: number;
  opacity?: number;
}

export default function BiharHeritageWatermark({
  width = 160,
  height = 44,
  opacity = 0.55,
}: BiharHeritageWatermarkProps) {
  if (Platform.OS !== "web") return null;

  return (
    <svg
      viewBox="0 0 240 64"
      width={width}
      height={height}
      style={{
        display: "block",
        overflow: "visible",
        opacity: opacity,
      }}
    >
      <defs>
        <linearGradient id="monumentGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#334E68" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#5B7E9F" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#87ADC8" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g fill="url(#monumentGrad)">
        {/* Base Platform */}
        <rect x="0" y="58" width="240" height="6" rx="1" />

        {/* Far Left Minaret */}
        <rect x="14" y="24" width="4.5" height="34" />
        <rect x="12" y="38" width="8.5" height="2" />
        <rect x="13" y="26" width="6.5" height="2" />
        {/* Dome of Far Left Minaret */}
        <path d="M13,24 C13,19 16.25,16 16.25,16 C16.25,16 19.5,19 19.5,24 Z" />
        <rect x="15.5" y="12" width="1.5" height="4" />
        <circle cx="16.25" cy="11.5" r="1.2" />

        {/* Mid-Left Slender Minaret */}
        <rect x="38" y="32" width="3.5" height="26" />
        <rect x="36.5" y="44" width="6.5" height="1.5" />
        <path d="M37,32 C37,28 39.75,25 39.75,25 C39.75,25 42.5,28 42.5,32 Z" />
        <line x1="39.75" y1="25" x2="39.75" y2="21" stroke="#5B7E9F" strokeWidth="1" />

        {/* Left Side Pavilion / Chhatri */}
        <rect x="70" y="36" width="2" height="10" />
        <rect x="78" y="36" width="2" height="10" />
        <path d="M68,36 C68,28 75,24 75,24 C75,24 82,28 82,36 Z" />
        <line x1="75" y1="24" x2="75" y2="19" stroke="#5B7E9F" strokeWidth="1" />

        {/* Center Plinth & Main Facade */}
        <rect x="62" y="46" width="116" height="12" />
        <path d="M84,46 L84,30 L156,30 L156,46 Z" />

        {/* Grand Center Portal Arch Cutout */}
        <path
          d="M102,58 L102,38 C102,32 120,32 120,32 C120,32 138,32 138,38 L138,58 Z"
          fill="#DFEEF8"
          opacity="0.9"
        />

        {/* Side Arched Niches */}
        <path d="M88,44 L88,34 C88,32 94,32 94,32 C94,32 100,32 100,34 L100,44 Z" fill="#DFEEF8" opacity="0.6" />
        <path d="M140,44 L140,34 C140,32 146,32 146,32 C146,32 152,32 152,34 L152,44 Z" fill="#DFEEF8" opacity="0.6" />

        {/* Center Grand Bulbous Onion Dome */}
        {/* Dome Drum */}
        <rect x="105" y="22" width="30" height="8" rx="1" />
        {/* Swelling Onion Dome */}
        <path d="M106,22 C101,15 110,6 120,2 C130,6 139,15 134,22 Z" />
        {/* Spire / Kalash Finial */}
        <line x1="120" y1="2" x2="120" y2="-6" stroke="#4A6E8F" strokeWidth="2" strokeLinecap="round" />
        <circle cx="120" cy="-6" r="1.5" />

        {/* Right Side Pavilion / Chhatri */}
        <rect x="160" y="36" width="2" height="10" />
        <rect x="168" y="36" width="2" height="10" />
        <path d="M158,36 C158,28 165,24 165,24 C165,24 172,28 172,36 Z" />
        <line x1="165" y1="24" x2="165" y2="19" stroke="#5B7E9F" strokeWidth="1" />

        {/* Mid-Right Slender Minaret */}
        <rect x="198" y="32" width="3.5" height="26" />
        <rect x="196.5" y="44" width="6.5" height="1.5" />
        <path d="M197,32 C197,28 199.75,25 199.75,25 C199.75,25 202.5,28 202.5,32 Z" />
        <line x1="199.75" y1="25" x2="199.75" y2="21" stroke="#5B7E9F" strokeWidth="1" />

        {/* Far Right Minaret */}
        <rect x="221" y="24" width="4.5" height="34" />
        <rect x="219" y="38" width="8.5" height="2" />
        <rect x="220" y="26" width="6.5" height="2" />
        {/* Dome of Far Right Minaret */}
        <path d="M220,24 C220,19 223.25,16 223.25,16 C223.25,16 226.5,19 226.5,24 Z" />
        <rect x="222.5" y="12" width="1.5" height="4" />
        <circle cx="223.25" cy="11.5" r="1.2" />
      </g>
    </svg>
  );
}
