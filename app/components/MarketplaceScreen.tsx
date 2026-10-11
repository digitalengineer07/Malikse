import ExpandableSearch from "./ExpandableSearch";
import { currentMapLocation } from "../src/services/currentMapLocation";
import type { MapFocus } from "../src/utils/nativeMapHtml";
import PropertyTypeTabs from "./PropertyTypeTabs";
import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View, TouchableOpacity, Text, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import { propertyService } from "../src/services/propertyService";
import type { Property, PropertyType } from "../src/types/property.types";
import { AppTheme } from "../constants/theme";
import { premiumStyles } from "../constants/typography";


export default function MarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [focus, setFocus] = useState<MapFocus>();
  const [locationNote, setLocationNote] = useState("");
  const locationRequest = useRef(0);
  useFocusEffect(useCallback(() => () => { locationRequest.current++; }, []));
  const locate = async () => {
    const request = ++locationRequest.current;
    setLocationNote("Finding your current area…");
    try {
      const point = await currentMapLocation();
      if (request !== locationRequest.current) return;
      setFocus({ ...point, zoom: 10 });
      setLocationNote("Map centered on your current area. Search by district or property name.");
    } catch (cause) {
      if (request === locationRequest.current) setLocationNote(cause instanceof Error ? cause.message : "Location unavailable. You can still search by district.");
    }
  };
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PropertyType | undefined>(undefined);
  const [properties, setProperties] = useState<Property[]>([]);
  const loadedPage = useRef(0);
  const searchGeneration = useRef(0);
  const pendingSearch = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const loadPage = useCallback(async (page: number, generation: number) => {
    pendingSearch.current = true;
    setLoading(true); setError("");
    try {
      const data = await propertyService.searchProperties({ type, location: query, page, limit: 50 });
      if (generation !== searchGeneration.current) return;
      setProperties(previous => {
        const merged = new Map<string, Property>();
        for (const property of [...(page === 1 ? [] : previous), ...data]) merged.set(property._id || property.id, property);
        return [...merged.values()];
      });
      loadedPage.current = page;
      setHasMore(data.length === 50 && page < 100);
      setLimitReached(data.length === 50 && page === 100);
    } catch {
      if (generation === searchGeneration.current) setError("Could not load properties. Please try again.");
    } finally {
      if (generation === searchGeneration.current) { pendingSearch.current = false; setLoading(false); }
    }
  }, [type, query]);

  useFocusEffect(useCallback(() => {
    const generation = ++searchGeneration.current;
    loadedPage.current = 0; pendingSearch.current = true;
    setLoading(true); setError(""); setProperties([]); setHasMore(false); setLimitReached(false);
    const timer = setTimeout(() => { void loadPage(1, generation); }, 300);
    return () => { searchGeneration.current++; pendingSearch.current = false; clearTimeout(timer); };
  }, [loadPage]));

  const loadMore = () => {
    if (!pendingSearch.current) void loadPage(loadedPage.current + 1, searchGeneration.current);
  };

  const openProperty = useCallback((property: Property) => {
    router.push({ pathname: "/property/[id]", params: { id: property._id || property.id } });
  }, [router]);

  return <View style={styles.screen}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: AppTheme.colors.background }]} />
    <View style={[StyleSheet.absoluteFill, { top: 0, bottom: 0 }]}>
      <VerifiedPropertyMap properties={properties} onSelect={openProperty} focus={focus} />
    </View>
    
    <View style={[styles.topControls, { paddingTop: Math.max(insets.top, 20) }]}>
       <View style={styles.searchControls}>
         <ExpandableSearch value={query} onChangeText={setQuery} label="Search properties" placeholder="Search district or property" onOpen={() => { void locate(); }} onClose={() => { locationRequest.current++; setLocationNote(""); }} />
         <TouchableOpacity accessibilityRole="button" accessibilityLabel="Property filters" accessibilityState={{ expanded: showFilters }} onPress={() => setShowFilters(!showFilters)} style={styles.filterBtn}>
           <MaterialIcons name="tune" size={24} color={showFilters ? AppTheme.colors.primary : AppTheme.colors.textMuted} />
         </TouchableOpacity>
       </View>
       {!!locationNote && <Text accessibilityLiveRegion="polite" style={styles.locationNote}>{locationNote}</Text>}
       <View style={styles.filtersPanel}>
         <Text accessibilityLiveRegion="polite" style={styles.typeLabel}>{loading ? (properties.length ? "Loading more properties…" : "Loading properties…") : properties.length ? `${properties.length} properties shown` : error ? "Properties unavailable" : "No properties match your search"}</Text>
         {!!error && <Text accessibilityRole="alert" style={styles.typeLabel}>{error}</Text>}
         {!loading && (hasMore || !!error) && <TouchableOpacity accessibilityRole="button" style={styles.loadMoreButton} onPress={loadMore}>
           <Text style={styles.loadMoreLabel}>{error ? "Try again" : "Show more properties"}</Text>
         </TouchableOpacity>}
         {limitReached && <Text style={styles.typeLabel}>Narrow your search by district or property type to explore more.</Text>}
       </View>
       {showFilters && (
         <View style={styles.filtersPanelWrapper}>
           {Platform.OS !== "web" ? (
             <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
           ) : null}
           <View style={styles.filtersPanel}>
             <PropertyTypeTabs value={type} onChange={setType} />
           </View>
         </View>
       )}
    </View>
  </View>;
}

const styles = premiumStyles({
  screen: { flex: 1, backgroundColor: AppTheme.colors.background },
  topControls: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, width: "100%", maxWidth: 800, alignSelf: "center" },
  searchControls: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  filterBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "rgba(255,255,255,0.8)" },
  locationNote: { padding: 12, borderRadius: 16, marginBottom: 8, fontSize: 13, lineHeight: 19, color: AppTheme.colors.text, backgroundColor: "rgba(255,255,255,0.85)" },
  filtersPanelWrapper: { marginTop: 12, borderRadius: 24, overflow: "hidden", ...AppTheme.shadows.card },
  filtersPanel: { backgroundColor: Platform.OS === "web" ? AppTheme.colors.card : "rgba(255,255,255,0.7)", padding: 16, ...AppTheme.glass },
  loadMoreButton: { marginTop: 12, minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: AppTheme.colors.primary },
  loadMoreLabel: { color: "white", fontSize: 14, fontWeight: "600" },
  typeLabel: { fontSize: 13, fontWeight: "600", color: AppTheme.colors.textSecondary },
});
