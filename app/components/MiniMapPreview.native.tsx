import React, { useMemo } from "react";
import { View } from "react-native";
import type { Property } from "../src/types/property.types";
import NativeLeafletMap from "./NativeLeafletMap";

export default function MiniMapPreview({ property }: { property: Property }) {
  const options = useMemo(() => ({ satellite: true, points: property.parcelPoints, pins: property.parcelPoints?.length ? [] : [{ ...property.location, id: property.id, title: "Property location", label: "Property" }] }), [property.parcelPoints, property.location, property.id]);
  return <View style={{ width: "100%", height: 240, borderRadius: 12, overflow: "hidden" }}><NativeLeafletMap options={options} /></View>;
}
