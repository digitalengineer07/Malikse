import React, { useMemo } from "react";
import { View } from "react-native";
import type { Property } from "../src/types/property.types";
import NativeLeafletMap from "./NativeLeafletMap";

export default function MiniMapPreview({ property, fixedPreview = false }: { property: Property; fixedPreview?: boolean }) {
  const options = useMemo(() => ({ satellite: true, fixedPreview, points: property.parcelPoints, pins: property.parcelPoints?.length ? [] : [{ ...property.location, id: property.id, title: "Property location", label: "Property" }] }), [fixedPreview, property.parcelPoints, property.location, property.id]);
  return <View style={{ width: "100%", height: 240, borderRadius: 12, overflow: "hidden" }}><NativeLeafletMap options={options} /></View>;
}
