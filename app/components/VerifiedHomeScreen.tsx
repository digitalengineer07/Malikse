import { premiumStyles } from "../constants/typography";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "./AppHeader";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import { propertyService } from "../src/services/propertyService";
import type { Property, PropertyType } from "../src/types/property.types";
import { AppTheme } from "../constants/theme";

const nameOf = (p: Property) => p.title || `${p.type} in ${p.location.district}`;
const priceOf = (p: Property) => `₹${p.price.toLocaleString("en-IN")}`;

const propertyTypes: { value: PropertyType | undefined; label: string }[] = [
  { value: undefined, label: "All properties" }, { value: "land", label: "Land" },
  { value: "flat", label: "Flats" }, { value: "house", label: "Houses" },
  { value: "shop", label: "Shops" }, { value: "office", label: "Offices" },
];
export default function VerifiedHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const { type: initialType, query, min, max } = useLocalSearchParams<{ type?: PropertyType; query?: string; min?: string; max?: string }>();
  const [type, setType] = useState<PropertyType | undefined>(initialType);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError("");
    const searchFilters = { type, location: query, budgetMin: min ? Number(min) : undefined, budgetMax: max ? Number(max) : undefined };
    propertyService.searchProperties(searchFilters).then(data => { if (active) setProperties(data); }).catch(() => { if (active) { setProperties([]); setError("We couldn’t load verified properties. Please try again."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; setSelected(null); };
  // Retry explicitly reloads the same backend query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, type, query, min, max]));
  const openProperty = useCallback((property: Property) => { setSelected(null); router.push({ pathname: "/property/[id]", params: { id: property._id || property.id } }); }, [router]);
  return <View style={s.screen}><AppHeader /><ScrollView contentContainerStyle={[s.content, width < 600 && { paddingHorizontal: 18 }]}>
    <View style={s.headingCenter}><Text style={s.eyebrow}>DISCOVER / VERIFIED BY MALIKSE</Text><Text accessibilityRole="header" style={[s.title, width < 600 && { fontSize: 33 }]}>Find your place.{"\n"}Feel at home.</Text>
    </View>
    <VerifiedPropertyMap properties={properties} onSelect={openProperty} />
    <View style={s.mapNote}><MaterialIcons name="verified-user" size={17} color="#355C77" /><Text style={s.note}>Only published, verified properties. Tap a price on the map to explore.</Text></View>
    <View style={[s.headingRow, { marginTop: 36, marginBottom: 16 }]}><View><Text style={s.eyebrow}>A PLACE FOR YOUR NEXT CHAPTER</Text><Text style={s.sectionTitle}>Explore our properties</Text></View><Text style={s.count}>{properties.length} available</Text></View>
    
    <View style={s.typeRow}>
      {propertyTypes.map(({ value, label }) => (
        <TouchableOpacity key={value || "all"} accessibilityRole="button" accessibilityState={{ selected: type === value }} onPress={() => setType(value)} style={[s.typePill, type === value && s.activePill]}>
          <Text style={[s.typeLabel, type === value && s.activeLabel]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {loading ? <ActivityIndicator style={{ padding: 30 }} color="#284B68" /> : error ? <View style={s.empty}><Text accessibilityRole="alert" style={s.note}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRevision(v => v + 1)} style={s.button}><Text style={s.buttonText}>Try again</Text></TouchableOpacity></View> : properties.length === 0 ? <View style={s.empty}><MaterialIcons name="home-work" size={36} color="#56768E" /><Text style={s.sectionTitle}>More places are on the way</Text><Text style={s.note}>Properties will appear here after Advisor and Verifier approval.</Text></View> : <View style={s.sectionsContainer}>
      {propertyTypes.filter(pt => pt.value !== undefined && (type === undefined || type === pt.value)).map(pt => {
        const typeProperties = properties.filter(p => p.type === pt.value);
        if (typeProperties.length === 0) return null;
        return (
          <View key={pt.value} style={s.typeSection}>
            <View style={s.typeSectionHeader}>
              <Text style={s.typeSectionTitle}>{pt.label}</Text>
              <Text style={s.typeSectionCount}>{typeProperties.length} available</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScrollContent}>
              {typeProperties.map(property => (
                <TouchableOpacity key={property._id || property.id} accessibilityRole="button" accessibilityLabel={`Preview ${nameOf(property)}`} onPress={() => setSelected(property)} activeOpacity={0.9} style={[s.card, { width: width < 600 ? width * 0.85 : 340 }]}>
                  {property.media?.photos?.[0] ? <Image source={{ uri: property.media.photos[0] }} accessibilityLabel="Property photo" style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={s.noPhoto}><Text style={s.photoLabel}>Property photo not provided</Text></View>}
                  <View style={s.verified}><MaterialIcons name="verified" size={14} color="#1D4866" /><Text style={s.verifiedText}>Verified</Text></View>
                  <View style={[s.glass, Platform.OS === "web" && { backdropFilter: "blur(18px)" } as any]}><Text style={s.cardTitle} numberOfLines={2}>{nameOf(property)}</Text><Text style={s.cardLocation}>{property.location.district}, {property.location.state}</Text><View style={s.priceRow}><Text style={s.price}>{priceOf(property)}</Text><View style={s.smallCircle}><MaterialIcons name="north-east" color="#142334" size={19} /></View></View><Text style={s.cardLocation}>{property.type}{property.sellableArea != null ? ` · ${property.sellableArea.toLocaleString("en-IN")} sq.ft` : ""}</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>}
  </ScrollView>
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}><View style={s.modal}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss property preview" onPress={() => setSelected(null)} />{selected && <View accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 22) }]}><View style={s.handle} /><ScrollView><View style={s.headingRow}><Text style={s.eyebrow}>PROPERTY PREVIEW</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close preview" onPress={() => setSelected(null)} style={s.smallCircle}><MaterialIcons name="close" size={22} /></TouchableOpacity></View><Text style={s.sectionTitle}>{nameOf(selected)}</Text><Text style={s.note}>{selected.location.district}, {selected.location.state}</Text><Text style={s.sheetPrice}>{priceOf(selected)}</Text><View style={s.facts}><Text style={s.fact}>{selected.type}</Text><Text style={s.fact}>{selected.sellableArea != null ? `${selected.sellableArea.toLocaleString("en-IN")} sq.ft` : "Area not provided"}</Text><Text style={s.fact}>{selected.negotiable ? "Negotiable" : "Fixed price"}</Text></View><Text style={[s.note, { marginVertical: 18 }]}>Approved by an Advisor and a Verifier. Explore the full listing for photos, location, disclosures and offer options.</Text></ScrollView><TouchableOpacity accessibilityRole="button" style={s.button} onPress={() => openProperty(selected)}><Text style={s.buttonText}>View full property details</Text><MaterialIcons name="arrow-forward" size={20} color="white" /></TouchableOpacity></View>}</View></Modal>
  </View>;
}
const s = premiumStyles({
  screen: { flex: 1, backgroundColor: AppTheme.colors.background }, content: { width: "100%", maxWidth: 1248, alignSelf: "center", padding: 28, paddingBottom: 45 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22 }, 
  headingCenter: { alignItems: "center", gap: 16, marginBottom: 32, marginTop: 10 },
  centerSearchButton: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: AppTheme.colors.card, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32, borderWidth: 1, borderColor: AppTheme.colors.border, width: "100%", maxWidth: 500, marginTop: 10, ...AppTheme.shadows.float, ...AppTheme.glass },
  centerSearchText: { color: AppTheme.colors.textSecondary, fontSize: 16, fontWeight: "500" },
  eyebrow: { color: AppTheme.colors.textMuted, fontSize: 10, letterSpacing: 1.8, fontWeight: "700", textAlign: "center" }, title: { fontSize: 48, lineHeight: 54, letterSpacing: -1.8, color: AppTheme.colors.text, fontWeight: "700", textAlign: "center" }, 
  circle: { width: 58, height: 58, borderRadius: 29, backgroundColor: AppTheme.colors.primaryLight, alignItems: "center", justifyContent: "center" },
  mapNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 13 }, note: { fontSize: 14, lineHeight: 23, color: AppTheme.colors.textSecondary, flexShrink: 1 }, sectionTitle: { color: AppTheme.colors.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.7, marginTop: 9 }, count: { color: AppTheme.colors.textSecondary, fontSize: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 20 }, 
  sectionsContainer: { gap: 40 }, typeSection: { gap: 16 }, typeSectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }, typeSectionTitle: { fontSize: 24, fontWeight: "700", color: AppTheme.colors.text, letterSpacing: -0.5 }, typeSectionCount: { fontSize: 13, color: AppTheme.colors.textSecondary }, horizontalScrollContent: { gap: 18, paddingHorizontal: 4, paddingBottom: 10 },
  card: { height: 375, backgroundColor: AppTheme.colors.primaryLight, borderRadius: AppTheme.radius.xl, overflow: "hidden", borderWidth: 1, borderColor: AppTheme.colors.border, ...AppTheme.shadows.card, ...AppTheme.glass }, noPhoto: { flex: 1, alignItems: "center", paddingTop: 60 }, photoLabel: { color: AppTheme.colors.textSecondary, fontSize: 12, marginTop: 12 }, verified: { position: "absolute", top: 17, left: 17, backgroundColor: AppTheme.colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 5, ...AppTheme.glass }, verifiedText: { color: AppTheme.colors.primaryDark, fontSize: 11, fontWeight: "600" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  typePill: { borderWidth: 1, borderColor: AppTheme.colors.border, borderRadius: 30, paddingVertical: 10, paddingHorizontal: 22, backgroundColor: AppTheme.colors.card, ...AppTheme.glass },
  activePill: { backgroundColor: AppTheme.colors.primaryDark, borderColor: AppTheme.colors.primaryDark },
  typeLabel: { color: AppTheme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  activeLabel: { color: AppTheme.colors.white },
  glass: { position: "absolute", bottom: 12, left: 12, right: 12, backgroundColor: "rgba(255,255,255,0.7)", padding: 20, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", ...AppTheme.glass }, cardTitle: { color: AppTheme.colors.text, fontSize: 21, lineHeight: 26, fontWeight: "700" }, cardLocation: { color: AppTheme.colors.textSecondary, fontSize: 12, marginTop: 6 }, priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15, gap: 8 }, price: { color: AppTheme.colors.primaryDark, fontSize: 22, fontWeight: "700" }, smallCircle: { backgroundColor: AppTheme.colors.background, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, empty: { padding: 35, borderRadius: 24, backgroundColor: AppTheme.colors.card, gap: 18, ...AppTheme.shadows.soft, ...AppTheme.glass },
  modal: { flex: 1, backgroundColor: "rgba(15,33,55,0.42)", justifyContent: "flex-end" }, sheet: { width: "100%", maxWidth: 660, alignSelf: "center", backgroundColor: AppTheme.colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 26, maxHeight: "85%", ...AppTheme.shadows.float, ...AppTheme.glass }, handle: { height: 4, width: 42, borderRadius: 4, backgroundColor: AppTheme.colors.border, alignSelf: "center", marginBottom: 22 }, sheetPrice: { fontSize: 34, fontWeight: "800", color: AppTheme.colors.primaryDark, marginVertical: 20 }, facts: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, fact: { backgroundColor: AppTheme.colors.card, padding: 12, borderRadius: 14, color: AppTheme.colors.textSecondary, ...AppTheme.glass }, button: { backgroundColor: AppTheme.colors.primary, padding: 18, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }, buttonText: { color: "white", fontSize: 14, fontWeight: "700" },
});
