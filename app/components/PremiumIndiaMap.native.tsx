import React, { useMemo } from "react";
import NativeLeafletMap from "./NativeLeafletMap";
import type { RegionGroup } from "../src/services/regionService";
import type { MapFocus } from "../src/utils/nativeMapHtml";
import type { IndiaStateInfo } from "../src/data/indiaStatesData";

interface PremiumIndiaMapProps {
  groups: RegionGroup[];
  level: "state" | "district" | "pincode";
  state?: string;
  focus?: MapFocus;
  onSelectGroup: (group: RegionGroup) => void;
  onSelectStateInfo?: (state: IndiaStateInfo) => void;
}

export default function PremiumIndiaMap({
  groups,
  level,
  state,
  focus,
  onSelectGroup,
}: PremiumIndiaMapProps) {
  const options = useMemo(
    () => ({
      focus: focus || { lat: 22.8, lng: 79.2, zoom: 4.5 },
      regions: { groups, level, state },
    }),
    [groups, focus, level, state]
  );

  return (
    <NativeLeafletMap
      options={options}
      onSelect={(key) => {
        const group = groups.find((item) => item.key === key);
        if (group) onSelectGroup(group);
      }}
    />
  );
}
