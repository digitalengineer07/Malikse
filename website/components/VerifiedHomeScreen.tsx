import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import AppHeader from "./AppHeader";
import PropertyTypeTabs from "./PropertyTypeTabs";
import HouseIllustration from "./HouseIllustration";
import CitySkyline from "./CitySkyline";
import WebFooter from "./WebFooter";
import { cachedPropertySearch, propertyService } from "../src/services/propertyService";
import type { Property, PropertyType } from "../src/types/property.types";
import { AppTheme } from "../constants/theme";

const nameOf = (p: Property) => p.title || `${p.type} in ${p.location.district}`;
const priceOf = (p: Property) => `₹${p.price.toLocaleString("en-IN")}`;

const compactPrice = (price: number) => {
  if (price >= 10000000) {
    const cr = (price / 10000000).toFixed(2);
    return `₹${cr.replace(/\.00$/, "")} Cr`;
  }
  if (price >= 100000) {
    const lakh = (price / 100000).toFixed(2);
    return `₹${lakh.replace(/\.00$/, "")} Lakh`;
  }
  return `₹${price.toLocaleString("en-IN")}`;
};

const typeIcon = (t: string): keyof typeof MaterialIcons.glyphMap => {
  switch (t?.toLowerCase()) {
    case "house":
    case "villa":
      return "villa";
    case "flat":
    case "apartment":
      return "apartment";
    case "land":
    case "plot":
      return "terrain";
    case "shop":
      return "storefront";
    case "office":
      return "business-center";
    default:
      return "home";
  }
};

