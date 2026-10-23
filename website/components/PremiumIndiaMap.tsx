import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { RegionGroup } from "../src/services/regionService";
import { validMapPoint, type MapFocus } from "../src/utils/nativeMapHtml";
import { addRegionBoundaries } from "../src/utils/regionBoundaryLayer";
import { INDIA_STATES_DATA, type IndiaStateInfo } from "../src/data/indiaStatesData";
import { currentMapLocation } from "../src/services/currentMapLocation";
import type { Property } from "../src/types/property.types";

interface PremiumIndiaMapProps {
  groups: RegionGroup[];
  level: "state" | "district" | "pincode";
  state?: string;
  focus?: MapFocus;
  properties?: Property[];
  onSelectGroup: (group: RegionGroup) => void;
  onSelectStateInfo?: (state: IndiaStateInfo) => void;
  onSelectProperty?: (property: Property) => void;
}

const DEFAULT_CENTER = { lat: 25.65, lng: 85.35, zoom: 7.5 };

export default function PremiumIndiaMap({
  groups,
  level,
  state,
  focus,
  properties,
  onSelectGroup,
  onSelectStateInfo,
  onSelectProperty,
}: PremiumIndiaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<any>(null);
  const stateMarkersLayerRef = useRef<any>(null);
  const plotMarkersLayerRef = useRef<any>(null);
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
        map.attributionControl.setPrefix(false);

        // Google Maps Roadmap tile layer - Official Google Maps layout
        const baseLayer = L.tileLayer(
          "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          {
            attribution:
              'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google</a>',
            maxZoom: 20,
            subdomains: "0123",
          }
        ).addTo(map);
        tileLayerRef.current = baseLayer;

        // Group layer for state markers
        const markersGroup = L.layerGroup().addTo(map);
        stateMarkersLayerRef.current = markersGroup;

        // Group layer for property/plot location points
        const plotMarkersGroup = L.layerGroup().addTo(map);
        plotMarkersLayerRef.current = plotMarkersGroup;

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
      plotMarkersLayerRef.current?.clearLayers();
      stateMarkersLayerRef.current?.clearLayers();
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
          "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          {
            attribution: "Imagery &copy; Google",
            maxZoom: 20,
            subdomains: "0123",
          }
        ).addTo(map);
      } else {
        tileLayerRef.current = L.tileLayer(
          "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          {
            attribution:
              'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google</a>',
            maxZoom: 20,
            subdomains: "0123",
          }
        ).addTo(map);
      }

      // Ensure state and plot markers remain prominent on top of imagery
      if (stateMarkersLayerRef.current && map.hasLayer(stateMarkersLayerRef.current)) {
        stateMarkersLayerRef.current.bringToFront?.();
      }
      if (plotMarkersLayerRef.current && map.hasLayer(plotMarkersLayerRef.current)) {
        plotMarkersLayerRef.current.bringToFront?.();
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

      // 3. Connect Survey of India official boundary vectors (without counting number tags)
      try {
        cleanupBoundaries = addRegionBoundaries(
          L,
          map,
          { groups, level, state, showCountTags: false },
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

  // Render located plots/properties on map in Location point manner (pinpoints & demarcated parcels)
  useEffect(() => {
    if (!ready || !mapRef.current || !plotMarkersLayerRef.current) return;
    let active = true;

    // Inject CSS for luxury plot popups and pin hover states
    if (typeof document !== "undefined" && !document.getElementById("malikse-plot-marker-styles")) {
      const styleEl = document.createElement("style");
      styleEl.id = "malikse-plot-marker-styles";
      styleEl.textContent = `
        .malikse-property-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 14px;
          overflow: hidden;
        }
        .malikse-property-popup .leaflet-popup-content {
          margin: 0 !important;
          line-height: normal;
        }
        .malikse-property-popup .leaflet-popup-tip {
          background: #FFFFFF !important;
          box-shadow: 0 4px 12px rgba(15,23,42,0.16) !important;
        }
        .malikse-plot-pin:hover {
          transform: translate(-50%, -106%) scale(1.08) !important;
          z-index: 1000 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    import("leaflet").then((module) => {
      if (!active || !mapRef.current || !plotMarkersLayerRef.current) return;
      const L = module.default || module;
      const layer = plotMarkersLayerRef.current;
      layer.clearLayers();

      if (!properties || properties.length === 0) return;

      properties.forEach((property) => {
        const lat = property.location?.lat;
        const lng = property.location?.lng;
        if (
          typeof lat !== "number" ||
          typeof lng !== "number" ||
          isNaN(lat) ||
          isNaN(lng) ||
          lat === 0 ||
          lng === 0
        ) {
          return;
        }

        // Format price label for luxury pin (e.g. ₹1.4 Cr, ₹55 L, ₹45 L)
        const price = property.price || 0;
        let priceLabel = "Verified Plot";
        if (price >= 10000000) {
          const cr = price / 10000000;
          priceLabel = `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2).replace(/\.?0+$/, "")} Cr`;
        } else if (price >= 100000) {
          const l = price / 100000;
          priceLabel = `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1).replace(/\.?0+$/, "")} L`;
        } else if (price > 0) {
          priceLabel = `₹${price.toLocaleString("en-IN")}`;
        }

        const areaStr =
          property.sellableArea || property.totalArea
            ? `${(property.sellableArea || property.totalArea)?.toLocaleString("en-IN")} sq.ft`
            : "Verified Parcel";

        const propType = (property.type || "Plot").toUpperCase();
        const photoUrl =
          property.media?.photos?.[0] ||
          property.image ||
          "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80";
        const districtName = property.location?.district || "Bihar";
        const mauzaOrBlock = property.location?.mauza || property.location?.block || "";
        const locationSub = mauzaOrBlock ? `${mauzaOrBlock}, ${districtName}` : districtName;
        const propTitle = property.title || `${propType} in ${locationSub}`;

        // Real-Estate Location Pinpoint HTML with pointer tip anchored to exact coordinates
        const pinHtml = `
          <div class="malikse-plot-pin" style="
            position: relative;
            transform: translate(-50%, -100%);
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            filter: drop-shadow(0 4px 10px rgba(15, 23, 42, 0.28));
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
            user-select: none;
          ">
            <!-- Pin Pill Capsule -->
            <div style="
              background: #03456C;
              background: linear-gradient(135deg, #03456C 0%, #0A2540 100%);
              border: 2px solid #FFFFFF;
              border-radius: 999px;
              padding: 4px 10px 4px 8px;
              display: flex;
              align-items: center;
              gap: 6px;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(3, 69, 108, 0.35);
            ">
              <span style="
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #0284C7;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
                font-size: 10px;
                font-weight: 800;
              ">📍</span>
              <span style="
                color: #FFFFFF;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 11.5px;
                font-weight: 800;
                letter-spacing: -0.2px;
              ">${priceLabel}</span>
              <span style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #10B981;
                box-shadow: 0 0 6px #10B981;
                display: inline-block;
              "></span>
            </div>
            <!-- Pin Pointer Stem -->
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 7px solid #0A2540;
              margin-top: -1px;
            "></div>
            <!-- Ground Anchor Dot -->
            <div style="
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: #0284C7;
              border: 1px solid #FFFFFF;
              margin-top: 1px;
              box-shadow: 0 0 4px rgba(2, 132, 199, 0.7);
            "></div>
          </div>
        `;

        const pinIcon = L.divIcon({
          html: pinHtml,
          className: "plot-location-marker-wrapper",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([lat, lng], {
          icon: pinIcon,
          keyboard: false,
          riseOnHover: true,
        });

        // Popup Content - Rich, luxury glass preview card
        const popupHtml = `
          <div style="
            width: 250px;
            font-family: system-ui, -apple-system, sans-serif;
            background: #FFFFFF;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
            border: 1px solid #E2E8F0;
          ">
            <div style="position: relative; width: 100%; height: 110px; overflow: hidden; background: #0A2540;">
              <img src="${photoUrl}" alt="${propTitle}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80';" />
              <div style="
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(16, 185, 129, 0.9);
                backdrop-filter: blur(8px);
                color: #FFFFFF;
                font-size: 9px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 999px;
                display: flex;
                align-items: center;
                gap: 4px;
              ">
                <span>✓</span> Verified Plot
              </div>
              <div style="
                position: absolute;
                bottom: 8px;
                right: 8px;
                background: rgba(3, 69, 108, 0.88);
                backdrop-filter: blur(8px);
                color: #FFFFFF;
                font-size: 11px;
                font-weight: 800;
                padding: 3px 8px;
                border-radius: 8px;
              ">
                ${priceLabel}
              </div>
            </div>
            <div style="padding: 12px;">
              <div style="font-size: 13px; font-weight: 800; color: #0F172A; line-height: 1.3; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${propTitle}
              </div>
              <div style="font-size: 11px; color: #64748B; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                <span>📍</span> <span>${locationSub}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #F1F5F9;">
                <span style="font-size: 11px; font-weight: 700; color: #03456C;">${areaStr}</span>
                <a href="/property/${property.id || property._id || ""}" style="
                  display: inline-block;
                  background: #0284C7;
                  color: #FFFFFF;
                  font-size: 10.5px;
                  font-weight: 700;
                  padding: 4px 10px;
                  border-radius: 6px;
                  text-decoration: none;
                ">Explore Plot →</a>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, {
          closeButton: false,
          offset: [0, -20],
          className: "malikse-property-popup",
        });

        marker.on("click", () => {
          marker.openPopup();
          onSelectProperty?.(property);
        });

        layer.addLayer(marker);

        // If parcelPoints are present (GIS demarcation), render polygon boundary
        if (Array.isArray(property.parcelPoints) && property.parcelPoints.length >= 3) {
          const latLngs: [number, number][] = property.parcelPoints.map((pt) => [pt.lat, pt.lng]);
          const polygon = L.polygon(latLngs, {
            color: "#0284C7",
            weight: 2,
            opacity: 0.9,
            fillColor: "#38BDF8",
            fillOpacity: 0.22,
          });
          polygon.bindTooltip(`Demarcated Parcel: ${propTitle}`, { sticky: true });
          polygon.on("click", () => {
            marker.openPopup();
            onSelectProperty?.(property);
          });
          layer.addLayer(polygon);
        }
      });
    });

    return () => {
      active = false;
    };
  }, [properties, ready, onSelectProperty]);

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
        {/* Google Maps Authenticity Badge */}
        <View style={styles.googleBrandBadge}>
          <Text style={styles.googleBrandText}>
            <Text style={{ color: "#4285F4", fontWeight: "800" }}>G</Text>
            <Text style={{ color: "#EA4335", fontWeight: "800" }}>o</Text>
            <Text style={{ color: "#FBBC05", fontWeight: "800" }}>o</Text>
            <Text style={{ color: "#4285F4", fontWeight: "800" }}>g</Text>
            <Text style={{ color: "#34A853", fontWeight: "800" }}>l</Text>
            <Text style={{ color: "#EA4335", fontWeight: "800" }}>e</Text>
            <Text style={{ color: "#475569", fontWeight: "600", fontSize: 11 }}> Maps</Text>
          </Text>
        </View>

        <View style={styles.layerModeWrap}>
          <TouchableOpacity
            style={[styles.layerModeBtn, layerMode === "street" && styles.layerModeBtnActive]}
            onPress={() => setLayerMode("street")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Switch to Google Standard Map"
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
              Google Map
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.layerModeBtn, layerMode === "satellite" && styles.layerModeBtnActive]}
            onPress={() => setLayerMode("satellite")}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Switch to Google Satellite Imagery"
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
              Google Satellite
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
            <Text style={styles.presetText}>All Bihar</Text>
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
  googleBrandBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 25, 47, 0.12)",
      },
    }),
  },
  googleBrandText: {
    fontSize: 13,
    letterSpacing: -0.2,
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
