import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { isAxiosError } from "axios";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import GoogleParcelMap from "./GoogleParcelMap.native";
import NativeLeafletMap from "./NativeLeafletMap";
import { currentMapLocation } from "../src/services/currentMapLocation";
import { fetchLocationSuggestions, type LocationSuggestion } from "../src/services/regionService";
import { validMapPoint, type MapFocus, type MapPoint } from "../src/utils/nativeMapHtml";
export type LatLngPoint = MapPoint;

type GoogleAddress = { placeId: string; label: string };
type SearchResult = { source: "google"; address: GoogleAddress } | { source: "local"; area: LocationSuggestion };

export default function MapParcelPicker({ initialPoints, onParcelChange, locationFocus, showLocate = true, onLocationSet, selectedLocation, initialSearch = "" }: {
  initialPoints?: MapPoint[];
  onParcelChange: (points: MapPoint[]) => void;
  areaSqFt?: number | string;
  locationFocus?: MapFocus;
  showLocate?: boolean;
  onLocationSet?: (point: MapPoint) => void;
  selectedLocation?: MapPoint;
  initialSearch?: string;
}) {
  // Keep drawing options stable; focus changes move the map without resetting corners.
  const [options] = useState(() => ({ points: initialPoints ?? [], editable: true, satellite: true }));
  const [localFocus, setLocalFocus] = useState<{ point: MapFocus; anchor?: MapFocus }>();
  const focus = localFocus?.anchor === locationFocus ? localFocus?.point ?? locationFocus : locationFocus;
  const setFocus = (point: MapFocus) => setLocalFocus({ point, anchor: locationFocus });
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState(initialSearch);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"pin" | "boundary" | null>(null);
  const [zoomRequest, setZoomRequest] = useState<{ delta: number }>();
  const google = Platform.OS === "android" && (isRunningInExpoGo() || Constants.expoConfig?.extra?.androidGoogleMapsConfigured === true);
  const canSearchGoogleAddresses = useAuthStore(state => state.user?.role === "user");
  const points = initialPoints ?? [];
  const setPin = (point: MapPoint) => {
    onLocationSet?.(point);
    setMode(null);
  };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  const session = useRef<string | undefined>(undefined);
  useEffect(() => () => {
    clearTimeout(timer.current);
    controller.current?.abort();
  }, []);

  const beginLookup = () => {
    clearTimeout(timer.current);
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    return next.signal;
  };

  const search = async (value: string) => {
    const term = value.trim();
    const signal = beginLookup();
    if (term.length < 2) {
      setError("Enter an address, district or pincode to search.");
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      let googleError: "access" | "unavailable" | undefined;
      if (google && canSearchGoogleAddresses && term.length >= 3) {
        session.current ??= randomUUID();
        const addresses = await api.post<GoogleAddress[]>("/parcel-places/autocomplete", {
          input: term, sessionToken: session.current,
        }, { signal, timeout: 7000 }).then(response => response.data).catch((error: unknown) => {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          googleError = status === 401 || status === 403 ? "access" : "unavailable";
          return [];
        });
        if (signal.aborted) return;
        if (addresses.length) {
          setResults(addresses.map(address => ({ source: "google", address })));
          return;
        }
      }
      const areas = (await fetchLocationSuggestions(term, undefined, signal, false)).filter(validMapPoint);
      if (signal.aborted) return;
      setResults(areas.map(area => ({ source: "local", area })));
      if (googleError === "access") {
        setError(areas.length ? "Street address search requires a buyer/seller account. Showing MalikSe areas."
          : "Street address search requires a buyer/seller account. Try a district, pincode, or GPS.");
      } else if (googleError === "unavailable") {
        setError(areas.length ? "Google address search is unavailable. Showing nearby MalikSe areas."
          : "Google address search is unavailable. Try a district, pincode, or GPS.");
      } else if (!areas.length) {
        setError("No matching addresses. Try a landmark, district, or pincode.");
      }
    } catch {
      if (!signal.aborted) setError("Could not search addresses. Please try again.");
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };

  const changeQuery = (value: string) => {
    beginLookup();
    setQuery(value);
    setResults([]);
    setError("");
    setBusy(false);
    if (value.trim().length >= 3) timer.current = setTimeout(() => void search(value), 350);
    else if (!value.trim()) session.current = undefined;
  };

  const chooseResult = async (result: SearchResult) => {
    const signal = beginLookup();
    setBusy(true);
    setError("");
    Keyboard.dismiss();
    try {
      if (result.source === "google") {
        const sessionToken = session.current;
        if (!sessionToken) throw new Error("Search again to select this address.");
        session.current = undefined;
        const { data: point } = await api.post<MapPoint>("/parcel-places/resolve", {
          placeId: result.address.placeId, sessionToken,
        }, { signal, timeout: 7000 });
        if (signal.aborted) return;
        if (!validMapPoint(point)) throw new Error("This address has no coordinates.");
        setFocus({ ...point, zoom: 18 });
        setPin(point);
        setQuery(result.address.label);
      } else {
        const area = result.area;
        setFocus({ lat: area.lat, lng: area.lng, zoom: area.kind === "state" ? 8 : area.kind === "district" ? 12 : 16 });
        setMode(null);
        setQuery(area.label);
      }
      setResults([]);
    } catch {
      if (!signal.aborted) {
        setResults([]);
        setError("Could not open that address. Search again to retry.");
      }
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };
  const locate = async () => {
    const signal = beginLookup();
    setBusy(true); setError(""); setResults([]); Keyboard.dismiss();
    try {
      const point = await currentMapLocation();
      if (!signal.aborted) setFocus({ ...point, zoom: 17 });
    } catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : "Could not obtain location."); }
    finally { if (!signal.aborted) setBusy(false); }
  };
  return <View style={styles.container}>
    <View style={styles.searchBar}>
      <TextInput accessibilityLabel="Search property address" placeholder="Address, landmark or pincode"
        placeholderTextColor="#536174" value={query} maxLength={200} onChangeText={changeQuery}
        onSubmitEditing={() => void search(query)} returnKeyType="search" style={styles.input} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search address" disabled={busy}
        onPress={() => void search(query)} style={[styles.searchButton, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color="#FCC61C" /> : <MaterialIcons name="search" color="#FCC61C" size={21} />}
      </TouchableOpacity>
    </View>
    {showLocate && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={locate} style={styles.locationButton}><Text style={styles.resultText}>Use my location</Text></TouchableOpacity>}
    {!!error && <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{error}</Text>}
    {!!results.length && (
      <View style={styles.results}>
        <Text style={styles.resultsHeading}>{results[0].source === "google" ? "Google Maps addresses" : "MalikSe areas"}</Text>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always" style={styles.resultsScroll}>
          {results.map(result => {
            const label = result.source === "google" ? result.address.label : result.area.label;
            const key = result.source === "google" ? result.address.placeId : result.area.label;
            return <TouchableOpacity key={key} accessibilityRole="button" disabled={busy}
              onPress={() => void chooseResult(result)} style={styles.result}>
              <MaterialIcons name="place" size={18} color="#14263E" />
              <Text style={[styles.resultText, { flex: 1 }]}>{label}</Text>
            </TouchableOpacity>;
          })}
        </ScrollView>
      </View>
    )}
    <View style={[styles.map, { height: Math.min(400, Math.max(280, height * 0.42)) }]}>
      <View pointerEvents={mode ? "auto" : "none"} style={StyleSheet.absoluteFill}>
        {google ? (
          <GoogleParcelMap points={points} location={selectedLocation} focus={focus} mode={mode ?? "boundary"}
            active={!!mode} zoomRequest={zoomRequest} onPoints={onParcelChange} onPin={setPin} />
        ) : (
          <NativeLeafletMap options={options} focus={focus} onPoints={onParcelChange}
            parcelControls={{ mode, zoomRequest, onPin: setPin }} />
        )}
      </View>
      <View style={styles.zoomControls}>
        {[{ delta: 1, icon: "add", label: "Zoom in" }, { delta: -1, icon: "remove", label: "Zoom out" }].map(control => (
          <TouchableOpacity key={control.delta} accessibilityRole="button" accessibilityLabel={control.label}
            onPress={() => setZoomRequest({ delta: control.delta })} style={styles.mapButton}>
            <MaterialIcons name={control.icon as "add" | "remove"} color="#14263E" size={23} />
          </TouchableOpacity>
        ))}
      </View>
      {mode && (
        <View pointerEvents="box-none" style={[styles.mapActions, !google && mode === "boundary" && styles.fallbackMapActions]}>
          {mode === "boundary" && google && points.length > 0 && (
            <>
              <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => onParcelChange(points.slice(0, -1))}><Text style={styles.resultText}>Undo</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => onParcelChange([])}><Text style={styles.resultText}>Clear</Text></TouchableOpacity>
            </>
          )}
          <TouchableOpacity accessibilityRole="button" style={[styles.action, styles.primary, mode === "boundary" && points.length > 0 && points.length < 3 && styles.disabled]}
            disabled={mode === "boundary" && points.length > 0 && points.length < 3} onPress={() => setMode(null)}>
            <Text style={styles.resultText}>{mode === "pin" ? "Cancel" : "Done"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    {!mode && <View style={styles.actions}>
          {onLocationSet && <TouchableOpacity accessibilityRole="button" style={[styles.action, styles.primary]} onPress={() => setMode("pin")}><Text style={styles.resultText}>Set property pin</Text></TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => setMode("boundary")}><Text style={styles.resultText}>{points.length ? "Edit boundary" : "Draw boundary"}</Text></TouchableOpacity>
    </View>}
    <Text style={styles.hint}>{mode === "pin" ? "Tap your property on the map to set its location." : mode === "boundary"
      ? "Tap at least three corners. Drag a corner to adjust it."
      : "Set a pin to mark the location. Draw a boundary if you want to outline the plot."}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D8DBDF", borderRadius: 16, backgroundColor: "#fff", padding: 4, gap: 4 },
  input: { flex: 1, minHeight: 44, minWidth: 0, paddingHorizontal: 10, fontFamily: "Manrope", fontSize: 15, color: "#14263E" },
  searchButton: { height: 44, width: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#14263E" },
  disabled: { opacity: 0.6 },
  locationButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 8 },
  results: { borderWidth: 1, borderColor: "#D8DBDF", borderRadius: 12, backgroundColor: "#fff", overflow: "hidden" },
  resultsHeading: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6, fontFamily: "ManropeBold", color: "#536174", fontSize: 12 },
  resultsScroll: { maxHeight: 188 },
  result: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#D8DBDF" },
  resultText: { fontFamily: "ManropeBold", color: "#14263E" },
  map: { borderRadius: 16, overflow: "hidden", backgroundColor: "#F7F4EC" },
  zoomControls: { position: "absolute", top: 12, left: 12, gap: 4 },
  mapButton: { width: 44, height: 44, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 3 },
  mapActions: { position: "absolute", left: 6, right: 6, bottom: 28, flexDirection: "row", justifyContent: "center", gap: 6 },
  fallbackMapActions: { top: 12, right: 12, left: undefined, bottom: undefined },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: "#D8DBDF", backgroundColor: "#fff" },
  primary: { backgroundColor: "#FCC61C", borderColor: "#FCC61C" },
  hint: { fontFamily: "Manrope", color: "#536174", fontSize: 12, lineHeight: 18 },
});
