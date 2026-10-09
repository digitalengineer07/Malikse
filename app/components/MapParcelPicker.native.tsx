import React, { useRef } from "react";
import { Text, View } from "react-native";
import NativeLeafletMap from "./NativeLeafletMap";
import type { MapPoint } from "../src/utils/nativeMapHtml";
export type LatLngPoint = MapPoint;

export default function MapParcelPicker({ initialPoints, onParcelChange }: { initialPoints?: MapPoint[]; onParcelChange: (points: MapPoint[]) => void; areaSqFt?: number | string }) {
  // Seed only on mount: parent updates must not reload the WebView mid-drawing.
  const options = useRef({ points: initialPoints ?? [], editable: true }).current;
  return <View style={{ gap: 10 }}>
    <Text style={{ color: "#284B68", lineHeight: 22 }}>Zoom to your property, then tap each boundary corner. Tap Finish to close the boundary. Drag a corner to adjust it.</Text>
    <View style={{ height: 430, borderRadius: 16, overflow: "hidden" }}><NativeLeafletMap options={options} onPoints={onParcelChange} /></View>
  </View>;
}
