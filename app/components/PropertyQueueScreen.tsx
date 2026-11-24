import React, { useCallback, useMemo, useRef, useState } from "react";
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
import AccountArtworkFooter from "./AccountArtworkFooter";
import { AccountHeaderBackdrop, accountHeaderStyle } from "./AccountHeaderBackdrop";
import { dashboardRoutes } from "../src/utils/accountRoutes";

const advisorPageSize = 10;

const advisorFilters = [
  { id: "all", label: "All" },
  { id: "pending", label: "To review" },
  { id: "correction_required", label: "Corrections" },
  { id: "verified", label: "Published" },
  { id: "rejected", label: "Rejected" },
  { id: "sold", label: "Sold" },
] as const;

const neutralReview = { surface: "#FFFFFF", border: "#DEDCD5", badge: "#F0EEE8", ink: "#536174" };
const inReview = { label: "In review", surface: "#FFFCF2", border: "#E9D6A1", badge: "#FFF1C0", ink: "#705213" };
const reviewAppearance: Record<string, (typeof neutralReview & { label: string }) | undefined> = {
  verified: { label: "Verified · Published", surface: "#F7FCF8", border: "#C5DDCC", badge: "#E1F2E7", ink: "#245A3B" },
  rejected: { label: "Rejected", surface: "#FFF8F8", border: "#E9C8CE", badge: "#FBE7EA", ink: "#882A40" },
  pending: inReview,
  advisor_verified: inReview,
  queued: { ...inReview, label: "Queued" },
  correction_required: { label: "Corrections requested", surface: "#FFF9F3", border: "#EFD0B2", badge: "#FCEBD9", ink: "#8C4518" },
  sold: { label: "Sold", surface: "#F7F9FD", border: "#CFD9EB", badge: "#E7EDF8", ink: "#304F7D" },
};

