import React, { useMemo } from "react";
import { View } from "react-native";
import type { Property } from "../src/types/property.types";
import NativeLeafletMap from "./NativeLeafletMap";

export default function VerifiedPropertyMap({ properties, onSelect }: { properties: Property[]; onSelect: (property: Property) => void }) {
  const options = useMemo(() => ({ pins: properties.map(property => ({
    id: property.id || property._id || "", lat: property.location.lat, lng: property.location.lng,
    label: `₹${(property.price / 100000).toFixed(1)}L`, title: property.title || `${property.type} in ${property.location.district}`,
  })) }), [properties]);
  return <View style={{ width: "100%", height: "100%" }}><NativeLeafletMap options={options} onSelect={id => {
    const property = properties.find(item => (item.id || item._id) === id);
    if (property) onSelect(property);
  }} /></View>;
}
