import { removeLeafletMap } from "../src/utils/removeLeafletMap";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import type { Property } from "../src/types/property.types";
import { addParcelBaseLayer, hasParcelBoundary, parcelStyle } from "../src/utils/parcelMap";

export default function MiniMapPreview({ property, fixedPreview = false }: { property: Property; fixedPreview?: boolean }) {
  return <MiniMapContent key={JSON.stringify(property.parcelPoints)} property={property} fixedPreview={fixedPreview} />;
}
function MiniMapContent({ property, fixedPreview = false }: { property: Property; fixedPreview?: boolean }) {
  const container = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const points = property.parcelPoints;
  useEffect(() => {
    if (Platform.OS !== "web" || !hasParcelBoundary(points)) return;
    let active = true;
    let map: import("leaflet").Map | undefined;
    import("leaflet").then(module => {
      if (!active || !container.current) return;
      const L = module.default || module;
      map = L.map(container.current, { zoomControl: false, maxZoom: 20, scrollWheelZoom: !fixedPreview, ...(fixedPreview ? { dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false } : {}) });
      addParcelBaseLayer(L, map);
      if (points && points.length >= 3) {
        const polygon = L.polygon(points.map(point => [point.lat, point.lng]), parcelStyle).addTo(map);
        map.fitBounds(polygon.getBounds(), fixedPreview ? { padding: [38, 38], maxZoom: 17, animate: false } : { padding: [16, 16], maxZoom: 19 });
      }
      setLoading(false);
    }).catch(() => { if (active) { setFailed(true); setLoading(false); } });
    return () => { active = false; removeLeafletMap(map); };
  }, [fixedPreview, points]);
  if (Platform.OS !== "web") return null;
  if (!hasParcelBoundary(points)) return <Text>No parcel boundary recorded for this property.</Text>;
  return <View style={styles.container}>
    <div ref={container} style={{ width: "100%", height: "100%" }} />
    {loading && <View style={styles.overlay}><ActivityIndicator color="#047857" /></View>}
    {failed && <View style={styles.overlay}><Text>Map unavailable. Use “Open location in maps” below.</Text></View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: "100%", height: 240, borderRadius: 8, overflow: "hidden", backgroundColor: "#F2F2F2" },
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 12 },
});
