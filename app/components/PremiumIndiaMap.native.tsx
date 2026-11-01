import React, { useMemo } from "react";
import NativeLeafletMap from "./NativeLeafletMap";
import type { RegionGroup } from "../src/services/regionService";
import type { NativeMapOptions, MapFocus } from "../src/utils/nativeMapHtml";
import { INDIA_STATES_DATA, type IndiaStateInfo } from "../src/data/indiaStatesData";
import type { Property } from "../src/types/property.types";
import { hasParcelBoundary } from "../src/utils/parcelMap";

interface PremiumIndiaMapProps {
  groups: RegionGroup[];
  level: "state" | "district" | "pincode";
  state?: string;
  focus?: MapFocus;
  properties?: Property[];
  onSelectGroup: (group: RegionGroup) => void;
  onSelectStateInfo?: (state: IndiaStateInfo) => void;
  onSelectProperty?: (property: Property) => void;
}

function priceLabel(price: number) {
  if (price >= 10000000) return `₹${Number((price / 10000000).toFixed(2))} Cr`;
  if (price >= 100000) return `₹${Number((price / 100000).toFixed(1))} L`;
  return price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Verified Plot";
}

export default function PremiumIndiaMap({ groups, level, state, focus, properties = [], onSelectGroup, onSelectStateInfo, onSelectProperty }: PremiumIndiaMapProps) {
  const options = useMemo<NativeMapOptions>(() => ({
    marketplace: true,
    focus: focus || { lat: 25.65, lng: 85.35, zoom: 7.5 },
    regions: { groups, level, state, showCountTags: false },
    pins: [
      ...properties.filter(property => property.location?.lat && property.location?.lng).map(property => ({
        id: `property:${property.id || property._id}`,
        lat: property.location.lat, lng: property.location.lng,
        label: priceLabel(property.price), title: property.title || `${property.type} in ${property.location.district}`,
      })),
      ...(level === "state" ? INDIA_STATES_DATA.map(item => ({
        id: `state:${item.name}`, lat: item.lat, lng: item.lng, label: item.name, title: item.name,
      })) : []),
    ],
    parcels: properties.filter(property => hasParcelBoundary(property.parcelPoints)).map(property => ({
      id: `property:${property.id || property._id}`, points: property.parcelPoints!,
    })),
  }), [properties, groups, focus, level, state]);

  return <NativeLeafletMap options={options} onSelect={key => {
    if (key.startsWith("property:")) {
      const property = properties.find(item => `property:${item.id || item._id}` === key);
      if (property) onSelectProperty?.(property);
    } else if (key.startsWith("state:")) {
      const selected = INDIA_STATES_DATA.find(item => `state:${item.name}` === key);
      if (!selected) return;
      const group = groups.find(item => item.name.toLowerCase() === selected.name.toLowerCase());
      if (group) onSelectGroup(group);
      else onSelectStateInfo?.(selected);
    } else {
      const group = groups.find(item => item.key === key);
      if (group) onSelectGroup(group);
    }
  }} />;
}
