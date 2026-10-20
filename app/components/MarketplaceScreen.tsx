import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import AppHeader from "./AppHeader";
import PropertyTypeTabs from "./PropertyTypeTabs";
import CitySkyline from "./CitySkyline";
import LocationSearchBar from "./LocationSearchBar";
import PremiumIndiaMap from "./PremiumIndiaMap";
import MapIntroOverlay from "./MapIntroOverlay";
import StateSelectorPanel from "./StateSelectorPanel";

import {
  fetchRegionCounts,
  cachedRegionCounts,
  fetchLocationSuggestions,
  type LocationSuggestion,
  type RegionGroup,
} from "../src/services/regionService";
import type { PropertyType } from "../src/types/property.types";
import type { MapFocus } from "../src/utils/nativeMapHtml";
import type { IndiaStateInfo } from "../src/data/indiaStatesData";
import { currentMapLocation } from "../src/services/currentMapLocation";
import { useResumeStore } from "../src/store/resumeStore";

export default function MarketplaceScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;

  // State management
  const savedSearch = useResumeStore.getState().search;
  const [state, setState] = useState<RegionGroup | undefined>(savedSearch.state);
  const [district, setDistrict] = useState<RegionGroup | undefined>(savedSearch.district);
  const [type, setType] = useState<PropertyType | undefined>(savedSearch.type);
  const [groups, setGroups] = useState<RegionGroup[]>([]);
  const [query, setQuery] = useState(savedSearch.query);
  const suggestionKey = JSON.stringify([query.trim(), type]);
  const [suggestionResult, setSuggestionResult] = useState<{ key: string; items: LocationSuggestion[]; error: boolean }>();
  const suggestions = suggestionResult?.key === suggestionKey ? suggestionResult.items : [];
  const suggesting = query.trim().length >= 2 && suggestionResult?.key !== suggestionKey;
  const suggestionError = !!(suggestionResult?.key === suggestionKey && suggestionResult.error);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [locating, setLocating] = useState(false);
  const [customFocus, setCustomFocus] = useState<MapFocus | undefined>(savedSearch.customFocus);
  useEffect(() => {
    useResumeStore.getState().setSearch({ state, district, type, query, customFocus });
  }, [state, district, type, query, customFocus]);

  const level = district ? "pincode" : state ? "district" : "state";

  // Total properties count aggregated from region groups
  const totalVerifiedCount = useMemo(() => {
    return groups.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }, [groups]);

  // Map of state name/code to counts for state panel
  const stateCounts = useMemo(() => {
    const map: Record<string, number> = {};
    if (level === "state") {
      groups.forEach((g) => {
        map[g.name] = g.count;
        map[g.key] = g.count;
      });
    }
    return map;
  }, [groups, level]);

  // Fetch region counts based on current state / district / type
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      let active = true;
      const filters = { state: state?.key, district: district?.key, type };
      const cached = cachedRegionCounts(filters);
      setLoading(!cached);
      setError("");
      setGroups(cached?.groups ?? []);

      fetchRegionCounts(filters, controller.signal)
        .then((data) => {
          if (active) setGroups(data.groups);
        })
        .catch(() => {
          if (active) setError(cached
            ? "Showing saved area counts. Could not refresh; please try again."
            : "Could not load area counts. Please try again.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
        controller.abort();
      };
    // Revision explicitly retries the same region query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state?.key, district?.key, type, revision])
  );

  // Ignore responses for superseded queries and property types.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      fetchLocationSuggestions(term, type, controller.signal)
        .then(items => { if (active) setSuggestionResult({ key: suggestionKey, items, error: false }); })
        .catch(() => { if (active) setSuggestionResult({ key: suggestionKey, items: [], error: true }); });
    }, 250);
    return () => { active = false;clearTimeout(timer);controller.abort(); };
  }, [query, type, suggestionKey]);

  // Calculated Map Focus
  const mapFocus = useMemo<MapFocus | undefined>(() => {
    if (customFocus) return customFocus;
    if (district) return { lat: district.lat, lng: district.lng, zoom: 10 };
    if (state) return { lat: state.lat, lng: state.lng, zoom: 7.2 };
    return undefined;
  }, [state, district, customFocus]);

  // Handle pincode navigation to listings
  const openPincode = useCallback(
    (selectedPincode: string, selectedState: string, selectedDistrict: string) => {
      setQuery("");
      setSuggestionResult(undefined);
      router.navigate({
        pathname: "/(tabs)/home",
        params: {
          state: selectedState,
          district: selectedDistrict,
          pincode: selectedPincode,
          type: type || "",
          query: "",
          address: "",
          min: "",
          max: "",
          areaSelection: String(Date.now()),
        },
      });
    },
    [router, type]
  );

  // Handle map region selection
  const handleSelectGroup = useCallback(
    (group: RegionGroup) => {
      setQuery("");
      setCustomFocus(undefined);
      if (!state) {
        setState(group);
      } else if (!district) {
        setDistrict(group);
      } else {
        openPincode(group.key, state.key, district.key);
      }
    },
    [state, district, openPincode]
  );

  // Handle state selection from state selector panel or state pin
  const handleSelectStateInfo = useCallback(
    (stateInfo: IndiaStateInfo) => {
      setQuery("");
      setDistrict(undefined);
      setCustomFocus({
        lat: stateInfo.lat,
        lng: stateInfo.lng,
        zoom: stateInfo.zoom || 7,
      });

      const matchedGroup = groups.find(
        (g) =>
          g.name.toLowerCase() === stateInfo.name.toLowerCase() ||
          g.key.toLowerCase() === stateInfo.name.toLowerCase()
      );

      if (matchedGroup) {
        setState(matchedGroup);
      } else {
        setState({
          key: stateInfo.name,
          name: stateInfo.name,
          count: 0,
          lat: stateInfo.lat,
          lng: stateInfo.lng,
        });
      }
    },
    [groups]
  );

  // Reset to All India view
  const handleClearSelection = useCallback(() => {
    setState(undefined);
    setDistrict(undefined);
    setQuery("");
    setCustomFocus(undefined);
  }, []);

  // Handle location suggestion selection
  const handleSelectSuggestion = useCallback(
    (item: LocationSuggestion) => {
      const term = query.trim();
      setQuery("");
      setSuggestionResult(undefined);
      setCustomFocus(undefined);

      const stateGroup: RegionGroup = {
        key: item.state,
        name: item.state,
        count: 0,
        lat: item.lat,
        lng: item.lng,
      };
      const districtGroup: RegionGroup = {
        key: item.district || "",
        name: item.district || "",
        count: 0,
        lat: item.lat,
        lng: item.lng,
      };

      if (item.kind === "state") {
        setState(stateGroup);
        setDistrict(undefined);
        return;
      }
      if (item.kind === "district") {
        setState(stateGroup);
        setDistrict(districtGroup);
        return;
      }
      if (item.kind === "pincode") {
        openPincode(item.pincode || "", item.state, item.district || "");
        return;
      }

      router.push({
        pathname: "/(tabs)/home",
        params: {
          address: term,
          state: "",
          district: "",
          pincode: "",
          type: type || "",
          query: "",
          min: "",
          max: "",
        },
      });
    },
    [query, router, type, openPincode]
  );

  // Execute general search
  const handleSearchAll = useCallback(() => {
    const term = query.trim();
    if (term.length < 2) return;
    setQuery("");
    setSuggestionResult(undefined);
    router.push({
      pathname: "/(tabs)/home",
      params: {
        address: term,
        state: "",
        district: "",
        pincode: "",
        type: type || "",
        query: "",
        min: "",
        max: "",
      },
    });
  }, [query, router, type]);

  // Current Geolocation GPS action
  const handleCurrentLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const point = await currentMapLocation();
      setCustomFocus({ lat: point.lat, lng: point.lng, zoom: 12 });
    } catch (e) {
      console.warn("Location lookup error:", e);
    } finally {
      setLocating(false);
    }
  }, [locating]);

  return (
    <View style={styles.screen}>
      {/* Brand Header */}
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentInner}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            {/* Introductory Eyebrow with Dash */}
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrow}>FIND YOUR PERFECT LOCATION</Text>
              <View style={styles.eyebrowDash} />
            </View>

            {/* Title Row with Skyline Graphic */}
            <View style={styles.titleRow}>
              <View style={styles.titleLeft}>
                <Text style={styles.mainTitle}>Find properties by area</Text>
                <Text style={styles.subTitle}>
                  Explore verified lands, plots, flats, and commercial properties across India.
                </Text>
              </View>

              {/* Skyline Backdrop Graphic on Desktop */}
              {width >= 768 && (
                <View style={styles.skylineWrap}>
                  <CitySkyline width={380} height={120} opacity={0.65} />
                </View>
              )}
            </View>

            {/* Property Category Pill Filters */}
            <PropertyTypeTabs value={type} onChange={setType} />

            {/* Premium Location Search Bar */}
            <LocationSearchBar
              query={query}
              onChangeQuery={setQuery}
              onSearch={handleSearchAll}
              suggestions={suggestions}
              suggesting={suggesting}
              suggestionError={suggestionError}
              onSelectSuggestion={handleSelectSuggestion}
              onCurrentLocation={handleCurrentLocation}
              locating={locating}
            />

            {/* Active Breadcrumbs Bar */}
            {(state || district) && (
              <View style={styles.breadcrumbsBar}>
                <MaterialIcons name="navigation" size={16} color="#075D91" style={{ marginRight: 6 }} />
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleClearSelection}
                  style={styles.crumbBtn}
                >
                  <Text style={styles.crumbLink}>All India</Text>
                </TouchableOpacity>

                {state && (
                  <>
                    <Text style={styles.crumbDivider}>›</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => {
                        setDistrict(undefined);
                        setCustomFocus({ lat: state.lat, lng: state.lng, zoom: 7.2 });
                      }}
                      style={styles.crumbBtn}
                    >
                      <Text style={[styles.crumbLink, !district && styles.crumbCurrent]}>
                        {state.name}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {district && (
                  <>
                    <Text style={styles.crumbDivider}>›</Text>
                    <Text style={[styles.crumbLink, styles.crumbCurrent]}>
                      {district.name}
                    </Text>
                  </>
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleClearSelection}
                  style={styles.resetCrumbBtn}
                >
                  <MaterialIcons name="close" size={14} color="#075D91" />
                  <Text style={styles.resetCrumbText}>Reset</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading / Error Indicators */}
            {loading && (
              <View style={styles.statusBanner}>
                <ActivityIndicator size="small" color="#075D91" />
                <Text style={styles.statusBannerText}>Loading region verified counts…</Text>
              </View>
            )}

            {!!error && (
              <View style={[styles.statusBanner, styles.errorBanner]}>
                <MaterialIcons name="error-outline" size={16} color="#B91C1C" />
                <Text style={styles.errorBannerText}>{error}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setRevision((v) => v + 1)}
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Main Map & State Selector Area */}
          {isDesktop ? (
            /* Desktop Unified Panoramic Map Container */
            <View style={styles.mapCardDesktop}>
              {/* Full Interactive Leaflet India Map */}
              <PremiumIndiaMap
                groups={loading ? [] : groups}
                level={level}
                state={state?.key}
                focus={mapFocus}
                onSelectGroup={handleSelectGroup}
                onSelectStateInfo={handleSelectStateInfo}
              />

              {/* Left-Side Dark Translucent Introduction Overlay */}
              <View style={styles.leftOverlayWrap} pointerEvents="box-none">
                <MapIntroOverlay
                  totalCount={totalVerifiedCount}
                  activeStateName={state?.name}
                />
              </View>

              {/* Right-Side Floating All States Panel */}
              <View style={styles.rightPanelWrap} pointerEvents="box-none">
                <StateSelectorPanel
                  selectedState={state?.name}
                  onSelectState={handleSelectStateInfo}
                  onClearState={handleClearSelection}
                  stateCounts={stateCounts}
                />
              </View>
            </View>
          ) : (
            /* Mobile & Tablet Responsive Stacked Presentation */
            <View style={styles.mapSectionMobile}>
              {/* Interactive Map Box */}
              <View style={styles.mapCardMobile}>
                <PremiumIndiaMap
                  groups={loading ? [] : groups}
                  level={level}
                  state={state?.key}
                  focus={mapFocus}
                  onSelectGroup={handleSelectGroup}
                  onSelectStateInfo={handleSelectStateInfo}
                />
              </View>

              {/* Mobile Intro Overview Card */}
              <View style={styles.mobileIntroCard}>
                <MapIntroOverlay
                  totalCount={totalVerifiedCount}
                  activeStateName={state?.name}
                />
              </View>

              {/* Mobile All States Panel */}
              <View style={styles.mobileStatesCard}>
                <StateSelectorPanel
                  selectedState={state?.name}
                  onSelectState={handleSelectStateInfo}
                  onClearState={handleClearSelection}
                  stateCounts={stateCounts}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingBottom: 140,
  },
  contentInner: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  heroSection: {
    marginBottom: 20,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#075D91",
    letterSpacing: 1.5,
  },
  eyebrowDash: {
    width: 36,
    height: 2,
    backgroundColor: "#075D91",
    borderRadius: 1,
    opacity: 0.8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    position: "relative",
    marginBottom: 10,
  },
  titleLeft: {
    flex: 1,
    zIndex: 2,
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#102B52",
    letterSpacing: -0.6,
  },
  subTitle: {
    fontSize: 14,
    color: "#64809E",
    fontWeight: "500",
    marginTop: 4,
    lineHeight: 20,
  },
  skylineWrap: {
    position: "absolute",
    right: 0,
    bottom: -10,
    zIndex: 1,
    pointerEvents: "none",
  },
  breadcrumbsBar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#D9E7F3",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(7, 93, 145, 0.06)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  crumbBtn: {
    paddingVertical: 2,
  },
  crumbLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#075D91",
  },
  crumbCurrent: {
    color: "#102B52",
    fontWeight: "700",
  },
  crumbDivider: {
    fontSize: 14,
    color: "#94A3B8",
    marginHorizontal: 8,
  },
  resetCrumbBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#EEF7FE",
  },
  resetCrumbText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#075D91",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EEF7FE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  statusBannerText: {
    fontSize: 12,
    color: "#075D91",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorBannerText: {
    fontSize: 12,
    color: "#B91C1C",
    fontWeight: "500",
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B91C1C",
  },

  /* Desktop Map Section */
  mapCardDesktop: {
    width: "100%",
    height: 640,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#EEF7FE",
    ...Platform.select({
      web: {
        boxShadow: "0 16px 44px rgba(16, 43, 82, 0.14)",
      },
      default: {
        shadowColor: "#102B52",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
      },
    }),
  },
  leftOverlayWrap: {
    position: "absolute",
    top: 24,
    left: 24,
    zIndex: 300,
  },
  rightPanelWrap: {
    position: "absolute",
    top: 24,
    right: 24,
    bottom: 24,
    zIndex: 300,
    display: "flex",
    justifyContent: "flex-start",
  },

  /* Mobile Map Section */
  mapSectionMobile: {
    gap: 18,
  },
  mapCardMobile: {
    width: "100%",
    height: 420,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#D9E7F3",
    overflow: "hidden",
    backgroundColor: "#EEF7FE",
    ...Platform.select({
      web: {
        boxShadow: "0 8px 24px rgba(16, 43, 82, 0.1)",
      },
      default: {
        elevation: 4,
      },
    }),
  },
  mobileIntroCard: {
    width: "100%",
  },
  mobileStatesCard: {
    width: "100%",
  },
});
