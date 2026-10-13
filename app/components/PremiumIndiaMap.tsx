import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { RegionGroup } from "../src/services/regionService";
import { validMapPoint, type MapFocus } from "../src/utils/nativeMapHtml";
import { addRegionBoundaries } from "../src/utils/regionBoundaryLayer";
import { INDIA_STATES_DATA, type IndiaStateInfo } from "../src/data/indiaStatesData";
import { currentMapLocation } from "../src/services/currentMapLocation";

interface PremiumIndiaMapProps {
  groups: RegionGroup[];
  level: "state" | "district" | "pincode";
  state?: string;
  focus?: MapFocus;
  onSelectGroup: (group: RegionGroup) => void;
  onSelectStateInfo?: (state: IndiaStateInfo) => void;
}

const DEFAULT_CENTER = { lat: 22.8, lng: 79.2, zoom: 4.5 };

export default function PremiumIndiaMap({
  groups,
  level,
  state,
  focus,
  onSelectGroup,
  onSelectStateInfo,
}: PremiumIndiaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const stateMarkersLayerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let active = true;
    let resizeObserver: ResizeObserver | undefined;

    import("leaflet")
      .then(async (module) => {
        const L = module.default || module;
        (window as any).L = L;
        try {
          await import("leaflet.vectorgrid");
        } catch (e) {
          console.warn("Vectorgrid could not load:", e);
        }

        if (!active || !containerRef.current) return;

        // Create Leaflet map instance with rich styling
        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
          minZoom: 3.8,
          maxZoom: 18,
          maxBounds: [
            [4.0, 64.0],
            [39.0, 101.0],
          ],
        }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_CENTER.zoom);

        // Premium CartoDB Voyager tile layer for lush terrain & crisp waterways
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            subdomains: "abcd",
          }
        ).addTo(map);

        // Group layer for state markers
        const markersGroup = L.layerGroup().addTo(map);
        stateMarkersLayerRef.current = markersGroup;

        mapRef.current = map;
        resizeObserver = new ResizeObserver(() => {
          mapRef.current?.invalidateSize();
        });
        resizeObserver.observe(containerRef.current);
        setReady(true);
      })
      .catch((err) => {
        console.error("Map initialization failed:", err);
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Region Boundaries and State Markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let active = true;
    let cleanupBoundaries: (() => void) | undefined;

    import("leaflet").then((module) => {
      if (!active || !mapRef.current) return;
      const L = module.default || module;
      const map = mapRef.current;

      // 1. Clear previous state markers
      if (stateMarkersLayerRef.current) {
        stateMarkersLayerRef.current.clearLayers();
      }

      // 2. Add subtle, elegant state pin markers for all states when at 'state' level
      if (level === "state" && stateMarkersLayerRef.current) {
        INDIA_STATES_DATA.forEach((stateItem) => {
          const matchedGroup = groups.find(
            (g) =>
              g.name.toLowerCase() === stateItem.name.toLowerCase() ||
              g.key.toLowerCase() === stateItem.name.toLowerCase()
          );

          const hasCount = matchedGroup && matchedGroup.count > 0;
          const pinHtml = `
            <div class="state-map-pin" style="
              transform: translate(-50%, -50%);
              display: flex;
              align-items: center;
              gap: 5px;
              background: ${hasCount ? "#075D91" : "#FFFFFF"};
              color: ${hasCount ? "#FFFFFF" : "#102B52"};
              padding: 3px 8px;
              border-radius: 999px;
              border: 1.5px solid ${hasCount ? "#FFFFFF" : "#D9E7F3"};
              box-shadow: 0 2px 8px rgba(16,43,82,0.18);
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              white-space: nowrap;
              transition: transform 0.15s ease, box-shadow 0.15s ease;
            ">
              <span style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${hasCount ? "#38BDF8" : "#075D91"};
                display: inline-block;
              "></span>
              <span>${stateItem.name}</span>
              ${
                hasCount
                  ? `<span style="
                      background: rgba(255,255,255,0.22);
                      padding: 1px 5px;
                      border-radius: 999px;
                      font-size: 10px;
                    ">${matchedGroup.count}</span>`
                  : ""
              }
            </div>
          `;

          const pinIcon = L.divIcon({
            html: pinHtml,
            className: "india-state-pin-container",
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          const marker = L.marker([stateItem.lat, stateItem.lng], {
            icon: pinIcon,
            keyboard: false,
          });

          marker.on("click", () => {
            if (matchedGroup) {
              onSelectGroup(matchedGroup);
            } else if (onSelectStateInfo) {
              onSelectStateInfo(stateItem);
            }
          });

          stateMarkersLayerRef.current.addLayer(marker);
        });
      }

      // 3. Connect Survey of India official boundary vectors
      try {
        cleanupBoundaries = addRegionBoundaries(
          L,
          map,
          { groups, level, state },
          (key: string) => {
            const found = groups.find((item) => item.key === key);
            if (found) onSelectGroup(found);
          },
          () => {}
        );
      } catch (err) {
        console.warn("Could not load boundary vectors:", err);
      }

      // 4. Handle focus or flyTo
      if (focus && validMapPoint(focus)) {
        map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.8 });
      } else {
        map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_CENTER.zoom);
      }
    });

    return () => {
      active = false;
      cleanupBoundaries?.();
    };
  }, [ready, groups, focus, level, state, onSelectGroup, onSelectStateInfo]);

  // Map Controls Actions
  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleResetView = () => {
    mapRef.current?.flyTo(
      [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      DEFAULT_CENTER.zoom,
      { duration: 0.7 }
    );
  };

  const handleLocateMe = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const point = await currentMapLocation();
      mapRef.current?.flyTo([point.lat, point.lng], 12, { duration: 1.0 });
    } catch (e) {
      console.warn("Location error:", e);
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.mapContainer}>
      <div
        ref={containerRef}
        aria-label="Interactive India Real Estate Map"
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#D9EEFC",
        }}
      />

      <View style={styles.controlsWrap} pointerEvents="box-none">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Zoom In"
          onPress={handleZoomIn}
          style={styles.controlBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={20} color="#102B52" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Zoom Out"
          onPress={handleZoomOut}
          style={styles.controlBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="remove" size={20} color="#102B52" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Reset to India View"
          onPress={handleResetView}
          style={styles.controlBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={18} color="#102B52" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Locate My Position"
          onPress={handleLocateMe}
          style={[styles.controlBtn, locating && styles.controlBtnActive]}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="my-location"
            size={18}
            color={locating ? "#075D91" : "#102B52"}
          />
        </TouchableOpacity>
      </View>

      {failed && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Map service unavailable. Please check your connection or search using the bar above.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#EEF7FE",
  },
  controlsWrap: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 400,
    flexDirection: "column",
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E7F3",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(16, 43, 82, 0.12)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      },
      default: {
        elevation: 4,
      },
    }),
  },
  controlBtnActive: {
    borderColor: "#075D91",
    backgroundColor: "#EEF7FE",
  },
  errorBanner: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    zIndex: 500,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
});
