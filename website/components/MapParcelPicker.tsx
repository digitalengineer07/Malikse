import TextInput from "./FormInput";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { useLanguageStore } from "../src/store/languageStore";
import { t } from "../src/i18n/translations";
import { loadGoogleMaps, geocodeAddress, geocodePlaceId } from "../src/utils/googleMaps";
import { fetchLocationSuggestions, type LocationSuggestion } from "../src/services/regionService";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

interface MapParcelPickerProps {
  initialPoints?: LatLngPoint[];
  onParcelChange: (points: LatLngPoint[]) => void;
  areaSqFt?: number | string;
}

// Custom HTML overlay factory for Google Maps SDK
function getCustomHtmlOverlayClass(maps: any) {
  return class CustomHtmlOverlay extends maps.OverlayView {
    private position: any;
    private html: string;
    private div: HTMLElement | null = null;
    private className: string;

    constructor(position: { lat: number; lng: number }, html: string, className = "") {
      super();
      this.position = new maps.LatLng(position.lat, position.lng);
      this.html = html;
      this.className = className;
    }

    onAdd() {
      this.div = document.createElement("div");
      if (this.className) this.div.className = this.className;
      this.div.style.position = "absolute";
      this.div.style.transform = "translate(-50%, -50%)";
      this.div.style.pointerEvents = "none";
      this.div.innerHTML = this.html;
      const panes = this.getPanes();
      panes?.floatPane?.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.position);
      if (point) {
        this.div.style.left = `${point.x}px`;
        this.div.style.top = `${point.y}px`;
      }
    }

    onRemove() {
      if (this.div?.parentNode) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }

    setPosition(pos: { lat: number; lng: number }) {
      this.position = new maps.LatLng(pos.lat, pos.lng);
      this.draw();
    }

    setContent(html: string) {
      this.html = html;
      if (this.div) this.div.innerHTML = html;
    }
  };
}

