import React, { useMemo } from "react";
import NativeLeafletMap from "./NativeLeafletMap";
import type { RegionGroup } from "../src/services/regionService";
import type { MapFocus } from "../src/utils/nativeMapHtml";
import type { RegionBoundaryOptions } from "../src/utils/regionBoundaryLayer";
export default function RegionCountMap({ groups, focus, level, state, onSelect }: RegionBoundaryOptions & { focus?: MapFocus; onSelect: (group: RegionGroup) => void }) {
  const options = useMemo(() => ({ focus: focus || { lat: 22.5, lng: 79, zoom: 4 }, regions: { groups, level, state } }), [groups, focus, level, state]);
  return <NativeLeafletMap options={options} onSelect={key => { const group = groups.find(item => item.key === key); if (group) onSelect(group); }} />;
}
