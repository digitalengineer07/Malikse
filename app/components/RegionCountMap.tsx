import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import type { RegionGroup } from "../src/services/regionService";
import { validMapPoint, type MapFocus } from "../src/utils/nativeMapHtml";
export default function RegionCountMap({ groups, focus, onSelect }: { groups: RegionGroup[]; focus?: MapFocus; onSelect: (group: RegionGroup) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let resize: ResizeObserver | undefined;
    import("leaflet").then(module => {
      if (!active || !container.current) return;
      const L = module.default || module;
      map.current = L.map(container.current, { zoomControl: false }).setView([22.5, 79], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      resize = new ResizeObserver(() => map.current?.invalidateSize());resize.observe(container.current);
      setReady(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; resize?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    import("leaflet").then(module => {
      if (!active || !map.current || !layer.current) return;
      const L = module.default || module;
      layer.current.clearLayers();
      groups.filter(validMapPoint).forEach(group => {
        const label = document.createElement("button");
        label.textContent = `${group.name} · ${group.count.toLocaleString("en-IN")}`;
        label.setAttribute("aria-label", `${group.name}, ${group.count} available properties`);
        label.style.cssText = "background:#1A365D;color:white;border:2px solid white;border-radius:24px;padding:10px 14px;white-space:nowrap;font-weight:bold;cursor:pointer;box-shadow:0 2px 8px #0003";
        label.onclick = () => onSelect(group);
        L.marker([group.lat, group.lng], { keyboard: false, icon: L.divIcon({ html: label, className: "", iconSize: [150, 44], iconAnchor: [75, 22] }) }).addTo(layer.current!);
      });
      if (focus && validMapPoint(focus)) map.current.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.6 });
      else map.current.setView([22.5, 79], 4);
    });
    return () => { active = false; };
  }, [ready, groups, focus, onSelect]);
  return <View style={{ flex: 1, backgroundColor: "#E9F3FA" }}><div ref={container} aria-label="Available properties by area" style={{ height: "100%", width: "100%" }} />{failed && <Text>Map unavailable. Select an area from the list below.</Text>}</View>;
}
