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
        const label = document.createElement("span");
        label.textContent = `₹${property.price.toLocaleString("en-IN")}`;
        Object.assign(label.style, { background: "#142334", color: "white", padding: "9px 13px", borderRadius: "20px", fontWeight: "700", whiteSpace: "nowrap", boxShadow: "0 4px 16px #20395030", border: "2px solid white" });
        const marker = L.marker([lat, lng], { title: property.title || `${property.type} in ${property.location.district}`, icon: L.divIcon({ html: label, className: "property-price-marker", iconSize: [110, 34], iconAnchor: [55, 17] }) }).addTo(map!).on("click", () => onSelect(property));
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
const styles = StyleSheet.create({ map: { height: 400, width: "100%", borderRadius: 28, overflow: "hidden", backgroundColor: "#E9F3FA" }, fallback: { flex: 1, justifyContent: "center", padding: 30 }, text: { color: "#284B68", fontSize: 16 } });
