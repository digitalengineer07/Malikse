import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PropertyTypeTabs from "./PropertyTypeTabs";
import RegionCountMap from "./RegionCountMap";
import { fetchRegionCounts, fetchLocationSuggestions, type LocationSuggestion, type RegionGroup } from "../src/services/regionService";
import type { PropertyType } from "../src/types/property.types";
import type { MapFocus } from "../src/utils/nativeMapHtml";

export default function MarketplaceScreen() {
  const router = useRouter(), insets = useSafeAreaInsets();
  const [state, setState] = useState<RegionGroup>();
  const [district, setDistrict] = useState<RegionGroup>();
  const [type, setType] = useState<PropertyType>();
  const [groups, setGroups] = useState<RegionGroup[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false), [suggestionError, setSuggestionError] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const level = district ? "pincode" : state ? "district" : "state";
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);setError("");setGroups([]);
    fetchRegionCounts({ state: state?.key, district: district?.key, type }, controller.signal)
      .then(data => { if (active) setGroups(data.groups); })
      .catch(() => { if (active) setError("Could not load area counts. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false;controller.abort(); };
  }, [state?.key, district?.key, type, revision]));
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setSuggestions([]);setSuggesting(false);setSuggestionError(false);return; }
    const controller = new AbortController();
    let active = true;
    setSuggesting(true);setSuggestionError(false);
    const timer = setTimeout(() => {
      fetchLocationSuggestions(term, type, controller.signal)
        .then(data => { if (active) setSuggestions(data); })
        .catch(() => { if (active) setSuggestionError(true); })
        .finally(() => { if (active) setSuggesting(false); });
    }, 250);
    return () => { active = false;clearTimeout(timer);controller.abort(); };
  }, [query, type]);
  const focus = useMemo<MapFocus | undefined>(() => district ? { lat: district.lat, lng: district.lng, zoom: 10 } : state ? { lat: state.lat, lng: state.lng, zoom: 7 } : undefined, [state, district]);
  const select = useCallback((group: RegionGroup) => {
    setQuery("");
    if (!state) setState(group);
    else if (!district) setDistrict(group);
    else router.push({ pathname: "/(tabs)/home", params: { state: state.key, district: district.key, pincode: group.key, type: type || "", query: "", min: "", max: "" } });
  }, [state, district, type, router]);
  const selectSuggestion = useCallback((item: LocationSuggestion) => {
    const term = query.trim();setQuery("");setSuggestions([]);
    const stateGroup = { key: item.state, name: item.state, count: 0, lat: item.lat, lng: item.lng };
    const districtGroup = { key: item.district || "", name: item.district || "", count: 0, lat: item.lat, lng: item.lng };
    if (item.kind === "state") { setState(stateGroup);setDistrict(undefined);return; }
    if (item.kind === "district") { setState(stateGroup);setDistrict(districtGroup);return; }
    if (item.kind === "pincode") {
      router.push({ pathname: "/(tabs)/home", params: { state: item.state, district: item.district || "", pincode: item.pincode || "", type: type || "", query: "", address: "", min: "", max: "" } });
      return;
    }
    router.push({ pathname: "/(tabs)/home", params: { address: term, state: "", district: "", pincode: "", type: type || "", query: "", min: "", max: "" } });
  }, [query, router, type]);
  const searchAll = () => {
    const term = query.trim();
    if (term.length < 2) return;
    setQuery("");setSuggestions([]);
    router.push({ pathname: "/(tabs)/home", params: { address: term, state: "", district: "", pincode: "", type: type || "", query: "", min: "", max: "" } });
  };
  return <View style={[styles.screen, { paddingTop: insets.top }]}>
    <View style={styles.controls}>
      <Text style={styles.title}>Find properties by area</Text>
      <View style={styles.breadcrumbs}>
        <TouchableOpacity accessibilityRole="button" onPress={() => { setState(undefined);setDistrict(undefined);setQuery(""); }}><Text style={styles.link}>All states</Text></TouchableOpacity>
        {state && <TouchableOpacity accessibilityRole="button" onPress={() => { setDistrict(undefined);setQuery(""); }}><Text style={styles.link}> › {state.name}</Text></TouchableOpacity>}
        {district && <Text style={styles.label}> › {district.name}</Text>}
      </View>
      <PropertyTypeTabs value={type} onChange={setType} />
      <TextInput accessibilityLabel="Search any state, district, pincode or address" placeholder="Search state, district, pincode or address" value={query} onChangeText={setQuery} onSubmitEditing={searchAll} returnKeyType="search" autoCorrect={false} style={styles.input} />
      {query.trim().length >= 2 && <View style={styles.suggestions}>
        {suggesting && <ActivityIndicator accessibilityLabel="Searching addresses" color="#1A365D" />}
        {suggestionError && <Text accessibilityRole="alert" style={styles.label}>Could not search addresses. Press Enter to try the full search.</Text>}
        {!suggesting && !suggestionError && <ScrollView keyboardShouldPersistTaps="always" style={styles.suggestionList}>
          {suggestions.map((item, index) => <TouchableOpacity key={`${item.kind}:${item.label}:${index}`} accessibilityRole="button" onPress={() => selectSuggestion(item)} style={styles.suggestionRow}><Text style={styles.label}>{item.label}</Text><Text style={styles.suggestionKind}>{item.kind}</Text></TouchableOpacity>)}
          {!suggestions.length && <Text style={styles.label}>No matching areas. Press Enter to search listings.</Text>}
        </ScrollView>}
      </View>}
      {loading && <ActivityIndicator accessibilityLabel="Loading area counts" color="#1A365D" />}
      {!!error && <View><Text accessibilityRole="alert" style={styles.label}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRevision(value => value + 1)}><Text style={styles.link}>Try again</Text></TouchableOpacity></View>}
      {!loading && !error && !groups.length && !query && <Text style={styles.label}>No available properties in this area.</Text>}
    </View>
    <View style={styles.map}><RegionCountMap groups={loading || error ? [] : groups} focus={focus} onSelect={select} /></View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F8FC" }, controls: { padding: 14, gap: 8 }, title: { fontSize: 22, fontWeight: "700", color: "#1A365D" },
  breadcrumbs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", minHeight: 32 }, link: { color: "#245E92", fontWeight: "600", paddingVertical: 6 }, label: { color: "#19334a", fontWeight: "600" },
  input: { backgroundColor: "white", borderColor: "#ccd6df", borderWidth: 1, padding: 12, borderRadius: 12 }, map: { flex: 1, minHeight: 160 },
  suggestions: { backgroundColor: "white", borderRadius: 12, padding: 8, maxHeight: 220 }, suggestionList: { flexGrow: 0 },
  suggestionRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, padding: 10, borderBottomColor: "#edf0f4", borderBottomWidth: 1 }, suggestionKind: { color: "#56768E", textTransform: "capitalize" },
});
