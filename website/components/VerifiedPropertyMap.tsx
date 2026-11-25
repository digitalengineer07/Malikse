import React, { useEffect, useRef, useState } from "react";
import { Platform, View, Text, StyleSheet } from "react-native";
import type { Property } from "../src/types/property.types";
import { addParcelBaseLayer, hasParcelBoundary, parcelStyle } from "../src/utils/parcelMap";
import { validMapPoint, type MapFocus } from "../src/utils/nativeMapHtml";

export default function VerifiedPropertyMap({
  properties,
  onSelect,
  focus,
  mapLayer = "standard",
}: {
  properties: Property[];
  onSelect: (property: Property) => void;
  focus?: MapFocus;
  mapLayer?: "standard" | "satellite" | "mouza";
}) {
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
      map = L.map(container.current, { scrollWheelZoom: true, zoomControl: false }).setView([25.6, 85.1], 7);
      map.attributionControl?.setPrefix(false);
      
      // Use satellite base layer if viewing a single property (popup from details), else use chosen mapLayer.
      if (properties.length === 1 && hasParcelBoundary(properties[0].parcelPoints)) {
        addParcelBaseLayer(L, map);
      } else if (mapLayer === "satellite") {
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
          attribution: 'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google</a>',
          maxZoom: 20,
          subdomains: "0123",
        }).addTo(map);
      } else if (mapLayer === "mouza") {
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}", {
          attribution: 'Cadastral &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google</a>',
          maxZoom: 20,
          subdomains: "0123",
        }).addTo(map);
      } else {
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          attribution: 'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google</a>',
          maxZoom: 20,
          subdomains: "0123",
        }).addTo(map);
      }
      
      const points: [number, number][] = [];
      properties.forEach(property => {
        const { lat, lng } = property.location;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
        points.push([lat, lng]);
        
        if (hasParcelBoundary(property.parcelPoints)) {
          const polyPoints = property.parcelPoints!.map(p => [p.lat, p.lng] as [number, number]);
          L.polygon(polyPoints, parcelStyle).addTo(map!).on("click", () => onSelect(property));
          polyPoints.forEach(p => points.push(p));
        }
        const label = document.createElement("div");
        label.innerHTML = `<div style="background: #14263E; color: #FFFFFF; padding: 6px 12px; border-radius: 999px; font-family: Manrope, system-ui, sans-serif; font-weight: 800; white-space: nowrap; box-shadow: 0 8px 18px -4px rgba(12,26,44,0.42); border: 2px solid #FCC61C; font-size: 12.5px; letter-spacing: -0.2px;">₹${(property.price / 100000).toFixed(1)}L</div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #14263E; margin: -2px auto 0 auto; position: relative; z-index: 1;"></div>
        <div style="width: 8px; height: 8px; border-radius: 4px; background: #FCC61C; border: 1.5px solid #14263E; margin: 2px auto 0 auto; box-shadow: 0 2px 4px rgba(12,26,44,0.3);"></div>`;
        const marker = L.marker([lat, lng], { title: property.title || `${property.type} in ${property.location.district}`, icon: L.divIcon({ html: label, className: "", iconSize: [80, 50], iconAnchor: [40, 50] }) }).addTo(map!).on("click", () => onSelect(property));
        marker.getElement()?.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(property); }
        });
      });
      if (focus && validMapPoint(focus) && Number.isFinite(focus.zoom)) map.setView([focus.lat, focus.lng], Math.max(1, Math.min(19, focus.zoom)));
      else if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [65, 65], maxZoom: properties.length === 1 ? 19 : 14 });
      resize = new ResizeObserver(() => map?.invalidateSize());
      resize.observe(container.current);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; resize?.disconnect(); map?.remove(); };
  }, [properties, onSelect, focus, mapLayer]);

  return <View style={styles.map}>
    {Platform.OS === "web" && <div ref={container} aria-label="Map of verified properties" style={{ width: "100%", height: "100%" }} />}
    {(failed || Platform.OS !== "web") && <View style={styles.fallback}><Text style={styles.text}>{failed ? "Map unavailable. Explore the verified properties below." : "Explore verified properties below. Open a property for its map location."}</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  map: { height: "100%", width: "100%", overflow: "hidden", backgroundColor: "#E9E4D5" },
  fallback: { flex: 1, justifyContent: "center", padding: 30 },
  text: { color: "#14263E", fontSize: 15, fontWeight: "600" }
});
