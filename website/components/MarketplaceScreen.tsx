import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

import AppHeader from "./AppHeader";
import PropertyTypeTabs from "./PropertyTypeTabs";
import CitySkyline from "./CitySkyline";
import LocationSearchBar from "./LocationSearchBar";
import PremiumIndiaMap from "./PremiumIndiaMap";
import BiharLandIntelligenceCard from "./BiharLandIntelligenceCard";
import BiharDistrictExplorerPanel from "./BiharDistrictExplorerPanel";
import WebFooter from "./WebFooter";
import PropertyCard from "./PropertyCard";
import type { BiharDistrictInfo } from "../src/data/biharDistrictsData";

import {
  fetchRegionCounts,
  fetchLocationSuggestions,
  type LocationSuggestion,
  type RegionGroup,
} from "../src/services/regionService";
import { propertyService } from "../src/services/propertyService";
import type { Property, PropertyType } from "../src/types/property.types";
import type { MapFocus } from "../src/utils/nativeMapHtml";
import type { IndiaStateInfo } from "../src/data/indiaStatesData";
import { currentMapLocation } from "../src/services/currentMapLocation";
import { geocodePlaceId } from "../src/utils/googleMaps";

export interface GrowthCorridor {
  id: string;
  name: string;
  tag: string;
  district: string;
  subDistrict: string;
  description: string;
  priceRange: string;
  growth: string;
  lat: number;
  lng: number;
  zoom: number;
  icon: keyof typeof MaterialIcons.glyphMap;
}

export const BIHAR_CORRIDORS: GrowthCorridor[] = [
  {
    id: "patna_bihta",
    name: "Patna – Bihta Airport Corridor",
    tag: "HIGH APPRECIATION",
    district: "Patna",
    subDistrict: "Bihta / Danapur",
    description: "Mega civil airport expansion, IIT Patna campus, IT SEZ, and direct elevated 4-lane expressway connecting AIIMS.",
    priceRange: "₹2,400 - ₹5,800 / sq.ft",
    growth: "+34% Annual",
    lat: 25.5688,
    lng: 84.8694,
    zoom: 12,
    icon: "flight-takeoff",
  },
  {
    id: "patna_kanhauli",
    name: "Greater Patna – Kanhauli & AIIMS Hub",
    tag: "RESIDENTIAL PLOTTING",
    district: "Patna",
    subDistrict: "Kanhauli / Naubatpur",
    description: "Interstate Ring Road junction, ISBT connector, and high-demand master-planned gated residential townships.",
    priceRange: "₹1,800 - ₹3,600 / sq.ft",
    growth: "+28% Annual",
    lat: 25.52,
    lng: 85.04,
    zoom: 12,
    icon: "home-work",
  },
  {
    id: "muzaffarpur_nh",
    name: "Muzaffarpur – Motipur Industrial Corridor",
    tag: "COMMERCIAL & LOGISTICS",
    district: "Muzaffarpur",
    subDistrict: "Motipur / Bairia NH-28",
    description: "North Bihar commercial capital, Mega Food Park, East-West corridor logistics belt, and smart city infrastructure.",
    priceRange: "₹1,400 - ₹3,200 / sq.ft",
    growth: "+22% Annual",
    lat: 26.1209,
    lng: 85.3647,
    zoom: 12,
    icon: "store",
  },
  {
    id: "gaya_dobhi",
    name: "Gaya – Bodh Gaya Industrial & Tourism Belt",
    tag: "HERITAGE & AKIC NODE",
    district: "Gaya",
    subDistrict: "Bodh Gaya / Dobhi",
    description: "Amritsar-Kolkata Industrial Corridor (AKIC Node), international spiritual tourism hotspot, and GT Road corridor.",
    priceRange: "₹1,200 - ₹2,900 / sq.ft",
    growth: "+26% Annual",
    lat: 24.6961,
    lng: 84.9869,
    zoom: 12,
    icon: "business",
  },
  {
    id: "darbhanga_airport",
    name: "Darbhanga – Airport & AIIMS Healthcare Node",
    tag: "AIRPORT EXPANSION",
    district: "Darbhanga",
    subDistrict: "Mabbi / NH-57 Bypass",
    description: "Mithila region aviation gateway with highest regional passenger traffic, 2nd AIIMS of Bihar, and medical estates.",
    priceRange: "₹1,600 - ₹3,500 / sq.ft",
    growth: "+25% Annual",
    lat: 26.1542,
    lng: 85.8918,
    zoom: 12,
    icon: "local-hospital",
  },
  {
    id: "vaishali_hajipur",
    name: "Vaishali – Hajipur Paswan Chowk Twin-City",
    tag: "TWIN-CITY EXPRESSWAY",
    district: "Vaishali",
    subDistrict: "Hajipur / Bidupur",
    description: "Direct 6-lane JP Setu & Kacchi Dargah bridge access to Patna. Industrial warehousing and prime residential plotting.",
    priceRange: "₹1,500 - ₹3,400 / sq.ft",
    growth: "+24% Annual",
    lat: 25.6858,
    lng: 85.2146,
    zoom: 12,
    icon: "directions-car",
  },
];

