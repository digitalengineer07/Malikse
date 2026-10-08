import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text, View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import type { UserRole } from "../src/types/auth.types";
import { actorId, Listing, statusLabels, workflowService } from "../src/services/workflowService";
import { AppTheme } from "../constants/theme";
import { Action, ui, WorkflowScreen } from "./WorkflowUI";
import { dashboardRoutes } from "../src/utils/accountRoutes";

export default function PropertyQueueScreen({ role }: { role: UserRole }) {
  const router = useRouter();
  const { user, authState, hydrated } = useAuthStore();
  const [properties, setProperties] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [revision, setRevision] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  useFocusEffect(useCallback(() => {
    let active = true;
    if (user?.role !== role || authState !== "AUTHENTICATED") return;
    setLoading(true); setError("");
    workflowService.queue(role).then(data => { if (active) setProperties(data); }).catch((cause) => { if (active) { setProperties([]); setError(cause.response?.data?.message || "Could not load properties"); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // Refresh on account changes and explicit reloads, even when the role is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, authState, role, revision]));
  if (!hydrated) return <ActivityIndicator />;
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;
  if (user.role !== role) return <Redirect href={dashboardRoutes[user.role]} />;
  const claim = async (id: string) => {
    setBusy(true); setError("");
    try { await workflowService.claim(id); router.push({ pathname: "/verification/[id]", params: { id } }); }
    catch (cause: any) { setError(cause.response?.data?.message || "Could not claim property"); setRevision(value => value + 1); }
    finally { setBusy(false); }
  };
  const filtered = properties.filter(property => filter === "all" || property.status === filter);
  const filterOptions = ["all", "draft", "pending", "advisor_verified", "correction_required", "rejected", "verified"].filter(status => role === "user" || role === "admin" || status !== "draft");
  
  return <WorkflowScreen title={role === "user" ? "My listings" : role === "admin" ? "Property verification tracking" : `${role === "advisor" ? "Advisor" : "Verifier"} review queue`}>
    <View style={[ui.row, { justifyContent: "space-between", zIndex: 10 }]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Action title="My dashboard" secondary onPress={() => router.push(dashboardRoutes[role])} />
        <Action title="Refresh" secondary onPress={() => setRevision(value => value + 1)} />
        {role === "user" && <Action title="List a property" onPress={() => router.push(user.demoKycComplete ? "/listing/create" : "/kyc")} />}
      </View>
      
      <View style={{ position: "relative", zIndex: 20 }}>
        <TouchableOpacity accessibilityRole="button" onPress={() => setDropdownOpen(!dropdownOpen)} style={localStyles.dropdownToggle}>
          <Text style={localStyles.dropdownToggleText}>Status: {filter === "all" ? "All" : statusLabels[filter]}</Text>
          <MaterialIcons name={dropdownOpen ? "arrow-drop-up" : "arrow-drop-down"} size={22} color="#111827" />
        </TouchableOpacity>
        {dropdownOpen && (
          <View style={[localStyles.dropdownMenu, Platform.OS === "web" && { backdropFilter: "none" } as any]}>
            {filterOptions.map(status => (
              <TouchableOpacity key={status} onPress={() => { setFilter(status); setDropdownOpen(false); }} style={[localStyles.dropdownItem, filter === status && localStyles.dropdownItemActive]}>
                <Text style={[localStyles.dropdownItemText, filter === status && localStyles.dropdownItemTextActive]}>{status === "all" ? "All" : statusLabels[status]}</Text>
                {filter === status && <MaterialIcons name="check" size={16} color="#111827" />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
    <Text style={ui.muted}>Draft → Advisor review → Verifier review → Published. Corrections return to the seller and restart review after resubmission.</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {loading ? <ActivityIndicator color={AppTheme.colors.primary} /> : !error && filtered.length === 0 ? <Text style={ui.text}>No properties in this queue.</Text> : null}
    {loading ? null : filtered.map(property => {
      const assigned = actorId(role === "advisor" ? property.assignedAdvisorId : property.assignedVerifierId);
      const unassigned = ["advisor", "verifier"].includes(role) && !assigned;
      return <View key={property._id} style={ui.card}>
        <Text style={ui.heading}>{property.title || `${property.type} in ${property.location.district}`}</Text>
        <Text style={ui.text}>{statusLabels[property.status] || property.status}</Text>
        <Text style={ui.muted}>{property.location.district}, {property.location.state} · ₹{property.price.toLocaleString("en-IN")}</Text>
        {property.rejectionReason ? <Text style={ui.error}>{property.rejectionReason}</Text> : null}
        {unassigned ? <Action title="Claim review" disabled={busy} onPress={() => claim(property._id)} /> : <Action title={role === "user" || role === "admin" ? "Details and history" : "Open review"} onPress={() => router.push({ pathname: "/verification/[id]", params: { id: property._id } })} />}
        {role === "user" && ["draft", "correction_required"].includes(property.status) ? <Action title={property.status === "draft" ? "Continue listing" : "Correct and resubmit"} secondary onPress={() => router.push({ pathname: "/listing/create", params: { id: property._id } })} /> : null}
      </View>;
    })}
  </WorkflowScreen>;
}

const localStyles = StyleSheet.create({
  dropdownToggle: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F2F6F9", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0" },
  dropdownToggleText: { color: "#111827", fontSize: 14, fontWeight: "600" },
  dropdownMenu: { position: "absolute", top: "100%", right: 0, marginTop: 8, backgroundColor: "rgba(255,255,255,0.9)", width: 260, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  dropdownItemActive: { backgroundColor: "#F2F6F9" },
  dropdownItemText: { color: "#4B5563", fontSize: 14, fontWeight: "500" },
  dropdownItemTextActive: { color: "#111827", fontWeight: "600" }
});
