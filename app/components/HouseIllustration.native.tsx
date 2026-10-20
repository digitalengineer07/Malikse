import React from "react";
import Svg, { Defs, LinearGradient, Stop, G, Path, Circle, Ellipse, Rect, Polygon, Line } from "react-native-svg";

interface HouseIllustrationProps {
  width?: number;
  height?: number;
}

export default function HouseIllustration({ width = 260, height = 150 }: HouseIllustrationProps) {

    return (
      <Svg
        viewBox="0 0 320 180"
        width={width}
        height={height}
        
      >
        <Defs>
          <LinearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#E6F2FC" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#D2E7F8" stopOpacity="0.5" />
          </LinearGradient>
          <LinearGradient id="roofGrad1" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#1E3E64" />
            <Stop offset="100%" stopColor="#132B47" />
          </LinearGradient>
          <LinearGradient id="roofGrad2" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#2A5382" />
            <Stop offset="100%" stopColor="#1D3E64" />
          </LinearGradient>
          <LinearGradient id="wallLight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#E2EDF7" />
          </LinearGradient>
          <LinearGradient id="wallShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#DFEAF5" />
            <Stop offset="100%" stopColor="#C8DAEB" />
          </LinearGradient>
          <LinearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#CCE2F5" />
            <Stop offset="100%" stopColor="#B3D3ED" stopOpacity="0.7" />
          </LinearGradient>
        </Defs>

        {/* Soft Background Clouds */}
        <G fill="url(#cloudGrad)">
          {/* Left Cloud */}
          <Path d="M 60,85 A 18,18 0 0,1 82,72 A 22,22 0 0,1 114,75 A 16,16 0 0,1 126,88 L 56,88 Z" />
          {/* Right Cloud */}
          <Path d="M 194,88 A 16,16 0 0,1 210,76 A 22,22 0 0,1 242,75 A 18,18 0 0,1 262,88 L 190,88 Z" />
        </G>

        {/* Distant Puffy Background Trees */}
        <Circle cx="86" cy="116" r="18" fill="#8BBDE3" opacity="0.6" />
        <Circle cx="236" cy="118" r="17" fill="#8BBDE3" opacity="0.6" />

        {/* House Ground Mound */}
        <Ellipse cx="160" cy="148" rx="138" ry="14" fill="url(#groundGrad)" />

        {/* Tree Group Left (Deeper & Medium Blue) */}
        <Circle cx="108" cy="118" r="15" fill="#296294" />
        <Circle cx="118" cy="125" r="12" fill="#3D7BAE" />
        <Rect x="106" y="128" width="4" height="18" fill="#1A3B5C" rx="1.5" />

        {/* Right Trees */}
        <Circle cx="214" cy="120" r="14" fill="#3573A6" />
        <Circle cx="225" cy="126" r="11" fill="#4B89BC" />
        <Rect x="212" y="128" width="4" height="18" fill="#1A3B5C" rx="1.5" />

        {/* Main Central House Structure */}
        {/* Left Wing / Garage */}
        <Rect x="120" y="102" width="46" height="42" fill="url(#wallShade)" />
        <Polygon points="116,102 143,84 170,102" fill="url(#roofGrad2)" />
        {/* Garage Door */}
        <Rect x="128" y="116" width="28" height="28" fill="#FFFFFF" rx="2" />
        <Line x1="128" y1="123" x2="156" y2="123" stroke="#CBDCEB" strokeWidth="1.5" />
        <Line x1="128" y1="130" x2="156" y2="130" stroke="#CBDCEB" strokeWidth="1.5" />
        <Line x1="128" y1="137" x2="156" y2="137" stroke="#CBDCEB" strokeWidth="1.5" />

        {/* Main Center Two-Story Section */}
        <Rect x="156" y="86" width="46" height="58" fill="url(#wallLight)" />
        {/* Upper Gable Roof */}
        <Polygon points="150,86 179,62 208,86" fill="url(#roofGrad1)" />

        {/* Second Floor Windows */}
        <Rect x="164" y="93" width="12" height="16" fill="#82B7DE" rx="1.5" />
        <Rect x="182" y="93" width="12" height="16" fill="#82B7DE" rx="1.5" />
        <Line x1="170" y1="93" x2="170" y2="109" stroke="#FFFFFF" strokeWidth="1.5" />
        <Line x1="164" y1="101" x2="176" y2="101" stroke="#FFFFFF" strokeWidth="1.5" />
        <Line x1="188" y1="93" x2="188" y2="109" stroke="#FFFFFF" strokeWidth="1.5" />
        <Line x1="182" y1="101" x2="194" y2="101" stroke="#FFFFFF" strokeWidth="1.5" />

        {/* Ground Floor Entrance & Door */}
        <Rect x="171" y="122" width="16" height="22" fill="#1F4873" rx="2" />
        <Circle cx="183" cy="133" r="1.5" fill="#FFFFFF" />

        {/* Right Wing with Overhang */}
        <Rect x="202" y="98" width="24" height="46" fill="url(#wallShade)" />
        <Polygon points="198,98 214,84 230,98" fill="url(#roofGrad2)" />
        <Rect x="208" y="107" width="12" height="14" fill="#82B7DE" rx="1" />
        <Line x1="214" y1="107" x2="214" y2="121" stroke="#FFFFFF" strokeWidth="1.5" />
        <Line x1="208" y1="114" x2="220" y2="114" stroke="#FFFFFF" strokeWidth="1.5" />

        {/* Front Bushes & Foliage */}
        <Circle cx="124" cy="144" r="8" fill="#3D7EB5" />
        <Circle cx="160" cy="144" r="7" fill="#2E699D" />
        <Circle cx="199" cy="144" r="8" fill="#3877AC" />
        <Circle cx="218" cy="144" r="7" fill="#5290C2" />
      </Svg>
    );
}
