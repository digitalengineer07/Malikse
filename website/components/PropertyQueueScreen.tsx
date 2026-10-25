import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import { useUserListingsStore } from "../src/store/userListingsStore";
import type { UserRole } from "../src/types/auth.types";
import { actorId, Listing, statusLabels, workflowService } from "../src/services/workflowService";
import { dashboardRoutes } from "../src/utils/accountRoutes";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

const leftWatermarkAsset = require("../assets/malikse-left-bottom-watermark.png");
const rightWatermarkAsset = require("../assets/malikse-right-bottom-watermark.png");

function resolveAssetUri(asset: any): string {
  if (typeof asset === "string") return asset;
  if (asset && typeof asset === "object") {
    if (asset.uri) return asset.uri;
    if (asset.default) {
      if (typeof asset.default === "string") return asset.default;
      if (asset.default.uri) return asset.default.uri;
    }
  }
  try {
    const source = Image.resolveAssetSource(asset);
    return source?.uri || "";
  } catch {
    return "";
  }
}

const statusShortLabels: Record<string, string> = {
  all: "All",
  draft: "Draft",
  queued: "Queued",
  pending: "Pending Advisor",
  advisor_verified: "Advisor Verified",
  correction_required: "Correction Needed",
  rejected: "Rejected",
  verified: "Verified & Live",
  sold: "Sold",
};

