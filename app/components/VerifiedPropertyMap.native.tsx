import React, { useMemo } from "react";
import { View } from "react-native";
import type { Property } from "../src/types/property.types";
import NativeLeafletMap from "./NativeLeafletMap";
import type { MapFocus } from "../src/utils/nativeMapHtml";
import { hasParcelBoundary } from "../src/utils/parcelMap";

export default function VerifiedPropertyMap({ properties, onSelect, focus, zoomControls = false, twoFingerPan = false }: { properties: Property[]; onSelect: (property: Property) => void; focus?: MapFocus; zoomControls?: boolean; twoFingerPan?: boolean }) {
  const options = useMemo(() => ({ focus, zoomControls, twoFingerPan,
    satellite: properties.length === 1 && hasParcelBoundary(properties[0].parcelPoints),
    parcels: properties.filter(property => hasParcelBoundary(property.parcelPoints)).map(property => ({ id: property.id || property._id || "", points: property.parcelPoints! })),
    pins: properties.map(property => ({
    id: property.id || property._id || "", lat: property.location.lat, lng: property.location.lng,
    label: `₹${(property.price / 100000).toFixed(1)}L`, title: property.title || `${property.type} in ${property.location.district}`,
  })) }), [properties, focus, zoomControls, twoFingerPan]);
  return <View style={{ width: "100%", height: "100%" }}><NativeLeafletMap options={options} onSelect={id => {
    const property = properties.find(item => (item.id || item._id) === id);
    if (property) onSelect(property);
  }} /></View>;
}
