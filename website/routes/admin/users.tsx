import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "@/web/navigation";
import api from "../../src/services/authService";
import { adminService } from "../../src/services/adminService";
import { useAuthStore } from "../../src/store/authStore";
import { MaterialIcons } from "@/web/icons";

const avatarColorPalettes = [
  { bg: "#EEF2FF", text: "#3730A3", border: "#C7D2FE" }, // Indigo
  { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" }, // Emerald
  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }, // Blue
  { bg: "#FAF5FF", text: "#6B21A8", border: "#E9D5FF" }, // Purple
  { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" }, // Amber/Orange
  { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" }, // Cyan
];

const getAvatarStyle = (name: string = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColorPalettes[Math.abs(hash) % avatarColorPalettes.length];
};

const getInitials = (name?: string) => {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateString;
  }
};

const formatPrice = (n: number) => {
  if (!n || isNaN(n)) return "₹0";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} Lakh`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const getKycBadge = (status?: string, isVerified?: boolean) => {
  if (isVerified || status === "approved") {
    return { label: "KYC Approved", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", icon: "verified" };
  }
  if (status === "pending" || status === "submitted") {
    return { label: "KYC In Review", bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", icon: "pending" };
  }
  if (status === "correction_required") {
    return { label: "Correction Required", bg: "#FFF7ED", text: "#C2410C", border: "#FFEDD5", icon: "error-outline" };
  }
  if (status === "rejected") {
    return { label: "KYC Rejected", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", icon: "cancel" };
  }
  return { label: "No KYC", bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0", icon: "person-outline" };
};

const getPropertyStatusBadge = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "verified":
      return { label: "Verified & Live", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" };
    case "queued":
      return { label: "Queued", bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" };
    case "pending":
    case "advisor_pending":
      return { label: "Pending Advisor", bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" };
    case "correction_required":
      return { label: "Correction Needed", bg: "#FFF7ED", text: "#C2410C", border: "#FFEDD5" };
    case "sold":
      return { label: "Sold", bg: "#F8FAFC", text: "#64748B", border: "#CBD5E1" };
    case "rejected":
      return { label: "Rejected", bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };
    default:
      return { label: status || "Unknown", bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" };
  }
};

export default function ManageUsersScreen() {
  const router = useRouter();
  const { user, authState } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "verified" | "pending_kyc" | "suspended">("all");

  // Selection & Details state
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [identityNotes, setIdentityNotes] = useState("");
  const [reviewingIdentity, setReviewingIdentity] = useState(false);
  const [propertyCursor, setPropertyCursor] = useState<string>();
  const [properties, setProperties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any>({ inquiries: [], deals: [] });
  const [loadingProps, setLoadingProps] = useState(false);

  const loadMore = async () => {
    if (!nextCursor || moreBusy) return;
    setMoreBusy(true);
    try {
      const rows = await adminService.listUsers(nextCursor);
      setUsers((old) => [...old, ...rows]);
      setNextCursor((rows as any).nextCursor);
    } catch {
      setError("Could not load the next page");
    } finally {
      setMoreBusy(false);
    }
  };

  const refreshUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await adminService.listUsers();
      setUsers(rows);
      setNextCursor((rows as any).nextCursor);
    } catch (cause: any) {
      setError(cause.response?.data?.message || "Could not load user accounts");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (authState !== "AUTHENTICATED" || user?.role !== "admin" || !user.id) return;
      refreshUsers();
    }, [authState, user])
  );

  const viewProperties = async (usr: any) => {
    if (selectedUser?._id === usr._id) {
      setSelectedUser(null);
      return;
    }
    setSelectedUser(usr);
    setIdentityNotes("");
    setLoadingProps(true);
    try {
      const [props, txs] = await Promise.all([
        adminService.getUserProperties(usr._id),
        adminService.getUserTransactions(usr._id),
      ]);
      setProperties(props);
      setPropertyCursor((props as any).nextCursor);
      setTransactions(txs || { inquiries: [], deals: [] });
    } catch (e) {
      console.error(e);
      setProperties([]);
      setTransactions({ inquiries: [], deals: [] });
    } finally {
      setLoadingProps(false);
    }
  };

  const moreProperties = async () => {
    if (!selectedUser || !propertyCursor || loadingProps) return;
    setLoadingProps(true);
    try {
      const rows = await adminService.getUserProperties(selectedUser._id, propertyCursor);
      setProperties((old) => [...old, ...rows]);
      setPropertyCursor((rows as any).nextCursor);
    } catch {
      setError("Could not load properties");
    } finally {
      setLoadingProps(false);
    }
  };

  const moreTransactions = async (kind: "inquiries" | "deals") => {
    if (!selectedUser || loadingProps) return;
    setLoadingProps(true);
    try {
      const data = await adminService.getUserTransactions(selectedUser._id, {
        [kind + "Cursor"]: transactions[kind === "inquiries" ? "nextInquiries" : "nextDeals"],
      });
      setTransactions((old: any) => ({
        ...old,
        [kind]: [...old[kind], ...data[kind]],
        [kind === "inquiries" ? "nextInquiries" : "nextDeals"]: data[kind === "inquiries" ? "nextInquiries" : "nextDeals"],
      }));
    } catch {
      setError("Could not load transactions");
    } finally {
      setLoadingProps(false);
    }
  };

  const toggleSuspension = async (usr: any) => {
    try {
      const nextSuspended = !usr.isSuspended;
      await adminService.suspendUser(usr._id, nextSuspended);
      setUsers((old) => old.map((u) => (u._id === usr._id ? { ...u, isSuspended: nextSuspended } : u)));
      setSelectedUser((prev: any) => (prev?._id === usr._id ? { ...prev, isSuspended: nextSuspended } : prev));
      setSuccessMessage(nextSuspended ? `Account for ${usr.name || "user"} suspended.` : `Account for ${usr.name || "user"} unsuspended.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to toggle suspension");
    }
  };

  const handleApproveIdentity = async (usr: any) => {
    if (identityNotes.trim().length < 10) {
      setError("Please provide at least 10 characters in review notes.");
      return;
    }
    setReviewingIdentity(true);
    setError("");
    setSuccessMessage("");
    try {
      const result = await adminService.reviewIdentity(usr._id, true, identityNotes.trim());
      setUsers((old) =>
        old.map((item) =>
          item._id === usr._id
            ? { ...item, isVerifiedIdentity: result.isVerifiedIdentity, kycStatus: "approved" }
            : item
        )
      );
      setSelectedUser((prev: any) =>
        prev?._id === usr._id ? { ...prev, isVerifiedIdentity: result.isVerifiedIdentity, kycStatus: "approved" } : prev
      );
      setIdentityNotes("");
      setSuccessMessage(`Identity approved successfully for ${usr.name || "user"}`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Could not save identity review");
    } finally {
      setReviewingIdentity(false);
    }
  };

  const handleRevokeIdentity = async (usr: any) => {
    if (identityNotes.trim().length < 10) {
      setError("Please provide at least 10 characters explaining why approval is being revoked.");
      return;
    }
    setReviewingIdentity(true);
    setError("");
    setSuccessMessage("");
    try {
      const result = await adminService.reviewIdentity(usr._id, false, identityNotes.trim());
      setUsers((old) =>
        old.map((item) =>
          item._id === usr._id
            ? { ...item, isVerifiedIdentity: false, kycStatus: "rejected" }
            : item
        )
      );
      setSelectedUser((prev: any) =>
        prev?._id === usr._id ? { ...prev, isVerifiedIdentity: false, kycStatus: "rejected" } : prev
      );
      setIdentityNotes("");
      setSuccessMessage(`Identity approval revoked for ${usr.name || "user"}`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Could not revoke identity approval");
    } finally {
      setReviewingIdentity(false);
    }
  };

  const handleCorrectionOrReject = async (usr: any, action: "correction" | "reject") => {
    if (identityNotes.trim().length < 10) {
      setError(
        `Please provide at least 10 characters in review notes for ${
          action === "correction" ? "requesting corrections" : "rejecting KYC"
        }.`
      );
      return;
    }
    setReviewingIdentity(true);
    setError("");
    setSuccessMessage("");
    try {
      await api.put(`/admin/users/${usr._id}/identity`, {
        approved: false,
        correctionRequired: action === "correction",
        notes: identityNotes.trim(),
      });
      const newStatus = action === "correction" ? "correction_required" : "rejected";
      setUsers((old) =>
        old.map((item) =>
          item._id === usr._id ? { ...item, kycStatus: newStatus, isVerifiedIdentity: false } : item
        )
      );
      setSelectedUser((prev: any) =>
        prev?._id === usr._id ? { ...prev, kycStatus: newStatus, isVerifiedIdentity: false } : prev
      );
      setIdentityNotes("");
      setSuccessMessage(
        action === "correction"
          ? `Correction request sent to ${usr.name || "user"}`
          : `KYC rejected for ${usr.name || "user"}`
      );
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Could not save KYC decision");
    } finally {
      setReviewingIdentity(false);
    }
  };

  if (authState !== "AUTHENTICATED" || user?.role !== "admin") {
    return (
      <View style={styles.screen}>
        <View style={styles.authWarningCard}>
          <MaterialIcons name="lock" size={32} color="#DC2626" />
          <Text style={styles.title}>Admin Access Required</Text>
          <Text style={styles.description}>Please sign in with administrator credentials to view this page.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/login")}>
            <Text style={styles.primaryBtnText}>Go to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Filter users
  const counts = {
    all: users.length,
    verified: users.filter((u) => u.isVerifiedIdentity).length,
    pending_kyc: users.filter((u) => u.kycStatus === "pending" || u.kycStatus === "submitted").length,
    suspended: users.filter((u) => u.isSuspended).length,
  };

  const filteredUsers = users.filter((usr) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      usr.name?.toLowerCase().includes(q) ||
      usr.email?.toLowerCase().includes(q) ||
      usr.mobile?.includes(q);

    if (!matchesSearch) return false;

    if (filterTab === "verified") return usr.isVerifiedIdentity;
    if (filterTab === "pending_kyc") return usr.kycStatus === "pending" || usr.kycStatus === "submitted";
    if (filterTab === "suspended") return usr.isSuspended;
    return true;
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/dashboard"))}
        >
          <MaterialIcons name="arrow-back" size={18} color="#0A45B5" />
          <Text style={styles.backButtonText}>Admin dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={refreshUsers}
          disabled={loading}
        >
          <MaterialIcons name="refresh" size={18} color="#0A45B5" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Page Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>User Accounts</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{users.length} Registered</Text>
          </View>
        </View>
        <Text style={styles.description}>
          View all registered users, verify identity documents, inspect listed properties and deal history.
        </Text>
      </View>

      {/* Global Alerts */}
      {error ? (
        <View style={styles.alertError}>
          <MaterialIcons name="error-outline" size={18} color="#DC2626" />
          <Text style={styles.alertErrorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError("")} style={styles.alertClose}>
            <MaterialIcons name="close" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.alertSuccess}>
          <MaterialIcons name="check-circle" size={18} color="#059669" />
          <Text style={styles.alertSuccessText}>{successMessage}</Text>
          <TouchableOpacity onPress={() => setSuccessMessage("")} style={styles.alertClose}>
            <MaterialIcons name="close" size={16} color="#059669" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Search & Filter Toolbar */}
      <View style={styles.controlsCard}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or mobile number..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
              <MaterialIcons name="close" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterChip, filterTab === "all" && styles.filterChipActive]}
            onPress={() => setFilterTab("all")}
          >
            <Text style={[styles.filterChipText, filterTab === "all" && styles.filterChipTextActive]}>
              All ({counts.all})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterTab === "verified" && styles.filterChipActive]}
            onPress={() => setFilterTab("verified")}
          >
            <Text style={[styles.filterChipText, filterTab === "verified" && styles.filterChipTextActive]}>
              Verified ({counts.verified})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterTab === "pending_kyc" && styles.filterChipActive]}
            onPress={() => setFilterTab("pending_kyc")}
          >
            <Text style={[styles.filterChipText, filterTab === "pending_kyc" && styles.filterChipTextActive]}>
              Pending KYC ({counts.pending_kyc})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterTab === "suspended" && styles.filterChipActive]}
            onPress={() => setFilterTab("suspended")}
          >
            <Text style={[styles.filterChipText, filterTab === "suspended" && styles.filterChipTextActive]}>
              Suspended ({counts.suspended})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Users List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#0A45B5" size="large" />
          <Text style={styles.loadingText}>Loading registered users...</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialIcons name="person-outline" size={42} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No matching accounts found</Text>
          <Text style={styles.emptyDesc}>
            {searchQuery
              ? `No user accounts match "${searchQuery}". Try a different keyword.`
              : "No users registered in this filter category yet."}
          </Text>
          {searchQuery ? (
            <TouchableOpacity style={styles.resetSearchBtn} onPress={() => setSearchQuery("")}>
              <Text style={styles.resetSearchBtnText}>Clear Search</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        filteredUsers.map((usr) => {
          const isExpanded = selectedUser?._id === usr._id;
          const avatar = getAvatarStyle(usr.name);
          const initials = getInitials(usr.name);
          const kyc = getKycBadge(usr.kycStatus, usr.isVerifiedIdentity);

          return (
            <View key={usr._id} style={[styles.userCard, isExpanded && styles.userCardExpanded]}>
              <TouchableOpacity
                style={styles.userHeader}
                onPress={() => viewProperties(usr)}
                activeOpacity={0.7}
              >
                {/* Left: Avatar Circle */}
                <View style={[styles.avatar, { backgroundColor: avatar.bg, borderColor: avatar.border }]}>
                  <Text style={[styles.avatarText, { color: avatar.text }]}>{initials}</Text>
                </View>

                {/* Center: Details */}
                <View style={styles.userMainInfo}>
                  {/* Name and Badges */}
                  <View style={styles.userNameRow}>
                    <Text
                      style={[
                        styles.userName,
                        usr.isSuspended && styles.userNameSuspended,
                      ]}
                      numberOfLines={1}
                    >
                      {usr.name || "Unnamed User"}
                    </Text>

                    {usr.isVerifiedIdentity && (
                      <View style={styles.verifiedBadge}>
                        <MaterialIcons name="verified" size={13} color="#059669" />
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    )}

                    {usr.isSuspended && (
                      <View style={styles.suspendedBadge}>
                        <MaterialIcons name="lock" size={12} color="#DC2626" />
                        <Text style={styles.suspendedBadgeText}>Suspended</Text>
                      </View>
                    )}

                    {usr.deletionRequestedAt && (
                      <View style={styles.deletionBadge}>
                        <MaterialIcons name="error-outline" size={12} color="#B45309" />
                        <Text style={styles.deletionBadgeText}>Deletion Requested</Text>
                      </View>
                    )}
                  </View>

                  {/* Contact Chips */}
                  <View style={styles.contactsRow}>
                    {usr.email ? (
                      <View style={styles.contactItem}>
                        <MaterialIcons name="mail-outline" size={14} color="#64748B" />
                        <Text style={styles.contactText}>{usr.email}</Text>
                      </View>
                    ) : null}

                    {usr.mobile ? (
                      <View style={styles.contactItem}>
                        <MaterialIcons name="phone" size={14} color="#64748B" />
                        <Text style={styles.contactText}>{usr.mobile}</Text>
                      </View>
                    ) : null}

                    {!usr.email && !usr.mobile ? (
                      <Text style={styles.noContactText}>No email or phone recorded</Text>
                    ) : null}
                  </View>

                  {/* Metadata Row: KYC Status & Joined Date */}
                  <View style={styles.metaRow}>
                    <View style={[styles.kycChip, { backgroundColor: kyc.bg, borderColor: kyc.border }]}>
                      <MaterialIcons name={kyc.icon} size={13} color={kyc.text} />
                      <Text style={[styles.kycChipText, { color: kyc.text }]}>{kyc.label}</Text>
                    </View>

                    <View style={styles.metaItem}>
                      <MaterialIcons name="calendar-today" size={13} color="#94A3B8" />
                      <Text style={styles.metaText}>Joined {formatDate(usr.createdAt)}</Text>
                    </View>
                  </View>
                </View>

                {/* Right: Expand / Collapse Chevron */}
                <View style={[styles.expandBtn, isExpanded && styles.expandBtnActive]}>
                  <MaterialIcons
                    name={isExpanded ? "expand-less" : "expand-more"}
                    size={22}
                    color={isExpanded ? "#0A45B5" : "#64748B"}
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded Section */}
              {isExpanded && (
                <View style={styles.expandedSection}>
                  {/* Identity Review Card */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionCardTitleRow}>
                        <MaterialIcons name="badge" size={18} color="#0A45B5" />
                        <Text style={styles.sectionCardTitle}>Identity Verification & KYC</Text>
                      </View>
                      <View style={[styles.kycChip, { backgroundColor: kyc.bg, borderColor: kyc.border }]}>
                        <MaterialIcons name={kyc.icon} size={12} color={kyc.text} />
                        <Text style={[styles.kycChipText, { color: kyc.text }]}>{kyc.label}</Text>
                      </View>
                    </View>

                    {/* Previous Review Notes */}
                    {usr.identityReview?.reviewedAt && (
                      <View style={styles.prevReviewBox}>
                        <Text style={styles.prevReviewHeader}>
                          Last reviewed on {formatDate(usr.identityReview.reviewedAt)}
                        </Text>
                        {usr.identityReview.notes ? (
                          <Text style={styles.prevReviewNotes}>"{usr.identityReview.notes}"</Text>
                        ) : null}
                      </View>
                    )}

                    {/* Uploaded Documents */}
                    <Text style={styles.subHeading}>Uploaded Documents ({(usr.kycDocuments || []).length})</Text>
                    {(usr.kycDocuments || []).length === 0 ? (
                      <View style={styles.emptyDocBox}>
                        <MaterialIcons name="description" size={18} color="#94A3B8" />
                        <Text style={styles.emptyDocText}>No KYC documents submitted yet</Text>
                      </View>
                    ) : (
                      <View style={styles.docList}>
                        {usr.kycDocuments.map((docId: string, idx: number) => (
                          <TouchableOpacity
                            key={docId}
                            style={styles.docItem}
                            onPress={async () => {
                              try {
                                const result = await api.post(`/users/kyc/${docId}/download`);
                                await Linking.openURL(result.data.url);
                              } catch {
                                setError("Could not open identity document");
                              }
                            }}
                          >
                            <View style={styles.docItemLeft}>
                              <MaterialIcons name="description" size={18} color="#0A45B5" />
                              <Text style={styles.docItemName}>Identity Document #{idx + 1}</Text>
                            </View>
                            <View style={styles.docItemRight}>
                              <Text style={styles.docItemAction}>Review Document</Text>
                              <MaterialIcons name="open-in-new" size={15} color="#0A45B5" />
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Review Notes Input */}
                    <Text style={[styles.subHeading, { marginTop: 16 }]}>Admin Review Remarks</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Record the identity evidence you verified or state correction details (min. 10 chars required)..."
                      placeholderTextColor="#94A3B8"
                      value={identityNotes}
                      onChangeText={setIdentityNotes}
                      multiline
                      numberOfLines={3}
                    />
                    <Text style={styles.notesHelpText}>
                      {identityNotes.trim().length < 10
                        ? `* Minimum 10 characters required (${identityNotes.trim().length}/10)`
                        : `✓ Ready to apply decision (${identityNotes.trim().length} chars)`}
                    </Text>

                    {/* Review Action Buttons */}
                    <View style={styles.reviewActionsRow}>
                      {!usr.isVerifiedIdentity ? (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.approveBtn,
                              (reviewingIdentity || identityNotes.trim().length < 10) && styles.btnDisabled,
                            ]}
                            disabled={reviewingIdentity || identityNotes.trim().length < 10}
                            onPress={() => handleApproveIdentity(usr)}
                          >
                            <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                            <Text style={styles.approveBtnText}>
                              {reviewingIdentity ? "Saving..." : "Approve Identity"}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.correctionBtn,
                              (reviewingIdentity || identityNotes.trim().length < 10) && styles.btnDisabled,
                            ]}
                            disabled={reviewingIdentity || identityNotes.trim().length < 10}
                            onPress={() => handleCorrectionOrReject(usr, "correction")}
                          >
                            <MaterialIcons name="error-outline" size={16} color="#C2410C" />
                            <Text style={styles.correctionBtnText}>Request Correction</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              styles.rejectBtn,
                              (reviewingIdentity || identityNotes.trim().length < 10) && styles.btnDisabled,
                            ]}
                            disabled={reviewingIdentity || identityNotes.trim().length < 10}
                            onPress={() => handleCorrectionOrReject(usr, "reject")}
                          >
                            <MaterialIcons name="cancel" size={16} color="#DC2626" />
                            <Text style={styles.rejectBtnText}>Reject KYC</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            styles.revokeBtn,
                            (reviewingIdentity || identityNotes.trim().length < 10) && styles.btnDisabled,
                          ]}
                          disabled={reviewingIdentity || identityNotes.trim().length < 10}
                          onPress={() => handleRevokeIdentity(usr)}
                        >
                          <MaterialIcons name="cancel" size={16} color="#DC2626" />
                          <Text style={styles.revokeBtnText}>
                            {reviewingIdentity ? "Saving..." : "Revoke Identity Approval"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Properties Listed Card */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionCardTitleRow}>
                        <MaterialIcons name="business" size={18} color="#0A45B5" />
                        <Text style={styles.sectionCardTitle}>Properties Listed ({properties.length})</Text>
                      </View>
                    </View>

                    {loadingProps ? (
                      <View style={styles.loadingBox}>
                        <ActivityIndicator color="#0A45B5" />
                        <Text style={styles.loadingText}>Loading user properties...</Text>
                      </View>
                    ) : properties.length === 0 ? (
                      <View style={styles.emptyDocBox}>
                        <MaterialIcons name="business" size={20} color="#94A3B8" />
                        <Text style={styles.emptyDocText}>No properties listed by this user.</Text>
                      </View>
                    ) : (
                      <View style={styles.propList}>
                        {properties.map((prop) => {
                          const pStatus = getPropertyStatusBadge(prop.status);
                          return (
                            <TouchableOpacity
                              key={prop._id}
                              style={styles.propRow}
                              onPress={() =>
                                router.push({ pathname: "/verification/[id]", params: { id: prop._id } })
                              }
                            >
                              <View style={styles.propInfo}>
                                <Text style={styles.propTitle} numberOfLines={1}>
                                  {prop.title || `${prop.type || "Property"} in ${prop.location?.district || "Bihar"}`}
                                </Text>
                                <View style={styles.propMetaRow}>
                                  <Text style={styles.propPrice}>{formatPrice(prop.price)}</Text>
                                  {prop.location?.district ? (
                                    <Text style={styles.propDistrict}>· {prop.location.district}</Text>
                                  ) : null}
                                </View>
                              </View>
                              <View style={styles.propRight}>
                                <View
                                  style={[
                                    styles.propStatusBadge,
                                    { backgroundColor: pStatus.bg, borderColor: pStatus.border },
                                  ]}
                                >
                                  <Text style={[styles.propStatusText, { color: pStatus.text }]}>
                                    {pStatus.label}
                                  </Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {propertyCursor ? (
                      <TouchableOpacity
                        style={styles.moreBtn}
                        disabled={loadingProps}
                        onPress={moreProperties}
                      >
                        <Text style={styles.moreBtnText}>Load more properties</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Transactions Card */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionCardTitleRow}>
                        <MaterialIcons name="receipt-long" size={18} color="#0A45B5" />
                        <Text style={styles.sectionCardTitle}>
                          Transactions & Inquiries (
                          {(transactions.deals?.length || 0) + (transactions.inquiries?.length || 0)})
                        </Text>
                      </View>
                    </View>

                    {loadingProps ? (
                      <View style={styles.loadingBox}>
                        <ActivityIndicator color="#0A45B5" />
                        <Text style={styles.loadingText}>Loading transaction activity...</Text>
                      </View>
                    ) : (transactions.deals?.length || 0) === 0 && (transactions.inquiries?.length || 0) === 0 ? (
                      <View style={styles.emptyDocBox}>
                        <MaterialIcons name="receipt-long" size={20} color="#94A3B8" />
                        <Text style={styles.emptyDocText}>No active deals or inquiries for this account.</Text>
                      </View>
                    ) : (
                      <View style={styles.txList}>
                        {(transactions.deals || []).map((deal: any) => (
                          <View key={`d_${deal._id}`} style={styles.txRow}>
                            <View style={styles.txLeft}>
                              <View style={styles.txTypeDeal}>
                                <Text style={styles.txTypeDealText}>Deal</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.txTitle} numberOfLines={1}>
                                  {deal.propertyId?.title || "Property Deal"}
                                </Text>
                                <Text style={styles.txSub}>
                                  Offer: {formatPrice(deal.counterAmount ?? deal.offerAmount ?? 0)}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.txStatusPill}>
                              <Text style={styles.txStatusText}>{deal.status}</Text>
                            </View>
                          </View>
                        ))}
                        {(transactions.inquiries || []).map((inq: any) => (
                          <View key={`i_${inq._id}`} style={styles.txRow}>
                            <View style={styles.txLeft}>
                              <View style={styles.txTypeInquiry}>
                                <Text style={styles.txTypeInquiryText}>Inquiry</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.txTitle} numberOfLines={1}>
                                  {inq.propertyId?.title || "Property Inquiry"}
                                </Text>
                                <Text style={styles.txSub}>Date: {formatDate(inq.createdAt)}</Text>
                              </View>
                            </View>
                            <View style={styles.txStatusPill}>
                              <Text style={styles.txStatusText}>{inq.status}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {transactions.nextInquiries ? (
                      <TouchableOpacity
                        style={styles.moreBtn}
                        disabled={loadingProps}
                        onPress={() => moreTransactions("inquiries")}
                      >
                        <Text style={styles.moreBtnText}>Load more inquiries</Text>
                      </TouchableOpacity>
                    ) : null}
                    {transactions.nextDeals ? (
                      <TouchableOpacity
                        style={styles.moreBtn}
                        disabled={loadingProps}
                        onPress={() => moreTransactions("deals")}
                      >
                        <Text style={styles.moreBtnText}>Load more deals</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Account Moderation Danger Zone */}
                  <View style={[styles.sectionCard, styles.dangerCard]}>
                    <View style={styles.dangerCardHeader}>
                      <MaterialIcons name="security" size={18} color="#DC2626" />
                      <Text style={styles.dangerTitle}>Account Safety & Moderation</Text>
                    </View>
                    <Text style={styles.dangerDesc}>
                      {usr.isSuspended
                        ? "This account is currently suspended. The user is prevented from signing in or posting new properties."
                        : "Suspending will restrict user sign-in and suspend property posting capabilities."}
                    </Text>
                    <TouchableOpacity
                      style={[styles.suspensionBtn, usr.isSuspended ? styles.unsuspendBtn : styles.suspendBtn]}
                      onPress={() => toggleSuspension(usr)}
                    >
                      <MaterialIcons
                        name={usr.isSuspended ? "lock-open" : "lock"}
                        size={16}
                        color={usr.isSuspended ? "#065F46" : "#DC2626"}
                      />
                      <Text
                        style={[
                          styles.suspensionBtnText,
                          usr.isSuspended ? styles.unsuspendBtnText : styles.suspendBtnText,
                        ]}
                      >
                        {usr.isSuspended ? "Unsuspend User Account" : "Suspend User Account"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Pagination Load More */}
      {nextCursor && (
        <TouchableOpacity style={styles.loadMorePageBtn} disabled={moreBusy} onPress={loadMore}>
          {moreBusy ? (
            <ActivityIndicator color="#0A45B5" size="small" />
          ) : (
            <MaterialIcons name="expand-more" size={20} color="#0A45B5" />
          )}
          <Text style={styles.loadMorePageBtnText}>
            {moreBusy ? "Loading additional accounts..." : "Load more user accounts"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    width: "100%",
    maxWidth: 880,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 80,
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
  },
  backButtonText: {
    color: "#0A45B5",
    fontSize: 14,
    fontWeight: "700",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
  },
  refreshButtonText: {
    color: "#0A45B5",
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  countBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 16,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  description: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
  },
  alertError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  alertErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  alertSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  alertSuccessText: {
    color: "#065F46",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  alertClose: {
    padding: 4,
  },
  controlsCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    padding: 0,
    outlineWidth: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#0A45B5",
    borderColor: "#0A45B5",
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptyDesc: {
    color: "#64748B",
    fontSize: 13.5,
    textAlign: "center",
    maxWidth: 400,
  },
  resetSearchBtn: {
    marginTop: 8,
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resetSearchBtnText: {
    color: "#0A45B5",
    fontSize: 13,
    fontWeight: "700",
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  userCardExpanded: {
    borderColor: "#BFDBFE",
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  userHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  userMainInfo: {
    flex: 1,
    gap: 6,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  userNameSuspended: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
  },
  suspendedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  suspendedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  deletionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deletionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  contactsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  contactText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  noContactText: {
    fontSize: 12.5,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 2,
  },
  kycChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  kycChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#64748B",
  },
  expandBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  expandBtnActive: {
    backgroundColor: "#EFF6FF",
  },
  expandedSection: {
    padding: 18,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 16,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  prevReviewBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  prevReviewHeader: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#475569",
  },
  prevReviewNotes: {
    fontSize: 12.5,
    color: "#334155",
    fontStyle: "italic",
  },
  subHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  emptyDocBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyDocText: {
    fontSize: 13,
    color: "#64748B",
  },
  docList: {
    gap: 8,
  },
  docItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  docItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  docItemName: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1E3A8A",
  },
  docItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  docItemAction: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0A45B5",
  },
  notesInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    fontSize: 13.5,
    color: "#0F172A",
    minHeight: 70,
    textAlignVertical: "top",
  },
  notesHelpText: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: -6,
  },
  reviewActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  approveBtn: {
    backgroundColor: "#059669",
  },
  approveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  correctionBtn: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  correctionBtnText: {
    color: "#C2410C",
    fontSize: 13,
    fontWeight: "700",
  },
  rejectBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },
  revokeBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  revokeBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  propList: {
    gap: 8,
  },
  propRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  propInfo: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  propTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  propMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  propPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A45B5",
  },
  propDistrict: {
    fontSize: 12.5,
    color: "#64748B",
  },
  propRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  propStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  propStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  moreBtn: {
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    marginTop: 4,
  },
  moreBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0A45B5",
  },
  txList: {
    gap: 8,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  txLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  txTypeDeal: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txTypeDealText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  txTypeInquiry: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txTypeInquiryText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#6B21A8",
  },
  txTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  txSub: {
    fontSize: 12,
    color: "#64748B",
  },
  txStatusPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  txStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "capitalize",
  },
  dangerCard: {
    backgroundColor: "#FFF5F5",
    borderColor: "#FED7D7",
  },
  dangerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991B1B",
  },
  dangerDesc: {
    fontSize: 12.5,
    color: "#7F1D1D",
    lineHeight: 18,
  },
  suspensionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  suspensionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  suspendBtn: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FECACA",
  },
  suspendBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },
  unsuspendBtn: {
    backgroundColor: "#FFFFFF",
    borderColor: "#A7F3D0",
  },
  unsuspendBtnText: {
    color: "#065F46",
    fontSize: 13,
    fontWeight: "700",
  },
  loadMorePageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  loadMorePageBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0A45B5",
  },
  authWarningCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 12,
    maxWidth: 480,
    alignSelf: "center",
    marginTop: 60,
  },
  primaryBtn: {
    backgroundColor: "#0A45B5",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