export default function MarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;

  // Scroll ref for smooth navigation
  const scrollViewRef = useRef<ScrollView>(null);

  // State management - Initialized directly to Bihar focus
  const [state, setState] = useState<RegionGroup | undefined>({
    key: "Bihar",
    name: "Bihar",
    count: 14,
    lat: 25.65,
    lng: 85.35,
  });
  const [district, setDistrict] = useState<RegionGroup | undefined>();
  const [type, setType] = useState<PropertyType | undefined>();
  const [groups, setGroups] = useState<RegionGroup[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [locating, setLocating] = useState(false);
  const [customFocus, setCustomFocus] = useState<MapFocus | undefined>();

  const level = district ? "pincode" : state ? "district" : "state";

  // Total properties count aggregated from region groups
  const totalVerifiedCount = useMemo(() => {
    return groups.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }, [groups]);

  // Map of Bihar district names to counts for the Bihar District Explorer Panel
  const districtCounts = useMemo(() => {
    const map: Record<string, number> = {
      Patna: 10,
      Muzaffarpur: 1,
      Gaya: 1,
      Darbhanga: 1,
      Vaishali: 1,
    };
    groups.forEach((g) => {
      map[g.name] = g.count;
      map[g.key] = g.count;
    });
    return map;
  }, [groups]);

  // Fetch region counts based on current state / district / type
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      let active = true;
      setLoading(true);
      setError("");
      setGroups([]);

      fetchRegionCounts({ state: state?.key, district: district?.key, type }, controller.signal)
        .then((data) => {
          if (active) setGroups(data.groups);
        })
        .catch(() => {
          if (active) setError("Could not load area counts. Please try again.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
        controller.abort();
      };
    }, [state?.key, district?.key, type, revision])
  );

  // Autocomplete suggestions debounce
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setSuggesting(false);
      setSuggestionError(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setSuggesting(true);
    setSuggestionError(false);

    const timer = setTimeout(() => {
      fetchLocationSuggestions(term, type, controller.signal)
        .then((data) => {
          if (active) setSuggestions(data);
        })
        .catch(() => {
          if (active) setSuggestionError(true);
        })
        .finally(() => {
          if (active) setSuggesting(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, type]);

  // Calculated Map Focus - Focused on Bihar
  const mapFocus = useMemo<MapFocus | undefined>(() => {
    if (customFocus) return customFocus;
    if (district) return { lat: district.lat, lng: district.lng, zoom: 11.5 };
    if (state) return { lat: state.lat, lng: state.lng, zoom: 7.5 };
    return { lat: 25.65, lng: 85.35, zoom: 7.5 };
  }, [state, district, customFocus]);

  // Handle pincode navigation to listings
  const openPincode = useCallback(
    (selectedPincode: string, selectedState: string, selectedDistrict: string) => {
      setQuery("");
      setSuggestions([]);
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

  // Handle district selection from BiharDistrictExplorerPanel
  const handleSelectDistrictInfo = useCallback(
    (districtInfo: BiharDistrictInfo) => {
      setQuery("");
      setState({
        key: "Bihar",
        name: "Bihar",
        count: 14,
        lat: 25.65,
        lng: 85.35,
      });
      setDistrict({
        key: districtInfo.name,
        name: districtInfo.name,
        count: districtCounts[districtInfo.name] || 0,
        lat: districtInfo.lat,
        lng: districtInfo.lng,
      });
      setCustomFocus({
        lat: districtInfo.lat,
        lng: districtInfo.lng,
        zoom: districtInfo.zoom || 11.5,
      });
    },
    [districtCounts]
  );

  // Handle quick corridor selection from BiharLandIntelligenceCard
  const handleSelectQuickHub = useCallback(
    (districtName: string, lat: number, lng: number, zoom: number) => {
      setQuery("");
      setState({
        key: "Bihar",
        name: "Bihar",
        count: 14,
        lat: 25.65,
        lng: 85.35,
      });
      setDistrict({
        key: districtName,
        name: districtName,
        count: districtCounts[districtName] || 0,
        lat,
        lng,
      });
      setCustomFocus({ lat, lng, zoom });
    },
    [districtCounts]
  );

  // Reset to All Bihar view
  const handleClearSelection = useCallback(() => {
    setState({
      key: "Bihar",
      name: "Bihar",
      count: 14,
      lat: 25.65,
      lng: 85.35,
    });
    setDistrict(undefined);
    setQuery("");
    setCustomFocus({ lat: 25.65, lng: 85.35, zoom: 7.5 });
  }, []);

  // Handle location suggestion selection
  const handleSelectSuggestion = useCallback(
    (item: LocationSuggestion) => {
      const term = query.trim();
      setQuery("");
      setSuggestions([]);
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

      if (item.placeId) {
        geocodePlaceId(item.placeId).then((geo) => {
          if (geo) {
            setCustomFocus({ lat: geo.lat, lng: geo.lng, zoom: 14 });
          }
        });
      }

      router.push({
        pathname: "/(tabs)/home",
        params: {
          address: item.label || term,
          state: item.state !== "India" ? item.state : "",
          district: item.district || "",
          pincode: item.pincode || "",
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
    setSuggestions([]);
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

  // Corridor and Property state
  const [selectedCorridorId, setSelectedCorridorId] = useState<string | null>(null);
  const [verifiedProperties, setVerifiedProperties] = useState<Property[]>([]);
  const [allStateProperties, setAllStateProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);

  // Fetch all verified properties for active state (to compute corridor metrics from live DB)
  useEffect(() => {
    let active = true;
    const targetState = state?.name || "Bihar";
    propertyService
      .searchProperties({ state: targetState, limit: 50 })
      .then((results) => {
        if (active) setAllStateProperties(results || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [state?.name, revision]);

  // Fetch verified properties based on current state / district / type
  useEffect(() => {
    let active = true;
    setPropertiesLoading(true);

    const targetState = state?.name || "Bihar";
    const filters: any = {
      state: targetState,
    };
    if (district?.name) filters.district = district.name;
    if (type) filters.type = type;

    propertyService
      .searchProperties(filters)
      .then((results) => {
        if (active) {
          setVerifiedProperties(results || []);
        }
      })
      .catch((err) => {
        console.warn("Could not load verified properties for explore:", err);
        if (active) setVerifiedProperties([]);
      })
      .finally(() => {
        if (active) setPropertiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [state?.name, district?.name, type]);

  // Dynamic growth corridors synchronized with live database properties & region counts
  const dynamicCorridors = useMemo(() => {
    return BIHAR_CORRIDORS.map((c) => {
      const matched = allStateProperties.filter((p) => {
        const matchesDistrict = p.location?.district?.toLowerCase() === c.district.toLowerCase();
        if (!matchesDistrict) return false;
        if (c.district.toLowerCase() !== "patna") return true;
        const loc = `${p.location?.block || ""} ${p.location?.mauza || ""} ${p.title || ""}`.toLowerCase();
        if (c.id === "patna_bihta") return loc.includes("bihta");
        if (c.id === "patna_kanhauli") return loc.includes("kanhauli") || loc.includes("naubatpur") || loc.includes("aiims");
        return true;
      });

      const rates = matched
        .map((p) => (p.sellableArea || p.totalArea ? Math.round(p.price / (p.sellableArea || p.totalArea || 1)) : 0))
        .filter((r) => r > 0);

      const dynamicPriceRange =
        rates.length > 1
          ? `₹${Math.min(...rates).toLocaleString("en-IN")} - ₹${Math.max(...rates).toLocaleString("en-IN")} / sq.ft`
          : rates.length === 1
          ? `₹${rates[0].toLocaleString("en-IN")} / sq.ft`
          : c.priceRange;

      return {
        ...c,
        priceRange: dynamicPriceRange,
        verifiedCount: matched.length,
      };
    });
  }, [allStateProperties]);

  // Corridor focus handler
  const handleSelectCorridor = useCallback((corridor: typeof dynamicCorridors[0]) => {
    setSelectedCorridorId(corridor.id);
    setQuery("");
    setSuggestions([]);

    setState({
      key: "Bihar",
      name: "Bihar",
      count: 0,
      lat: 25.6,
      lng: 85.1,
    });
    setDistrict({
      key: corridor.district,
      name: corridor.district,
      count: 0,
      lat: corridor.lat,
      lng: corridor.lng,
    });
    setCustomFocus({
      lat: corridor.lat,
      lng: corridor.lng,
      zoom: corridor.zoom,
    });

    scrollViewRef.current?.scrollTo({ y: 220, animated: true });
  }, []);

  return (
    <View style={styles.screen}>
      {/* Brand Header */}
      <AppHeader />

      <ScrollView
        ref={scrollViewRef}
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
                <Text style={styles.mainTitle}>Find properties in Bihar</Text>
                <Text style={styles.subTitle}>
                  Explore verified lands, plots, commercial corridors, and residential estates across Bihar.
                </Text>
              </View>

              {/* Skyline Backdrop Graphic on Desktop */}
              {width >= 768 && (
                <View style={styles.skylineWrap}>
                  <CitySkyline width={width < 1100 ? 460 : 560} height={155} opacity={0.92} />
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
                <MaterialIcons name="navigation" size={16} color="#03456C" style={{ marginRight: 6 }} />
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
                  <MaterialIcons name="close" size={14} color="#03456C" />
                  <Text style={styles.resetCrumbText}>Reset</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading / Error Indicators */}
            {loading && (
              <View style={styles.statusBanner}>
                <ActivityIndicator size="small" color="#03456C" />
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
                groups={loading || error ? [] : groups}
                level={level}
                state={state?.key}
                focus={mapFocus}
                onSelectGroup={handleSelectGroup}
                onSelectStateInfo={handleSelectDistrictInfo as any}
              />

              {/* Left-Side Bihar Land Intelligence Overlay */}
              <View style={styles.leftOverlayWrap} pointerEvents="box-none">
                <BiharLandIntelligenceCard
                  totalCount={allStateProperties.length || totalVerifiedCount || 14}
                  activeDistrictName={district?.name}
                  onSelectQuickHub={handleSelectQuickHub}
                  onResetView={handleClearSelection}
                />
              </View>

              {/* Right-Side Floating Bihar Key Districts Panel */}
              <View style={styles.rightPanelWrap} pointerEvents="box-none">
                <BiharDistrictExplorerPanel
                  selectedDistrict={district?.name}
                  onSelectDistrict={handleSelectDistrictInfo}
                  onClearDistrict={handleClearSelection}
                  districtCounts={districtCounts}
                />
              </View>
            </View>
          ) : (
            /* Mobile & Tablet Responsive Stacked Presentation */
            <View style={styles.mapSectionMobile}>
              {/* Interactive Map Box */}
              <View style={styles.mapCardMobile}>
                <PremiumIndiaMap
                  groups={loading || error ? [] : groups}
                  level={level}
                  state={state?.key}
                  focus={mapFocus}
                  onSelectGroup={handleSelectGroup}
                  onSelectStateInfo={handleSelectDistrictInfo as any}
                />
              </View>

              {/* Mobile Bihar Land Intelligence Overview Card */}
              <View style={styles.mobileIntroCard}>
                <BiharLandIntelligenceCard
                  totalCount={allStateProperties.length || totalVerifiedCount || 14}
                  activeDistrictName={district?.name}
                  onSelectQuickHub={handleSelectQuickHub}
                  onResetView={handleClearSelection}
                />
              </View>

              {/* Mobile Bihar Key Districts Panel */}
              <View style={styles.mobileStatesCard}>
                <BiharDistrictExplorerPanel
                  selectedDistrict={district?.name}
                  onSelectDistrict={handleSelectDistrictInfo}
                  onClearDistrict={handleClearSelection}
                  districtCounts={districtCounts}
                />
              </View>
            </View>
          )}

          {/* Curated High-Growth Investment Corridors */}
          <View style={styles.corridorsSection}>
            <View style={styles.corridorsHeaderRow}>
              <View style={styles.corridorsTitleCol}>
                <View style={styles.eyebrowRow}>
                  <Text style={styles.eyebrow}>INVESTMENT HOTSPOTS</Text>
                  <View style={styles.eyebrowDash} />
                </View>
                <Text style={styles.sectionHeading}>
                  Curated High-Growth Corridors in Bihar
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Select any high-potential growth belt to inspect on the satellite map, review connectivity nodes, and browse surveyor-verified plots.
                </Text>
              </View>
            </View>

            <View style={styles.corridorsGrid}>
              {dynamicCorridors.map((corridor) => {
                const isSelected = selectedCorridorId === corridor.id;
                return (
                  <TouchableOpacity
                    key={corridor.id}
                    style={[
                      styles.corridorCard,
                      { width: isDesktop ? "31.8%" : width >= 680 ? "48.5%" : "100%" },
                      isSelected && styles.corridorCardSelected,
                    ]}
                    onPress={() => handleSelectCorridor(corridor)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.corridorTopRow}>
                      <View style={styles.corridorTagBadge}>
                        <Text style={styles.corridorTagText}>{corridor.tag}</Text>
                      </View>
                      <View style={styles.corridorGrowthBadge}>
                        <MaterialIcons name="verified" size={13} color="#059669" />
                        <Text style={styles.corridorGrowthText}>
                          {corridor.verifiedCount > 0
                            ? `${corridor.verifiedCount} Verified Listing${corridor.verifiedCount === 1 ? "" : "s"}`
                            : "Expanding Soon"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.corridorTitleRow}>
                      <View style={styles.corridorIconBox}>
                        <MaterialIcons name={corridor.icon} size={20} color="#03456C" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.corridorName} numberOfLines={1}>
                          {corridor.name}
                        </Text>
                        <View style={styles.corridorLocRow}>
                          <MaterialIcons name="place" size={13} color="#64748B" />
                          <Text style={styles.corridorLocText}>{corridor.subDistrict}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.corridorDesc} numberOfLines={2}>
                      {corridor.description}
                    </Text>

                    <View style={styles.corridorDivider} />

                    <View style={styles.corridorFooter}>
                      <View>
                        <Text style={styles.corridorPriceLabel}>Est. Land Benchmark</Text>
                        <Text style={styles.corridorPriceVal}>{corridor.priceRange}</Text>
                      </View>
                      <View style={[styles.corridorActionBtn, isSelected && styles.corridorActionBtnActive]}>
                        <Text style={[styles.corridorActionText, isSelected && styles.corridorActionTextActive]}>
                          {isSelected ? "Focused" : "View Map"}
                        </Text>
                        <MaterialIcons
                          name={isSelected ? "my-location" : "arrow-forward"}
                          size={13}
                          color={isSelected ? "#FFFFFF" : "#03456C"}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Trending Verified Properties */}
          <View style={styles.trendingSection}>
            <View style={styles.trendingHeaderRow}>
              <View style={styles.trendingTitleCol}>
                <View style={styles.eyebrowRow}>
                  <Text style={styles.eyebrow}>LIVE VERIFIED INVENTORY</Text>
                  <View style={styles.eyebrowDash} />
                </View>
                <Text style={styles.sectionHeading}>
                  {district
                    ? `Verified Properties in ${district.name}`
                    : state
                    ? `Verified Properties in ${state.name}`
                    : "Trending Verified Properties in Bihar"}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Surveyor-demarcated plots, commercial land, and vetted residential properties with certified Khatiyan clearance.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.browseAllLinkBtn}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/home",
                    params: {
                      state: state?.name || "Bihar",
                      district: district?.name || "",
                      type: type || "",
                    },
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.browseAllLinkText}>View All in Directory</Text>
                <MaterialIcons name="arrow-forward" size={15} color="#03456C" />
              </TouchableOpacity>
            </View>

            {propertiesLoading ? (
              <View style={styles.propertiesLoadingBox}>
                <ActivityIndicator size="small" color="#03456C" />
                <Text style={styles.propertiesLoadingText}>Loading certified property listings…</Text>
              </View>
            ) : verifiedProperties.length > 0 ? (
              <View style={styles.propertiesGrid}>
                {verifiedProperties.slice(0, 6).map((property, idx) => (
                  <View
                    key={property.id || property._id || String(idx)}
                    style={{ width: isDesktop ? "31.8%" : width >= 680 ? "48.5%" : "100%" }}
                  >
                    <PropertyCard property={property} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyPropertiesBox}>
                <MaterialIcons name="landscape" size={38} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No verified listings found matching this exact filter</Text>
                <Text style={styles.emptySub}>
                  Our land surveyors are adding new Khatiyan-verified plots weekly across Bihar. Browse all live listings on MalikSe Home.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBrowseBtn}
                  onPress={() => router.push("/(tabs)/home")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyBrowseText}>Browse All Verified Properties</Text>
                  <MaterialIcons name="arrow-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Institutional Land Revenue & MVR Knowledge Guide */}
          <View style={styles.knowledgeSection}>
            <View style={styles.knowledgeHeader}>
              <View style={styles.eyebrowRow}>
                <Text style={styles.eyebrow}>TRANSPARENCY & DUE DILIGENCE</Text>
                <View style={styles.eyebrowDash} />
              </View>
              <Text style={styles.sectionHeading}>
                Institutional Land Verification Standard in Bihar
              </Text>
              <Text style={styles.sectionSubtitle}>
                Purchasing land without institutional title checks leads to boundary disputes. Here is how MalikSe protects every transaction.
              </Text>
            </View>

            <View style={styles.knowledgeGrid}>
              {/* Card 1: Circle Rate / MVR */}
              <View
                style={[
                  styles.knowledgeCard,
                  { width: isDesktop ? "31.8%" : "100%" },
                ]}
              >
                <View style={styles.knowledgeIconCircle}>
                  <MaterialIcons name="account-balance" size={24} color="#03456C" />
                </View>
                <View style={styles.knowledgeTagBadge}>
                  <Text style={styles.knowledgeTagText}>GOVERNMENT BENCHMARK</Text>
                </View>
                <Text style={styles.knowledgeCardTitle}>Minimum Value Register (MVR)</Text>
                <Text style={styles.knowledgeCardDesc}>
                  Bihar government official Circle Rates dictate minimum registry valuation and stamp duty. MalikSe lists official MVR benchmarks alongside asking rates to protect you against arbitrary market pricing.
                </Text>
                <View style={styles.knowledgeDivider} />
                <View style={styles.knowledgeFeatureRow}>
                  <MaterialIcons name="check-circle" size={15} color="#059669" />
                  <Text style={styles.knowledgeFeatureText}>Circle Rates for all 38 Bihar Districts</Text>
                </View>
                <View style={styles.knowledgeFeatureRow}>
                  <MaterialIcons name="check-circle" size={15} color="#059669" />
                  <Text style={styles.knowledgeFeatureText}>Accurate Stamp Duty & Registry Estimates</Text>
                </View>
              </View>

              {/* Card 2: Jamabandi & Mutation */}
              <View
                style={[
                  styles.knowledgeCard,
                  { width: isDesktop ? "31.8%" : "100%" },
                ]}
              >
                <View style={styles.knowledgeIconCircle}>
                  <MaterialIcons name="verified-user" size={24} color="#0284C7" />
                </View>
                <View style={[styles.knowledgeTagBadge, { backgroundColor: "#E0F2FE" }]}>
                  <Text style={[styles.knowledgeTagText, { color: "#03456C" }]}>PEDIGREE & CLEARANCE</Text>
                </View>
                <Text style={styles.knowledgeCardTitle}>Jamabandi & Dakhil-Kharij Audit</Text>
                <Text style={styles.knowledgeCardDesc}>
                  Every parcel is cross-verified on the Bihar Bhumi Revenue Portal. We audit Khatiyan chain-of-title, active mutation (Dakhil-Kharij) clearance, and up-to-date Land Possession Certificate (LPC) receipts.
                </Text>
                <View style={styles.knowledgeDivider} />
                <View style={styles.knowledgeFeatureRow}>
                  <MaterialIcons name="check-circle" size={15} color="#059669" />
                  <Text style={styles.knowledgeFeatureText}>100% Chain-of-Title Pedigree Check</Text>
                </View>
                <View style={styles.knowledgeFeatureRow}>
                  <MaterialIcons name="check-circle" size={15} color="#059669" />
                  <Text style={styles.knowledgeFeatureText}>Dispute-Free Revenue Portal Verification</Text>
                </View>
              </View>

              {/* Card 3: DGPS Demarcation */}
              <View
                style={[
                  styles.knowledgeCard,
                  { width: isDesktop ? "31.8%" : "100%" },
                ]}
              >
                <View style={styles.knowledgeIconCircle}>
                  <MaterialIcons name="satellite-alt" size={24} color="#059669" />
                </View>
                <View style={[styles.knowledgeTagBadge, { backgroundColor: "#D1FAE5" }]}>
                  <Text style={[styles.knowledgeTagText, { color: "#065F46" }]}>PHYSICAL ACCURACY</Text>
                </View>
                <Text style={styles.knowledgeCardTitle}>DGPS & Bhu-Naksha Demarcation</Text>
                <Text style={styles.knowledgeCardDesc}>
                  Physical plot corners are mapped by certified surveyors using Electronic Total Stations (ETS) and Bhu-Naksha revenue maps. Corner pillars are geo-tagged with exact GPS latitude and longitude coordinates.
                </Text>
                <View style={styles.knowledgeDivider} />
                <View style={styles.knowledgeFeatureRow}>
                  <MaterialIcons name="check-circle" size={15} color="#059669" />
                  <Text style={styles.knowledgeFeatureText}>Sub-Centimeter Corner Pillar Demarcation</Text>
                </View>
                <View style={styles.knowledgeFeatureRow}>
                  <MaterialIcons name="check-circle" size={15} color="#059669" />
                  <Text style={styles.knowledgeFeatureText}>Geo-Tagged High-Resolution Satellite Map</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Regional Quick Jump & Verification Callout */}
          <View style={styles.quickJumpSection}>
            <View style={styles.quickJumpCard}>
              <View style={styles.quickJumpLeft}>
                <View style={styles.quickJumpIconCircle}>
                  <MaterialIcons name="share-location" size={22} color="#0284C7" />
                </View>
                <View style={{ flex: 1, minWidth: 260 }}>
                  <Text style={styles.quickJumpTitle}>
                    Looking for Demarcated Land in Bihar?
                  </Text>
                  <Text style={styles.quickJumpSub}>
                    Explore verified Khatiyan-cleared plots across Patna, Bihta, Danapur, Muzaffarpur and Gaya with surveyor-certified coordinates.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.quickJumpBtn}
                onPress={() => router.push("/home")}
                activeOpacity={0.85}
              >
                <Text style={styles.quickJumpBtnText}>Browse Available Land</Text>
                <MaterialIcons name="arrow-forward" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Global Website Footer */}
        <WebFooter />
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
    paddingBottom: 0,
    flexGrow: 1,
  },
  contentInner: {
    width: "100%",
    maxWidth: 1340,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
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
    fontSize: 11,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 1.2,
  },
  eyebrowDash: {
    width: 32,
    height: 2,
    backgroundColor: "#0284C7",
    borderRadius: 1,
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
    fontSize: 32,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.6,
  },
  subTitle: {
    fontSize: 14,
    color: "#64748B",
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
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(10, 25, 47, 0.04)",
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
    color: "#03456C",
  },
  crumbCurrent: {
    color: "#0A192F",
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
    backgroundColor: "#E0F2FE",
  },
  resetCrumbText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03456C",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  statusBannerText: {
    fontSize: 12,
    color: "#03456C",
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
    height: 660,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 30px -5px rgba(10, 25, 47, 0.08)",
      },
      default: {
        shadowColor: "#0A192F",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
      },
    }),
  },
  leftOverlayWrap: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 300,
  },
  rightPanelWrap: {
    position: "absolute",
    top: 20,
    right: 20,
    bottom: 20,
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
    height: 440,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
    ...Platform.select({
      web: {
        boxShadow: "0 8px 24px rgba(10, 25, 47, 0.06)",
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

  /* Common Section Headers */
  sectionHeading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 13.5,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 20,
    fontWeight: "500",
  },

  /* Curated High-Growth Corridors */
  corridorsSection: {
    marginTop: 36,
    marginBottom: 8,
  },
  corridorsHeaderRow: {
    marginBottom: 18,
  },
  corridorsTitleCol: {
    flex: 1,
  },
  corridorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  corridorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    justifyContent: "space-between",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 25, 47, 0.04)",
        cursor: "pointer",
        transition: "transform 0.2s ease, border-color 0.2s ease",
      },
    }),
  },
  corridorCardSelected: {
    borderColor: "#0284C7",
    borderWidth: 1.5,
    backgroundColor: "#F0F9FF",
  },
  corridorTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  corridorTagBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  corridorTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#03456C",
    letterSpacing: 0.6,
  },
  corridorGrowthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  corridorGrowthText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  corridorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  corridorIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    justifyContent: "center",
    alignItems: "center",
  },
  corridorName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0A192F",
  },
  corridorLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  corridorLocText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  corridorDesc: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 17,
    marginBottom: 14,
  },
  corridorDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },
  corridorFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  corridorPriceLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  corridorPriceVal: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#03456C",
    marginTop: 2,
  },
  corridorActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#E0F2FE",
  },
  corridorActionBtnActive: {
    backgroundColor: "#03456C",
  },
  corridorActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03456C",
  },
  corridorActionTextActive: {
    color: "#FFFFFF",
  },

  /* Trending Verified Properties */
  trendingSection: {
    marginTop: 36,
    marginBottom: 8,
  },
  trendingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 18,
  },
  trendingTitleCol: {
    flex: 1,
    minWidth: 260,
  },
  browseAllLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  browseAllLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#03456C",
  },
  propertiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  propertiesLoadingBox: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  propertiesLoadingText: {
    fontSize: 13,
    color: "#03456C",
    fontWeight: "600",
  },
  emptyPropertiesBox: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A192F",
    marginTop: 10,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    maxWidth: 540,
    lineHeight: 18,
  },
  emptyBrowseBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#03456C",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  emptyBrowseText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Institutional Knowledge Guide */
  knowledgeSection: {
    marginTop: 36,
    marginBottom: 8,
  },
  knowledgeHeader: {
    marginBottom: 20,
  },
  knowledgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  knowledgeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 22,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 12px rgba(10, 25, 47, 0.04)",
      },
    }),
  },
  knowledgeIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  knowledgeTagBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  knowledgeTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#03456C",
    letterSpacing: 0.6,
  },
  knowledgeCardTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0A192F",
    marginBottom: 8,
  },
  knowledgeCardDesc: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 19,
    marginBottom: 16,
  },
  knowledgeDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  knowledgeFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  knowledgeFeatureText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
  },

  /* Quick Jump Section */
  quickJumpSection: {
    width: "100%",
    marginTop: 24,
    marginBottom: 28,
  },
  quickJumpCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 25, 47, 0.03)",
      },
    }),
  },
  quickJumpLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  quickJumpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    justifyContent: "center",
    alignItems: "center",
  },
  quickJumpTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0A192F",
  },
  quickJumpSub: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
  },
  quickJumpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#03456C",
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(3, 69, 108, 0.2)",
      },
    }),
  },
  quickJumpBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
