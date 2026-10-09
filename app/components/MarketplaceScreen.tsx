import React, { useCallback, useState } from "react";
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ScrollView, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import { propertyService } from "../src/services/propertyService";
import type { Property, PropertyType } from "../src/types/property.types";
import { AppTheme } from "../constants/theme";
import { premiumStyles } from "../constants/typography";

const propertyTypes: { value: PropertyType | undefined; label: string }[] = [
  { value: undefined, label: "All properties" }, { value: "land", label: "Land" },
  { value: "flat", label: "Flats" }, { value: "house", label: "Houses" },
  { value: "shop", label: "Shops" }, { value: "office", label: "Offices" },
];

export default function MarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PropertyType | undefined>(undefined);
  const [properties, setProperties] = useState<Property[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  useFocusEffect(useCallback(() => {
    let active = true;
    propertyService.searchProperties({ type, location: query }).then(data => { if (active) setProperties(data); }).catch(() => {});
    return () => { active = false; };
  }, [type, query]));

  const openProperty = useCallback((property: Property) => {
    router.push({ pathname: "/property/[id]", params: { id: property._id || property.id } });
  }, [router]);

  return <View style={styles.screen}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: AppTheme.colors.background }]} />
    <View style={[StyleSheet.absoluteFill, { top: 0, bottom: 0 }]}>
      <VerifiedPropertyMap properties={properties} onSelect={openProperty} />
    </View>
    
    <View style={[styles.topControls, { paddingTop: Math.max(insets.top, 20) }]}>
       <View style={styles.searchBarWrapper}>
         {Platform.OS !== "web" ? (
           <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
         ) : null}
         <View style={styles.searchBar}>
           <MaterialIcons name="search" size={24} color={AppTheme.colors.textMuted} />
           <TextInput 
             style={styles.searchInput} 
             placeholder="Search locations..." 
             placeholderTextColor={AppTheme.colors.textMuted}
             value={query}
             onChangeText={setQuery}
           />
           <TouchableOpacity accessibilityRole="button" onPress={() => setShowFilters(!showFilters)} style={styles.filterBtn}>
             <MaterialIcons name="tune" size={24} color={showFilters ? AppTheme.colors.primary : AppTheme.colors.textMuted} />
           </TouchableOpacity>
         </View>
       </View>
       
       {showFilters && (
         <View style={styles.filtersPanelWrapper}>
           {Platform.OS !== "web" ? (
             <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
           ) : null}
           <View style={styles.filtersPanel}>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
               {propertyTypes.map(({ value, label }) => (
                 <TouchableOpacity 
                   key={value || "all"} 
                   accessibilityRole="button" 
                   onPress={() => setType(value)} 
                   style={[styles.typePill, type === value && styles.activePill]}
                 >
                   <Text style={[styles.typeLabel, type === value && styles.activeLabel]}>{label}</Text>
                 </TouchableOpacity>
               ))}
             </ScrollView>
           </View>
         </View>
       )}
    </View>
  </View>;
}

const styles = premiumStyles({
  screen: { flex: 1, backgroundColor: AppTheme.colors.background },
  topControls: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, width: "100%", maxWidth: 800, alignSelf: "center" },
  searchBarWrapper: { borderRadius: 28, overflow: "hidden", ...AppTheme.shadows.float },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: Platform.OS === "web" ? AppTheme.colors.card : "rgba(255,255,255,0.7)", paddingHorizontal: 20, height: 56, ...AppTheme.glass },
  searchInput: { flex: 1, height: "100%", marginLeft: 12, fontSize: 16, color: AppTheme.colors.text },
  filterBtn: { padding: 8, marginLeft: 8 },
  filtersPanelWrapper: { marginTop: 12, borderRadius: 24, overflow: "hidden", ...AppTheme.shadows.medium },
  filtersPanel: { backgroundColor: Platform.OS === "web" ? AppTheme.colors.card : "rgba(255,255,255,0.7)", padding: 16, ...AppTheme.glass },
  typeRow: { flexDirection: "row", gap: 10, paddingHorizontal: 4 },
  typePill: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 1, borderColor: AppTheme.colors.border },
  activePill: { backgroundColor: AppTheme.colors.primary, borderColor: AppTheme.colors.primary },
  typeLabel: { fontSize: 13, fontWeight: "600", color: AppTheme.colors.textSecondary },
  activeLabel: { color: "white" }
});
