import React, { useRef, useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import NativeLeafletMap from "./NativeLeafletMap";
import { currentMapLocation } from "../src/services/currentMapLocation";
import { fetchLocationSuggestions, type LocationSuggestion } from "../src/services/regionService";
import type { MapFocus, MapPoint } from "../src/utils/nativeMapHtml";
export type LatLngPoint = MapPoint;

export default function MapParcelPicker({ initialPoints, onParcelChange }: { initialPoints?: MapPoint[]; onParcelChange: (points: MapPoint[]) => void; areaSqFt?: number | string }) {
  // Keep drawing options stable; focus changes move the map without resetting corners.
  const [options] = useState(() => ({ points: initialPoints ?? [], editable: true, satellite: true }));
  const [focus, setFocus] = useState<MapFocus>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const search = async () => {
    if (query.trim().length < 2) return;
    const revision = ++request.current;
    setBusy(true); setError(""); setResults([]); Keyboard.dismiss();
    try {
      const items = await fetchLocationSuggestions(query.trim());
      if (revision !== request.current) return;
      setResults(items);
      if (!items.length) setError("No matching areas. Use your location or move the map manually.");
    } catch { if (revision === request.current) setError("Could not search areas. Please try again."); }
    finally { if (revision === request.current) setBusy(false); }
  };
  const locate = async () => {
    const revision = ++request.current;
    setBusy(true); setError(""); setResults([]); Keyboard.dismiss();
    try {
      const point = await currentMapLocation();
      if (revision === request.current) setFocus({ ...point, zoom: 17 });
    } catch (cause) { if (revision === request.current) setError(cause instanceof Error ? cause.message : "Could not obtain location."); }
    finally { if (revision === request.current) setBusy(false); }
  };
  return <View style={{ gap: 10 }}>
    <Text style={{ color: "#284B68", lineHeight: 22 }}>Find an area, then tap each boundary corner. Tap Finish to close the boundary. Drag a corner to adjust it.</Text>
    <TextInput accessibilityLabel="Search parcel area" placeholder="Search district or pincode" value={query} onChangeText={value => { request.current++; setQuery(value); setResults([]); setError(""); setBusy(false); }} onSubmitEditing={search} returnKeyType="search" style={{ backgroundColor: "white", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#ccd6df" }} />
    <View style={{ flexDirection: "row", gap: 16 }}>
      <TouchableOpacity accessibilityRole="button" disabled={busy || query.trim().length < 2} onPress={search} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: "#245B78" }}>Search area</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={locate} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: "#245B78" }}>Use my location</Text></TouchableOpacity>
      {busy && <ActivityIndicator />}
    </View>
    {!!error && <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{error}</Text>}
    {!!results.length && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>{results.map((item, index) => <TouchableOpacity key={`${item.label}:${index}`} accessibilityRole="button" onPress={() => { setFocus({ lat: item.lat, lng: item.lng, zoom: item.kind === "state" ? 7 : item.kind === "district" ? 11 : 15 }); setResults([]); Keyboard.dismiss(); }} style={{ padding: 12 }}><Text>{item.label}</Text></TouchableOpacity>)}</ScrollView>}
    <View style={{ height: 430, borderRadius: 16, overflow: "hidden" }}><NativeLeafletMap options={options} focus={focus} onPoints={onParcelChange} /></View>
  </View>;
}
