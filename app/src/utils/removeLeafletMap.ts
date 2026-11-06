import type { Map } from "leaflet";

/** Cancel Leaflet 1.9's queued wheel zoom before it loses its map pane. */
export function removeLeafletMap(map: Map | null | undefined): void {
  if (!map) return;

  // Leaflet removeHooks detaches wheel events but does not clear this timeout.
  // Keep the private-field workaround here so it can be revisited on upgrades.
  const wheel = map.scrollWheelZoom as typeof map.scrollWheelZoom & {
    _timer?: ReturnType<typeof setTimeout>;
  };
  wheel?.disable();
  if (wheel) clearTimeout(wheel._timer);
  map.remove();
}
