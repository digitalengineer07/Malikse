import React, { useCallback, useEffect, useState } from "react";
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
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { MaterialIcons } from "@/web/icons";
import { useRouter, useLocalSearchParams } from "@/web/navigation";
import { useAuthStore } from "../src/store/authStore";
import api, { authService } from "../src/services/authService";
import * as DocumentPicker from "@/web/files";
import { prepareUpload } from "../src/services/prepareUpload";
import { premiumStyles } from "../constants/typography";

export default function KycScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, authState } = useAuthStore();
  const { width } = useWindowDimensions();
  const compact = width < 640;

  const [kycData, setKycData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/users/kyc");
      setKycData(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load verification status",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authState === "AUTHENTICATED" && user) {
      void fetchStatus();
    } else {
      setLoading(false);
    }
  }, [authState, user, fetchStatus]);

  // Status computation
  const isVerified = Boolean(
    user?.isVerifiedIdentity ||
      user?.demoKycComplete ||
      kycData?.isVerifiedIdentity ||
      kycData?.kycStatus === "approved",
  );
  const isPending = !isVerified && kycData?.kycStatus === "pending";
  const isCorrection =
    !isVerified &&
    (kycData?.kycStatus === "correction_required" || kycData?.kycStatus === "rejected");

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const handlePickFiles = async () => {
    setError("");
    setSuccessMsg("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        setFiles((prev) => {
          const combined = [...prev, ...result.assets];
          if (combined.length > 3) {
            setError("You can select up to 3 documents in total.");
            return combined.slice(0, 3);
          }
          return combined;
        });
      }
    } catch (e: any) {
      setError("Could not open file picker: " + (e?.message || "unknown error"));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitKyc = async () => {
    if (!files.length) {
      setError("Please select at least 1 identity document to upload.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      const form = new FormData();
      for (const asset of files) {
        const prepared = await prepareUpload(asset, true);
        if (Platform.OS === "web") {
          form.append("files", prepared.file, prepared.name);
        } else {
          form.append("files", prepared.file as any);
        }
      }

      await api.post("/users/kyc", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });

      setFiles([]);
      setSuccessMsg("Documents submitted successfully! Your verification is now under review.");
      await fetchStatus();
      await authService.getMe();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Upload failed. Please ensure files are under 5 MB and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoVerify = async () => {
    setDemoSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      await authService.completeDemoKyc();
      await authService.getMe();
      await fetchStatus();
      setSuccessMsg("Instant verification completed! Your account is now verified.");
      if (params.returnTo) {
        setTimeout(() => {
          router.replace(params.returnTo as any);
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Demo verification failed");
    } finally {
      setDemoSubmitting(false);
    }
  };

  // Not authenticated screen
  if (authState !== "AUTHENTICATED" || !user) {
    return (
      <View style={styles.screen}>
        <AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton showBack={false} />
        <View style={styles.accessPanel}>
          <View style={styles.accessIcon}>
            <MaterialIcons name="lock-outline" size={28} color="#0A45B5" />
          </View>
          <Text style={styles.accessTitle}>Sign in to verify identity</Text>
          <Text style={styles.accessSubtitle}>
            Identity verification requires you to be logged into your MalikSe account.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Go to sign in</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader showBack={false} showNavLinks={true} showPostPropertyBtn={true} />

      <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
        {/* Top Breadcrumb & Back Link */}
        <View style={styles.topNavRow}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.push("/dashboard")}
            activeOpacity={0.75}
          >
            <MaterialIcons name="arrow-back" size={16} color="#0A45B5" />
            <Text style={styles.backLinkText}>Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.breadcrumbBadge}>
            <Text style={styles.breadcrumbText}>IDENTITY VERIFICATION</Text>
          </View>
        </View>

        {/* Page Title & Subtitle */}
        <View style={styles.headerBlock}>
          <Text accessibilityRole="header" style={styles.pageTitle}>
            Identity Verification (KYC)
          </Text>
          <Text style={styles.pageSubtitle}>
            Verify your identity to list properties, contact owners directly, and make certified offers in Bihar.
          </Text>
        </View>

        {/* Alerts / Error Messages */}
        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View style={styles.successBox}>
            <MaterialIcons name="check-circle" size={18} color="#059669" />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* Loading Spinner */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0A45B5" />
            <Text style={styles.loadingText}>Checking verification status...</Text>
          </View>
        ) : isVerified ? (
          /* STATE 1: ALREADY VERIFIED */
          <View style={styles.card}>
            <View style={styles.verifiedHeaderRow}>
              <View style={styles.verifiedIconCircle}>
                <MaterialIcons name="verified" size={32} color="#059669" />
              </View>
              <View style={styles.verifiedHeaderText}>
                <View style={styles.verifiedBadgeRow}>
                  <Text style={styles.verifiedTitle}>Identity Verified</Text>
                  <View style={styles.certifiedTag}>
                    <Text style={styles.certifiedTagText}>✓ Certified</Text>
                  </View>
                </View>
                <Text style={styles.verifiedSubtitle}>
                  Your account is verified. You have full access to buy, sell, and post properties.
                </Text>
              </View>
            </View>

            <View style={styles.detailsList}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Account Holder</Text>
                <Text style={styles.detailValue}>{user.name || "Nikhil"}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Mobile</Text>
                <Text style={styles.detailValue}>
                  {user.mobile ? `+91 ${user.mobile}` : "Registered"}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>7-Point Bihar Land Check</Text>
                <Text style={[styles.detailValue, { color: "#059669" }]}>Passed & Active</Text>
              </View>
            </View>

            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push("/dashboard")}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push("/post")}
                activeOpacity={0.85}
              >
                <MaterialIcons name="add" size={16} color="#0A45B5" />
                <Text style={styles.secondaryBtnText}>Post a Property</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isPending ? (
          /* STATE 2: UNDER REVIEW */
          <View style={styles.card}>
            <View style={styles.pendingHeaderRow}>
              <View style={styles.pendingIconCircle}>
                <MaterialIcons name="schedule" size={30} color="#D97706" />
              </View>
              <View style={styles.pendingHeaderText}>
                <Text style={styles.pendingTitle}>Documents Under Review</Text>
                <Text style={styles.pendingSubtitle}>
                  Your identity documents have been submitted. Our verification team is reviewing them (usually within 2–4 hours).
                </Text>
              </View>
            </View>

            {kycData?.kycSubmittedAt ? (
              <View style={styles.infoRow}>
                <MaterialIcons name="access-time" size={16} color="#64748B" />
                <Text style={styles.infoRowText}>
                  Submitted on: {formatDate(kycData.kycSubmittedAt)}
                </Text>
              </View>
            ) : null}

            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={fetchStatus}
                activeOpacity={0.85}
              >
                <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Refresh Status</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push("/dashboard")}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* STATE 3: UPLOAD FORM */
          <>
            {isCorrection && kycData?.identityReview?.notes ? (
              <View style={styles.correctionBox}>
                <View style={styles.correctionHeader}>
                  <MaterialIcons name="info-outline" size={18} color="#D97706" />
                  <Text style={styles.correctionTitle}>Reviewer Feedback</Text>
                </View>
                <Text style={styles.correctionText}>{kycData.identityReview.notes}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              {/* Status Header */}
              <View style={styles.statusRow}>
                <View style={styles.statusIconWrap}>
                  <MaterialIcons name="security" size={22} color="#0A45B5" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.statusTagRow}>
                    <Text style={styles.statusTitle}>Government ID Upload</Text>
                    <View style={styles.unverifiedTag}>
                      <Text style={styles.unverifiedTagText}>Not Submitted</Text>
                    </View>
                  </View>
                  <Text style={styles.statusDescription}>
                    Upload clear photos or PDFs of your identity proof.
                  </Text>
                </View>
              </View>

              {/* Accepted Documents Pills */}
              <View style={styles.acceptedRow}>
                <Text style={styles.acceptedLabel}>Accepted documents:</Text>
                <View style={styles.pillsList}>
                  <View style={styles.docPill}><Text style={styles.docPillText}>Aadhaar Card</Text></View>
                  <View style={styles.docPill}><Text style={styles.docPillText}>PAN Card</Text></View>
                  <View style={styles.docPill}><Text style={styles.docPillText}>Voter ID</Text></View>
                  <View style={styles.docPill}><Text style={styles.docPillText}>Passport</Text></View>
                </View>
              </View>

              {/* Upload Drop Area */}
              <TouchableOpacity
                style={styles.uploadDropzone}
                onPress={handlePickFiles}
                activeOpacity={0.85}
              >
                <View style={styles.uploadIconCircle}>
                  <MaterialIcons name="cloud-upload" size={26} color="#0A45B5" />
                </View>
                <Text style={styles.uploadMainText}>
                  {files.length > 0 ? "Click to add more documents" : "Choose identity documents"}
                </Text>
                <Text style={styles.uploadSubText}>
                  JPG, PNG or PDF • Up to 5 MB each (maximum 3 files)
                </Text>
              </TouchableOpacity>

              {/* Selected Files List */}
              {files.length > 0 ? (
                <View style={styles.filesContainer}>
                  <Text style={styles.filesTitle}>Selected files ({files.length}/3):</Text>
                  {files.map((file, idx) => {
                    const isPdf =
                      file.name?.toLowerCase().endsWith(".pdf") ||
                      file.mimeType?.includes("pdf");
                    return (
                      <View key={file.uri + idx} style={styles.fileItem}>
                        <View style={styles.fileIconWrap}>
                          <MaterialIcons
                            name={isPdf ? "picture-as-pdf" : "image"}
                            size={18}
                            color="#0A45B5"
                          />
                        </View>
                        <View style={styles.fileMeta}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fileDeleteBtn}
                          onPress={() => removeFile(idx)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  styles.fullWidthBtn,
                  (!files.length || submitting) && styles.disabledBtn,
                ]}
                disabled={!files.length || submitting}
                onPress={handleSubmitKyc}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Submitting documents...</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Submit KYC for Review</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Instant Demo Verification Card */}
            <View style={styles.demoCard}>
              <View style={styles.demoHeader}>
                <View style={styles.demoIconCircle}>
                  <MaterialIcons name="bolt" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoTitle}>Testing in Demo Mode?</Text>
                  <Text style={styles.demoSubtitle}>
                    Activate instant verification with 1 click without waiting for manual document review.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.demoBtn}
                onPress={handleDemoVerify}
                disabled={demoSubmitting}
                activeOpacity={0.85}
              >
                {demoSubmitting ? (
                  <ActivityIndicator size="small" color="#B45309" />
                ) : (
                  <>
                    <MaterialIcons name="verified" size={16} color="#B45309" />
                    <Text style={styles.demoBtnText}>Activate Instant Demo Verification</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Security & Confidentiality Footer */}
        <View style={styles.securityNote}>
          <MaterialIcons name="lock-outline" size={14} color="#64748B" />
          <Text style={styles.securityNoteText}>
            256-bit encrypted. Your documents are reviewed strictly for Bihar property deal verification and never shared publicly.
          </Text>
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = premiumStyles({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 80,
  },
  contentCompact: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Top Nav Row
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 10,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  },
  backLinkText: {
    color: "#0A45B5",
    fontSize: 13,
    fontWeight: "700",
  },
  breadcrumbBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },
  breadcrumbText: {
    color: "#0A45B5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Page Header
  headerBlock: {
    marginBottom: 20,
  },
  pageTitle: {
    color: "#0B1B3F",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },

  // Loading State
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 13.5,
    fontWeight: "500",
  },

  // Alerts
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECDD3",
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "500",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    color: "#059669",
    fontSize: 13,
    fontWeight: "600",
  },

  // Main Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 22,
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 20,
  },

  // State 1: Verified
  verifiedHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
  },
  verifiedIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedHeaderText: {
    flex: 1,
  },
  verifiedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  verifiedTitle: {
    color: "#0B1B3F",
    fontSize: 19,
    fontWeight: "800",
  },
  certifiedTag: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  certifiedTagText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "700",
  },
  verifiedSubtitle: {
    color: "#64748B",
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
  },

  // Details List
  detailsList: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  detailLabel: {
    color: "#64748B",
    fontSize: 13,
  },
  detailValue: {
    color: "#0B1B3F",
    fontSize: 13.5,
    fontWeight: "700",
  },

  // State 2: Pending
  pendingHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
  },
  pendingIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingHeaderText: {
    flex: 1,
  },
  pendingTitle: {
    color: "#0B1B3F",
    fontSize: 18,
    fontWeight: "800",
  },
  pendingSubtitle: {
    color: "#64748B",
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    marginBottom: 20,
  },
  infoRowText: {
    color: "#64748B",
    fontSize: 12.5,
    fontWeight: "500",
  },

  // Correction Alert
  correctionBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 18,
  },
  correctionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  correctionTitle: {
    color: "#92400E",
    fontSize: 13.5,
    fontWeight: "700",
  },
  correctionText: {
    color: "#78350F",
    fontSize: 13,
    lineHeight: 19,
  },

  // Status Row in Upload form
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  statusTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusTitle: {
    color: "#0B1B3F",
    fontSize: 16,
    fontWeight: "800",
  },
  unverifiedTag: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  unverifiedTagText: {
    color: "#0A45B5",
    fontSize: 11,
    fontWeight: "700",
  },
  statusDescription: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 2,
  },

  // Accepted Pills
  acceptedRow: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  acceptedLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  pillsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  docPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  docPillText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },

  // Upload Drop Area
  uploadDropzone: {
    borderWidth: 2,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
    backgroundColor: "#F8FAFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginBottom: 18,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  uploadMainText: {
    color: "#0A45B5",
    fontSize: 14.5,
    fontWeight: "700",
  },
  uploadSubText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 4,
  },

  // Selected Files
  filesContainer: {
    marginBottom: 18,
    gap: 8,
  },
  filesTitle: {
    color: "#0B1B3F",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  fileIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  fileMeta: {
    flex: 1,
  },
  fileName: {
    color: "#0B1B3F",
    fontSize: 13,
    fontWeight: "600",
  },
  fileSize: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  fileDeleteBtn: {
    padding: 6,
    cursor: "pointer",
  },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#0A45B5",
    borderRadius: 14,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
    cursor: "pointer",
  },
  fullWidthBtn: {
    width: "100%",
  },
  disabledBtn: {
    backgroundColor: "#93C5FD",
    shadowOpacity: 0,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    cursor: "pointer",
  },
  secondaryBtnText: {
    color: "#0A45B5",
    fontSize: 13.5,
    fontWeight: "700",
  },
  actionButtonGroup: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },

  // Demo Card
  demoCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 18,
    marginBottom: 20,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  demoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  demoTitle: {
    color: "#92400E",
    fontSize: 14.5,
    fontWeight: "800",
  },
  demoSubtitle: {
    color: "#78350F",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 12,
    cursor: "pointer",
  },
  demoBtnText: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "700",
  },

  // Security Note
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
  },
  securityNoteText: {
    flex: 1,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
  },

  // Access Panel
  accessPanel: {
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    marginTop: 40,
    padding: 28,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
    gap: 14,
  },
  accessIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  accessTitle: {
    color: "#0B1B3F",
    fontSize: 20,
    fontWeight: "800",
  },
  accessSubtitle: {
    color: "#64748B",
    fontSize: 13.5,
    lineHeight: 20,
  },
});