export default function VerifiedHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const resultsScroll = useRef<ScrollView>(null);
  const {
    type: initialType,
    query,
    min,
    max,
    district,
    state,
    pincode,
    address,
    areaSelection,
  } = useLocalSearchParams<{
    type?: PropertyType;
    query?: string;
    min?: string;
    max?: string;
    district?: string;
    state?: string;
    pincode?: string;
    address?: string;
    areaSelection?: string;
  }>();

  const [type, setType] = useState<PropertyType | undefined>(initialType || undefined);
  useEffect(() => {
    if (areaSelection) resultsScroll.current?.scrollTo({ y: 0, animated: false });
  }, [areaSelection]);
  useEffect(() => {
    setType(initialType || undefined);
  }, [initialType]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [revision, setRevision] = useState(0);
  const filterKey = JSON.stringify([type, query, min, max, district, state, pincode, address, areaSelection]);
  const [pagination, setPagination] = useState<{ key: string; page: number; cursors: (string | undefined)[] }>({
    key: "",
    page: 1,
    cursors: [undefined],
  });
  const [nextCursor, setNextCursor] = useState<string>();
  const page = pagination.key === filterKey ? pagination.page : 1;

  // Website Screen-Overlapping Luxury Ad State
  const [isOverlayAdVisible, setIsOverlayAdVisible] = useState(false);
  const [adStep, setAdStep] = useState<"details" | "claim" | "success">("details");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadError, setLeadError] = useState("");

  // Automatically trigger the luxury overlapping ad 1.4s after landing
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOverlayAdVisible(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  const handleClaimOffer = () => {
    setAdStep("claim");
    setLeadError("");
  };

  const handleLeadSubmit = () => {
    if (!leadName.trim() || leadName.trim().length < 2) {
      setLeadError("Please enter your full name.");
      return;
    }
    const clean = leadPhone.trim().replace(/\D/g, "");
    if (!/^[0-9]{10}$/.test(clean)) {
      setLeadError("Please enter a valid 10-digit WhatsApp number.");
      return;
    }
    setLeadError("");
    setAdStep("success");
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const searchFilters = {
        cursor: pagination.key === filterKey ? pagination.cursors[page - 1] : undefined,
        limit: 50,
        type,
        location: query,
        district,
        state,
        pincode,
        address,
        budgetMin: min ? Number(min) : undefined,
        budgetMax: max ? Number(max) : undefined,
      };
      const cached = cachedPropertySearch(searchFilters);
      if (cached) {
        setProperties(cached);
        setNextCursor((cached as any).nextCursor);
      }
      setLoading(!cached);
      setError("");
      setRefreshError("");
      propertyService
        .searchProperties(searchFilters)
        .then((data) => {
          if (active) {
            setProperties(data);
            setNextCursor((data as any).nextCursor);
          }
        })
        .catch(() => {
          if (active && cached) setRefreshError("Showing saved results. Could not refresh; try again shortly.");
          if (active && !cached) {
            setProperties([]);
            setError("We couldn’t load verified properties. Please try again.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        setSelected(null);
      };
    }, [revision, type, query, min, max, district, state, pincode, address, areaSelection, page])
  );

  const openProperty = useCallback(
    (property: Property) => {
      setSelected(null);
      router.push({ pathname: "/property/[id]", params: { id: property._id || property.id } });
    },
    [router]
  );

  const isWide = width >= 800;
  const filteredProperties = properties.filter((p) => type === undefined || p.type === type);

  // Dynamic investment corridors synchronized with live database properties
  const hubCorridors = useMemo(() => {
    // 1. Patna Sadar & Central (Fraser Road, Boring Road, Exhibition Road, Kankarbagh)
    const centralProps = properties.filter((p) => {
      const loc = `${p.location?.mauza || ""} ${p.location?.block || ""} ${p.title || ""}`.toLowerCase();
      return (
        loc.includes("boring") ||
        loc.includes("fraser") ||
        loc.includes("exhibition") ||
        loc.includes("kankarbagh") ||
        p.location?.pincode === "800020"
      );
    });

    // 2. Danapur & Roadside (Danapur, Saguna, 801503)
    const danapurProps = properties.filter((p) => {
      const loc = `${p.location?.mauza || ""} ${p.location?.block || ""} ${p.location?.policeStation || ""} ${p.title || ""}`.toLowerCase();
      return loc.includes("danapur") || loc.includes("saguna") || p.location?.pincode === "801503";
    });

    // 3. Patna Prime Plots & Land (Land parcels in Patna)
    const plotProps = properties.filter(
      (p) => p.type === "land" && !danapurProps.some((dp) => (dp._id || dp.id) === (p._id || p.id))
    );

    // 4. Greater Patna & Bihar Regional Properties
    const allBiharProps = properties;

    const getMinRate = (list: Property[], fallback: number) => {
      const rates = list
        .map((p) => (p.sellableArea || p.totalArea ? Math.round(p.price / (p.sellableArea || p.totalArea || 1)) : 0))
        .filter((r) => r > 0);
      return rates.length > 0 ? Math.min(...rates) : fallback;
    };

    return [
      {
        id: "central",
        name: "Patna Sadar & Central",
        highlights: "Bailey Road · Fraser Road · Kankarbagh",
        count: centralProps.length,
        minRate: getMinRate(centralProps, 4700),
        image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=600&q=80",
        onPress: () => router.push({ pathname: "/home", params: { district: "Patna" } }),
      },
      {
        id: "danapur",
        name: "Danapur & Saguna More",
        highlights: "Khagaul Road · Danapur Station · RPS More",
        count: danapurProps.length,
        minRate: getMinRate(danapurProps, 1875),
        image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=600&q=80",
        onPress: () => router.push({ pathname: "/home", params: { district: "Patna", pincode: "801503" } }),
      },
      {
        id: "plots",
        name: "Patna Prime Plots & Land",
        highlights: "Main Road Frontage · Gated Layouts · Title Verified",
        count: plotProps.length,
        minRate: getMinRate(plotProps, 1875),
        image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80",
        onPress: () => router.push({ pathname: "/home", params: { type: "land", district: "Patna" } }),
      },
      {
        id: "all_bihar",
        name: "Greater Patna & Bihar Belts",
        highlights: "Apartments · Houses · Commercial Shops · Offices",
        count: allBiharProps.length,
        minRate: getMinRate(allBiharProps, 1875),
        image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=600&q=80",
        onPress: () => router.push({ pathname: "/home", params: { state: "Bihar" } }),
      },
    ];
  }, [properties, router]);
  const carouselScroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  const handleCarouselScroll = (direction: "left" | "right") => {
    if (!carouselScroll.current) return;
    const delta = direction === "left" ? -340 : 340;
    const target = Math.max(0, scrollOffset.current + delta);
    scrollOffset.current = target;
    carouselScroll.current.scrollTo({ x: target, animated: true });
  };

  return (
    <View style={s.screen}>
      <AppHeader />
      {!!refreshError && (
        <Text accessibilityRole="alert" style={s.alertNote}>
          {refreshError}
        </Text>
      )}

      <ScrollView ref={resultsScroll} contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={true}>
        <View style={s.content}>
          {/* Hero Header Area */}
          <View style={s.heroSection}>
            {/* Top row with Eyebrow Badge on left, count on right */}
            <View style={s.eyebrowRow}>
              <View style={s.badgeCapsule}>
                <MaterialIcons name="verified" size={14} color="#03456C" />
                <Text style={s.badgeCapsuleText}>BIHAR'S #1 VERIFIED REAL ESTATE PORTAL</Text>
              </View>

              <View style={s.titleRight}>
                <View style={s.countDot} />
                <Text style={s.countText}>
                  {loading ? "Loading…" : `${properties.length} verified listings on page ${page}`}
                </Text>
              </View>
            </View>

            {/* Title Row */}
            <View style={s.titleRow}>
              <View style={s.titleLeft}>
                <Text style={s.mainTitle}>
                  {pincode
                    ? pincode === "__missing__"
                      ? "Properties without a pincode"
                      : `Properties in ${pincode}`
                    : "Explore Verified Properties"}
                </Text>
                <Text style={s.heroSubtitle}>
                  Direct title-checked plots, verified flats, and independent houses across Bihar with zero brokerage.
                </Text>
              </View>
            </View>

            {/* Filter Area Clear Buttons if active */}
            {!!pincode && (
              <View style={s.filterInfoRow}>
                <Text style={s.filterInfoText}>
                  {state} · {district} · {pincode === "__missing__" ? "Pincode not provided" : pincode}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => router.setParams({ pincode: "", state: "", district: "" })}
                >
                  <Text style={s.clearFilterBtn}>Clear area filter</Text>
                </TouchableOpacity>
              </View>
            )}

            {!!address && (
              <View style={s.filterInfoRow}>
                <Text style={s.filterInfoText}>Address: {address}</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => router.setParams({ address: "" })}>
                  <Text style={s.clearFilterBtn}>Clear address search</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter Pills */}
            <PropertyTypeTabs value={type} onChange={setType} />
          </View>

          {/* Elevated Pure White Main Card Section with Flush Skyline Horizon */}
          <View style={s.mainCardContainer}>
            {/* Skyline sitting DIRECTLY on the top edge of mainCard */}
            {isWide && (
              <View style={s.skylineHorizonAnchor} pointerEvents="none">
                <CitySkyline
                  width={width < 1100 ? 700 : 880}
                  maxWidth="68%"
                  height={width < 1100 ? 250 : 305}
                  opacity={0.96}
                />
              </View>
            )}

            <View style={s.mainCard}>
              {loading ? (
                <View style={s.loadingContainer}>
                  <ActivityIndicator size="large" color="#03456C" />
                </View>
              ) : error ? (
                <View style={s.emptyStateWrapper}>
                  <Text accessibilityRole="alert" style={s.errorNote}>
                    {error}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setRevision((v) => v + 1)}
                    style={s.retryButton}
                  >
                    <Text style={s.retryButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : filteredProperties.length === 0 ? (
                /* Empty State */
                <View style={s.emptyStateWrapper}>
                  <HouseIllustration width={width < 600 ? 220 : 280} height={width < 600 ? 120 : 155} />
                  <Text style={s.emptyHeading}>
                    {type ? `No ${type} properties available yet` : "More places are on the way"}
                  </Text>
                  <Text style={s.emptySubheading}>
                    {type
                      ? `We have verified listings in other categories. Switch to "All properties" or "Land" to view them.`
                      : "Properties will appear here after Advisor and Verifier approval."}
                  </Text>
                  {!!type && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => setType(undefined)}
                      style={[s.retryButton, { marginTop: 16 }]}
                    >
                      <Text style={s.retryButtonText}>View all properties</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* Horizontal Scrollable Carousel */
                <View style={s.carouselWrapper}>
                  {/* Header bar with total available count and navigation arrows */}
                  <View style={s.carouselHeader}>
                    <View style={s.carouselTitleRow}>
                      <Text style={s.carouselTitle}>
                        {type
                          ? `${type.charAt(0).toUpperCase() + type.slice(1)} Properties`
                          : "Featured Verified Listings"}
                      </Text>
                      <View style={s.verifiedShieldBadge}>
                        <MaterialIcons name="verified" size={13} color="#059669" />
                        <Text style={s.verifiedShieldText}>100% Legal Clearance</Text>
                      </View>
                      <View style={s.countBadge}>
                        <Text style={s.countBadgeText}>{filteredProperties.length} available</Text>
                      </View>
                    </View>

                    <View style={s.arrowControls}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Previous properties"
                        onPress={() => handleCarouselScroll("left")}
                        style={s.arrowBtn}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="chevron-left" size={24} color="#03456C" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Next properties"
                        onPress={() => handleCarouselScroll("right")}
                        style={s.arrowBtn}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="chevron-right" size={24} color="#03456C" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Horizontal Scroll Area */}
                  <ScrollView
                    ref={carouselScroll}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.carouselContent}
                    onScroll={(e) => {
                      scrollOffset.current = e.nativeEvent.contentOffset.x;
                    }}
                    scrollEventThrottle={16}
                  >
                    {filteredProperties.map((property) => (
                      <TouchableOpacity
                        key={property._id || property.id}
                        onPress={() => setSelected(property)}
                        activeOpacity={0.92}
                        style={s.horizontalCard}
                      >
                        {/* Card Top: Image & Badges */}
                        <View style={s.cardTopImage}>
                          {property.media?.photos?.[0] ? (
                            <Image
                              source={{ uri: property.media.photos[0] }}
                              style={StyleSheet.absoluteFill}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={s.noPhoto}>
                              <MaterialIcons name="landscape" size={36} color="#94A3B8" />
                            </View>
                          )}
                          <View style={s.imageBadge}>
                            <MaterialIcons name={typeIcon(property.type)} size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={s.imageBadgeText}>{property.type.toUpperCase()}</Text>
                          </View>
                          <View style={s.verifiedTag}>
                            <MaterialIcons name="verified" size={12} color="#10B981" />
                            <Text style={s.verifiedTagText}>Title Verified</Text>
                          </View>
                          <TouchableOpacity
                            style={s.heartPill}
                            accessibilityRole="button"
                            accessibilityLabel="Save property"
                            onPress={(e: any) => {
                              e?.stopPropagation?.();
                            }}
                          >
                            <MaterialIcons name="favorite-border" size={17} color="#03456C" />
                          </TouchableOpacity>
                        </View>

                        {/* Card Body */}
                        <View style={s.horizontalCardBody}>
                          <View style={s.priceLocationRow}>
                            <View style={s.priceRow}>
                              <Text style={s.compactPriceText}>{compactPrice(property.price)}</Text>
                              <Text style={s.fullPriceText}>({priceOf(property)})</Text>
                            </View>
                            <View style={s.locationRow}>
                              <MaterialIcons name="location-on" size={13} color="#0284C7" />
                              <Text style={s.locationText} numberOfLines={1}>
                                {property.location.district}, {property.location.state}
                              </Text>
                            </View>
                          </View>

                          <Text style={s.horizontalCardTitle} numberOfLines={2}>
                            {property.title || `${property.type} in ${property.location.district}`}
                          </Text>

                          <View style={s.specsRow}>
                            <View style={s.specChip}>
                              <MaterialIcons name="square-foot" size={14} color="#64748B" />
                              <Text style={s.specText}>
                                {property.sellableArea
                                  ? `${property.sellableArea.toLocaleString("en-IN")} sq ft`
                                  : "Area unlisted"}
                              </Text>
                            </View>
                            <View style={[s.specChip, property.negotiable ? s.negotiableChip : s.fixedChip]}>
                              <Text style={[s.negotiableText, property.negotiable ? s.negotiableColor : s.fixedColor]}>
                                {property.negotiable ? "Negotiable" : "Fixed price"}
                              </Text>
                            </View>
                          </View>

                          <View style={s.viewDetailsBtn}>
                            <Text style={s.viewDetailsText}>View Details</Text>
                            <MaterialIcons name="arrow-forward" size={14} color="#03456C" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          {/* Pagination Controls */}
          {!loading && !error && (
            <View style={s.paginationRow}>
              {page > 1 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={s.pagePill}
                  onPress={() =>
                    setPagination((old) => ({ key: filterKey, page: page - 1, cursors: old.cursors }))
                  }
                >
                  <Text style={s.pagePillText}>Previous page</Text>
                </TouchableOpacity>
              )}
              {!!nextCursor && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={s.pagePill}
                  onPress={() =>
                    setPagination((old) => ({
                      key: filterKey,
                      page: page + 1,
                      cursors: [
                        ...(old.key === filterKey ? old.cursors.slice(0, page) : [undefined]),
                        nextCursor,
                      ],
                    }))
                  }
                >
                  <Text style={s.pagePillText}>Next page</Text>
                </TouchableOpacity>
              )}
              {page === 100 && (
                <Text style={s.filterInfoText}>Refine your search to see more relevant properties.</Text>
              )}
            </View>
          )}

          {/* Section 1: The 4-Step Verification Guarantee */}
          <View style={s.trustSection}>
            <View style={s.sectionHeader}>
              <View style={s.sectionBadge}>
                <MaterialIcons name="security" size={14} color="#03456C" />
                <Text style={s.sectionBadgeText}>100% DISPUTE-FREE ASSURANCE</Text>
              </View>
              <Text style={s.sectionTitle}>Why Buyers & Investors Choose MalikSe</Text>
              <Text style={s.sectionSubtitle}>
                Every property undergoes Bihar’s strictest 4-stage legal, revenue, and physical boundary audit before being listed.
              </Text>
            </View>

            <View style={[s.trustGrid, { flexDirection: isWide ? "row" : "column" }]}>
              {/* Card 1 */}
              <View style={[s.trustCard, { width: isWide ? "23.5%" : "100%" }]}>
                <View style={[s.trustIconBox, { backgroundColor: "#E0F2FE" }]}>
                  <MaterialIcons name="account-balance" size={26} color="#03456C" />
                </View>
                <Text style={s.trustCardTitle}>Revenue Record Audit</Text>
                <Text style={s.trustCardDesc}>
                  Jamabandi, Khatiyan, LPC, and Mutation records verified directly at the Circle Office (Anchal Adhikari).
                </Text>
              </View>

              {/* Card 2 */}
              <View style={[s.trustCard, { width: isWide ? "23.5%" : "100%" }]}>
                <View style={[s.trustIconBox, { backgroundColor: "#ECFDF5" }]}>
                  <MaterialIcons name="gps-fixed" size={26} color="#059669" />
                </View>
                <Text style={s.trustCardTitle}>GPS Demarcation</Text>
                <Text style={s.trustCardDesc}>
                  On-ground satellite coordinates mapped with surveyor pegs to ensure zero boundary encroachment disputes.
                </Text>
              </View>

              {/* Card 3 */}
              <View style={[s.trustCard, { width: isWide ? "23.5%" : "100%" }]}>
                <View style={[s.trustIconBox, { backgroundColor: "#FEF3C7" }]}>
                  <MaterialIcons name="gavel" size={26} color="#D97706" />
                </View>
                <Text style={s.trustCardTitle}>30-Year Title Search</Text>
                <Text style={s.trustCardDesc}>
                  Empanelled High Court advocates audit 30 years of registered sale deeds, ensuring non-encumbrance clearance.
                </Text>
              </View>

              {/* Card 4 */}
              <View style={[s.trustCard, { width: isWide ? "23.5%" : "100%" }]}>
                <View style={[s.trustIconBox, { backgroundColor: "#F3E8FF" }]}>
                  <MaterialIcons name="handshake" size={26} color="#7C3AED" />
                </View>
                <Text style={s.trustCardTitle}>Direct Deals, ₹0 Brokerage</Text>
                <Text style={s.trustCardDesc}>
                  Connect directly with verified title holders. Complete documentation transparency with zero hidden middleman cuts.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 2: Explore Bihar's Top Investment Corridors */}
          <View style={s.districtsSection}>
            <View style={s.sectionHeader}>
              <View style={s.sectionBadge}>
                <MaterialIcons name="trending-up" size={14} color="#03456C" />
                <Text style={s.sectionBadgeText}>PRIME CORRIDORS</Text>
              </View>
              <Text style={s.sectionTitle}>Explore High-Growth Hubs in Bihar</Text>
              <Text style={s.sectionSubtitle}>
                High-appreciation residential belts, commercial retail hotspots, and emerging infrastructure corridors.
              </Text>
            </View>

            <View style={[s.districtsGrid, { flexDirection: isWide ? "row" : "column" }]}>
              {hubCorridors.map((hub) => (
                <TouchableOpacity
                  key={hub.id}
                  style={[s.districtCard, { width: isWide ? "23.5%" : "100%" }]}
                  activeOpacity={0.88}
                  onPress={hub.onPress}
                >
                  <View style={s.districtImageWrap}>
                    <Image
                      source={{ uri: hub.image }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                    <View style={s.districtOverlay} />
                    <View style={s.districtCountBadge}>
                      <Text style={s.districtCountText}>
                        {hub.count > 0 ? `${hub.count} Verified` : "Coming Soon"}
                      </Text>
                    </View>
                  </View>
                  <View style={s.districtInfo}>
                    <Text style={s.districtName}>{hub.name}</Text>
                    <Text style={s.districtHighlights}>{hub.highlights}</Text>
                    <Text style={s.districtPriceRange}>
                      {hub.count > 0 ? `From ₹${hub.minRate.toLocaleString("en-IN")} / sq ft` : "Register Interest"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Section 3: Owner / Seller Call To Action Banner */}
          <View style={s.ctaBanner}>
            <View style={[s.ctaContent, { flexDirection: isWide ? "row" : "column" }]}>
              <View style={[s.ctaLeft, { maxWidth: isWide ? "75%" : "100%" }]}>
                <View style={s.ctaBadge}>
                  <MaterialIcons name="stars" size={14} color="#38BDF8" />
                  <Text style={s.ctaBadgeText}>FOR PROPERTY OWNERS & BUILDERS</Text>
                </View>
                <Text style={s.ctaTitle}>Own Land or a Home in Bihar? Sell with 100% Free Verification.</Text>
                <Text style={s.ctaDesc}>
                  List your property on MalikSe. We audit your Khatiyan & boundary, award the MalikSe Verified Seal, and connect you directly with genuine buyers with ₹0 commission.
                </Text>
                <View style={s.ctaButtonsRow}>
                  <TouchableOpacity
                    style={s.ctaPrimaryBtn}
                    onPress={() => router.push("/listing/create")}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="add-circle" size={18} color="#03456C" />
                    <Text style={s.ctaPrimaryBtnText}>Post Your Property Free</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.ctaSecondaryBtn}
                    onPress={() => router.push("/search")}
                    activeOpacity={0.85}
                  >
                    <Text style={s.ctaSecondaryBtnText}>Explore Verification Benefits</Text>
                    <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {isWide && (
                <View style={s.ctaRightGraphic}>
                  <MaterialIcons name="verified-user" size={110} color="rgba(255, 255, 255, 0.12)" />
                </View>
              )}
            </View>
          </View>

          {/* Section 4: Live Trust Numbers Strip */}
          <View style={[s.statsStrip, { flexDirection: isWide ? "row" : "column" }]}>
            <View style={s.statItem}>
              <Text style={s.statNumber}>100%</Text>
              <Text style={s.statLabel}>Revenue-Verified Titles</Text>
            </View>
            {isWide && <View style={s.statDivider} />}
            <View style={s.statItem}>
              <Text style={s.statNumber}>{properties.length > 0 ? properties.length : "8+"}</Text>
              <Text style={s.statLabel}>Live Verified Properties</Text>
            </View>
            {isWide && <View style={s.statDivider} />}
            <View style={s.statItem}>
              <Text style={s.statNumber}>₹0</Text>
              <Text style={s.statLabel}>Brokerage on Direct Deals</Text>
            </View>
            {isWide && <View style={s.statDivider} />}
            <View style={s.statItem}>
              <Text style={s.statNumber}>48h</Text>
              <Text style={s.statLabel}>Legal Audit Turnaround</Text>
            </View>
          </View>
        </View>

        {/* Global Website Footer */}
        <WebFooter />
      </ScrollView>

      {/* Floating Bottom-Right Ad Widget (Website Only) */}
      {!isOverlayAdVisible && (
        <TouchableOpacity
          style={s.floatingAdWidget}
          onPress={() => {
            setIsOverlayAdVisible(true);
            setAdStep("details");
          }}
          activeOpacity={0.9}
        >
          <View style={s.floatingAdSparkle}>
            <MaterialIcons name="auto-awesome" size={15} color="#D97706" />
          </View>
          <View style={s.floatingAdTextBox}>
            <Text style={s.floatingAdTag}>SPONSORED PRIVILEGE</Text>
            <Text style={s.floatingAdTitle}>Patliputra Imperial Heights · ₹3.5L Off</Text>
          </View>
          <View style={s.floatingAdBtn}>
            <Text style={s.floatingAdBtnText}>View</Text>
            <MaterialIcons name="arrow-forward" size={13} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}

      {/* Screen-Overlapping Luxury Ad Modal (Website Only) */}
      <Modal
        visible={isOverlayAdVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOverlayAdVisible(false)}
      >
        <View style={s.adOverlayBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsOverlayAdVisible(false)}
          />

          <View style={[s.adOverlayCard, { flexDirection: isWide ? "row" : "column" }]}>
            {/* Left Photo & Luxury Badges */}
            <View style={[s.adOverlayMedia, { width: isWide ? "46%" : "100%" }]}>
              <Image
                source={{
                  uri: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
                }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <View style={s.adOverlayMediaShade} />

              <View style={s.adOverlayBadges}>
                <View style={s.adOverlayGoldTag}>
                  <MaterialIcons name="star" size={12} color="#FFFFFF" />
                  <Text style={s.adOverlayGoldText}>EXCLUSIVE SPONSORED SHOWCASE</Text>
                </View>
                <View style={s.adOverlayGreenTag}>
                  <MaterialIcons name="verified" size={12} color="#FFFFFF" />
                  <Text style={s.adOverlayGreenText}>BIHAR RERA APPROVED</Text>
                </View>
              </View>

              <View style={s.adOverlayPrivilegeBox}>
                <Text style={s.adOverlayPrivilegeLabel}>⚡ PRE-LAUNCH PRIVILEGE OFFER</Text>
                <Text style={s.adOverlayPrivilegeTitle}>Flat ₹3,50,000 Cash Discount on Bookings</Text>
                <Text style={s.adOverlayPrivilegeSub}>Limited to First 15 Verified MalikSe Investors</Text>
              </View>
            </View>

            {/* Right Interactive Column */}
            <View style={[s.adOverlayBody, { width: isWide ? "54%" : "100%" }]}>
              {/* Top Bar with Developer Info & Close Button */}
              <View style={s.adOverlayHeader}>
                <View style={s.adOverlayDevWrap}>
                  <MaterialIcons name="business" size={15} color="#03456C" />
                  <Text style={s.adOverlayDevName}>PATLIPUTRA REALTY & INFRASTRUCTURE</Text>
                </View>
                <TouchableOpacity
                  style={s.adOverlayCloseBtn}
                  onPress={() => setIsOverlayAdVisible(false)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Step 1: Project Details */}
              {adStep === "details" && (
                <View style={s.adOverlayContent}>
                  <Text style={s.adOverlayProjectTitle}>Patliputra Imperial Heights & Luxury Residences</Text>
                  <View style={s.adOverlayLocationRow}>
                    <MaterialIcons name="place" size={14} color="#0284C7" />
                    <Text style={s.adOverlayLocationText}>Bailey Road Extension · Near AIIMS & Airport, Patna</Text>
                  </View>

                  <View style={s.adOverlayPerksList}>
                    <View style={s.adOverlayPerkItem}>
                      <MaterialIcons name="park" size={14} color="#059669" />
                      <Text style={s.adOverlayPerkText}>45% Green Central Forest Park & Lakefront</Text>
                    </View>
                    <View style={s.adOverlayPerkItem}>
                      <MaterialIcons name="pool" size={14} color="#0284C7" />
                      <Text style={s.adOverlayPerkText}>Olympic Clubhouse, Rooftop Gym & Solar Energy</Text>
                    </View>
                    <View style={s.adOverlayPerkItem}>
                      <MaterialIcons name="flight" size={14} color="#D97706" />
                      <Text style={s.adOverlayPerkText}>15 Mins to Patna International Airport & Metro</Text>
                    </View>
                    <View style={s.adOverlayPerkItem}>
                      <MaterialIcons name="account-balance" size={14} color="#7C3AED" />
                      <Text style={s.adOverlayPerkText}>₹0 Pre-EMI until Possession · Approved by SBI & HDFC</Text>
                    </View>
                  </View>

                  <View style={s.adOverlayPricingRow}>
                    <View>
                      <Text style={s.adOverlayPriceFrom}>Starting from</Text>
                      <Text style={s.adOverlayPriceValue}>₹54.9 Lakh*</Text>
                    </View>
                    <View style={s.adOverlayPricingDivider} />
                    <View>
                      <Text style={s.adOverlayUnitTypes}>2, 3 & 4 BHK Luxury Residences</Text>
                      <Text style={s.adOverlayReraText}>RERA: BRERAP00184-1/102</Text>
                    </View>
                  </View>

                  <View style={s.adOverlayBtnRow}>
                    <TouchableOpacity
                      style={s.adOverlayClaimBtn}
                      onPress={handleClaimOffer}
                      activeOpacity={0.88}
                    >
                      <Text style={s.adOverlayClaimBtnText}>Claim ₹3.5L Offer & Brochure</Text>
                      <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.adOverlaySkipBtn}
                      onPress={() => setIsOverlayAdVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.adOverlaySkipBtnText}>Continue to Website</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={s.adOverlayFootnote}>
                    Verified Institutional Partner · Zero Brokerage · Direct Deal
                  </Text>
                </View>
              )}

              {/* Step 2: Instant Claim Form */}
              {adStep === "claim" && (
                <View style={s.adOverlayContent}>
                  <Text style={s.adOverlayProjectTitle}>Claim Your Pre-Launch Privilege</Text>
                  <Text style={s.adOverlayClaimDesc}>
                    Receive your exclusive ₹3,50,000 discount voucher, official floor plans, and masterplan directly on WhatsApp.
                  </Text>

                  {!!leadError && (
                    <View style={s.leadErrorBox}>
                      <MaterialIcons name="error-outline" size={15} color="#DC2626" />
                      <Text style={s.leadErrorText}>{leadError}</Text>
                    </View>
                  )}

                  <View style={s.leadField}>
                    <Text style={s.leadLabel}>Full Name</Text>
                    <TextInput
                      style={s.leadInput}
                      value={leadName}
                      onChangeText={setLeadName}
                      placeholder="e.g. Ramesh Kumar"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={s.leadField}>
                    <Text style={s.leadLabel}>WhatsApp / Mobile Number</Text>
                    <View style={s.leadPhoneWrap}>
                      <View style={s.leadCountryCode}>
                        <Text style={s.leadCountryCodeText}>+91</Text>
                      </View>
                      <TextInput
                        style={s.leadPhoneInput}
                        value={leadPhone}
                        onChangeText={(t) => setLeadPhone(t.replace(/\D/g, "").slice(0, 10))}
                        placeholder="10-digit mobile number"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={s.adOverlayClaimBtn}
                    onPress={handleLeadSubmit}
                    activeOpacity={0.88}
                  >
                    <MaterialIcons name="send" size={16} color="#FFFFFF" />
                    <Text style={s.adOverlayClaimBtnText}>Send Instant Brochure on WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.adOverlayBackLink}
                    onPress={() => setAdStep("details")}
                    activeOpacity={0.7}
                  >
                    <Text style={s.adOverlayBackText}>← Back to project details</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 3: Success Confirmation */}
              {adStep === "success" && (
                <View style={s.adOverlaySuccessView}>
                  <View style={s.adOverlaySuccessIcon}>
                    <MaterialIcons name="check-circle" size={48} color="#10B981" />
                  </View>
                  <Text style={s.adOverlaySuccessTitle}>Privilege Voucher Confirmed!</Text>
                  <Text style={s.adOverlaySuccessVoucher}>VOUCHER CODE: #MALIKSE-VIP-350</Text>
                  <Text style={s.adOverlaySuccessDesc}>
                    The official digital brochure, masterplan, and ₹3,50,000 discount voucher have been dispatched to your WhatsApp number.
                  </Text>
                  <TouchableOpacity
                    style={s.adOverlayDoneBtn}
                    onPress={() => setIsOverlayAdVisible(false)}
                    activeOpacity={0.88}
                  >
                    <Text style={s.adOverlayDoneBtnText}>Explore MalikSe Website</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Property Preview Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={[s.modalBackdrop, isWide && s.modalBackdropDesktop]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Dismiss property preview"
            onPress={() => setSelected(null)}
          />
          {selected && (
            <BlurView
              intensity={90}
              tint="light"
              accessibilityViewIsModal
              style={[
                s.sheet,
                isWide ? s.sheetDesktop : { paddingBottom: Math.max(insets.bottom, 22) },
              ]}
            >
              {!isWide && <View style={s.handle} />}
              <ScrollView>
                <View style={s.sheetHeader}>
                  <Text style={s.modalEyebrow}>PROPERTY PREVIEW</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Close preview"
                    onPress={() => setSelected(null)}
                    style={s.closeCircle}
                  >
                    <MaterialIcons name="close" size={20} color="#0A192F" />
                  </TouchableOpacity>
                </View>
                <Text style={s.mainTitle}>{nameOf(selected)}</Text>
                <Text style={s.filterInfoText}>
                  {selected.location.district}, {selected.location.state}
                </Text>
                <Text style={s.sheetPrice}>{priceOf(selected)}</Text>
                <View style={s.factsRow}>
                  <Text style={s.factChip}>{selected.type}</Text>
                  <Text style={s.factChip}>
                    {selected.sellableArea != null
                      ? `${selected.sellableArea.toLocaleString("en-IN")} sq.ft`
                      : "Area not provided"}
                  </Text>
                  <Text style={s.factChip}>{selected.negotiable ? "Negotiable" : "Fixed price"}</Text>
                </View>
                <Text style={[s.filterInfoText, { marginVertical: 18 }]}>
                  {selected.title ? `${selected.title}. ` : ""}
                  {selected.boundary ? `Boundary: ${selected.boundary}. ` : ""}
                  {selected.roadWidth ? `Road Width: ${selected.roadWidth} ft. ` : ""}
                  {selected.khata || selected.khesra
                    ? `Khata: ${selected.khata || "N/A"}, Khesra: ${selected.khesra || "N/A"}. `
                    : ""}
                  {selected.disclosures?.possessionStatus
                    ? `Possession: ${selected.disclosures.possessionStatus}.`
                    : ""}
                  {!selected.boundary &&
                    !selected.roadWidth &&
                    !selected.khata &&
                    !selected.title &&
                    "Explore the full listing for more detailed property information, photos, and disclosures."}
                </Text>
              </ScrollView>
              <TouchableOpacity
                accessibilityRole="button"
                style={s.viewDetailsAction}
                onPress={() => openProperty(selected)}
              >
                <Text style={s.viewDetailsActionText}>View full property details</Text>
                <MaterialIcons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
            </BlurView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  scrollContainer: {
    paddingBottom: 0,
  },
  content: {
    width: "100%",
    maxWidth: 1340,
    alignSelf: "center",
    paddingHorizontal: 28,
  },
  alertNote: {
    paddingHorizontal: 28,
    color: "#C53030",
    fontSize: 13,
    marginBottom: 8,
  },
  heroSection: {
    marginTop: 24,
    marginBottom: 0,
    position: "relative",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    zIndex: 2,
  },
  badgeCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(224, 242, 254, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(186, 230, 253, 0.95)",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  badgeCapsuleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: 1.2,
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  countText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    minHeight: 52,
    marginBottom: 6,
    zIndex: 2,
  },
  titleLeft: {
    flex: 1,
    zIndex: 2,
  },
  mainTitle: {
    fontSize: 38,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.8,
    lineHeight: 44,
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#475569",
    fontWeight: "500",
    marginTop: 6,
    maxWidth: 680,
    lineHeight: 22,
  },
  filterInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  filterInfoText: {
    fontSize: 13,
    color: "#64748B",
  },
  clearFilterBtn: {
    fontSize: 13,
    fontWeight: "600",
    color: "#03456C",
  },

  /* Main Card with Anchored Skyline Horizon */
  mainCardContainer: {
    position: "relative",
    width: "100%",
    marginTop: 16,
    marginBottom: 28,
    zIndex: 2,
  },
  skylineHorizonAnchor: {
    position: "absolute",
    right: -120,
    bottom: "100%",
    marginBottom: -2,
    zIndex: 1,
    pointerEvents: "none",
  },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    minHeight: 360,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 28,
    elevation: 4,
    width: "100%",
    zIndex: 2,
  },
  loadingContainer: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 32,
  },
  emptyHeading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A192F",
    marginTop: 22,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  emptySubheading: {
    fontSize: 15,
    fontWeight: "500",
    color: "#475569",
    marginTop: 8,
    textAlign: "center",
  },
  errorNote: {
    fontSize: 14,
    color: "#E53E3E",
    textAlign: "center",
    marginBottom: 14,
  },
  retryButton: {
    backgroundColor: "#03456C",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  /* Carousel */
  carouselWrapper: {
    width: "100%",
  },
  carouselHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  carouselTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  carouselTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.4,
  },
  verifiedShieldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  verifiedShieldText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  countBadge: {
    backgroundColor: "#EBF3F8",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03456C",
  },
  arrowControls: {
    flexDirection: "row",
    gap: 8,
  },
  arrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  carouselContent: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 18,
  },

  /* Property Cards */
  horizontalCard: {
    width: 325,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    overflow: "hidden",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cardTopImage: {
    width: "100%",
    height: 185,
    position: "relative",
    backgroundColor: "#F1F5F9",
  },
  noPhoto: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  imageBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(10, 25, 47, 0.88)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  verifiedTag: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.2,
  },
  heartPill: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  horizontalCardBody: {
    padding: 16,
  },
  priceLocationRow: {
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  compactPriceText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: -0.3,
  },
  fullPriceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  horizontalCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A192F",
    minHeight: 42,
    lineHeight: 21,
    marginBottom: 10,
  },
  specsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  specChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  negotiableChip: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  negotiableText: {
    fontSize: 11,
    fontWeight: "700",
  },
  negotiableColor: {
    color: "#059669",
  },
  fixedChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fixedColor: {
    color: "#64748B",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F0F7FB",
    borderWidth: 1,
    borderColor: "#D0E4F0",
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#03456C",
  },

  /* Pagination */
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 6,
    marginBottom: 32,
  },
  pagePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pagePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A192F",
  },

  /* Section 1: Trust Section */
  trustSection: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderRadius: 32,
    padding: 32,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
    maxWidth: 720,
    lineHeight: 21,
  },
  trustGrid: {
    justifyContent: "space-between",
    gap: 16,
  },
  trustCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  trustIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  trustCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A192F",
    marginBottom: 8,
  },
  trustCardDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },

  /* Section 2: Districts */
  districtsSection: {
    width: "100%",
    marginVertical: 24,
  },
  districtsGrid: {
    justifyContent: "space-between",
    gap: 16,
  },
  districtCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  districtImageWrap: {
    width: "100%",
    height: 150,
    position: "relative",
    backgroundColor: "#E2E8F0",
  },
  districtOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 25, 47, 0.25)",
  },
  districtCountBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(3, 69, 108, 0.9)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  districtCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  districtInfo: {
    padding: 16,
  },
  districtName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0A192F",
    marginBottom: 4,
  },
  districtHighlights: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 6,
  },
  districtPriceRange: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },

  /* Section 3: Owner CTA Banner */
  ctaBanner: {
    width: "100%",
    backgroundColor: "#03456C",
    borderRadius: 28,
    marginVertical: 24,
    overflow: "hidden",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 8,
  },
  ctaContent: {
    padding: 36,
    justifyContent: "space-between",
    alignItems: "center",
  },
  ctaLeft: {
    zIndex: 2,
  },
  ctaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  ctaBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.8,
  },
  ctaTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 34,
    marginBottom: 10,
  },
  ctaDesc: {
    fontSize: 14,
    color: "#E2E8F0",
    lineHeight: 22,
    marginBottom: 20,
  },
  ctaButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ctaPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  ctaPrimaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#03456C",
  },
  ctaSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ctaSecondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  ctaRightGraphic: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 20,
  },

  /* Section 4: Stats Strip */
  statsStrip: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 32,
    marginVertical: 18,
    justifyContent: "space-around",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2F6",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    gap: 16,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#03456C",
    letterSpacing: -0.6,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  statDivider: {
    width: 1.5,
    height: 36,
    backgroundColor: "#E2E8F0",
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 33, 55, 0.45)",
    justifyContent: "flex-end",
  },
  modalBackdropDesktop: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "85%",
  },
  sheetDesktop: {
    borderRadius: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "82%",
    paddingBottom: 28,
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
  handle: {
    height: 4,
    width: 40,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 18,
  },
  modalEyebrow: {
    color: "#1E293B",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrice: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0A192F",
    marginVertical: 14,
  },
  factsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  factChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  viewDetailsAction: {
    backgroundColor: "#03456C",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  viewDetailsActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /* Screen-Overlapping Luxury Promotional Ad & Floating Widget Styles (Website Only) */
  floatingAdWidget: {
    position: "fixed" as any,
    bottom: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0A192F",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: "rgba(217, 119, 6, 0.45)",
    zIndex: 9999,
    ...Platform.select({
      web: {
        boxShadow: "0 12px 32px -4px rgba(10, 25, 47, 0.45), 0 0 16px rgba(217, 119, 6, 0.25)",
        cursor: "pointer",
        backdropFilter: "blur(12px)",
      },
      default: {
        elevation: 10,
      },
    }),
  },
  floatingAdSparkle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(217, 119, 6, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingAdTextBox: {
    gap: 2,
  },
  floatingAdTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "#F59E0B",
    letterSpacing: 0.8,
  },
  floatingAdTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  floatingAdBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#03456C",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  floatingAdBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Full Screen Overlapping Lightbox / Modal */
  adOverlayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 25, 47, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: "blur(10px)",
        zIndex: 100000,
      },
    }),
  },
  adOverlayCard: {
    width: "100%",
    maxWidth: 900,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    zIndex: 10,
    ...Platform.select({
      web: {
        boxShadow: "0 30px 80px -15px rgba(2, 44, 67, 0.55), 0 0 30px rgba(217, 119, 6, 0.15)",
      },
      default: {
        elevation: 16,
      },
    }),
  },
  adOverlayMedia: {
    minHeight: 380,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#0A192F",
    justifyContent: "space-between",
    padding: 24,
  },
  adOverlayMediaShade: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: "rgba(10, 25, 47, 0.4)",
    ...Platform.select({
      web: {
        backgroundImage: "linear-gradient(180deg, rgba(10, 25, 47, 0.45) 0%, rgba(10, 25, 47, 0.88) 100%)",
      },
    }),
  },
  adOverlayBadges: {
    flexDirection: "row",
    gap: 8,
    zIndex: 2,
    flexWrap: "wrap",
  },
  adOverlayGoldTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#D97706",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  adOverlayGoldText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  adOverlayGreenTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  adOverlayGreenText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  adOverlayPrivilegeBox: {
    zIndex: 2,
    backgroundColor: "rgba(10, 25, 47, 0.88)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.35)",
  },
  adOverlayPrivilegeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#F59E0B",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  adOverlayPrivilegeTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 22,
    marginBottom: 4,
  },
  adOverlayPrivilegeSub: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8",
  },
  adOverlayBody: {
    padding: 28,
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  adOverlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  adOverlayDevWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adOverlayDevName: {
    fontSize: 10,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: 0.8,
  },
  adOverlayCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  adOverlayContent: {
    flex: 1,
  },
  adOverlayProjectTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 4,
  },
  adOverlayLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 14,
  },
  adOverlayLocationText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  adOverlayPerksList: {
    gap: 8,
    marginBottom: 16,
  },
  adOverlayPerkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adOverlayPerkText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  adOverlayPricingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    gap: 14,
  },
  adOverlayPriceFrom: {
    fontSize: 10,
    fontWeight: "600",
    color: "#03456C",
  },
  adOverlayPriceValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#03456C",
  },
  adOverlayPricingDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#BAE6FD",
  },
  adOverlayUnitTypes: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  adOverlayReraText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  adOverlayBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  adOverlayClaimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#03456C",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      web: {
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0284C7 100%)",
        cursor: "pointer",
      },
    }),
  },
  adOverlayClaimBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  adOverlaySkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  adOverlaySkipBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  adOverlayFootnote: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  adOverlayClaimDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
    marginBottom: 14,
  },
  leadErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  leadErrorText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  leadField: {
    gap: 6,
    marginBottom: 14,
  },
  leadLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  leadInput: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  leadPhoneWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  leadCountryCode: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
  },
  leadCountryCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  leadPhoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#0F172A",
  },
  adOverlayBackLink: {
    marginTop: 10,
    alignSelf: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  adOverlayBackText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
  },
  adOverlaySuccessView: {
    alignItems: "center",
    paddingVertical: 20,
  },
  adOverlaySuccessIcon: {
    marginBottom: 12,
  },
  adOverlaySuccessTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0A192F",
    marginBottom: 6,
  },
  adOverlaySuccessVoucher: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D97706",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12,
    letterSpacing: 0.6,
  },
  adOverlaySuccessDesc: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 380,
  },
  adOverlayDoneBtn: {
    backgroundColor: "#03456C",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  adOverlayDoneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

