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
import WebFooter from "../components/WebFooter";
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
            setError("Maximum 3 files allowed.");
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
      setError("Please choose at least 1 document to upload.");
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
      setSuccessMsg("Documents submitted! Verification is now in review.");
      await fetchStatus();
      await authService.getMe();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Upload failed. Ensure files are under 5 MB.",
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
      setSuccessMsg("Account verified successfully!");
      if (params.returnTo) {
        setTimeout(() => {
          router.replace(params.returnTo as any);
        }, 1000);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Verification failed");
    } finally {
      setDemoSubmitting(false);
    }
  };

  if (authState !== "AUTHENTICATED" || !user) {
    return (
      <View style={styles.screen}>
        <AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton showBack={false} />
        <View style={styles.accessPanel}>
          <View style={styles.accessIcon}>
            <MaterialIcons name="lock" size={26} color="#0A45B5" />
          </View>
          <Text style={styles.accessTitle}>Sign in to verify identity</Text>
          <Text style={styles.accessSubtitle}>
            Please sign in to access identity verification and manage your listings.
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
        <WebFooter />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader showBack={false} showNavLinks={true} showPostPropertyBtn={true} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.mainWrapper, compact && styles.mainWrapperCompact]}>
          {/* Top Breadcrumb & Back Link */}
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/dashboard")}
              activeOpacity={0.75}
            >
              <MaterialIcons name="arrow-back" size={16} color="#0A45B5" />
              <Text style={styles.backButtonText}>Dashboard</Text>
            </TouchableOpacity>

            <View style={styles.badgeTop}>
              <MaterialIcons name="verified-user" size={14} color="#0A45B5" />
              <Text style={styles.badgeTopText}>MALIKSE VERIFY</Text>
            </View>
          </View>

          {/* Attractive Hero Header */}
          <View style={styles.heroBlock}>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              Identity Verification
            </Text>
            <Text style={styles.heroSubtitle}>
              Verify your identity to list properties, contact owners, and make certified offers.
            </Text>
          </View>

          {/* Feedback Alerts */}
          {error ? (
            <View style={styles.errorAlert}>
              <MaterialIcons name="error-outline" size={18} color="#DC2626" />
              <Text style={styles.errorAlertText}>{error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successAlert}>
              <MaterialIcons name="check-circle" size={18} color="#059669" />
              <Text style={styles.successAlertText}>{successMsg}</Text>
            </View>
          ) : null}

          {/* Central Card */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0A45B5" />
              <Text style={styles.loadingText}>Loading status...</Text>
            </View>
          ) : isVerified ? (
            /* STATE 1: VERIFIED */
            <View style={styles.glassCard}>
              <View style={styles.verifiedHero}>
                <View style={styles.verifiedIconBadge}>
                  <MaterialIcons name="verified" size={36} color="#059669" />
                </View>
                <Text style={styles.verifiedMainTitle}>Identity Verified</Text>
                <Text style={styles.verifiedMainSubtitle}>
                  Your account is fully verified. You have full access to buy and sell.
                </Text>
              </View>

              <View style={styles.verifiedInfoStrip}>
                <View style={styles.verifiedInfoCol}>
                  <Text style={styles.verifiedInfoLabel}>Member</Text>
                  <Text style={styles.verifiedInfoValue}>{user.name || "Nikhil"}</Text>
                </View>
                <View style={styles.verifiedInfoDivider} />
                <View style={styles.verifiedInfoCol}>
                  <Text style={styles.verifiedInfoLabel}>Status</Text>
                  <Text style={[styles.verifiedInfoValue, { color: "#059669" }]}>Certified ✓</Text>
                </View>
              </View>

              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }]}
                  onPress={() => router.push("/dashboard")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Dashboard</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  onPress={() => router.push("/post")}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="add" size={16} color="#0A45B5" />
                  <Text style={styles.secondaryBtnText}>Post Property</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isPending ? (
            /* STATE 2: PENDING REVIEW */
            <View style={styles.glassCard}>
              <View style={styles.pendingHero}>
                <View style={styles.pendingIconBadge}>
                  <MaterialIcons name="schedule" size={34} color="#D97706" />
                </View>
                <Text style={styles.pendingMainTitle}>Review in Progress</Text>
                <Text style={styles.pendingMainSubtitle}>
                  Your documents were received and are being verified. This typically takes 2–4 hours.
                </Text>
              </View>

              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }]}
                  onPress={fetchStatus}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Refresh</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  onPress={() => router.push("/dashboard")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryBtnText}>Dashboard</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* STATE 3: UPLOAD DOCUMENTS */
            <View style={styles.glassCard}>
              {isCorrection && kycData?.identityReview?.notes ? (
                <View style={styles.notesBox}>
                  <MaterialIcons name="error-outline" size={16} color="#D97706" />
                  <Text style={styles.notesText}>{kycData.identityReview.notes}</Text>
                </View>
              ) : null}

              {/* Upload Card Header */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerLeft}>
                  <View style={styles.idIconCircle}>
                    <MaterialIcons name="badge" size={22} color="#0A45B5" />
                  </View>
                  <View>
                    <Text style={styles.cardHeaderTitle}>Upload Government ID</Text>
                    <Text style={styles.cardHeaderSub}>Aadhaar, PAN, Voter ID, or Passport</Text>
                  </View>
                </View>
                <View style={styles.statusPillUnverified}>
                  <Text style={styles.statusPillUnverifiedText}>Required</Text>
                </View>
              </View>

              {/* Upload Box */}
              <TouchableOpacity
                style={styles.dropZone}
                onPress={handlePickFiles}
                activeOpacity={0.85}
              >
                <View style={styles.dropZoneIconCircle}>
                  <MaterialIcons name="cloud-upload" size={26} color="#0A45B5" />
                </View>
                <Text style={styles.dropZoneTitle}>
                  {files.length > 0 ? "Add more documents" : "Choose identity documents"}
                </Text>
                <Text style={styles.dropZoneSub}>JPG, PNG or PDF (up to 5 MB each)</Text>
              </TouchableOpacity>

              {/* Selected Files */}
              {files.length > 0 ? (
                <View style={styles.filesList}>
                  {files.map((file, idx) => {
                    const isPdf =
                      file.name?.toLowerCase().endsWith(".pdf") ||
                      file.mimeType?.includes("pdf");
                    return (
                      <View key={file.uri + idx} style={styles.fileRow}>
                        <MaterialIcons
                          name={isPdf ? "picture-as-pdf" : "image"}
                          size={18}
                          color="#0A45B5"
                        />
                        <View style={styles.fileNameCol}>
                          <Text style={styles.fileNameText} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <Text style={styles.fileSizeText}>{formatFileSize(file.size)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
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
                  styles.fullBtn,
                  (!files.length || submitting) && styles.disabledBtn,
                ]}
                disabled={!files.length || submitting}
                onPress={handleSubmitKyc}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Submitting...</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="check" size={17} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Submit Documents</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Demo Mode Instant Verification Shortcut */}
              <View style={styles.demoShortcutRow}>
                <TouchableOpacity
                  style={styles.demoLinkBtn}
                  onPress={handleDemoVerify}
                  disabled={demoSubmitting}
                  activeOpacity={0.8}
                >
                  {demoSubmitting ? (
                    <ActivityIndicator size="small" color="#0A45B5" />
                  ) : (
                    <>
                      <MaterialIcons name="bolt" size={16} color="#0A45B5" />
                      <Text style={styles.demoLinkText}>Activate Instant Demo Verification</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Three Visual Benefit Icons */}
          <View style={[styles.benefitsRow, compact && styles.benefitsRowCompact]}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIconWrap}>
                <MaterialIcons name="verified" size={18} color="#0A45B5" />
              </View>
              <Text style={styles.benefitTitle}>Certified Badge</Text>
              <Text style={styles.benefitDesc}>Builds instant buyer trust</Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconWrap}>
                <MaterialIcons name="chat" size={18} color="#0A45B5" />
              </View>
              <Text style={styles.benefitTitle}>Direct Deals</Text>
              <Text style={styles.benefitDesc}>Contact owners with 0% brokerage</Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconWrap}>
                <MaterialIcons name="security" size={18} color="#0A45B5" />
              </View>
              <Text style={styles.benefitTitle}>Private & Safe</Text>
              <Text style={styles.benefitDesc}>Encrypted document review</Text>
            </View>
          </View>
        </View>

        {/* Real Institutional Web Footer */}
        <WebFooter />
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
  scrollContent: {
    flexGrow: 1,
  },
  mainWrapper: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 48,
  },
  mainWrapperCompact: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 36,
  },

  // Top Nav Row
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  },
  backButtonText: {
    color: "#0A45B5",
    fontSize: 13,
    fontWeight: "700",
  },
  badgeTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeTopText: {
    color: "#0A45B5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // Hero Header
  heroBlock: {
    marginBottom: 24,
  },
  heroTitle: {
    color: "#0B1B3F",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    color: "#64748B",
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: 6,
  },

  // Alerts
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECDD3",
    padding: 12,
    marginBottom: 16,
  },
  errorAlertText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "500",
  },
  successAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 12,
    marginBottom: 16,
  },
  successAlertText: {
    flex: 1,
    color: "#059669",
    fontSize: 13,
    fontWeight: "600",
  },

  // Loading
  loadingBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 28,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 13.5,
  },

  // Glass Card
  glassCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 26,
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
    marginBottom: 28,
  },

  // Verified Hero
  verifiedHero: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 18,
  },
  verifiedIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  verifiedMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.4,
  },
  verifiedMainSubtitle: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    maxWidth: 420,
    lineHeight: 20,
  },
  verifiedInfoStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 14,
    marginBottom: 20,
  },
  verifiedInfoCol: {
    flex: 1,
    alignItems: "center",
  },
  verifiedInfoDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0",
  },
  verifiedInfoLabel: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "500",
  },
  verifiedInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B1B3F",
    marginTop: 2,
  },

  // Pending Hero
  pendingHero: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 20,
  },
  pendingIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  pendingMainTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0B1B3F",
  },
  pendingMainSubtitle: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    maxWidth: 420,
    lineHeight: 20,
  },

  // Card Header Row (Upload state)
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  idIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#0B1B3F",
  },
  cardHeaderSub: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 2,
  },
  statusPillUnverified: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillUnverifiedText: {
    color: "#0A45B5",
    fontSize: 11,
    fontWeight: "700",
  },

  // Dropzone
  dropZone: {
    borderWidth: 2,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
    backgroundColor: "#F8FAFF",
    borderRadius: 18,
    padding: 26,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginBottom: 18,
  },
  dropZoneIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  dropZoneTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0A45B5",
  },
  dropZoneSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  // Files List
  filesList: {
    gap: 8,
    marginBottom: 18,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  fileNameCol: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B1B3F",
  },
  fileSizeText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  removeBtn: {
    padding: 4,
    cursor: "pointer",
  },

  // Notes Box
  notesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  notesText: {
    flex: 1,
    fontSize: 12.5,
    color: "#92400E",
    lineHeight: 18,
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
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
    cursor: "pointer",
  },
  fullBtn: {
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
  ctaRow: {
    flexDirection: "row",
    gap: 12,
  },

  // Demo shortcut
  demoShortcutRow: {
    alignItems: "center",
    marginTop: 16,
  },
  demoLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    cursor: "pointer",
  },
  demoLinkText: {
    color: "#0A45B5",
    fontSize: 12.5,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // Benefits Row
  benefitsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  benefitsRowCompact: {
    flexDirection: "column",
    gap: 12,
  },
  benefitItem: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    alignItems: "center",
    textAlign: "center",
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  benefitTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0B1B3F",
  },
  benefitDesc: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },

  // Access Panel
  accessPanel: {
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    marginTop: 48,
    marginBottom: 48,
    padding: 28,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
