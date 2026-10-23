import TextInput from "./FormInput";
import { addParcelBaseLayer, parcelStyle } from "../src/utils/parcelMap";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  } from "react-native";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useLanguageStore } from "../src/store/languageStore";
import { t } from "../src/i18n/translations";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

interface MapParcelPickerProps {
  initialPoints?: LatLngPoint[];
  onParcelChange: (points: LatLngPoint[]) => void;
  areaSqFt?: number | string;
}

export default function MapParcelPicker({
  initialPoints,
  onParcelChange,
  areaSqFt = "2,400",
}: MapParcelPickerProps) {
  const { language } = useLanguageStore();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const baseLayerRef = useRef<any>(null);

  const polygonLayerRef = useRef<any>(null);
  const markerLayersRef = useRef<any[]>([]);
  const midpointLayersRef = useRef<any[]>([]);
  const dimensionLayersRef = useRef<any[]>([]);
  const centerBadgeMarkerRef = useRef<any>(null);
  const mouseGuideLineRef = useRef<any>(null);

  // Search input state
  const [searchLocation, setSearchLocation] = useState("");
  // Layer Mode: satellite (default) or street
  const [mapLayerMode, setMapLayerMode] = useState<"satellite" | "street">("satellite");
  // Floating Guide HUD toggle state
  const [showGuideHUD, setShowGuideHUD] = useState<boolean>(true);
  // Current polygon points - default empty until user clicks/plots
  const [points, setPoints] = useState<LatLngPoint[]>(
    initialPoints && initialPoints.length > 0 ? initialPoints : []
  );
  // Drawing closed state
  const [isDrawingClosed, setIsDrawingClosed] = useState<boolean>(
    Boolean(initialPoints && initialPoints.length >= 3)
  );
  // Undo & Redo History
  const [history, setHistory] = useState<LatLngPoint[][]>([]);
  const [redoHistory, setRedoHistory] = useState<LatLngPoint[][]>([]);
  // Live cursor guide distance in feet
  const [cursorDistanceFt, setCursorDistanceFt] = useState<number | null>(null);

  // Synced refs for event listeners
  const pointsRef = useRef<LatLngPoint[]>(points);
  const isClosedRef = useRef<boolean>(isDrawingClosed);
  useEffect(() => { pointsRef.current = points; isClosedRef.current = isDrawingClosed; }, [points, isDrawingClosed]);

  // Notify the parent after this component commits its own point update.
  useEffect(() => {
    onParcelChange(points);
  }, [points, onParcelChange]);

  // Inject CSS animations for smooth vertex hover and first-point pulse ring
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const styleId = "malikse-smooth-plot-styles";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.innerHTML = `
        .parcel-vertex-handle {
          width: 14px;
          height: 14px;
          background-color: #FFFFFF;
          border: 2.5px solid #10B981;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: grab;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .parcel-vertex-handle:hover {
          transform: scale(1.35);
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.9);
        }
        .parcel-first-vertex-pulse {
          width: 16px;
          height: 16px;
          background-color: #FFFFFF;
          border: 3px solid #059669;
          border-radius: 50%;
          cursor: pointer;
          animation: parcel-pulse 1.3s infinite ease-in-out;
        }
        @keyframes parcel-pulse {
          0% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7); transform: scale(1); }
          70% { box-shadow: 0 0 0 10px rgba(5, 150, 105, 0); transform: scale(1.2); }
          100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0); transform: scale(1); }
        }
        .parcel-midpoint-handle {
          width: 11px;
          height: 11px;
          background-color: rgba(255, 255, 255, 0.95);
          border: 2px solid #10B981;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .parcel-midpoint-handle:hover {
          transform: scale(1.4);
          background-color: #10B981;
        }
        .leaflet-container {
          cursor: crosshair !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Compute centroid of the polygon for badge placement
  const calculateCentroid = (pts: LatLngPoint[]) => {
    if (pts.length === 0) return { lat: 25.6152, lng: 85.0485 };
    let sumLat = 0;
    let sumLng = 0;
    pts.forEach((p) => {
      sumLat += p.lat;
      sumLng += p.lng;
    });
    return { lat: sumLat / pts.length, lng: sumLng / pts.length };
  };

  // Distance between 2 coordinates in feet & meters
  const getEdgeDistance = (p1: LatLngPoint, p2: LatLngPoint) => {
    const R = 6371e3; // meters
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
    const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = R * c;
    const feet = Math.round(meters * 3.28084);
    return { feet, meters: Math.round(meters) };
  };

  // Compute rough geodesic polygon area in sq.ft, Kattha, and Decimal
  const getAreaDetails = (pts: LatLngPoint[]) => {
    if (pts.length < 3) return null;
    const R = 6378137;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const p1 = pts[i];
      const p2 = pts[j];
      const lat1 = (p1.lat * Math.PI) / 180;
      const lat2 = (p2.lat * Math.PI) / 180;
      const lon1 = (p1.lng * Math.PI) / 180;
      const lon2 = (p2.lng * Math.PI) / 180;
      area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    area = (Math.abs(area) * R * R) / 2;
    const sqMeters = Math.round(area);
    const sqFt = Math.round(sqMeters * 10.7639);
    const kattha = (sqFt / 1361.25).toFixed(2);
    const decimal = (sqFt / 435.6).toFixed(2);
    const formattedSqFt = sqFt.toLocaleString("en-IN");
    return {
      sqFt,
      kattha,
      decimal,
      formattedSqFt,
      badgeText: `${formattedSqFt} sq.ft (${kattha} ${language === "hi" ? "कट्ठा" : "Kattha"})`,
      fullText: `${formattedSqFt} sq.ft • ${kattha} ${language === "hi" ? "कट्ठा" : "Kattha"} • ${decimal} ${language === "hi" ? "डेसिमल" : "Decimal"}`,
    };
  };

  // Render Polygon, Draggable Vertex Handles, Midpoint Handles, Dimension Labels & Centroid Badge
  const renderParcel = (L: any, map: any, pts: LatLngPoint[]) => {
    // Clear old polygon layer
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    // Clear old corner markers
    markerLayersRef.current.forEach((m) => map.removeLayer(m));
    markerLayersRef.current = [];
    // Clear old midpoint markers
    midpointLayersRef.current.forEach((m) => map.removeLayer(m));
    midpointLayersRef.current = [];
    // Clear old dimension markers
    dimensionLayersRef.current.forEach((m) => map.removeLayer(m));
    dimensionLayersRef.current = [];
    // Clear old center badge
    if (centerBadgeMarkerRef.current) {
      map.removeLayer(centerBadgeMarkerRef.current);
      centerBadgeMarkerRef.current = null;
    }

    if (pts.length === 0) return;

    // 1. Draw connecting polyline or filled polygon
    if (pts.length === 2 || (pts.length >= 3 && !isDrawingClosed)) {
      const line = L.polyline(
        pts.map((p) => [p.lat, p.lng]),
        {
          color: "#10B981",
          weight: 2.5,
          dashArray: isDrawingClosed ? undefined : "6, 6",
        }
      ).addTo(map);
      polygonLayerRef.current = line;
    } else if (pts.length >= 3 && isDrawingClosed) {
      const latLngPairs = pts.map((p) => [p.lat, p.lng]);
      const poly = L.polygon(latLngPairs, parcelStyle).addTo(map);
      polygonLayerRef.current = poly;
    }

    // 2. Draw Draggable Corner Vertex Handles
    const normalVertexIcon = L.divIcon({
      className: "parcel-vertex-icon",
      html: `<div class="parcel-vertex-handle"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    const firstVertexPulseIcon = L.divIcon({
      className: "parcel-first-vertex-icon",
      html: `<div class="parcel-first-vertex-pulse" title="${
        language === "hi" ? "सीमा पूरी करने के लिए क्लिक करें" : "Click to complete boundary"
      }"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    pts.forEach((p, idx) => {
      // First vertex pulses when >= 3 points are placed and shape isn't closed yet
      const isFirstSnapTarget = idx === 0 && pts.length >= 3 && !isDrawingClosed;
      const marker = L.marker([p.lat, p.lng], {
        icon: isFirstSnapTarget ? firstVertexPulseIcon : normalVertexIcon,
        draggable: true,
      }).addTo(map);

      // Real-time 60fps drag update without full layer rebuild
      marker.on("drag", (ev: any) => {
        const newLat = ev.latlng.lat;
        const newLng = ev.latlng.lng;
        const updatedPts = [...pointsRef.current];
        updatedPts[idx] = { lat: newLat, lng: newLng };
        pointsRef.current = updatedPts;

        // Directly update polygon geometry
        if (polygonLayerRef.current) {
          polygonLayerRef.current.setLatLngs(
            updatedPts.map((pt) => [pt.lat, pt.lng])
          );
        }

        // Directly update center badge
        if (centerBadgeMarkerRef.current && updatedPts.length >= 3) {
          const newCentroid = calculateCentroid(updatedPts);
          centerBadgeMarkerRef.current.setLatLng([newCentroid.lat, newCentroid.lng]);
          const areaInfo = getAreaDetails(updatedPts);
          if (areaInfo) {
            const badgeEl = document.querySelector(".parcel-center-badge-inner");
            if (badgeEl) badgeEl.textContent = areaInfo.badgeText;
          }
        }
      });

      marker.on("dragstart", () => {
        setHistory((h) => [...h, pts]);
        setRedoHistory([]);
      });

      marker.on("dragend", () => {
        setPoints([...pointsRef.current]);
      });

      // Click on first vertex when >= 3 points snaps and completes the shape
      marker.on("click", (ev: any) => {
        ev.originalEvent?.stopPropagation();
        if (idx === 0 && pts.length >= 3 && !isDrawingClosed) {
          setIsDrawingClosed(true);
          isClosedRef.current = true;
          if (mouseGuideLineRef.current) {
            map.removeLayer(mouseGuideLineRef.current);
            mouseGuideLineRef.current = null;
          }
          setCursorDistanceFt(null);
          return;
        }

        // If shape is closed and > 3 points, clicking a vertex removes it
        if (pts.length > 3 && isDrawingClosed) {
          setHistory((h) => [...h, pts]);
          setRedoHistory([]);
          const updated = pts.filter((_, i) => i !== idx);
          setPoints(updated);
        }
      });

      markerLayersRef.current.push(marker);
    });

    // 3. Draw Edge Dimension Labels & Midpoint Handles
    if (pts.length >= 2) {
      const edgeCount = isDrawingClosed ? pts.length : pts.length - 1;
      for (let i = 0; i < edgeCount; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;
        const dist = getEdgeDistance(p1, p2);

        // Edge Dimension Pill
        const dimIcon = L.divIcon({
          className: "parcel-dim-label",
          html: `<div style="
            background-color: rgba(255, 255, 255, 0.92);
            border: 1px solid #CBD5E1;
            color: #0F172A;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.18);
            white-space: nowrap;
            pointer-events: none;
            letter-spacing: 0.2px;
          ">${dist.feet} ft</div>`,
          iconSize: [40, 16],
          iconAnchor: [20, 8],
        });

        const dimMarker = L.marker([midLat, midLng], {
          icon: dimIcon,
          interactive: false,
        }).addTo(map);
        dimensionLayersRef.current.push(dimMarker);

        // Interactive Midpoint '+' Handle (Virtual Vertex for smooth refinement)
        if (isDrawingClosed && pts.length >= 3) {
          const midHandleIcon = L.divIcon({
            className: "parcel-midpoint-icon",
            html: `<div class="parcel-midpoint-handle" title="${
              language === "hi" ? "नया कोना जोड़ने के लिए क्लिक करें" : "Click to insert new corner"
            }"></div>`,
            iconSize: [11, 11],
            iconAnchor: [5, 5],
          });

          const midMarker = L.marker([midLat, midLng], {
            icon: midHandleIcon,
            draggable: true,
          }).addTo(map);

          // Clicking or dragging midpoint inserts a new vertex
          midMarker.on("click", (ev: any) => {
            ev.originalEvent?.stopPropagation();
            insertMidpointVertex(i, midLat, midLng);
          });

          midMarker.on("dragstart", () => {
            insertMidpointVertex(i, midLat, midLng);
          });

          midpointLayersRef.current.push(midMarker);
        }
      }
    }

    // 4. Draw Center Dark Area Pill Badge (Sq.Ft + Kattha)
    if (pts.length >= 3 && isDrawingClosed) {
      const centroid = calculateCentroid(pts);
      const areaInfo = getAreaDetails(pts);
      if (areaInfo) {
        const centerBadgeIcon = L.divIcon({
          className: "parcel-center-badge",
          html: `<div style="
            background-color: rgba(15, 23, 42, 0.88);
            color: #FFFFFF;
            padding: 6px 14px;
            border-radius: 9999px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.2px;
            white-space: nowrap;
            border: 1.5px solid rgba(16, 185, 129, 0.8);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#10B981;"></span>
            <span class="parcel-center-badge-inner">${areaInfo.badgeText}</span>
          </div>`,
          iconSize: [130, 28],
          iconAnchor: [65, 14],
        });

        const badgeMarker = L.marker([centroid.lat, centroid.lng], {
          icon: centerBadgeIcon,
          interactive: false,
        }).addTo(map);
        centerBadgeMarkerRef.current = badgeMarker;
      }
    }
  };

  // Insert a new vertex from a midpoint handle
  const insertMidpointVertex = (insertIndex: number, lat: number, lng: number) => {
    const previous = pointsRef.current;
    const updated = [
      ...previous.slice(0, insertIndex + 1),
      { lat, lng },
      ...previous.slice(insertIndex + 1),
    ];
    setHistory((h) => [...h, previous]);
    setRedoHistory([]);
    pointsRef.current = updated;
    setPoints(updated);
  };

  // Quick 1-Click Standard 4-Corner Plot (2,400 sq.ft)
  const handleDropStandardRectangle = () => {
    if (!mapInstanceRef.current) return;
    const center = mapInstanceRef.current.getCenter();
    const dLat = 0.00008;
    const dLng = 0.00014;
    const rectPoints: LatLngPoint[] = [
      { lat: center.lat + dLat, lng: center.lng - dLng },
      { lat: center.lat + dLat, lng: center.lng + dLng },
      { lat: center.lat - dLat, lng: center.lng + dLng },
      { lat: center.lat - dLat, lng: center.lng - dLng },
    ];
    setHistory((h) => [...h, points]);
    setRedoHistory([]);
    setPoints(rectPoints);
    setIsDrawingClosed(true);
    isClosedRef.current = true;
  };

  // Finish / Close Boundary Manually
  const handleFinishBoundary = () => {
    if (points.length >= 3) {
      setIsDrawingClosed(true);
      isClosedRef.current = true;
      if (mouseGuideLineRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(mouseGuideLineRef.current);
        mouseGuideLineRef.current = null;
      }
      setCursorDistanceFt(null);
    }
  };

  // Undo last action
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoHistory((r) => [...r, points]);
    setHistory((h) => h.slice(0, -1));
    setPoints(previous);
    if (previous.length < 3) {
      setIsDrawingClosed(false);
      isClosedRef.current = false;
    }
  };

  // Redo last undone action
  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setHistory((h) => [...h, points]);
    setRedoHistory((r) => r.slice(0, -1));
    setPoints(next);
  };

  // Clear all points
  const handleClear = () => {
    setHistory((h) => [...h, points]);
    setRedoHistory([]);
    setPoints([]);
    setIsDrawingClosed(false);
    isClosedRef.current = false;
    if (mouseGuideLineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(mouseGuideLineRef.current);
      mouseGuideLineRef.current = null;
    }
    setCursorDistanceFt(null);
  };

  // Crosshair - Center to plot
  // Center to plot / GPS
  const handleCenterToPlot = () => {
    if (mapInstanceRef.current && points.length > 0) {
      const centroid = calculateCentroid(pointsRef.current);
      mapInstanceRef.current.flyTo([centroid.lat, centroid.lng], 18, { duration: 1 });
    }
  };

  // Zoom In / Out Handlers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  // Satellite vs Street Map Layer Switcher
  const handleToggleLayer = () => {
    if (!baseLayerRef.current) return;
    const nextMode = mapLayerMode === "satellite" ? "street" : "satellite";
    setMapLayerMode(nextMode);
    const url =
      nextMode === "satellite"
        ? "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        : "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
    baseLayerRef.current.setUrl(url);
  };

  // Search Location Dispatcher (Supports Lat,Lng coordinates or Bihar cities/places)
  const handleSearchSubmit = () => {
    if (!mapInstanceRef.current || !searchLocation.trim()) return;
    const query = searchLocation.toLowerCase().trim();

    // Check if user entered direct GPS coordinates: "lat, lng"
    const coordMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        mapInstanceRef.current.flyTo([lat, lng], 18, { duration: 1.2 });
        return;
      }
    }

    const KNOWN_PLACES: Record<string, [number, number]> = {
      patna: [25.5941, 85.1376],
      danapur: [25.6152, 85.0485],
      bihta: [25.5684, 84.8582],
      "bailey road": [25.6127, 85.0456],
      kankarbagh: [25.5941, 85.155],
      hajipur: [25.6858, 85.214],
      naubatpur: [25.5342, 84.9741],
      muzaffarpur: [26.1209, 85.3647],
      gaya: [24.7914, 85.0002],
      bhagalpur: [25.2425, 86.9842],
      darbhanga: [26.1542, 85.8918],
      purnia: [25.7771, 87.4753],
      ara: [25.5541, 84.6667],
      arrah: [25.5541, 84.6667],
      begusarai: [25.4182, 86.1272],
      rajgir: [25.0298, 85.4221],
      nalanda: [25.1357, 85.4578],
      vaishali: [25.9866, 85.1277],
      buxar: [25.5647, 83.9777],
      chhapra: [25.7811, 84.7466],
      motihari: [26.6473, 84.9126],
      saharsa: [25.8835, 86.6006],
      samastipur: [25.8634, 85.7813],
      katihar: [25.5541, 87.5714],
      deoghar: [24.4826, 86.7001],
      sasaram: [24.9525, 84.0299],
    };

    let targetCoord: [number, number] | null = null;
    for (const key of Object.keys(KNOWN_PLACES)) {
      if (query.includes(key)) {
        targetCoord = KNOWN_PLACES[key];
        break;
      }
    }

    if (!targetCoord) {
      targetCoord = [25.6152, 85.0485]; // Default prime Danapur plot
    }

    mapInstanceRef.current.flyTo(targetCoord, 17, { duration: 1.2 });
  };

  // Get current guidance message for status pill
  const getGuidanceText = () => {
    if (points.length === 0) {
      return t(language, "plot_hint_0") || "Tap anywhere on map to place 1st boundary corner";
    }
    if (points.length === 1) {
      return cursorDistanceFt
        ? `${t(language, "plot_hint_1") || "Tap to place 2nd corner"} (${cursorDistanceFt} ft)`
        : t(language, "plot_hint_1") || "Tap to place 2nd corner (live distance guide)";
    }
    if (points.length === 2) {
      return t(language, "plot_hint_2") || "Tap 3rd corner to form property boundary";
    }
    if (points.length >= 3 && !isDrawingClosed) {
      return t(language, "plot_hint_closing") || "Click the pulsing 1st point to close boundary";
    }
    return t(language, "plot_hint_done") || "Boundary complete! Drag corner points or '+' to fine-tune";
  };

  const renderParcelRef = useRef(renderParcel);
  useEffect(() => { renderParcelRef.current = renderParcel; });

  // Keyboard Shortcuts (Undo with Ctrl+Z / Backspace, Cancel with Esc)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        handleUndo();
      } else if (e.key === "Escape") {
        handleClear();
      } else if (e.key === "Enter" && points.length >= 3 && !isDrawingClosed) {
        handleFinishBoundary();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Initialize interactive Leaflet map instance
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    let isMounted = true;

    import("leaflet").then((leafletModule) => {
      const L = (leafletModule as any).default || leafletModule;
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initial center
      const centroid = calculateCentroid(pointsRef.current);
      const map = L.map(mapContainerRef.current, {
        center: [centroid.lat, centroid.lng],
        zoom: 17,
        zoomControl: false,
        attributionControl: true,
        maxZoom: 20,
      });
      mapInstanceRef.current = map;

      const baseLayer = addParcelBaseLayer(L, map);
      baseLayerRef.current = baseLayer;

      // Map Click to Add New Boundary Point
      map.on("click", (e: any) => {
        // If drawing is already closed, don't add points on map click; user can drag handles
        if (isClosedRef.current && pointsRef.current.length >= 3) return;

        const newPt: LatLngPoint = { lat: e.latlng.lat, lng: e.latlng.lng };

        const previous = pointsRef.current;
        // Clicking near the first vertex closes an existing polygon.
        if (previous.length >= 3 && getEdgeDistance(previous[0], newPt).feet < 30) {
          setIsDrawingClosed(true);
          isClosedRef.current = true;
          if (mouseGuideLineRef.current) {
            map.removeLayer(mouseGuideLineRef.current);
            mouseGuideLineRef.current = null;
          }
          setCursorDistanceFt(null);
          return;
        }

        const updated = [...previous, newPt];
        setHistory((h) => [...h, previous]);
        setRedoHistory([]);
        pointsRef.current = updated;
        setPoints(updated);
      });

      // Live Rubber-Band Guide Line to Mouse Cursor
      map.on("mousemove", (e: any) => {
        const curPts = pointsRef.current;
        if (curPts.length > 0 && !isClosedRef.current) {
          const lastPt = curPts[curPts.length - 1];
          const curPt = { lat: e.latlng.lat, lng: e.latlng.lng };

          if (!mouseGuideLineRef.current) {
            mouseGuideLineRef.current = L.polyline(
              [
                [lastPt.lat, lastPt.lng],
                [curPt.lat, curPt.lng],
              ],
              {
                color: "#10B981",
                weight: 2,
                dashArray: "5, 5",
                opacity: 0.85,
              }
            ).addTo(map);
          } else {
            mouseGuideLineRef.current.setLatLngs([
              [lastPt.lat, lastPt.lng],
              [curPt.lat, curPt.lng],
            ]);
          }

          const dist = getEdgeDistance(lastPt, curPt);
          setCursorDistanceFt(dist.feet);
        } else if (mouseGuideLineRef.current) {
          map.removeLayer(mouseGuideLineRef.current);
          mouseGuideLineRef.current = null;
          setCursorDistanceFt(null);
        }
      });

      // Mouse Out: hide rubber band line
      map.on("mouseout", () => {
        if (mouseGuideLineRef.current) {
          map.removeLayer(mouseGuideLineRef.current);
          mouseGuideLineRef.current = null;
        }
        setCursorDistanceFt(null);
      });

      // Double-Click to Finish Shape
      map.on("dblclick", (e: any) => {
        e.originalEvent?.stopPropagation();
        if (pointsRef.current.length >= 3) {
          setIsDrawingClosed(true);
          isClosedRef.current = true;
          if (mouseGuideLineRef.current) {
            map.removeLayer(mouseGuideLineRef.current);
            mouseGuideLineRef.current = null;
          }
          setCursorDistanceFt(null);
        }
      });

      renderParcelRef.current(L, map, pointsRef.current);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Re-render polygon & vertex markers when points or closed status changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((leafletModule) => {
      const L = (leafletModule as any).default || leafletModule;
      if (mapInstanceRef.current) renderParcelRef.current(L, mapInstanceRef.current, points);
    });
  }, [points, isDrawingClosed, language]);



  const areaDetails = getAreaDetails(points);

  return (
    <View style={styles.workspaceContainer}>
      {/* ================= MAIN FULL-WIDTH MAP CANVAS WITH ADVANCED OVERLAYS ================= */}
      <View style={styles.mapCanvasCard}>
        {/* Leaflet DOM Node */}
        {Platform.OS === "web" ? (
          <div
            ref={mapContainerRef as any}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
              backgroundColor: "#0A2540",
            }}
          />
        ) : (
          <View style={styles.fallbackBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={{ marginTop: 12, color: "#64748B" }}>Loading Interactive Map...</Text>
          </View>
        )}

        {/* OVERLAY: Top-Left Search Location Bar */}
        <View style={styles.mapSearchBox}>
          <MaterialIcons name="search" size={20} color="#03456C" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.mapSearchInput}
            placeholder={
              t(language, "search_map_location") || "Search city, village, or GPS (e.g. 25.61, 85.14)..."
            }
            placeholderTextColor="#64748B"
            value={searchLocation}
            onChangeText={setSearchLocation}
            onSubmitEditing={handleSearchSubmit}
          />
          <TouchableOpacity
            onPress={handleSearchSubmit}
            activeOpacity={0.8}
            style={styles.searchSubmitBtn}
            accessibilityLabel="Search map location"
          >
            <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* OVERLAY: Top-Right Toolbar (Quick Template, Finish, Undo, Redo, Delete, Guide) */}
        <View style={styles.mapDrawingToolbar}>
          {/* Quick 4-Corner Plot Button */}
          <TouchableOpacity
            style={styles.quickPresetBtn}
            onPress={handleDropStandardRectangle}
            activeOpacity={0.8}
            accessibilityLabel="Drop Standard Plot"
          >
            <MaterialIcons name="crop-square" size={16} color="#0284C7" />
            <Text style={styles.quickPresetBtnText}>
              {language === "hi" ? "त्वरित प्लॉट" : "Quick Plot"}
            </Text>
          </TouchableOpacity>

          {/* Finish Boundary Button (when >= 3 points and not closed) */}
          {points.length >= 3 && !isDrawingClosed && (
            <TouchableOpacity
              style={styles.finishShapeBtn}
              onPress={handleFinishBoundary}
              activeOpacity={0.8}
              accessibilityLabel="Complete boundary"
            >
              <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
              <Text style={styles.finishShapeBtnText}>
                {language === "hi" ? "पूरा करें" : "Complete"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.toolDivider} />

          {/* Undo */}
          <TouchableOpacity
            style={[styles.toolBtn, history.length === 0 && styles.toolBtnDisabled]}
            onPress={handleUndo}
            disabled={history.length === 0}
            activeOpacity={0.7}
            accessibilityLabel="Undo"
          >
            <FontAwesome5
              name="undo-alt"
              size={13}
              color={history.length === 0 ? "#94A3B8" : "#0F172A"}
            />
          </TouchableOpacity>

          {/* Redo */}
          <TouchableOpacity
            style={[styles.toolBtn, redoHistory.length === 0 && styles.toolBtnDisabled]}
            onPress={handleRedo}
            disabled={redoHistory.length === 0}
            activeOpacity={0.7}
            accessibilityLabel="Redo"
          >
            <FontAwesome5
              name="redo-alt"
              size={13}
              color={redoHistory.length === 0 ? "#94A3B8" : "#0F172A"}
            />
          </TouchableOpacity>

          <View style={styles.toolDivider} />

          {/* Clear */}
          <TouchableOpacity
            style={styles.clearToolBtn}
            onPress={handleClear}
            activeOpacity={0.7}
            accessibilityLabel="Clear Boundary"
          >
            <FontAwesome5 name="trash-alt" size={13} color="#DC2626" />
          </TouchableOpacity>

          <View style={styles.toolDivider} />

          {/* Guide / HUD Toggle Button */}
          <TouchableOpacity
            style={[styles.guideToggleBtn, showGuideHUD && styles.guideToggleBtnActive]}
            onPress={() => setShowGuideHUD((prev) => !prev)}
            activeOpacity={0.8}
            accessibilityLabel="Toggle Cadastral Guide"
          >
            <MaterialIcons
              name="layers"
              size={16}
              color={showGuideHUD ? "#059669" : "#475569"}
            />
            <Text
              style={[
                styles.guideToggleBtnText,
                showGuideHUD && styles.guideToggleBtnTextActive,
              ]}
            >
              {language === "hi" ? "गाइड व जानकारी" : "Guide & Stats"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* OVERLAY: Middle-Left Navigation & Zoom Controls */}
        <View style={styles.mapLeftControls}>
          <TouchableOpacity
            style={styles.standaloneIconBtn}
            onPress={handleCenterToPlot}
            activeOpacity={0.8}
            accessibilityLabel="Center on property boundary"
          >
            <MaterialIcons name="my-location" size={19} color="#03456C" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.standaloneIconBtn}
            onPress={handleZoomIn}
            activeOpacity={0.8}
            accessibilityLabel="Zoom in"
          >
            <MaterialIcons name="add" size={20} color="#0F172A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.standaloneIconBtn}
            onPress={handleZoomOut}
            activeOpacity={0.8}
            accessibilityLabel="Zoom out"
          >
            <MaterialIcons name="remove" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* OVERLAY: Floating Cadastral Drawing Guide & Parcel Stats HUD */}
        {showGuideHUD && (
          <View style={styles.hudCard}>
            {/* HUD Header */}
            <View style={styles.hudHeader}>
              <View style={styles.hudHeaderTitleRow}>
                <View style={styles.hudIconBadge}>
                  <MaterialIcons name="map" size={16} color="#03456C" />
                </View>
                <Text style={styles.hudTitle}>
                  {t(language, "cadastral_guide") || "Cadastral Guide & Live Stats"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.hudCloseBtn}
                onPress={() => setShowGuideHUD(false)}
                activeOpacity={0.7}
                accessibilityLabel="Minimize guide"
              >
                <MaterialIcons name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Live Metrics Box */}
            {points.length >= 3 && areaDetails ? (
              <View style={styles.hudMetricsBox}>
                <View style={styles.hudMetricsHeader}>
                  <View
                    style={[
                      styles.hudLiveDot,
                      !isDrawingClosed && styles.hudLiveDotAmber,
                    ]}
                  />
                  <Text style={styles.hudMetricsStatus}>
                    {isDrawingClosed
                      ? language === "hi"
                        ? "प्लॉट सीमा पूर्ण व मान्य"
                        : "Boundary Locked & Verified"
                      : language === "hi"
                      ? "सीमा अभी खुली है"
                      : "Outline In Progress"}
                  </Text>
                  <Text style={styles.hudPointsCount}>
                    {points.length} {language === "hi" ? "कोने" : "Corners"}
                  </Text>
                </View>

                <View style={styles.hudMetricsGrid}>
                  <View style={styles.hudMetricItem}>
                    <Text style={styles.hudMetricValue}>{areaDetails.formattedSqFt}</Text>
                    <Text style={styles.hudMetricUnit}>Sq.Ft</Text>
                  </View>
                  <View style={styles.hudMetricDivider} />
                  <View style={styles.hudMetricItem}>
                    <Text style={styles.hudMetricValue}>{areaDetails.kattha}</Text>
                    <Text style={styles.hudMetricUnit}>
                      {language === "hi" ? "कट्ठा" : "Kattha"}
                    </Text>
                  </View>
                  <View style={styles.hudMetricDivider} />
                  <View style={styles.hudMetricItem}>
                    <Text style={styles.hudMetricValue}>{areaDetails.decimal}</Text>
                    <Text style={styles.hudMetricUnit}>
                      {language === "hi" ? "डेसिमल" : "Decimal"}
                    </Text>
                  </View>
                </View>

                <View style={styles.hudTipRow}>
                  <MaterialIcons name="touch-app" size={14} color="#059669" />
                  <Text style={styles.hudAdjustmentTip}>
                    {language === "hi"
                      ? "सीमा बदलने के लिए हरे कोनों या '+' को खींचें"
                      : "Drag green handles or '+' midpoints to adjust shape"}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.hudEmptyMetricsBox}>
                <MaterialIcons name="straighten" size={18} color="#0284C7" />
                <Text style={styles.hudEmptyText}>
                  {points.length === 0
                    ? language === "hi"
                      ? "मानचित्र पर प्लॉट के कोने छूकर सीमा बनाएं"
                      : "Tap points on satellite map to start boundary"
                    : `${points.length} of 3 minimum corner points marked`}
                </Text>
              </View>
            )}

            {/* How to Draw Stepped Instructions */}
            <View style={styles.hudStepsContainer}>
              <Text style={styles.hudStepsHeading}>
                {t(language, "how_to_draw") || "How to Mark Your Plot"}
              </Text>

              <View style={styles.hudStepRow}>
                <View style={styles.hudStepBadge}>
                  <Text style={styles.hudStepNum}>1</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_1") || "Tap on map to place boundary corner points"}
                </Text>
              </View>

              <View style={styles.hudStepRow}>
                <View style={styles.hudStepBadge}>
                  <Text style={styles.hudStepNum}>2</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_2") || "Continue clicking around the land perimeter"}
                </Text>
              </View>

              <View style={styles.hudStepRow}>
                <View style={styles.hudStepBadge}>
                  <Text style={styles.hudStepNum}>3</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_5") || "Click the pulsing 1st point or 'Complete' to close"}
                </Text>
              </View>

              <View style={styles.hudStepRow}>
                <View style={styles.hudStepBadge}>
                  <Text style={styles.hudStepNum}>4</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_3") || "Drag points to fine-tune exact cadastral area"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* OVERLAY: Bottom-Left Layer Switcher (Satellite vs Street) */}
        <TouchableOpacity
          style={styles.mapLayerModePill}
          onPress={handleToggleLayer}
          activeOpacity={0.8}
          accessibilityLabel="Switch map layer"
        >
          <MaterialIcons
            name={mapLayerMode === "satellite" ? "satellite" : "map"}
            size={16}
            color="#03456C"
          />
          <Text style={styles.mapLayerModeText}>
            {mapLayerMode === "satellite"
              ? language === "hi"
                ? "गूगल सैटेलाइट"
                : "Satellite (Hybrid)"
              : language === "hi"
              ? "सड़क मानचित्र"
              : "Street Map"}
          </Text>
          <MaterialIcons name="swap-horiz" size={14} color="#64748B" />
        </TouchableOpacity>

        {/* OVERLAY: Live Interactive Guidance Status Pill */}
        <View style={styles.liveGuidancePill}>
          <View style={styles.pulsingStatusDot} />
          <Text style={styles.liveGuidanceText} numberOfLines={1}>
            {getGuidanceText()}
          </Text>
        </View>
      </View>

      {/* ================= HORIZONTAL FEATURE & INFORMATION BAR ================= */}
      <View style={styles.quickFeatureRow}>
        <View style={styles.featureCard}>
          <View style={styles.featureIconBadge}>
            <MaterialIcons name="edit-location-alt" size={20} color="#0284C7" />
          </View>
          <View style={styles.featureCardContent}>
            <Text style={styles.featureTitle}>
              {language === "hi" ? "सटीक भूखंड सीमा" : "Cadastral Plot Pinning"}
            </Text>
            <Text style={styles.featureDesc}>
              {language === "hi"
                ? "हाई-रेसोल्यूशन सैटेलाइट पर जमीन के सभी कोने सटीक रूप से चिह्नित करें।"
                : "Place corners directly on high-res Google Satellite imagery with sub-meter accuracy."}
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={[styles.featureIconBadge, { backgroundColor: "#ECFDF5" }]}>
            <MaterialIcons name="straighten" size={20} color="#059669" />
          </View>
          <View style={styles.featureCardContent}>
            <Text style={styles.featureTitle}>
              {language === "hi" ? "वास्तविक दूरी व आयाम" : "Live Edge Dimensions"}
            </Text>
            <Text style={styles.featureDesc}>
              {language === "hi"
                ? "प्रत्येक भुजा की लंबाई फीट में तुरंत देखें व '+' से नए बिंदु जोड़ें।"
                : "Real-time edge distances in feet with midpoint '+' handles for precise shaping."}
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={[styles.featureIconBadge, { backgroundColor: "#F5F3FF" }]}>
            <MaterialIcons name="calculate" size={20} color="#7C3AED" />
          </View>
          <View style={styles.featureCardContent}>
            <Text style={styles.featureTitle}>
              {language === "hi" ? "बिहार प्रमाणित क्षेत्रफल" : "Bihar Land Units"}
            </Text>
            <Text style={styles.featureDesc}>
              {language === "hi"
                ? "स्क्वायर फीट, कट्ठा और डेसिमल में स्वतः गणना जो सीधे रजिस्ट्री से मेल खाए।"
                : "Instant automatic conversion into Sq.Ft, Kattha, and Decimal matching registry records."}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  workspaceContainer: {
    width: "100%",
    gap: 20,
    alignItems: "stretch",
  },

  /* Main Map Canvas */
  mapCanvasCard: {
    width: "100%",
    minHeight: 580,
    height: 580,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#0A2540",
  },
  fallbackBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: 580,
    backgroundColor: "#0A2540",
  },

  /* Overlay: Top-Left Location Search Bar */
  mapSearchBox: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    height: 44,
    width: 340,
    maxWidth: "50%",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.22)",
      },
    }),
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
    outlineStyle: "none" as any,
  },
  searchSubmitBtn: {
    backgroundColor: "#03456C",
    borderRadius: 8,
    padding: 7,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },

  /* Overlay: Top-Right Drawing Tools Bar */
  mapDrawingToolbar: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    zIndex: 1000,
    gap: 6,
    ...Platform.select({
      web: {
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.22)",
      },
    }),
  },
  quickPresetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  quickPresetBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0284C7",
  },
  finishShapeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  finishShapeBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  toolBtn: {
    width: 34,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  toolBtnDisabled: {
    opacity: 0.35,
  },
  clearToolBtn: {
    width: 34,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  guideToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  guideToggleBtnActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  guideToggleBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  guideToggleBtnTextActive: {
    color: "#059669",
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 1,
  },

  /* Overlay: Middle-Left Navigation Controls */
  mapLeftControls: {
    position: "absolute",
    top: 72,
    left: 16,
    gap: 8,
    zIndex: 1000,
  },
  standaloneIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.18)",
      },
    }),
  },

  /* Overlay: Floating Cadastral Drawing Guide & Parcel Stats HUD */
  hudCard: {
    position: "absolute",
    top: 72,
    right: 16,
    width: 310,
    maxWidth: "85%",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    padding: 14,
    zIndex: 1000,
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: "0 8px 28px rgba(15, 23, 42, 0.22)",
        backdropFilter: "blur(12px)",
      },
    }),
  },
  hudHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  hudHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hudIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  hudTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  hudCloseBtn: {
    padding: 4,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  hudMetricsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  hudMetricsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hudLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  hudLiveDotAmber: {
    backgroundColor: "#F59E0B",
  },
  hudMetricsStatus: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    marginLeft: 6,
  },
  hudPointsCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  hudMetricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  hudMetricItem: {
    alignItems: "center",
  },
  hudMetricValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#03456C",
  },
  hudMetricUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 1,
  },
  hudMetricDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#E2E8F0",
  },
  hudTipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  hudAdjustmentTip: {
    fontSize: 10.5,
    color: "#059669",
    fontWeight: "600",
    flex: 1,
  },
  hudEmptyMetricsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  hudEmptyText: {
    fontSize: 11.5,
    color: "#03456C",
    fontWeight: "600",
    flex: 1,
  },
  hudStepsContainer: {
    gap: 8,
  },
  hudStepsHeading: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.2,
  },
  hudStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  hudStepBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  hudStepNum: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0284C7",
  },
  hudStepText: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "500",
    flex: 1,
    lineHeight: 15,
  },

  /* Overlay: Bottom-Left Mode Switcher Pill */
  mapLayerModePill: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    zIndex: 1000,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.18)",
      },
    }),
  },
  mapLayerModeText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#03456C",
  },

  /* Overlay: Live Interactive Guidance Status Pill */
  liveGuidancePill: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -190 }],
    width: 380,
    maxWidth: "85%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#10B981",
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 18px rgba(16, 185, 129, 0.22)",
      },
    }),
  },
  pulsingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveGuidanceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
  },

  /* Horizontal Quick Feature & Information Bar */
  quickFeatureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 4,
  },
  featureCard: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
  },
  featureCardContent: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  featureDesc: {
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: 16,
  },
});