export default function PropertyQueueScreen({ role }: { role: UserRole }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  const { user, authState, hydrated } = useAuthStore();
  const { language } = useLanguageStore();
  const { setListingsCount } = useUserListingsStore();

  const [properties, setProperties] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [revision, setRevision] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const leftWatermarkUri = resolveAssetUri(leftWatermarkAsset);
  const rightWatermarkUri = resolveAssetUri(rightWatermarkAsset);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (user?.role !== role || authState !== "AUTHENTICATED") return;
      setLoading(true);
      setError("");

      const refresh = () =>
        workflowService
          .queue(role)
          .then((data) => {
            if (!active) return;
            setProperties(data);
            setNextCursor((data as any).nextCursor);
            if (role === "user") {
              setListingsCount(data.length);
            }
            if (data.some((property) => property.status === "queued")) {
              timer = setTimeout(refresh, 3000);
            }
          })
          .catch((cause) => {
            if (active) {
              setProperties([]);
              setError(cause.response?.data?.message || "Could not load properties");
            }
          })
          .finally(() => {
            if (active) setLoading(false);
          });

      void refresh();
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [user?.id, user?.role, authState, role, revision, setListingsCount])
  );

  if (!hydrated) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0873B9" />
      </View>
    );
  }

  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;
  if (user.role !== role) return <Redirect href={dashboardRoutes[user.role]} />;

  const claim = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await workflowService.claim(id);
      router.push({ pathname: "/verification/[id]", params: { id } });
    } catch (cause: any) {
      setError(cause.response?.data?.message || "Could not claim property");
      setRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (busy || !nextCursor) return;
    setBusy(true);
    try {
      const rows = await workflowService.queue(role, nextCursor);
      setProperties((old) => [...old, ...rows]);
      setNextCursor((rows as any).nextCursor);
    } catch {
      setError("Could not load the next page. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const filtered = properties.filter((property) => filter === "all" || property.status === filter);
  const filterOptions = [
    "all",
    "draft",
    "queued",
    "pending",
    "advisor_verified",
    "correction_required",
    "rejected",
    "verified",
  ].filter(
    (status) => role === "user" || role === "admin" || !["draft", "queued"].includes(status)
  );

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "verified":
        return { bg: "#EBF9F1", text: "#137333", border: "#C6F0D4", icon: "verified" };
      case "advisor_verified":
        return { bg: "#EEF6FF", text: "#0873B9", border: "#CDE5FA", icon: "check-circle" };
      case "pending":
      case "queued":
        return { bg: "#FEF8E7", text: "#B06000", border: "#FEEFC3", icon: "hourglass-top" };
      case "correction_required":
        return { bg: "#FEF0EE", text: "#C5221F", border: "#FAD2CF", icon: "error-outline" };
      case "rejected":
        return { bg: "#FDF2F2", text: "#B91C1C", border: "#FCA5A5", icon: "cancel" };
      default:
        return { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", icon: "edit-note" };
    }
  };

  const pageTitle =
    role === "user"
      ? language === "hi"
        ? "मेरी लिस्टिंग"
        : "My listings"
      : role === "admin"
      ? "Property verification tracking"
      : `${role === "advisor" ? "Advisor" : "Verifier"} review queue`;

  const roleBadgeText =
    role === "user"
      ? "SELLER LISTINGS"
      : role === "admin"
      ? "ADMIN AUDIT"
      : `${role.toUpperCase()} QUEUE`;

  const countsByStatus = {
    all: properties.length,
    verified: properties.filter((p) => p.status === "verified").length,
    inReview: properties.filter((p) =>
      ["queued", "pending", "advisor_verified"].includes(p.status)
    ).length,
    attention: properties.filter((p) =>
      ["draft", "correction_required"].includes(p.status)
    ).length,
  };

  return (
    <View style={styles.screen}>
      {/* Top Header Bar with Navigation Menu, Post Button, Profile and clean logo */}
      <AppHeader showBack={false} showNavLinks={true} showPostPropertyBtn={true} />

      <KeyboardAvoidingView
        style={{ flex: 1, zIndex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
        >
          {/* Topline Breadcrumb & Role Badge */}
          <View style={styles.topline}>
            <View style={styles.breadcrumbRow}>
              <Text style={styles.eyebrow}>MALIKSE</Text>
              <Text style={styles.eyebrowDivider}>/</Text>
              <Text style={styles.eyebrowActive}>
                {role === "user" ? "YOUR PROPERTIES" : "WORKFLOW QUEUE"}
              </Text>
            </View>
            <View style={styles.rolePill}>
              <View style={styles.roleDot} />
              <Text style={styles.roleText}>{roleBadgeText}</Text>
            </View>
          </View>

          {/* Title Row with Properly Positioned Back Button & Count Badge */}
          <View style={styles.titleRow}>
            <View style={styles.titleLeftGroup}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={styles.backBtn}
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace(dashboardRoutes[role] || "/dashboard");
                }}
                activeOpacity={0.75}
              >
                <MaterialIcons name="arrow-back" size={20} color="#102B52" />
              </TouchableOpacity>
              <Text accessibilityRole="header" style={[styles.title, isMobile && styles.titleMobile]}>
                {pageTitle}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {properties.length} {properties.length === 1 ? "property" : "properties"}
                </Text>
              </View>
            </View>
          </View>

          {/* Actions & Filters Bar */}
          <View style={[styles.actionControlsRow, isMobile && styles.actionControlsRowMobile]}>
            <View style={styles.actionLeftGroup}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.secondaryBtn}
                onPress={() => router.push(dashboardRoutes[role])}
                activeOpacity={0.8}
              >
                <MaterialIcons name="dashboard" size={17} color="#102B52" />
                <Text style={styles.secondaryBtnText}>
                  {language === "hi" ? "डैशबोर्ड" : "My dashboard"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                style={styles.secondaryBtn}
                onPress={() => setRevision((v) => v + 1)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={17} color="#102B52" />
                <Text style={styles.secondaryBtnText}>
                  {language === "hi" ? "ताज़ा करें" : "Refresh"}
                </Text>
              </TouchableOpacity>

              {role === "user" && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.primaryActionBtn}
                  onPress={() =>
                    router.push(user.demoKycComplete ? "/listing/create" : "/kyc")
                  }
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>
                    {language === "hi" ? "प्रॉपर्टी लिस्ट करें" : "List a property"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Dropdown */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setDropdownOpen(!dropdownOpen)}
                style={styles.dropdownToggle}
                activeOpacity={0.8}
              >
                <MaterialIcons name="filter-list" size={18} color="#0873B9" />
                <Text style={styles.dropdownToggleText}>
                  Status: {statusShortLabels[filter] || filter}
                </Text>
                <MaterialIcons
                  name={dropdownOpen ? "arrow-drop-up" : "arrow-drop-down"}
                  size={20}
                  color="#102B52"
                />
              </TouchableOpacity>

              {dropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {filterOptions.map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => {
                        setFilter(status);
                        setDropdownOpen(false);
                      }}
                      style={[
                        styles.dropdownItem,
                        filter === status && styles.dropdownItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          filter === status && styles.dropdownItemTextActive,
                        ]}
                      >
                        {statusShortLabels[status] || statusLabels[status] || status}
                      </Text>
                      {filter === status && (
                        <MaterialIcons name="check" size={16} color="#0873B9" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Verification Pipeline Stages Tracker Banner */}
          <View style={styles.pipelineCard}>
            <View style={styles.pipelineHeader}>
              <View style={styles.pipelineTitleRow}>
                <MaterialIcons name="verified-user" size={18} color="#0873B9" />
                <Text style={styles.pipelineTitle}>MalikSe Bihar Verification Process</Text>
              </View>
              <Text style={styles.pipelineSubtitle}>
                Every listing is verified on-ground before being published to buyers
              </Text>
            </View>

            <View style={styles.stagesRow}>
              <View style={styles.stageItem}>
                <View style={[styles.stageIconBadge, { backgroundColor: "#EEF6FF" }]}>
                  <MaterialIcons name="edit" size={15} color="#0873B9" />
                </View>
                <View>
                  <Text style={styles.stageName}>1. Draft</Text>
                  <Text style={styles.stageSub}>Seller submission</Text>
                </View>
              </View>

              <MaterialIcons name="chevron-right" size={18} color="#94A3B8" />

              <View style={styles.stageItem}>
                <View style={[styles.stageIconBadge, { backgroundColor: "#FEF8E7" }]}>
                  <MaterialIcons name="assignment-ind" size={15} color="#B06000" />
                </View>
                <View>
                  <Text style={styles.stageName}>2. Advisor Review</Text>
                  <Text style={styles.stageSub}>Ground survey</Text>
                </View>
              </View>

              <MaterialIcons name="chevron-right" size={18} color="#94A3B8" />

              <View style={styles.stageItem}>
                <View style={[styles.stageIconBadge, { backgroundColor: "#EBF9F1" }]}>
                  <MaterialIcons name="gavel" size={15} color="#137333" />
                </View>
                <View>
                  <Text style={styles.stageName}>3. Verifier Review</Text>
                  <Text style={styles.stageSub}>Legal & registry</Text>
                </View>
              </View>

              <MaterialIcons name="chevron-right" size={18} color="#94A3B8" />

              <View style={styles.stageItem}>
                <View style={[styles.stageIconBadge, { backgroundColor: "#EBF9F1" }]}>
                  <MaterialIcons name="verified" size={15} color="#137333" />
                </View>
                <View>
                  <Text style={styles.stageName}>4. Published</Text>
                  <Text style={styles.stageSub}>Marketplace live</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Filter Status Tabs */}
          {properties.length > 0 && (
            <View style={styles.quickChipsRow}>
              <TouchableOpacity
                onPress={() => setFilter("all")}
                style={[styles.quickChip, filter === "all" && styles.quickChipActive]}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    filter === "all" && styles.quickChipTextActive,
                  ]}
                >
                  All ({countsByStatus.all})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilter("verified")}
                style={[styles.quickChip, filter === "verified" && styles.quickChipActive]}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    filter === "verified" && styles.quickChipTextActive,
                  ]}
                >
                  Verified ({countsByStatus.verified})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilter("pending")}
                style={[styles.quickChip, filter === "pending" && styles.quickChipActive]}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    filter === "pending" && styles.quickChipTextActive,
                  ]}
                >
                  In Review ({countsByStatus.inReview})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilter("correction_required")}
                style={[
                  styles.quickChip,
                  filter === "correction_required" && styles.quickChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    filter === "correction_required" && styles.quickChipTextActive,
                  ]}
                >
                  Action Needed ({countsByStatus.attention})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Error Message */}
          {!!error && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#0873B9" />
              <Text style={styles.loaderText}>Loading properties...</Text>
            </View>
          )}

          {/* Empty State Card */}
          {!loading && !error && filtered.length === 0 && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons name="real-estate-agent" size={38} color="#0873B9" />
              </View>

              <Text style={styles.emptyTitle}>
                {filter === "all"
                  ? language === "hi"
                    ? "आपके पास अभी कोई लिस्टिंग नहीं है"
                    : "No properties listed yet"
                  : `No properties found in "${statusShortLabels[filter] || filter}"`}
              </Text>

              <Text style={styles.emptySubtitle}>
                {filter === "all"
                  ? "List your residential plot, commercial space, or agricultural land in Bihar. Get verified by MalikSe advisors and discover genuine buyers."
                  : "Try switching to 'All' or a different status to view your other listings."}
              </Text>

              <View style={styles.emptyActionsRow}>
                {role === "user" ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.emptyPrimaryBtn}
                    onPress={() =>
                      router.push(user.demoKycComplete ? "/listing/create" : "/kyc")
                    }
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.emptyPrimaryBtnText}>
                      {language === "hi" ? "पहली प्रॉपर्टी लिस्ट करें" : "List Your First Property"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.emptyPrimaryBtn}
                    onPress={() => setRevision((v) => v + 1)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
                    <Text style={styles.emptyPrimaryBtnText}>Refresh Queue</Text>
                  </TouchableOpacity>
                )}

                {filter !== "all" && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.emptySecondaryBtn}
                    onPress={() => setFilter("all")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptySecondaryBtnText}>View All Listings</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Property Cards List */}
          {!loading &&
            filtered.map((property) => {
              const assigned = actorId(
                role === "advisor" ? property.assignedAdvisorId : property.assignedVerifierId
              );
              const unassigned = ["advisor", "verifier"].includes(role) && !assigned;
              const badge = getStatusBadgeStyle(property.status);

              return (
                <View key={property._id} style={styles.propertyCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.propertyTypePill}>
                        <Text style={styles.propertyTypeText}>
                          {property.type ? property.type.toUpperCase() : "LAND"}
                        </Text>
                      </View>
                      <Text style={styles.cardTitle}>
                        {property.title || `${property.type} in ${property.location.district}`}
                      </Text>
                    </View>

                    {/* Status Pill Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: badge.bg, borderColor: badge.border },
                      ]}
                    >
                      <MaterialIcons
                        name={badge.icon as any}
                        size={14}
                        color={badge.text}
                      />
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {statusShortLabels[property.status] || property.status}
                      </Text>
                    </View>
                  </View>

                  {/* Property Meta Details */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <MaterialIcons name="location-on" size={16} color="#0873B9" />
                      <Text style={styles.metaText}>
                        {property.location.district}, {property.location.state}
                        {property.location.block ? ` · ${property.location.block}` : ""}
                      </Text>
                    </View>

                    <View style={styles.metaDivider} />

                    <View style={styles.metaItem}>
                      <MaterialIcons name="payments" size={16} color="#059669" />
                      <Text style={styles.priceText}>
                        ₹{property.price ? property.price.toLocaleString("en-IN") : "Price on request"}
                      </Text>
                    </View>

                    {(property.sellableArea || property.totalArea) ? (
                      <>
                        <View style={styles.metaDivider} />
                        <View style={styles.metaItem}>
                          <MaterialIcons name="square-foot" size={16} color="#64748B" />
                          <Text style={styles.metaText}>
                            {property.sellableArea || property.totalArea} sq ft
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  {/* Rejection / Correction Note */}
                  {property.rejectionReason && (
                    <View style={styles.rejectionBox}>
                      <MaterialIcons name="warning" size={16} color="#C5221F" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectionTitle}>Feedback from verification team:</Text>
                        <Text style={styles.rejectionBody}>{property.rejectionReason}</Text>
                      </View>
                    </View>
                  )}

                  {/* Card Actions Footer */}
                  <View style={styles.cardFooter}>
                    {unassigned ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.cardActionPrimary}
                        disabled={busy}
                        onPress={() => claim(property._id)}
                      >
                        <MaterialIcons name="touch-app" size={16} color="#FFFFFF" />
                        <Text style={styles.cardActionPrimaryText}>Claim review</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.cardActionSecondary}
                        onPress={() =>
                          router.push({
                            pathname: "/verification/[id]",
                            params: { id: property._id },
                          })
                        }
                      >
                        <Text style={styles.cardActionSecondaryText}>
                          {role === "user" || role === "admin"
                            ? "Details and history"
                            : "Open review"}
                        </Text>
                        <MaterialIcons name="north-east" size={15} color="#0873B9" />
                      </TouchableOpacity>
                    )}

                    {role === "user" &&
                      ["draft", "correction_required"].includes(property.status) && (
                        <TouchableOpacity
                          accessibilityRole="button"
                          style={styles.cardActionHighlight}
                          onPress={() =>
                            router.push({
                              pathname: "/listing/create",
                              params: { id: property._id },
                            })
                          }
                        >
                          <MaterialIcons name="edit" size={15} color="#FFFFFF" />
                          <Text style={styles.cardActionHighlightText}>
                            {property.status === "draft"
                              ? "Continue listing"
                              : "Correct and resubmit"}
                          </Text>
                        </TouchableOpacity>
                      )}
                  </View>
                </View>
              );
            })}

          {/* Load More Button */}
          {nextCursor && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.loadMoreBtn}
              disabled={busy}
              onPress={loadMore}
            >
              <Text style={styles.loadMoreText}>
                {busy ? "Loading more..." : "Load more properties"}
              </Text>
              <MaterialIcons name="expand-more" size={18} color="#0873B9" />
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Two Corner Watermark Images Shifted Towards Center */}
      {Platform.OS === "web" ? (
        <>
          {/* 1st Image: Left Watermark */}
          <div
            id="malikse-left-bottom-watermark"
            style={{
              position: "fixed",
              bottom: 0,
              left: isMobile ? "clamp(10px, 4vw, 24px)" : "clamp(24px, 7vw, 120px)",
              width: isMobile ? "min(48vw, 240px)" : "min(42vw, 480px)",
              height: isMobile ? "130px" : "220px",
              pointerEvents: "none",
              zIndex: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-start",
              overflow: "hidden",
            }}
          >
            <img
              src={leftWatermarkUri}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target && !target.dataset.triedFallback) {
                  target.dataset.triedFallback = "true";
                  target.src = "/assets/malikse-left-bottom-watermark.png";
                }
              }}
              alt="MalikSe Heritage Left Bottom Watermark"
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "left bottom",
                display: "block",
                pointerEvents: "none",
                opacity: 0.9,
              }}
            />
          </div>

          {/* 2nd Image: Right Watermark */}
          <div
            id="malikse-right-bottom-watermark"
            style={{
              position: "fixed",
              bottom: 0,
              right: isMobile ? "clamp(10px, 4vw, 24px)" : "clamp(24px, 7vw, 120px)",
              width: isMobile ? "min(48vw, 240px)" : "min(42vw, 480px)",
              height: isMobile ? "130px" : "220px",
              pointerEvents: "none",
              zIndex: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              overflow: "hidden",
            }}
          >
            <img
              src={rightWatermarkUri}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target && !target.dataset.triedFallback) {
                  target.dataset.triedFallback = "true";
                  target.src = "/assets/malikse-right-bottom-watermark.png";
                }
              }}
              alt="MalikSe Heritage Right Bottom Watermark"
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "right bottom",
                display: "block",
                pointerEvents: "none",
                opacity: 0.9,
              }}
            />
          </div>
        </>
      ) : null}

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 110,
    gap: 16,
  },
  contentMobile: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 90,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    color: "#0873B9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  eyebrowDivider: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "400",
  },
  eyebrowActive: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "#D4E9F9",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0873B9",
  },
  roleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0873B9",
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  titleLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D8E8F5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    cursor: "pointer",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#102B52",
    letterSpacing: -0.6,
  },
  titleMobile: {
    fontSize: 24,
  },
  countBadge: {
    backgroundColor: "#EDF7FE",
    borderWidth: 1,
    borderColor: "#CDE5FA",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  countBadgeText: {
    color: "#0873B9",
    fontSize: 13,
    fontWeight: "700",
  },
  actionControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 10,
  },
  actionControlsRowMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  actionLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E8F5",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    cursor: "pointer",
  },
  secondaryBtnText: {
    color: "#102B52",
    fontSize: 13.5,
    fontWeight: "700",
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#102B52",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
    cursor: "pointer",
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  filterContainer: {
    position: "relative",
    zIndex: 30,
  },
  dropdownToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D8E8F5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    cursor: "pointer",
  },
  dropdownToggleText: {
    color: "#102B52",
    fontSize: 13.5,
    fontWeight: "700",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 6,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    width: 240,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "#D8E8F5",
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dropdownItemActive: {
    backgroundColor: "#EDF7FE",
  },
  dropdownItemText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  dropdownItemTextActive: {
    color: "#0873B9",
    fontWeight: "700",
  },
  pipelineCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "#DCEBF8",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  pipelineHeader: {
    marginBottom: 12,
  },
  pipelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pipelineTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#102B52",
    letterSpacing: -0.2,
  },
  pipelineSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  stagesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  stageItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stageIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stageName: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#102B52",
  },
  stageSub: {
    fontSize: 11,
    color: "#64748B",
  },
  quickChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  quickChip: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: "#D8E8F5",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    cursor: "pointer",
  },
  quickChipActive: {
    backgroundColor: "#102B52",
    borderColor: "#102B52",
  },
  quickChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569",
  },
  quickChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13.5,
    fontWeight: "600",
    flex: 1,
  },
  loaderContainer: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1.5,
    borderColor: "#DCEBF8",
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EDF7FE",
    borderWidth: 1.5,
    borderColor: "#CDE5FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#102B52",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 520,
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  emptyPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#102B52",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    cursor: "pointer",
  },
  emptyPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  emptySecondaryBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    cursor: "pointer",
  },
  emptySecondaryBtnText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  propertyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 6,
  },
  propertyTypePill: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  propertyTypeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#102B52",
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#CBD5E1",
  },
  metaText: {
    color: "#475569",
    fontSize: 13.5,
    fontWeight: "500",
  },
  priceText: {
    color: "#059669",
    fontSize: 15,
    fontWeight: "800",
  },
  rejectionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
  },
  rejectionTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#B91C1C",
  },
  rejectionBody: {
    fontSize: 12,
    color: "#7F1D1D",
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cardActionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#102B52",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
    cursor: "pointer",
  },
  cardActionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  cardActionSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F0F7FE",
    borderWidth: 1,
    borderColor: "#CDE5FA",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    cursor: "pointer",
  },
  cardActionSecondaryText: {
    color: "#0873B9",
    fontSize: 13,
    fontWeight: "700",
  },
  cardActionHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0873B9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
    cursor: "pointer",
  },
  cardActionHighlightText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D8E8F5",
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    cursor: "pointer",
  },
  loadMoreText: {
    color: "#0873B9",
    fontSize: 14,
    fontWeight: "700",
  },
});