function matchesQueueFilter(status: string, filter: string, role: UserRole) {
  return filter === "all" || status === filter ||
    (role === "advisor" && filter === "pending" && status === "advisor_verified");
}

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
  const [advisorFiltersExpanded, setAdvisorFiltersExpanded] = useState(true);
  const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([undefined]);
  const listRef = useRef<FlatList<Listing>>(null);
  const advisorCursor = role === "advisor" ? pageCursors[pageCursors.length - 1] : undefined;
  const advisorStatus = role === "advisor" && filter !== "all" ? filter : undefined;
  const advisorPageKey = JSON.stringify([user?.id, advisorStatus, advisorCursor]);
  const [loadedPageKey, setLoadedPageKey] = useState<string>();
  const currentAdvisorPage = advisorPageKey === loadedPageKey;

  
  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (user?.role !== role || authState !== "AUTHENTICATED") return;
    setLoading(true); setError("");
    const refresh = () => workflowService.queue(role, advisorCursor,
      role === "advisor" ? { limit: advisorPageSize, status: advisorStatus } : undefined).then(data => {
      if (!active) return;
      setQueueOwner(user.id); setProperties(data); setNextCursor(data.nextCursor);
      if (role === "advisor") setLoadedPageKey(advisorPageKey);
      if (role !== "advisor" && data.some(property => property.status === "queued")) timer = setTimeout(refresh, 3000);
    }).catch((cause) => { if (active) { if (role !== "advisor") setProperties([]); setError(cause.response?.data?.message || "Could not load properties"); } }).finally(() => { if (active) setLoading(false); });
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  // Refresh on account changes and explicit reloads, even when the role is unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, authState, role, revision, advisorCursor, advisorStatus, advisorPageKey]));
  const filtered = useMemo(() => queueOwner === user?.id
    ? properties.filter(property => matchesQueueFilter(property.status, filter, role))
    : [], [filter, properties, queueOwner, role, user?.id]);
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
    try { const rows = await workflowService.queue(role, nextCursor); setProperties(old => [...old, ...rows]); setNextCursor(rows.nextCursor); }
    catch { setError("Could not load the next page. Please try again."); } finally { setBusy(false); }
  };
  const filterOptions = ["all", "draft", "queued", "pending", "advisor_verified", "correction_required", "rejected", "verified"].filter(status => role === "user" || role === "admin" || !["draft", "queued"].includes(status));
  
  if (role === "advisor") {
    const changePage = (cursors: (string | undefined)[]) => {
      setLoading(true);
      setError("");
      setPageCursors(cursors);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    };
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
          ref={listRef}
          data={currentAdvisorPage ? filtered.slice(0, advisorPageSize) : []}
          keyExtractor={property => property._id}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          contentContainerStyle={localStyles.queueContent}
          ListHeaderComponent={
            <View style={localStyles.queueFilters}>
              <View style={localStyles.filterToolbar}>
                <Text accessibilityRole="header" style={localStyles.filterHeading}>Review status</Text>
                {!advisorFiltersExpanded && <Text style={localStyles.reviewMeta}>
                  {advisorFilters.find(option => option.id === filter)?.label}
                </Text>}
                <Pressable accessibilityRole="button"
                  accessibilityLabel={advisorFiltersExpanded ? "Hide review status filters" : "Show review status filters"}
                  accessibilityState={{ expanded: advisorFiltersExpanded }}
                  onPress={() => setAdvisorFiltersExpanded(expanded => !expanded)}
                  style={localStyles.filterChevron}>
                  <MaterialIcons name={advisorFiltersExpanded ? "expand-less" : "expand-more"} size={21} color="#14263E" />
                </Pressable>
              </View>
              {advisorFiltersExpanded && <View style={localStyles.filterOptions}>
                {advisorFilters.map(({ id, label }) => (
                  <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: id === filter }}
                    style={[localStyles.filterOption, id === filter && localStyles.selectedOption]}
                    onPress={() => {
                      if (id === filter) return;
                      setFilter(id);
                      changePage([undefined]);
                    }}>
                    {id === filter && <MaterialIcons name="check" size={15} color="#14263E" />}
                    <Text style={localStyles.queueLabel}>{label}</Text>
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
            const sellerName = property.sellerName?.trim() ||
              (typeof property.ownerId === "object" ? property.ownerId?.name?.trim() : undefined);
            const appearance = reviewAppearance[property.status];
            const colors = appearance ?? neutralReview;
            const status = appearance?.label ?? statusLabels[property.status] ?? property.status;
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel}, ${property.title || property.type}`}
                disabled={unassigned && busy} style={[localStyles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => unassigned ? void claim(property._id) : router.push({ pathname: "/verification/[id]", params: { id: property._id } })}>
                <View style={localStyles.reviewTop}>
                  <View style={localStyles.reviewIdentity}>
                    <View style={localStyles.reviewIcon}><MaterialIcons name="home-work" size={19} color="#14263E" /></View>
                    <Text style={localStyles.reviewTitle}>{property.title || `${property.type} in ${property.location.district}`}</Text>
                  </View>
                  <View style={[localStyles.reviewStatusBadge, { backgroundColor: colors.badge }]}>
                    <Text style={[localStyles.reviewStatus, { color: colors.ink }]}>{status}</Text>
                  </View>
                </View>
                <View style={localStyles.reviewDetails}>
                  <View style={localStyles.reviewMetaRow}>
                    <MaterialIcons name="person-outline" size={17} color="#536174" />
                    <Text style={localStyles.reviewMeta}>Seller: {sellerName || (unassigned ? "Available after claiming" : "Name unavailable")}</Text>
                  </View>
                  <View style={localStyles.reviewMetaRow}>
                    <MaterialIcons name="place" size={17} color="#536174" />
                    <Text style={localStyles.reviewMeta}>
                      {[property.streetAddress, property.location.district, property.location.state, property.location.pincode]
                        .filter(Boolean).join(", ") || "Property address unavailable"}
                    </Text>
                  </View>
                  {!!property.rejectionReason && <Text style={ui.error}>{property.rejectionReason}</Text>}
                </View>
                <View style={localStyles.reviewFooter}>
                  <Text style={localStyles.reviewPrice}>₹{property.price.toLocaleString("en-IN")}</Text>
                  <View style={localStyles.reviewFooterAction}>
                    {unassigned && <Text style={localStyles.queueLabel}>Claim review</Text>}
                    <MaterialIcons name="chevron-right" size={21} color="#14263E" />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={pageCursors.length > 1 || (currentAdvisorPage && nextCursor) ? (
            <View style={localStyles.pagination}>
              <Pressable accessibilityRole="button" style={localStyles.queueFilter} disabled={loading || busy || pageCursors.length === 1}
                accessibilityState={{ disabled: loading || busy || pageCursors.length === 1 }}
                onPress={() => changePage(pageCursors.slice(0, -1))}>
                <Text style={localStyles.queueLabel}>Previous</Text>
              </Pressable>
              <Text style={localStyles.reviewMeta}>Page {pageCursors.length}</Text>
              <Pressable accessibilityRole="button" style={localStyles.queueFilter} disabled={loading || busy || !currentAdvisorPage || !nextCursor}
                accessibilityState={{ disabled: loading || busy || !currentAdvisorPage || !nextCursor }}
                onPress={() => { if (nextCursor) changePage([...pageCursors, nextCursor]); }}>
                <Text style={localStyles.queueLabel}>Next</Text>
              </Pressable>
            </View>
          ) : undefined}
        />
        <View pointerEvents="none">
          <AccountArtworkFooter wavesOnly hideWhileTyping={false} />
        </View>
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
  pagination: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 },
  queueFilters: { gap: 8, paddingBottom: 3 },
  queueFilter: { minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#FFF1C0" },
  filterToolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  filterChevron: {
    marginStart: "auto", width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1C0",
  },
  filterHeading: { color: "#14263E", fontFamily: "ManropeExtraBold", fontSize: 14 },
  filterOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterOption: {
    flexGrow: 1, flexBasis: 92, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#DEDCD5",
  },
  selectedOption: { backgroundColor: "#FFF1C0", borderColor: "#DFC052" },
  queueLabel: { color: "#14263E", fontFamily: "ManropeBold", fontSize: 13, flexShrink: 1 },
  emptyQueue: { color: "#536174", padding: 16, fontFamily: "Manrope" },
  reviewCard: { gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DEDCD5" },
  reviewIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1C0" },
  reviewTitle: { flexShrink: 1, color: "#14263E", fontFamily: "ManropeExtraBold", fontSize: 17 },
  reviewTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  reviewIdentity: { flexGrow: 1, flexShrink: 1, flexBasis: 110, flexDirection: "row", alignItems: "center", gap: 8 },
  reviewDetails: { gap: 6 },
  reviewMetaRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  reviewFooter: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center",
    gap: 8, paddingTop: 9, borderTopWidth: 1, borderTopColor: "#ECE9E0",
  },
  reviewFooterAction: { marginStart: "auto", flexDirection: "row", alignItems: "center", gap: 6 },
  reviewPrice: { color: "#14263E", fontFamily: "ManropeExtraBold", fontSize: 15 },
  reviewStatusBadge: { marginStart: "auto", maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: "#F5F2E9" },
  reviewStatus: { color: "#254C3A", fontFamily: "ManropeBold", fontSize: 12 },
  reviewMeta: { flexShrink: 1, color: "#536174", fontFamily: "Manrope", fontSize: 13 },
  dropdownToggle: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F2F6F9", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0" },
  dropdownToggleText: { color: "#111827", fontSize: 14, fontWeight: "600" },
  dropdownMenu: { position: "absolute", top: "100%", right: 0, marginTop: 8, backgroundColor: "rgba(255,255,255,0.9)", width: 260, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  dropdownItemActive: { backgroundColor: "#F2F6F9" },
  dropdownItemText: { color: "#4B5563", fontSize: 14, fontWeight: "500" },
  dropdownItemTextActive: { color: "#111827", fontWeight: "600" }
});
