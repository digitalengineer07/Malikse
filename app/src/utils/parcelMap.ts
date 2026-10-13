import type * as Leaflet from "leaflet";

// Shared by the listing editor and every read-only property/review map.
// Satellite imagery excludes road/place-label layers; overlays represent parcels only.
export const parcelStyle: Leaflet.PathOptions = {
  color: "#10B981",
  weight: 2.5,
  fillColor: "#059669",
  fillOpacity: 0.35,
  lineJoin: "round",
};

export function addParcelBaseLayer(L: typeof Leaflet, map: Leaflet.Map) {
  return L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
    maxZoom: 20,
    attribution: "Imagery © Google",
  }).addTo(map);
}

export function hasParcelBoundary(points?: { lat: number; lng: number }[]) {
  return !!points && points.length >= 3 && points.every(point =>
    Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    Number.isFinite(point.lng) && Math.abs(point.lng) <= 180);
}
