import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import type { RegionGroup } from "../src/services/regionService";
import { validMapPoint, type MapFocus } from "../src/utils/nativeMapHtml";
import { addRegionBoundaries, type RegionBoundaryOptions } from "../src/utils/regionBoundaryLayer";
export default function RegionCountMap({ groups, focus, level, state, onSelect }: RegionBoundaryOptions & { focus?: MapFocus; onSelect: (group: RegionGroup) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let resize: ResizeObserver | undefined;
    import("leaflet").then(async module => {
      const L = module.default || module;
      (window as any).L = L;
      await import("leaflet.vectorgrid");
      if (!active || !container.current) return;
      map.current = L.map(container.current, { zoomControl: false }).setView([22.5, 79], 4);
      L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", { attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>', maxZoom: 20, subdomains: "0123" }).addTo(map.current);
      resize = new ResizeObserver(() => map.current?.invalidateSize());resize.observe(container.current);
      setReady(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; resize?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    setFailed(false);
    import("leaflet").then(module => {
      if (!active || !map.current) return;
      const L = module.default || module;
      cleanup = addRegionBoundaries(L, map.current, { groups, level, state }, key => {
        const group = groups.find(item => item.key === key);if (group) onSelect(group);
      }, () => { if (active) setFailed(true); });
      if (focus && validMapPoint(focus)) map.current.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.6 });
      else map.current.setView([22.5, 79], 4);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; cleanup?.(); };
  }, [ready, groups, focus, level, state, onSelect]);
  return <View style={{ flex: 1, backgroundColor: "#E9F3FA" }}><div ref={container} aria-label="Highlighted area boundaries with available properties" style={{ height: "100%", width: "100%" }} />{failed && <Text accessibilityRole="alert">Boundaries could not load. Search for an area above.</Text>}</View>;
}