export default function MapParcelPicker({
  initialPoints,
  onParcelChange,
  areaSqFt = "2,400",
}: MapParcelPickerProps) {
  const { language } = useLanguageStore();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Engine state: 'google' | 'loading' | 'error'
  const [mapEngine, setMapEngine] = useState<"loading" | "google" | "error">("loading");

  // Google Maps SDK Refs
  const googleMapRef = useRef<any>(null);
  const googleMapsApiRef = useRef<any>(null);
  const customHtmlOverlayRef = useRef<any>(null);

  const googlePolygonRef = useRef<any>(null);
  const googlePolylineRef = useRef<any>(null);
  const googleRubberBandRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleMidpointMarkersRef = useRef<any[]>([]);
  const googleDimensionOverlaysRef = useRef<any[]>([]);
  const googleCenterBadgeOverlayRef = useRef<any>(null);
  const googleSearchMarkerRef = useRef<any>(null);
  const googleSearchOverlayRef = useRef<any>(null);

  // Search input state
  const [searchLocation, setSearchLocation] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Layer Mode: satellite (default) or street
  const [mapLayerMode, setMapLayerMode] = useState<"satellite" | "street">("satellite");

  // Floating Guide HUD toggle state
  const [showGuideHUD, setShowGuideHUD] = useState<boolean>(true);

  // Current polygon points
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
  useEffect(() => {
    pointsRef.current = points;
    isClosedRef.current = isDrawingClosed;
  }, [points, isDrawingClosed]);

  // Notify the parent after this component commits its own point update
  useEffect(() => {
    onParcelChange(points);
  }, [points, onParcelChange]);

  // Inject CSS animations for handles and Google map cursor
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const styleId = "malikse-google-plot-styles";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.innerHTML = `
        .gm-style {
          cursor: crosshair !important;
        }
        .parcel-first-vertex-pulse {
          animation: parcel-pulse 1.3s infinite ease-in-out;
        }
        @keyframes parcel-pulse {
          0% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7); transform: scale(1); }
          70% { box-shadow: 0 0 0 10px rgba(5, 150, 105, 0); transform: scale(1.2); }
          100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0); transform: scale(1); }
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
    if (googleMapsApiRef.current?.geometry?.spherical) {
      const g1 = new googleMapsApiRef.current.LatLng(p1.lat, p1.lng);
      const g2 = new googleMapsApiRef.current.LatLng(p2.lat, p2.lng);
      const meters = googleMapsApiRef.current.geometry.spherical.computeDistanceBetween(g1, g2);
      const feet = Math.round(meters * 3.28084);
      return { feet, meters: Math.round(meters) };
    }
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

  // Compute geodesic polygon area in sq.ft, Kattha, and Decimal
  const getAreaDetails = (pts: LatLngPoint[]) => {
    if (pts.length < 3) return null;
    let sqMeters = 0;
    if (googleMapsApiRef.current?.geometry?.spherical) {
      const gPath = pts.map((p) => new googleMapsApiRef.current.LatLng(p.lat, p.lng));
      sqMeters = Math.round(googleMapsApiRef.current.geometry.spherical.computeArea(gPath));
    } else {
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
      sqMeters = Math.round((Math.abs(area) * R * R) / 2);
    }

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

  // SVG Marker Icons for Google Maps
  const createVertexIcon = (maps: any) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="#FFFFFF" stroke="#10B981" stroke-width="2.5" />
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new maps.Size(16, 16),
      anchor: new maps.Point(8, 8),
    };
  };

  const createFirstVertexIcon = (maps: any) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="10" fill="#10B981" fill-opacity="0.35" />
      <circle cx="11" cy="11" r="6" fill="#FFFFFF" stroke="#059669" stroke-width="3" />
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new maps.Size(22, 22),
      anchor: new maps.Point(11, 11),
    };
  };

  const createMidpointIcon = (maps: any) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5.5" fill="#FFFFFF" stroke="#10B981" stroke-width="2" />
      <line x1="7" y1="4" x2="7" y2="10" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" />
      <line x1="4" y1="7" x2="10" y2="7" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" />
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new maps.Size(14, 14),
      anchor: new maps.Point(7, 7),
    };
  };

  const createSearchPinIcon = (maps: any) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">
      <defs>
        <filter id="pinShadow" x="-30%" y="-15%" width="160%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.38"/>
        </filter>
      </defs>
      <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.75 17 46 17 46 C17 46 34 29.75 34 17 C34 7.6 26.4 0 17 0 Z" fill="#EF4444" stroke="#FFFFFF" stroke-width="2" filter="url(#pinShadow)"/>
      <circle cx="17" cy="17" r="6.5" fill="#FFFFFF"/>
      <circle cx="17" cy="17" r="3.5" fill="#B91C1C"/>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new maps.Size(34, 46),
      anchor: new maps.Point(17, 46),
    };
  };

  // Insert midpoint vertex to shape
  const insertMidpointVertex = (index: number, lat: number, lng: number) => {
    const previous = pointsRef.current;
    const updated = [...previous];
    updated.splice(index + 1, 0, { lat, lng });
    setHistory((h) => [...h, previous]);
    setRedoHistory([]);
    pointsRef.current = updated;
    setPoints(updated);
  };

  // ================= GOOGLE MAPS RENDERING ENGINE =================
  const renderGoogleParcel = (pts: LatLngPoint[]) => {
    if (!googleMapRef.current || !googleMapsApiRef.current) return;
    const map = googleMapRef.current;
    const maps = googleMapsApiRef.current;
    const CustomHtmlOverlay = customHtmlOverlayRef.current;

    // Clear previous layers
    if (googlePolygonRef.current) {
      googlePolygonRef.current.setMap(null);
      googlePolygonRef.current = null;
    }
    if (googlePolylineRef.current) {
      googlePolylineRef.current.setMap(null);
      googlePolylineRef.current = null;
    }
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    googleMidpointMarkersRef.current.forEach((m) => m.setMap(null));
    googleMidpointMarkersRef.current = [];
    googleDimensionOverlaysRef.current.forEach((o) => o.setMap(null));
    googleDimensionOverlaysRef.current = [];
    if (googleCenterBadgeOverlayRef.current) {
      googleCenterBadgeOverlayRef.current.setMap(null);
      googleCenterBadgeOverlayRef.current = null;
    }

    if (pts.length === 0) return;

    const gPath = pts.map((p) => ({ lat: p.lat, lng: p.lng }));

    // 1. Draw Polyline or filled Polygon
    if (pts.length >= 3 && isClosedRef.current) {
      const polygon = new maps.Polygon({
        paths: gPath,
        strokeColor: "#10B981",
        strokeOpacity: 1,
        strokeWeight: 2.5,
        fillColor: "#10B981",
        fillOpacity: 0.25,
        map,
        clickable: false,
      });
      googlePolygonRef.current = polygon;
    } else if (pts.length >= 2) {
      const polyline = new maps.Polyline({
        path: gPath,
        strokeColor: "#10B981",
        strokeOpacity: 1,
        strokeWeight: 2.5,
        map,
        clickable: false,
      });
      googlePolylineRef.current = polyline;
    }

    // 2. Corner Vertex Handles
    pts.forEach((p, idx) => {
      const isFirstSnapTarget = idx === 0 && pts.length >= 3 && !isClosedRef.current;

      const marker = new maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        draggable: true,
        cursor: "grab",
        icon: isFirstSnapTarget ? createFirstVertexIcon(maps) : createVertexIcon(maps),
        title: isFirstSnapTarget
          ? language === "hi"
            ? "सीमा पूरी करने के लिए क्लिक करें"
            : "Click to complete boundary"
          : language === "hi"
          ? `कोना #${idx + 1}`
          : `Corner #${idx + 1}`,
      });

      // Real-time 60fps drag update
      marker.addListener("drag", (ev: any) => {
        const newLat = ev.latLng.lat();
        const newLng = ev.latLng.lng();
        const updatedPts = [...pointsRef.current];
        updatedPts[idx] = { lat: newLat, lng: newLng };
        pointsRef.current = updatedPts;

        const newGPath = updatedPts.map((pt) => ({ lat: pt.lat, lng: pt.lng }));
        if (googlePolygonRef.current) googlePolygonRef.current.setPath(newGPath);
        if (googlePolylineRef.current) googlePolylineRef.current.setPath(newGPath);

        // Update Center Area Badge
        if (googleCenterBadgeOverlayRef.current && updatedPts.length >= 3) {
          const newCentroid = calculateCentroid(updatedPts);
          googleCenterBadgeOverlayRef.current.setPosition(newCentroid);
          const areaInfo = getAreaDetails(updatedPts);
          if (areaInfo) {
            googleCenterBadgeOverlayRef.current.setContent(
              `<div style="
                background-color: rgba(15, 23, 42, 0.9);
                color: #FFFFFF;
                padding: 6px 14px;
                border-radius: 9999px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                font-weight: 800;
                border: 1.5px solid rgba(16, 185, 129, 0.85);
                box-shadow: 0 4px 14px rgba(0,0,0,0.4);
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 6px;
              ">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#10B981;"></span>
                <span>${areaInfo.badgeText}</span>
              </div>`
            );
          }
        }

        // Update Edge Dimensions
        const edgeCount = isClosedRef.current ? updatedPts.length : updatedPts.length - 1;
        for (let i = 0; i < edgeCount; i++) {
          const p1 = updatedPts[i];
          const p2 = updatedPts[(i + 1) % updatedPts.length];
          const mid = { lat: (p1.lat + p2.lat) / 2, lng: (p1.lng + p2.lng) / 2 };
          const dist = getEdgeDistance(p1, p2);
          if (googleDimensionOverlaysRef.current[i]) {
            googleDimensionOverlaysRef.current[i].setPosition(mid);
            googleDimensionOverlaysRef.current[i].setContent(
              `<div style="
                background-color: rgba(255, 255, 255, 0.95);
                border: 1.5px solid #CBD5E1;
                color: #0F172A;
                font-size: 10px;
                font-weight: 800;
                padding: 2px 6px;
                border-radius: 5px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                white-space: nowrap;
              ">${dist.feet} ft</div>`
            );
          }
        }
      });

      marker.addListener("dragstart", () => {
        setHistory((h) => [...h, pointsRef.current]);
        setRedoHistory([]);
      });

      marker.addListener("dragend", () => {
        setPoints([...pointsRef.current]);
      });

      marker.addListener("click", () => {
        if (idx === 0 && pointsRef.current.length >= 3 && !isClosedRef.current) {
          setIsDrawingClosed(true);
          isClosedRef.current = true;
          if (googleRubberBandRef.current) {
            googleRubberBandRef.current.setMap(null);
            googleRubberBandRef.current = null;
          }
          setCursorDistanceFt(null);
          return;
        }

        if (pointsRef.current.length > 3 && isClosedRef.current) {
          setHistory((h) => [...h, pointsRef.current]);
          setRedoHistory([]);
          const updated = pointsRef.current.filter((_, i) => i !== idx);
          pointsRef.current = updated;
          setPoints(updated);
        }
      });

      googleMarkersRef.current.push(marker);
    });

    // 3. Draw Edge Dimensions
    if (pts.length >= 2 && CustomHtmlOverlay) {
      const edgeCount = isClosedRef.current ? pts.length : pts.length - 1;
      for (let i = 0; i < edgeCount; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const mid = { lat: (p1.lat + p2.lat) / 2, lng: (p1.lng + p2.lng) / 2 };
        const dist = getEdgeDistance(p1, p2);

        const dimOverlay = new CustomHtmlOverlay(
          mid,
          `<div style="
            background-color: rgba(255, 255, 255, 0.95);
            border: 1.5px solid #CBD5E1;
            color: #0F172A;
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 5px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            white-space: nowrap;
          ">${dist.feet} ft</div>`,
          "parcel-dim-label"
        );
        dimOverlay.setMap(map);
        googleDimensionOverlaysRef.current.push(dimOverlay);

        // Midpoint Handle
        if (isClosedRef.current && pts.length >= 3) {
          const midMarker = new maps.Marker({
            position: mid,
            map,
            draggable: true,
            cursor: "pointer",
            icon: createMidpointIcon(maps),
            title: language === "hi" ? "नया कोना जोड़ने के लिए क्लिक करें" : "Click or drag to add corner",
          });

          midMarker.addListener("click", () => {
            insertMidpointVertex(i, mid.lat, mid.lng);
          });

          midMarker.addListener("dragstart", () => {
            insertMidpointVertex(i, mid.lat, mid.lng);
          });

          googleMidpointMarkersRef.current.push(midMarker);
        }
      }
    }

    // 4. Draw Center Area Badge
    if (pts.length >= 3 && isClosedRef.current && CustomHtmlOverlay) {
      const centroid = calculateCentroid(pts);
      const areaInfo = getAreaDetails(pts);
      if (areaInfo) {
        const centerOverlay = new CustomHtmlOverlay(
          centroid,
          `<div style="
            background-color: rgba(15, 23, 42, 0.9);
            color: #FFFFFF;
            padding: 6px 14px;
            border-radius: 9999px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 800;
            border: 1.5px solid rgba(16, 185, 129, 0.85);
            box-shadow: 0 4px 14px rgba(0,0,0,0.4);
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#10B981;"></span>
            <span>${areaInfo.badgeText}</span>
          </div>`,
          "parcel-center-badge"
        );
        centerOverlay.setMap(map);
        googleCenterBadgeOverlayRef.current = centerOverlay;
      }
    }
  };

  // Quick 4-Corner Plot Button (standard 2,400 sq.ft rectangle)
  const handleDropStandardRectangle = () => {
    let centerLat = 25.6152;
    let centerLng = 85.0485;

    if (googleMapRef.current) {
      const c = googleMapRef.current.getCenter();
      if (c) {
        centerLat = c.lat();
        centerLng = c.lng();
      }
    } else if (points.length > 0) {
      const c = calculateCentroid(points);
      centerLat = c.lat;
      centerLng = c.lng;
    }

    // Approx 40 ft x 60 ft rectangle (2,400 sq.ft)
    const dLat = (60 / 364000) / 2;
    const dLng = (40 / 329000) / 2;

    const rectPts: LatLngPoint[] = [
      { lat: centerLat - dLat, lng: centerLng - dLng },
      { lat: centerLat + dLat, lng: centerLng - dLng },
      { lat: centerLat + dLat, lng: centerLng + dLng },
      { lat: centerLat - dLat, lng: centerLng + dLng },
    ];

    setHistory((h) => [...h, points]);
    setRedoHistory([]);
    setPoints(rectPts);
    setIsDrawingClosed(true);
    isClosedRef.current = true;
  };

  // Finish Boundary Button
  const handleFinishBoundary = () => {
    if (points.length >= 3) {
      setIsDrawingClosed(true);
      isClosedRef.current = true;
      if (googleRubberBandRef.current) {
        googleRubberBandRef.current.setMap(null);
        googleRubberBandRef.current = null;
      }
      setCursorDistanceFt(null);
    }
  };

  // Undo Button
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, h.length - 1));
    setRedoHistory((r) => [...r, points]);
    setPoints(previous);
    if (previous.length < 3) {
      setIsDrawingClosed(false);
      isClosedRef.current = false;
    }
  };

  // Redo Button
  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setRedoHistory((r) => r.slice(0, r.length - 1));
    setHistory((h) => [...h, points]);
    setPoints(next);
  };

  // Clear all points
  const handleClear = () => {
    setHistory((h) => [...h, points]);
    setRedoHistory([]);
    setPoints([]);
    setIsDrawingClosed(false);
    isClosedRef.current = false;
    if (googleRubberBandRef.current) {
      googleRubberBandRef.current.setMap(null);
      googleRubberBandRef.current = null;
    }
    setCursorDistanceFt(null);
  };

  // Center to plot / GPS
  const handleCenterToPlot = () => {
    if (googleMapRef.current && googleMapsApiRef.current && points.length > 0) {
      const maps = googleMapsApiRef.current;
      const bounds = new maps.LatLngBounds();
      points.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
      googleMapRef.current.fitBounds(bounds, 50);
    }
  };

  // Zoom In / Out Handlers
  const handleZoomIn = () => {
    if (googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 18) + 1);
    }
  };

  const handleZoomOut = () => {
    if (googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 18) - 1);
    }
  };

  // Satellite vs Street Map Layer Switcher
  const handleToggleLayer = () => {
    const nextMode = mapLayerMode === "satellite" ? "street" : "satellite";
    setMapLayerMode(nextMode);

    if (googleMapRef.current && googleMapsApiRef.current) {
      googleMapRef.current.setMapTypeId(
        nextMode === "satellite"
          ? googleMapsApiRef.current.MapTypeId.HYBRID
          : googleMapsApiRef.current.MapTypeId.ROADMAP
      );
    }
  };

  // Show prominent searched location marker pin on the map
  const displaySearchPin = (lat: number, lng: number, label: string) => {
    if (googleMapRef.current && googleMapsApiRef.current) {
      const map = googleMapRef.current;
      const maps = googleMapsApiRef.current;
      const CustomHtmlOverlay = customHtmlOverlayRef.current;

      if (googleSearchMarkerRef.current) {
        googleSearchMarkerRef.current.setMap(null);
        googleSearchMarkerRef.current = null;
      }
      if (googleSearchOverlayRef.current) {
        googleSearchOverlayRef.current.setMap(null);
        googleSearchOverlayRef.current = null;
      }

      const marker = new maps.Marker({
        position: { lat, lng },
        map,
        animation: maps.Animation?.DROP,
        icon: createSearchPinIcon(maps),
        title: label,
      });
      googleSearchMarkerRef.current = marker;

      if (CustomHtmlOverlay) {
        const labelOverlay = new CustomHtmlOverlay(
          { lat, lng },
          `<div style="
            background-color: rgba(15, 23, 42, 0.94);
            color: #FFFFFF;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.25);
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            white-space: nowrap;
            margin-bottom: 58px;
            letter-spacing: 0.2px;
          ">${label}</div>`,
          "search-pin-label"
        );
        labelOverlay.setMap(map);
        googleSearchOverlayRef.current = labelOverlay;
      }

      map.panTo({ lat, lng });
      map.setZoom(18);
    }
  };

  // Auto-suggest as user types in the search box
  const handleSearchChange = (text: string) => {
    setSearchLocation(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await fetchLocationSuggestions(text.trim());
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 250);
  };

  // When a user selects a suggestion from the dropdown
  const handleSelectSuggestion = async (item: LocationSuggestion) => {
    setSearchLocation(item.label);
    setShowSuggestions(false);
    setIsSearching(true);

    try {
      if (item.lat && item.lng && item.lat !== 0 && item.lng !== 0) {
        displaySearchPin(item.lat, item.lng, item.label);
        return;
      }

      if (item.placeId) {
        const geocoded = await geocodePlaceId(item.placeId);
        if (geocoded) {
          displaySearchPin(geocoded.lat, geocoded.lng, item.label);
          return;
        }
      }

      const addrGeocoded = await geocodeAddress(item.label);
      if (addrGeocoded) {
        displaySearchPin(addrGeocoded.lat, addrGeocoded.lng, item.label);
        return;
      }

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        item.label + ", Bihar, India"
      )}&countrycodes=in&limit=1`;
      const res = await fetch(nominatimUrl);
      const data = await res.json();
      if (data && data[0]) {
        displaySearchPin(parseFloat(data[0].lat), parseFloat(data[0].lon), item.label);
      }
    } catch (e) {
      console.warn("Geocoding failed for suggestion:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // Search Location Dispatcher (Google Maps Geocoder + Places + Coordinates + Nominatim)
  const handleSearchSubmit = async () => {
    if (!searchLocation.trim()) return;
    setShowSuggestions(false);
    const query = searchLocation.toLowerCase().trim();

    // 1. Direct GPS coordinates: "lat, lng"
    const coordMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        displaySearchPin(lat, lng, `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        return;
      }
    }

    setIsSearching(true);
    try {
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
        "boring road": [25.6186, 85.1166],
        "saguna more": [25.6195, 85.0345],
        "gola road": [25.6267, 85.0682],
        rukanpura: [25.6139, 85.0745],
        anisabad: [25.5802, 85.0931],
        "rajendra nagar": [25.5975, 85.1678],
      };

      for (const key of Object.keys(KNOWN_PLACES)) {
        if (query.includes(key)) {
          const [lat, lng] = KNOWN_PLACES[key];
          displaySearchPin(lat, lng, searchLocation.toUpperCase());
          return;
        }
      }

      // 2. Google Maps Geocoder API
      const googleRes = await geocodeAddress(searchLocation);
      if (googleRes) {
        displaySearchPin(googleRes.lat, googleRes.lng, googleRes.formattedAddress || searchLocation);
        return;
      }

      // 3. OpenStreetMap Nominatim Geocoder
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchLocation + ", Bihar, India"
      )}&countrycodes=in&limit=1`;
      const res = await fetch(nominatimUrl);
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        displaySearchPin(lat, lon, data[0].display_name?.split(",")[0] || searchLocation);
        return;
      }

      // Fallback
      displaySearchPin(25.6152, 85.0485, "Danapur, Patna");
    } catch (err) {
      console.warn("Location search error:", err);
      displaySearchPin(25.6152, 85.0485, "Danapur, Patna");
    } finally {
      setIsSearching(false);
    }
  };

  // Helper guidance text for bottom pill
  const getGuidanceText = () => {
    if (points.length === 0) {
      return t(language, "plot_hint_0") || "Tap anywhere on the map to place 1st boundary corner";
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

  // ================= INITIALIZE GOOGLE MAPS =================
  const initGoogleMap = useCallback(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !mapContainerRef.current) return;
    setMapEngine("loading");

    loadGoogleMaps()
      .then((maps) => {
        if (!mapContainerRef.current) return;

        googleMapsApiRef.current = maps;
        customHtmlOverlayRef.current = getCustomHtmlOverlayClass(maps);

        const centroid = calculateCentroid(pointsRef.current);

        const map = new maps.Map(mapContainerRef.current, {
          center: { lat: centroid.lat, lng: centroid.lng },
          zoom: 18,
          mapTypeId: mapLayerMode === "satellite" ? maps.MapTypeId.HYBRID : maps.MapTypeId.ROADMAP,
          tilt: 0,
          disableDefaultUI: true,
          scaleControl: true,
          gestureHandling: "greedy",
        });

        googleMapRef.current = map;
        setMapEngine("google");

        // Map Click to Add New Boundary Point
        map.addListener("click", (e: any) => {
          if (isClosedRef.current && pointsRef.current.length >= 3) return;

          const newPt: LatLngPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          const previous = pointsRef.current;

          // Clicking near the first vertex closes an existing polygon
          if (previous.length >= 3 && getEdgeDistance(previous[0], newPt).feet < 30) {
            setIsDrawingClosed(true);
            isClosedRef.current = true;
            if (googleRubberBandRef.current) {
              googleRubberBandRef.current.setMap(null);
              googleRubberBandRef.current = null;
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
        map.addListener("mousemove", (e: any) => {
          const curPts = pointsRef.current;
          if (curPts.length > 0 && !isClosedRef.current) {
            const lastPt = curPts[curPts.length - 1];
            const mousePt = { lat: e.latLng.lat(), lng: e.latLng.lng() };

            if (!googleRubberBandRef.current) {
              googleRubberBandRef.current = new maps.Polyline({
                path: [lastPt, mousePt],
                strokeColor: "#10B981",
                strokeWeight: 2,
                strokeOpacity: 0.85,
                map,
                clickable: false,
              });
            } else {
              googleRubberBandRef.current.setPath([lastPt, mousePt]);
            }

            const dist = getEdgeDistance(lastPt, mousePt);
            setCursorDistanceFt(dist.feet);
          } else if (googleRubberBandRef.current) {
            googleRubberBandRef.current.setMap(null);
            googleRubberBandRef.current = null;
            setCursorDistanceFt(null);
          }
        });

        map.addListener("mouseout", () => {
          if (googleRubberBandRef.current) {
            googleRubberBandRef.current.setMap(null);
            googleRubberBandRef.current = null;
          }
          setCursorDistanceFt(null);
        });

        map.addListener("dblclick", () => {
          if (pointsRef.current.length >= 3) {
            setIsDrawingClosed(true);
            isClosedRef.current = true;
            if (googleRubberBandRef.current) {
              googleRubberBandRef.current.setMap(null);
              googleRubberBandRef.current = null;
            }
            setCursorDistanceFt(null);
          }
        });

        renderGoogleParcel(pointsRef.current);
      })
      .catch((err) => {
        console.error("Google Maps failed to load:", err);
        setMapEngine("error");
      });
  }, [mapLayerMode]);

  useEffect(() => {
    initGoogleMap();
    return () => {
      if (googleRubberBandRef.current) {
        googleRubberBandRef.current.setMap(null);
      }
      if (googlePolygonRef.current) {
        googlePolygonRef.current.setMap(null);
      }
      if (googlePolylineRef.current) {
        googlePolylineRef.current.setMap(null);
      }
    };
  }, []);

  // Sync Google Maps parcel changes whenever points, status, or language updates
  useEffect(() => {
    if (googleMapRef.current) {
      renderGoogleParcel(points);
    }
  }, [points, isDrawingClosed, language]);

  const areaDetails = getAreaDetails(points);

  return (
    <View style={styles.workspaceContainer}>
      {/* ================= MAIN FULL-WIDTH GOOGLE MAP CANVAS ================= */}
      <View style={styles.mapCanvasCard}>
        {/* Real Google Maps DOM Container */}
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

        {/* Loading Indicator while Google Maps initializes */}
        {mapEngine === "loading" && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingOverlayText}>
              {language === "hi" ? "गूगल मैप्स लोड हो रहा है..." : "Loading Google Maps..."}
            </Text>
          </View>
        )}

        {/* Error Overlay with Retry button */}
        {mapEngine === "error" && (
          <View style={styles.loadingOverlay}>
            <MaterialIcons name="error-outline" size={40} color="#EF4444" />
            <Text style={styles.errorOverlayTitle}>
              {language === "hi" ? "गूगल मैप्स लोड करने में असमर्थ" : "Unable to Load Google Maps"}
            </Text>
            <Text style={styles.errorOverlayDesc}>
              {language === "hi"
                ? "कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।"
                : "Please check your network connection and retry."}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={initGoogleMap}
              activeOpacity={0.8}
            >
              <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>
                {language === "hi" ? "पुनः प्रयास करें" : "Retry Loading Google Maps"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OVERLAY: Top-Left Search Location Bar */}
        <View style={styles.mapSearchContainer}>
          <View style={styles.mapSearchBox}>
            <MaterialIcons name="search" size={20} color="#03456C" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.mapSearchInput}
              placeholder={
                t(language, "search_map_location") || "Search city, village, or GPS (e.g. 25.61, 85.14)..."
              }
              placeholderTextColor="#64748B"
              value={searchLocation}
              onChangeText={handleSearchChange}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchLocation.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchLocation("");
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                activeOpacity={0.7}
                style={{ padding: 4, marginRight: 4 }}
                accessibilityLabel="Clear search"
              >
                <MaterialIcons name="close" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSearchSubmit}
              activeOpacity={0.8}
              style={styles.searchSubmitBtn}
              disabled={isSearching}
              accessibilityLabel="Search map location"
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Live Google Places & Location Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsDropdown}>
              <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                {suggestions.map((item, idx) => (
                  <TouchableOpacity
                    key={`${item.label}-${idx}`}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={item.kind === "district" ? "location-city" : "place"}
                      size={18}
                      color="#0284C7"
                      style={{ marginRight: 8, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {item.district && (
                        <Text style={styles.suggestionSub} numberOfLines={1}>
                          {item.district}, {item.state}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
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
                      isDrawingClosed ? styles.hudLiveDotGreen : styles.hudLiveDotAmber,
                    ]}
                  />
                  <Text style={styles.hudMetricsStatus}>
                    {isDrawingClosed
                      ? t(language, "boundary_closed") || "Boundary Locked & Verified"
                      : t(language, "boundary_in_progress") || "Outline In Progress"}
                  </Text>
                  <Text style={styles.hudPointsCount}>
                    {points.length} {t(language, "corners") || "Corners"}
                  </Text>
                </View>

                {/* 3-Column Land Metrics Grid */}
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
                    {t(language, "drag_to_adjust") ||
                      "Drag green handles or '+' midpoints to adjust shape"}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.hudEmptyMetricsBox}>
                <MaterialIcons name="straighten" size={18} color="#0284C7" />
                <Text style={styles.hudEmptyMetricsText}>
                  {t(language, "no_points_yet") || "Tap points on satellite map to start boundary"}
                </Text>
              </View>
            )}

            {/* Quick 4-Step Instructions */}
            <View style={styles.hudStepsContainer}>
              <Text style={styles.hudStepsTitle}>
                {t(language, "how_to_draw") || "How to Draw"}
              </Text>
              <View style={styles.hudStepItem}>
                <View style={styles.hudStepNumber}>
                  <Text style={styles.hudStepNumberText}>1</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_1") || "Tap on the map to add boundary points"}
                </Text>
              </View>
              <View style={styles.hudStepItem}>
                <View style={styles.hudStepNumber}>
                  <Text style={styles.hudStepNumberText}>2</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_2") || "Continue tapping to complete the outline"}
                </Text>
              </View>
              <View style={styles.hudStepItem}>
                <View style={styles.hudStepNumber}>
                  <Text style={styles.hudStepNumberText}>3</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_5") || "Close the shape by clicking on the first point"}
                </Text>
              </View>
              <View style={styles.hudStepItem}>
                <View style={styles.hudStepNumber}>
                  <Text style={styles.hudStepNumberText}>4</Text>
                </View>
                <Text style={styles.hudStepText}>
                  {t(language, "draw_step_3") || "Drag points to adjust if needed"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* OVERLAY: Bottom-Left Google Satellite vs Street Map Mode Switcher Pill */}
        <TouchableOpacity
          style={styles.mapLayerModePill}
          onPress={handleToggleLayer}
          activeOpacity={0.8}
          accessibilityLabel="Switch Google Map Layer"
        >
          <MaterialIcons
            name={mapLayerMode === "satellite" ? "satellite" : "map"}
            size={16}
            color="#03456C"
          />
          <Text style={styles.mapLayerModeText}>
            {mapLayerMode === "satellite"
              ? language === "hi"
                ? "गूगल सैटेलाइट (हाइब्रिड)"
                : "Satellite (Hybrid)"
              : language === "hi"
              ? "गूगल सड़क मानचित्र"
              : "Google Street Map"}
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
        <View style={[styles.featureCard, styles.featureCardPinning]}>
          <View style={[styles.featureIconBadge, styles.featureIconBadgePinning]}>
            <MaterialIcons name="edit-location-alt" size={20} color="#0284C7" />
          </View>
          <View style={styles.featureCardContent}>
            <Text style={[styles.featureTitle, styles.featureTitlePinning]}>
              {language === "hi" ? "सटीक भूखंड सीमा" : "Cadastral Plot Pinning"}
            </Text>
            <Text style={styles.featureDesc}>
              {language === "hi"
                ? "हाई-रेसोल्यूशन सैटेलाइट पर जमीन के सभी कोने सटीक रूप से चिह्नित करें।"
                : "Place corners directly on high-res Google Satellite imagery with sub-meter accuracy."}
            </Text>
          </View>
        </View>

        <View style={[styles.featureCard, styles.featureCardDimensions]}>
          <View style={[styles.featureIconBadge, styles.featureIconBadgeDimensions]}>
            <MaterialIcons name="straighten" size={20} color="#059669" />
          </View>
          <View style={styles.featureCardContent}>
            <Text style={[styles.featureTitle, styles.featureTitleDimensions]}>
              {language === "hi" ? "वास्तविक दूरी व आयाम" : "Live Edge Dimensions"}
            </Text>
            <Text style={styles.featureDesc}>
              {language === "hi"
                ? "प्रत्येक भुजा की लंबाई फीट में तुरंत देखें व '+' से नए बिंदु जोड़ें।"
                : "Real-time edge distances in feet with midpoint '+' handles for precise shaping."}
            </Text>
          </View>
        </View>

        <View style={[styles.featureCard, styles.featureCardUnits]}>
          <View style={[styles.featureIconBadge, styles.featureIconBadgeUnits]}>
            <MaterialIcons name="calculate" size={20} color="#7C3AED" />
          </View>
          <View style={styles.featureCardContent}>
            <Text style={[styles.featureTitle, styles.featureTitleUnits]}>
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
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 37, 64, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3000,
    padding: 24,
    gap: 12,
  },
  loadingOverlayText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  errorOverlayTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  errorOverlayDesc: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0284C7",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Overlay: Top-Left Location Search Container */
  mapSearchContainer: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 2000,
    width: 350,
    maxWidth: "50%",
  },
  mapSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    height: 44,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
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
  suggestionsDropdown: {
    marginTop: 6,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    maxHeight: 220,
    ...Platform.select({
      web: {
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.25)",
      },
    }),
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  suggestionLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  suggestionSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
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
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    zIndex: 1000,
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
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  quickPresetBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  finishShapeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  finishShapeBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#E2E8F0",
  },
  toolBtn: {
    padding: 7,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  toolBtnDisabled: {
    opacity: 0.35,
    ...Platform.select({ web: { cursor: "not-allowed" as any } }),
  },
  clearToolBtn: {
    padding: 7,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  guideToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
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

  /* Overlay: Middle-Left Navigation & Zoom Controls */
  mapLeftControls: {
    position: "absolute",
    top: 76,
    left: 16,
    gap: 8,
    zIndex: 1000,
  },
  standaloneIconBtn: {
    width: 38,
    height: 38,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.18)",
      },
    }),
  },

  /* Overlay: Floating Cadastral Drawing Guide & Parcel Stats HUD */
  hudCard: {
    position: "absolute",
    top: 76,
    right: 16,
    width: 320,
    maxWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    padding: 16,
    gap: 12,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.22)",
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
    flex: 1,
  },
  hudIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
  },
  hudTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  hudCloseBtn: {
    padding: 4,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  hudMetricsBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  hudMetricsHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  hudLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hudLiveDotGreen: {
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
  hudEmptyMetricsText: {
    fontSize: 11,
    color: "#03456C",
    fontWeight: "600",
    flex: 1,
    lineHeight: 15,
  },
  hudStepsContainer: {
    gap: 7,
  },
  hudStepsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  hudStepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  hudStepNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  hudStepNumberText: {
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
    marginTop: 6,
  },
  featureCard: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 15,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
      },
      default: {
        elevation: 1,
      },
    }),
  },
  featureCardPinning: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  featureCardDimensions: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  featureCardUnits: {
    backgroundColor: "#FAF5FF",
    borderColor: "#E9D5FF",
  },
  featureIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  featureIconBadgePinning: {
    backgroundColor: "#E0F2FE",
  },
  featureIconBadgeDimensions: {
    backgroundColor: "#D1FAE5",
  },
  featureIconBadgeUnits: {
    backgroundColor: "#EDE9FE",
  },
  featureCardContent: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  featureTitlePinning: {
    color: "#03456C",
  },
  featureTitleDimensions: {
    color: "#065F46",
  },
  featureTitleUnits: {
    color: "#5B21B6",
  },
  featureDesc: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "500",
  },
});
