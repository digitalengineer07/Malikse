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
  const tileLayerRef = useRef<any>(null);
  const stateMarkersLayerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [layerMode, setLayerMode] = useState<"street" | "satellite">("street");

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

        // OpenStreetMap tile layer - Clean, reliable, and keyless
        const baseLayer = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            subdomains: "abc",
          }
        ).addTo(map);
        tileLayerRef.current = baseLayer;

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

  // Switch between Street OpenStreetMap & ESRI World Imagery Satellite layers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    import("leaflet").then((module) => {
      const L = module.default || module;
      const map = mapRef.current;
      if (!map) return;

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      if (layerMode === "satellite") {
        tileLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and GIS User Community',
            maxZoom: 18,
          }
        ).addTo(map);
      } else {
        tileLayerRef.current = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            subdomains: "abc",
          }
        ).addTo(map);
      }

      // Ensure state markers remain prominent on top of imagery
      if (stateMarkersLayerRef.current && map.hasLayer(stateMarkersLayerRef.current)) {
        stateMarkersLayerRef.current.bringToFront?.();
      }
    });
  }, [layerMode, ready]);

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
          // Check if this state has property count in groups
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
              background: ${hasCount ? "#03456C" : "#FFFFFF"};
              color: ${hasCount ? "#FFFFFF" : "#0A192F"};
              padding: 4px 9px;
              border-radius: 999px;
              border: 1.5px solid ${hasCount ? "#0284C7" : "#E2E8F0"};
              box-shadow: 0 2px 8px rgba(3,69,108,0.22);
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
                background: ${hasCount ? "#38BDF8" : "#0284C7"};
                display: inline-block;
              "></span>
              <span>${stateItem.name}</span>
              ${
                hasCount
                  ? `<span style="
                      background: rgba(255,255,255,0.25);
                      padding: 1px 6px;
                      border-radius: 999px;
                      font-size: 10px;
                      font-weight: 800;
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
          () => {
            // graceful fallback if vector tiles have latency
          }
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
      {/* HTML Leaflet Map Div */}
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

      {/* Floating Top-Right Map Controls */}
      <View style={styles.controlsWrap} pointerEvents="box-none">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Zoom In"
          onPress={handleZoomIn}
          style={styles.controlBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={20} color="#03456C" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Zoom Out"
          onPress={handleZoomOut}
          style={styles.controlBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="remove" size={20} color="#03456C" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Reset to India View"
          onPress={handleResetView}
          style={styles.controlBtn}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={18} color="#03456C" />
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
            color={locating ? "#0284C7" : "#03456C"}
          />
        </TouchableOpacity>
      </View>

      {/* Floating Bottom-Left Layer Mode Switcher & Quick Focus */}
      <View style={styles.bottomControlsWrap} pointerEvents="box-none">
        <View style={styles.layerModeWrap}>
          <TouchableOpacity
            style={[styles.layerModeBtn, layerMode === "street" && styles.layerModeBtnActive]}
            onPress={() => setLayerMode("street")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Switch to Standard Map"
          >
            <MaterialIcons
              name="map"
              size={14}
              color={layerMode === "street" ? "#FFFFFF" : "#03456C"}
            />
            <Text
              style={[
                styles.layerModeText,
                layerMode === "street" && styles.layerModeTextActive,
              ]}
            >
              Map
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.layerModeBtn, layerMode === "satellite" && styles.layerModeBtnActive]}
            onPress={() => setLayerMode("satellite")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Switch to Satellite Imagery"
          >
            <MaterialIcons
              name="satellite"
              size={14}
              color={layerMode === "satellite" ? "#FFFFFF" : "#03456C"}
            />
            <Text
              style={[
                styles.layerModeText,
                layerMode === "satellite" && styles.layerModeTextActive,
              ]}
            >
              Satellite
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Regional Focus Presets */}
        <View style={styles.presetsWrap}>
          <TouchableOpacity
            style={styles.presetPill}
            onPress={() => mapRef.current?.setView([25.6, 85.1], 7.8)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <MaterialIcons name="near-me" size={13} color="#0284C7" />
            <Text style={styles.presetText}>Bihar Hub</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetPill}
            onPress={() => mapRef.current?.setView([25.61, 85.05], 11.2)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <MaterialIcons name="location-city" size={13} color="#0284C7" />
            <Text style={styles.presetText}>Patna Metro</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetPill}
            onPress={handleResetView}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <MaterialIcons name="public" size={13} color="#0284C7" />
            <Text style={styles.presetText}>All India</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Failure Note if Tiles completely unavailable */}
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
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
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
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(3, 69, 108, 0.12)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      },
      default: {
        elevation: 3,
      },
    }),
  },
  controlBtnActive: {
    borderColor: "#03456C",
    backgroundColor: "#F0F9FF",
  },
  bottomControlsWrap: {
    position: "absolute",
    bottom: 20,
    left: 20,
    zIndex: 400,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  layerModeWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 3,
    gap: 3,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 25, 47, 0.12)",
      },
    }),
  },
  layerModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "transparent",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  layerModeBtnActive: {
    backgroundColor: "#03456C",
  },
  layerModeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03456C",
  },
  layerModeTextActive: {
    color: "#FFFFFF",
  },
  presetsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  presetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(10, 25, 47, 0.08)",
      },
    }),
  },
  presetText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03456C",
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
