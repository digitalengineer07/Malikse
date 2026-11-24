import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import type { UserRole } from "../src/types/auth.types";
import { actorId, Listing, statusLabels, workflowService } from "../src/services/workflowService";
import { AppTheme } from "../constants/theme";
import { Action, ui, WorkflowScreen } from "./WorkflowUI";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandLockup } from "./BrandLockup";
import { AccountHeaderBackdrop, accountHeaderStyle } from "./AccountHeaderBackdrop";
import { dashboardRoutes } from "../src/utils/accountRoutes";

export default function PropertyQueueScreen({ role }: { role: UserRole }) {
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [queueOwner, setQueueOwner] = useState<string>();
  const { user, authState, hydrated } = useAuthStore();
  const [properties, setProperties] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [revision, setRevision] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (user?.role !== role || authState !== "AUTHENTICATED") return;
    setLoading(true); setError("");
    const refresh = () => workflowService.queue(role).then(data => {
      if (!active) return;
      setQueueOwner(user.id); setProperties(data); setNextCursor((data as any).nextCursor);
      if (data.some(property => property.status === "queued")) timer = setTimeout(refresh, 3000);
    }).catch((cause) => { if (active) { if (role !== "advisor") setProperties([]); setError(cause.response?.data?.message || "Could not load properties"); } }).finally(() => { if (active) setLoading(false); });
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  // Refresh on account changes and explicit reloads, even when the role is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, authState, role, revision]));
  const filtered = useMemo(() => queueOwner === user?.id
    ? properties.filter(property => filter === "all" || property.status === filter)
    : [], [filter, properties, queueOwner, user?.id]);
  if (!hydrated) return <ActivityIndicator />;
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;
  if (user.role !== role) return <Redirect href={dashboardRoutes[user.role]} />;
  const claim = async (id: string) => {
    setBusy(true); setError("");
    try { await workflowService.claim(id); router.push({ pathname: "/verification/[id]", params: { id } }); }
    catch (cause: any) { setError(cause.response?.data?.message || "Could not claim property"); setRevision(value => value + 1); }
    finally { setBusy(false); }
  };
  const loadMore = async () => {
    if (busy || !nextCursor) return;
    setBusy(true);
    try { const rows = await workflowService.queue(role, nextCursor); setProperties(old => [...old, ...rows]); setNextCursor((rows as any).nextCursor); }
    catch { setError("Could not load the next page. Please try again."); } finally { setBusy(false); }
  };
  const filterOptions = ["all", "draft", "queued", "pending", "advisor_verified", "correction_required", "rejected", "verified"].filter(status => role === "user" || role === "admin" || !["draft", "queued"].includes(status));
  
  if (role === "advisor") {
    const backToDashboard = () => router.dismissTo(dashboardRoutes.advisor);
    return (
      <View style={localStyles.advisorScreen}>
        {focused && <StatusBar style="light" />}
        <View style={[localStyles.advisorHeader, { paddingTop: insets.top + 14 }]}>
          <AccountHeaderBackdrop top={insets.top + 4} />
          <View style={localStyles.advisorHeaderInner}>
            <View style={localStyles.advisorTop}>
              <Pressable accessibilityRole="button" accessibilityLabel="Back to Advisor dashboard" onPress={backToDashboard} style={localStyles.headerIcon}>
                <MaterialIcons name="arrow-back" size={22} color="#fff" />
              </Pressable>
              <BrandLockup style={localStyles.queueBrand} />
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh reviews" disabled={loading}
                onPress={() => setRevision(value => value + 1)} style={localStyles.headerIcon}>
                {loading ? <ActivityIndicator size="small" color="#FCC61C" /> : <MaterialIcons name="refresh" size={22} color="#fff" />}
              </Pressable>
            </View>
            <View style={accountHeaderStyle.titleGroup}>
              <Text accessibilityRole="header" style={[localStyles.queueTitle, accountHeaderStyle.heading]}>Advisor review queue</Text>
              <Text style={localStyles.queueHint}>Review assigned properties and find past decisions.</Text>
            </View>
          </View>
        </View>
        <FlatList
          data={filtered}
          keyExtractor={property => property._id}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          contentContainerStyle={[localStyles.queueContent, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <View style={localStyles.queueFilters}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: dropdownOpen }}
                onPress={() => setDropdownOpen(open => !open)} style={localStyles.queueFilter}>
                <Text style={localStyles.queueLabel}>Status · {filter === "all" ? "All" : statusLabels[filter]}</Text>
                <MaterialIcons name={dropdownOpen ? "expand-less" : "expand-more"} size={20} color="#14263E" />
              </Pressable>
              {dropdownOpen && <View style={localStyles.filterOptions}>
                {filterOptions.map(status => (
                  <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: status === filter }}
                    style={[localStyles.filterOption, status === filter && localStyles.selectedOption]}
                    onPress={() => { setFilter(status); setDropdownOpen(false); }}>
                    <Text style={localStyles.queueLabel}>{status === "all" ? "All statuses" : statusLabels[status]}</Text>
                  </Pressable>
                ))}
              </View>}
              {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
            </View>
          }
          ListEmptyComponent={loading ? <ActivityIndicator color="#14263E" /> : !error
            ? <Text style={localStyles.emptyQueue}>No properties match this status.</Text>
            : undefined}
          renderItem={({ item: property }) => {
            const unassigned = !actorId(property.assignedAdvisorId);
            const actionLabel = unassigned ? "Claim review" : "Open review";
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel}, ${property.title || property.type}`}
                disabled={unassigned && busy} style={localStyles.reviewCard}
                onPress={() => unassigned ? void claim(property._id) : router.push({ pathname: "/verification/[id]", params: { id: property._id } })}>
                <View style={localStyles.reviewIcon}><MaterialIcons name="home-work" size={22} color="#14263E" /></View>
                <View style={localStyles.reviewCopy}>
                  <Text style={localStyles.reviewTitle}>{property.title || `${property.type} in ${property.location.district}`}</Text>
                  <Text style={localStyles.reviewStatus}>{statusLabels[property.status] || property.status}</Text>
                  <Text style={localStyles.reviewMeta}>{property.location.district}, {property.location.state} · ₹{property.price.toLocaleString("en-IN")}</Text>
                  {!!property.rejectionReason && <Text style={ui.error}>{property.rejectionReason}</Text>}
                  <Text style={localStyles.queueLabel}>{actionLabel}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={21} color="#14263E" />
              </Pressable>
            );
          }}
          ListFooterComponent={nextCursor && queueOwner === user.id
            ? <Pressable accessibilityRole="button" style={localStyles.queueFilter} disabled={busy || loading} onPress={loadMore}>
                <Text style={localStyles.queueLabel}>{busy ? "Loading…" : "Load more properties"}</Text>
              </Pressable> : undefined}
        />
      </View>
    );
  }

  return <WorkflowScreen title={role === "user" ? "My listings" : role === "admin" ? "Property verification tracking" : `Verifier review queue`}>
    <View style={[ui.row, { justifyContent: "space-between", zIndex: 10 }]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Action title="My dashboard" secondary onPress={() => router.push(dashboardRoutes[role])} />
        <Action title="Refresh" secondary onPress={() => setRevision(value => value + 1)} />
        {role === "user" && <Action title="List a property" onPress={() => router.push((user.isVerifiedIdentity || user.demoKycComplete) ? "/listing/create" : "/kyc")} />}
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
    <Text style={ui.muted}>Draft → Assigned staff review → Published. Corrections return to the seller and restart review after resubmission.</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {loading ? <ActivityIndicator color={AppTheme.colors.primary} /> : !error && filtered.length === 0 ? <Text style={ui.text}>No properties in this queue.</Text> : null}
    {loading ? null : filtered.map(property => {
      const assigned = actorId(property.assignedVerifierId);
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
    {!!nextCursor && <Action title={busy ? "Loading…" : "Load more properties"} disabled={busy} onPress={loadMore} />}
  </WorkflowScreen>;
}

const localStyles = StyleSheet.create({
  advisorScreen: { flex: 1, backgroundColor: "#F5F2E9" },
  advisorHeader: { backgroundColor: "#14263E", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden" },
  advisorHeaderInner: { width: "100%", maxWidth: 900, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  advisorTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  queueBrand: { flex: 1 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#244268", alignItems: "center", justifyContent: "center" },
  queueTitle: { color: "#fff", fontFamily: "Fraunces" },
  queueHint: { color: "#E7EDF5", fontFamily: "Manrope", fontSize: 13, lineHeight: 19 },
  queueContent: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 16, gap: 10 },
  queueFilters: { gap: 8, paddingBottom: 3 },
  queueFilter: { minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#FFF1C0" },
  filterOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterOption: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#fff" },
  selectedOption: { backgroundColor: "#FFF1C0" },
  queueLabel: { color: "#14263E", fontFamily: "ManropeBold", fontSize: 13, flexShrink: 1 },
  emptyQueue: { color: "#536174", padding: 16, fontFamily: "Manrope" },
  reviewCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DEDCD5" },
  reviewIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1C0" },
  reviewCopy: { flex: 1, minWidth: 0, gap: 5 },
  reviewTitle: { color: "#14263E", fontFamily: "ManropeExtraBold", fontSize: 17 },
  reviewStatus: { color: "#536174", fontFamily: "ManropeBold", fontSize: 12 },
  reviewMeta: { color: "#536174", fontFamily: "Manrope", fontSize: 13 },
  dropdownToggle: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F2F6F9", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0" },
  dropdownToggleText: { color: "#111827", fontSize: 14, fontWeight: "600" },
  dropdownMenu: { position: "absolute", top: "100%", right: 0, marginTop: 8, backgroundColor: "rgba(255,255,255,0.9)", width: 260, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  dropdownItemActive: { backgroundColor: "#F2F6F9" },
  dropdownItemText: { color: "#4B5563", fontSize: 14, fontWeight: "500" },
  dropdownItemTextActive: { color: "#111827", fontWeight: "600" }
});
