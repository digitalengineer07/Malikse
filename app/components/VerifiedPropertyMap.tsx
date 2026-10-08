import React, { useEffect, useRef, useState } from "react";
import { Platform, View, Text, StyleSheet } from "react-native";
import type { Property } from "../src/types/property.types";

export default function VerifiedPropertyMap({ properties, onSelect }: { properties: Property[]; onSelect: (property: Property) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let active = true;
    let map: import("leaflet").Map | undefined;
    let resize: ResizeObserver | undefined;
    import("leaflet").then(module => {
      if (!active || !container.current) return;
      const L = module.default || module;
      map = L.map(container.current, { scrollWheelZoom: false }).setView([25.6, 85.1], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
      const points: [number, number][] = [];
      properties.forEach(property => {
        const { lat, lng } = property.location;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
        points.push([lat, lng]);
        const label = document.createElement("div");
        label.innerHTML = `<div style="background: #1A365D; color: white; padding: 6px 12px; border-radius: 20px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 2px solid rgba(255,255,255,0.8); font-size: 13px;">₹${(property.price / 100000).toFixed(1)}L</div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #1A365D; margin: -2px auto 0 auto; position: relative; z-index: 1;"></div>
        <div style="width: 8px; height: 8px; border-radius: 4px; background: #1A365D; margin: 2px auto 0 auto; box-shadow: 0 0 0 2px white, 0 2px 4px rgba(0,0,0,0.2);"></div>`;
        const marker = L.marker([lat, lng], { title: property.title || `${property.type} in ${property.location.district}`, icon: L.divIcon({ html: label, className: "", iconSize: [80, 50], iconAnchor: [40, 50] }) }).addTo(map!).on("click", () => onSelect(property));
        marker.getElement()?.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(property); }
        });
      });
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [65, 65], maxZoom: 14 });
      resize = new ResizeObserver(() => map?.invalidateSize());
      resize.observe(container.current);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; resize?.disconnect(); map?.remove(); };
  }, [properties, onSelect]);
  return <View style={styles.map}>
    {Platform.OS === "web" && <div ref={container} aria-label="Map of verified properties" style={{ width: "100%", height: "100%" }} />}
    {(failed || Platform.OS !== "web") && <View style={styles.fallback}><Text style={styles.text}>{failed ? "Map unavailable. Explore the verified properties below." : "Explore verified properties below. Open a property for its map location."}</Text></View>}
  </View>;
}
const styles = StyleSheet.create({ map: { height: "100%", width: "100%", overflow: "hidden", backgroundColor: "#E9F3FA" }, fallback: { flex: 1, justifyContent: "center", padding: 30 }, text: { color: "#284B68", fontSize: 16 } });
