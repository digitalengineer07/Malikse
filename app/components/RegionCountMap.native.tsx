import React, { useMemo } from "react";
import NativeLeafletMap from "./NativeLeafletMap";
import type { RegionGroup } from "../src/services/regionService";
import type { MapFocus } from "../src/utils/nativeMapHtml";
export default function RegionCountMap({ groups, focus, onSelect }: { groups: RegionGroup[]; focus?: MapFocus; onSelect: (group: RegionGroup) => void }) {
  const options = useMemo(() => ({ focus: focus || { lat: 22.5, lng: 79, zoom: 4 }, pins: groups.map(group => ({ id: group.key, lat: group.lat, lng: group.lng, title: group.name, label: `${group.name} · ${group.count}` })) }), [groups, focus]);
  return <NativeLeafletMap options={options} onSelect={key => { const group = groups.find(item => item.key === key); if (group) onSelect(group); }} />;
}
