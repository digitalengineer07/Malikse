import type { RegionGroup } from "../services/regionService";

export type RegionBoundaryOptions = { level: "state" | "district" | "pincode"; state?: string; groups: RegionGroup[]; showCountTags?: boolean };

/** Closure-free: also embedded in the native WebView, keeping both maps identical. */
export function addRegionBoundaries(L: any, map: any, options: RegionBoundaryOptions, select: (key: string) => void, fail: () => void) {
  const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = { orissa: "odisha", uttaranchal: "uttarakhand", pondicherry: "puducherry", nctofdelhi: "delhi", newdelhi: "delhi", bangaloreurban: "bengaluruurban", bangalorerural: "bengalururural", allahabad: "prayagraj", gurgaon: "gurugram" };
  const canonical = (value: unknown) => { const name = normalize(value); return aliases[name] || name; };
  const groups = new Map(options.groups.map(group => [canonical(group.key), group]));
  const palette = ["#00E5FF", "#FF3DF2", "#B6FF00", "#FF9F1C", "#9D6BFF", "#00FFAE"];
  const colors = new Map([...groups.keys()].sort().map((key, index) => [key, palette[index % palette.length]]));
  const tags = new Map<string, { marker: any; score: number }>();
  let disposed = false;
  const sources = {
    state: { path: "states/soi", layer: "SOI_States" },
    district: { path: "districts/soi", layer: "SOI_Districts" },
    pincode: { path: "pincodes/datagovin", layer: "Datagov_Pincode_Boundaries" },
  };
  const source = sources[options.level];
  const match = (properties: Record<string, unknown>) => {
    if (options.level === "district" && canonical(properties.STATE_C || properties.STATE) !== canonical(options.state)) return undefined;
    const value = options.level === "state" ? properties.STATE_C || properties.STATE : options.level === "district" ? properties.District_C || properties.District : properties.Pincode;
    return groups.get(canonical(value));
  };
  const style = (properties: Record<string, unknown>) => {
    const group = match(properties);
    if (!group) return [];
    const color = colors.get(canonical(group.key));
    return [
      { color, weight: 7, fill: false, opacity: 0.22 },
      { color, weight: 2.5, fill: true, fillColor: color, fillOpacity: 0.16, opacity: 1 },
    ];
  };
  // Place one tag within the polygon's rings, respecting holes and concave outlines.
  const addTag = (feature: any, extent: number, coordinates: { x: number; y: number; z: number }) => {
    if (options.showCountTags === false) return;
    const group = match(feature.properties);
    if (!group || feature.type !== 3 || !feature.geometry?.length || disposed) return;
    const rings = feature.geometry;
    let low = extent, high = 0;
    rings.forEach((ring: any[]) => ring.forEach(point => { low = Math.min(low, point.y);high = Math.max(high, point.y); }));
    low = Math.max(0, low);high = Math.min(extent, high);
    if (high <= low) return;
    let best: { x: number; y: number; score: number } | undefined;
    for (let row = 1; row < 16; row++) {
      const y = low + (high - low) * row / 16;
      const crossings: number[] = [];
      rings.forEach((ring: any[]) => {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[j], b = ring[i];
          if ((a.y > y) !== (b.y > y)) crossings.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
        }
      });
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const left = Math.max(0, crossings[i]), right = Math.min(extent, crossings[i + 1]);
        const score = (right - left) * Math.min(y - low, high - y) / (extent * extent * 4 ** coordinates.z);
        if (right > left && (!best || score > best.score)) best = { x: (left + right) / 2, y, score };
      }
    }
    if (!best) return;
    const previous = tags.get(group.key);
    if (previous && previous.score >= best.score) return;
    const position = map.unproject(L.point((coordinates.x + best.x / extent) * 256, (coordinates.y + best.y / extent) * 256), coordinates.z);
    if (previous) { previous.marker.setLatLng(position);previous.score = best.score;return; }
    const color = colors.get(canonical(group.key));
    const label = document.createElement("button");
    label.type = "button";label.textContent = group.count.toLocaleString("en-IN");
    label.setAttribute("aria-label", `${group.name}, ${group.count} available properties. Select ${options.level}`);
    label.title = `${group.name} · ${group.count.toLocaleString("en-IN")} properties`;
    label.style.cssText = `transform:translate(-50%,-50%);min-width:30px;height:26px;padding:2px 7px;border:1.5px solid ${color};border-radius:8px;background:#102039;color:white;font:700 12px system-ui;white-space:nowrap;cursor:pointer;box-shadow:0 0 8px ${color}80`;
    label.onclick = (event: any) => { event.stopPropagation();select(group.key); };
    const marker = L.marker(position, { keyboard: false, icon: L.divIcon({ html: label, className: "region-count-tag", iconSize: [0, 0], iconAnchor: [0, 0] }) }).addTo(map);
    tags.set(group.key, { marker, score: best.score });
  };
  const BoundaryGrid = L.VectorGrid.Protobuf.extend({
    _getVectorTilePromise: function (coordinates: { x: number; y: number; z: number }) {
      return L.VectorGrid.Protobuf.prototype._getVectorTilePromise.call(this, coordinates).then((tile: any) => {
        const layer = tile.layers[source.layer];
        if (!disposed && layer) layer.features.forEach((feature: any) => addTag(feature, layer.extent || 4096, coordinates));
        return tile;
      }).catch(() => {
        if (!disposed && this._map) fail();
        return { layers: {} };
      });
    },
  });
  const grid = new BoundaryGrid(`https://indianopenmaps.com/${source.path}/{z}/{x}/{y}.pbf`, {
    vectorTileLayerStyles: { [source.layer]: style }, interactive: true,
    maxNativeZoom: 14, maxZoom: 19, bounds: [[6, 67], [38, 98]],
    attribution: 'Boundaries: Survey of India',
  });
  const tooltip = L.tooltip({ sticky: true, direction: "top" });
  grid.on("mouseover", (event: any) => {
    const group = match(event.layer.properties);
    if (!group) return;
    const label = document.createElement("span");
    label.textContent = `${group.name} · ${group.count.toLocaleString("en-IN")} available properties`;
    tooltip.setLatLng(event.latlng).setContent(label).addTo(map);
  });
  grid.on("mouseout", () => map.removeLayer(tooltip));
  grid.on("click", (event: any) => {
    const group = match(event.layer.properties);
    if (group) { map.removeLayer(tooltip); select(group.key); }
  });
  grid.addTo(map);
  // Missing pincodes have no polygon. Keep only these exceptional records selectable.
  const missing = options.groups.filter(group => group.key === "__missing__");
  const chooser = L.control({ position: "topright" });
  chooser.onAdd = () => {
    const container = L.DomUtil.create("div", "leaflet-bar");
    const input = document.createElement("select");
    input.setAttribute("aria-label", `Select ${options.level} with available properties`);
    input.style.cssText = "max-width:230px;min-height:44px;background:white;color:#19334a;border:0;padding:8px;border-radius:4px";
    const placeholder = document.createElement("option");placeholder.textContent = "Select an area";placeholder.value = "";input.appendChild(placeholder);
    missing.forEach(group => { const item = document.createElement("option");item.value = group.key;item.textContent = `${group.name} · ${group.count}`;input.appendChild(item); });
    input.onchange = () => { if (input.value) select(input.value); };
    container.appendChild(input);L.DomEvent.disableClickPropagation(container);L.DomEvent.disableScrollPropagation(container);
    return container;
  };
  if (missing.length) chooser.addTo(map);
  return () => { disposed = true;tags.forEach(tag => map.removeLayer(tag.marker));tags.clear();map.removeLayer(tooltip);map.removeLayer(grid);if (missing.length) map.removeControl(chooser); };
}
