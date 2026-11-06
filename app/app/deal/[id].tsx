import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/authStore";
import { dealService } from "../../src/services/dealService";
import type { Deal } from "../../src/types/deal.types";

export default function DealDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore(state => state.user);
  const hydrated = useAuthStore(state => state.hydrated);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    if (!user || !id) return;
    let active = true;
    setError("");
    dealService.getDeal(id).then(value => { if (active) setDeal(value); })
      .catch(() => { if (active) setError("Could not load this deal."); });
    return () => { active = false; };
  }, [id, user?.id]));

  if (!hydrated) return <ActivityIndicator />;
  if (!user) return <Redirect href="/login" />;
  const property = deal?.propertyId;
  const propertyName = typeof property === "object" && property !== null && "title" in property
    ? String(property.title) : "Property";
  const propertyId = typeof property === "object" && property !== null && "_id" in property
    ? String(property._id) : typeof property === "string" ? property : "";

  return <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 40, gap: 20, flexGrow: 1, backgroundColor: "#F4F6F9" }}>
    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button"><Text style={{ color: "#1D4ED8", fontSize: 16 }}>Back</Text></TouchableOpacity>
    <Text style={{ fontSize: 28, fontWeight: "700", color: "#172033" }}>Deal update</Text>
    {error ? <Text style={{ color: "#B42318" }}>{error}</Text> : !deal ? <ActivityIndicator /> : <View style={{ padding: 20, borderRadius: 16, backgroundColor: "#FFFFFF", gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", color: "#172033" }}>{propertyName}</Text>
      <Text style={{ color: "#475467" }}>Status: {deal.status.replace(/_/g, " ")}</Text>
      <Text style={{ color: "#475467" }}>Offer: ₹{deal.offerAmount.toLocaleString("en-IN")}</Text>
      {propertyId ? <TouchableOpacity onPress={() => router.push({ pathname: "/property/[id]", params: { id: propertyId } })} accessibilityRole="button"><Text style={{ color: "#1D4ED8", fontWeight: "600" }}>View property</Text></TouchableOpacity> : null}
    </View>}
  </ScrollView>;
}
