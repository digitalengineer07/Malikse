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
  const isWide = width >= 992;

  const [kycData, setKycData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleDrop = async (e: any) => {
    if (Platform.OS !== "web") return;
    e.preventDefault?.();
    e.stopPropagation?.();
    setIsDragging(false);

    try {
      const droppedFiles: File[] = Array.from(e?.dataTransfer?.files || []);
      if (!droppedFiles.length) return;

      const validFiles = droppedFiles.filter((f) =>
        ["image/jpeg", "image/png", "application/pdf"].includes(f.type)
      );

      if (!validFiles.length) {
        setError("Please drop valid JPG, PNG, or PDF files.");
        return;
      }

      const assets: DocumentPicker.DocumentPickerAsset[] = await Promise.all(
        validFiles.map(async (file) => ({
          name: file.name,
          uri: await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          }),
          mimeType: file.type,
          size: file.size,
          file,
          lastModified: file.lastModified,
        }))
      );

      setFiles((prev) => {
        const combined = [...prev, ...assets];
        if (combined.length > 3) {
          setError("Maximum 3 files allowed.");
          return combined.slice(0, 3);
        }
        return combined;
      });
    } catch (err: any) {
      setError("Could not process dropped files: " + (err?.message || "unknown error"));
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
          {/* Top Breadcrumb & Status Pill */}
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/dashboard")}
              activeOpacity={0.75}
            >
              <MaterialIcons name="arrow-back" size={15} color="#0A45B5" />
              <Text style={styles.backButtonText}>Dashboard</Text>
            </TouchableOpacity>

            <View style={styles.badgeTop}>
              <View style={styles.badgeLiveDot} />
              <MaterialIcons name="verified-user" size={13} color="#0A45B5" />
              <Text style={styles.badgeTopText}>MALIKSE VERIFY</Text>
            </View>
          </View>

          {/* Institutional Hero Header */}
          <View style={styles.heroBlock}>
            <View style={styles.complianceChip}>
              <MaterialIcons name="shield" size={12} color="#059669" />
              <Text style={styles.complianceChipText}>
                Bihar Revenue & Land Integrity Compliant
              </Text>
            </View>
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

          {/* Two-Column Symmetrical Grid (Equal Width 50/50 & Equal Height) */}
          <View style={[styles.contentGrid, isWide && styles.contentGridRow]}>
            {/* Left Column: Interactive KYC Card */}
            <View style={[styles.columnWrapper, isWide && styles.columnWrapperWide]}>
              {loading ? (
                <View style={[styles.glassCard, styles.loadingCard]}>
                  <ActivityIndicator size="large" color="#0A45B5" />
                  <Text style={styles.loadingText}>Loading verification status...</Text>
                </View>
              ) : isVerified ? (
                /* STATE 1: VERIFIED */
                <View style={styles.glassCard}>
                  <View>
                    <View style={styles.verifiedHero}>
                      <View style={styles.verifiedIconBadge}>
                        <MaterialIcons name="verified" size={40} color="#059669" />
                      </View>
                      <Text style={styles.verifiedMainTitle}>Identity Verified</Text>
                      <Text style={styles.verifiedMainSubtitle}>
                        Your account is fully certified. You have complete direct access to list properties, contact verified owners, and submit legally binding offers.
                      </Text>
                    </View>

                    <View style={styles.verifiedInfoStrip}>
                      <View style={styles.verifiedInfoCol}>
                        <Text style={styles.verifiedInfoLabel}>MEMBER NAME</Text>
                        <Text style={styles.verifiedInfoValue}>{user.name || "Member"}</Text>
                      </View>
                      <View style={styles.verifiedInfoDivider} />
                      <View style={styles.verifiedInfoCol}>
                        <Text style={styles.verifiedInfoLabel}>VERIFICATION STATUS</Text>
                        <View style={styles.verifiedStatusInline}>
                          <MaterialIcons name="check-circle" size={14} color="#059669" />
                          <Text style={[styles.verifiedInfoValue, { color: "#059669", marginLeft: 4 }]}>Certified ✓</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.ctaRow}>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { flex: 1 }]}
                        onPress={() => router.push("/dashboard")}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
                        <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.secondaryBtn, { flex: 1 }]}
                        onPress={() => router.push("/post")}
                        activeOpacity={0.85}
                      >
                        <MaterialIcons name="add" size={16} color="#0A45B5" />
                        <Text style={styles.secondaryBtnText}>Post a Property</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.securityFootnote}>
                    <MaterialIcons name="verified" size={13} color="#059669" />
                    <Text style={styles.securityFootnoteText}>
                      Member certified under MalikSe verified owner protocols.
                    </Text>
                  </View>
                </View>
              ) : isPending ? (
                /* STATE 2: PENDING REVIEW */
                <View style={styles.glassCard}>
                  <View>
                    <View style={styles.pendingHero}>
                      <View style={styles.pendingIconBadge}>
                        <MaterialIcons name="schedule" size={36} color="#D97706" />
                      </View>
                      <Text style={styles.pendingMainTitle}>Review in Progress</Text>
                      <Text style={styles.pendingMainSubtitle}>
                        Your documents were received and are currently being reviewed by our verification desk. Review typically completes within 2–4 business hours.
                      </Text>
                    </View>

                    <View style={styles.pendingInfoStrip}>
                      <MaterialIcons name="info-outline" size={16} color="#D97706" />
                      <Text style={styles.pendingInfoText}>
                        You will receive an instant notification once your Jamabandi & identity credentials are confirmed.
                      </Text>
                    </View>

                    <View style={styles.ctaRow}>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { flex: 1 }]}
                        onPress={fetchStatus}
                        activeOpacity={0.85}
                      >
                        <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Refresh Status</Text>
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

                  <View style={styles.securityFootnote}>
                    <MaterialIcons name="schedule" size={13} color="#D97706" />
                    <Text style={styles.securityFootnoteText}>
                      Queued for document auditor verification.
                    </Text>
                  </View>
                </View>
              ) : (
                /* STATE 3: UPLOAD DOCUMENTS */
                <View style={styles.glassCard}>
                  <View>
                    {isCorrection && kycData?.identityReview?.notes ? (
                      <View style={styles.notesBox}>
                        <MaterialIcons name="error-outline" size={18} color="#D97706" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notesTitle}>Verification Reviewer Feedback:</Text>
                          <Text style={styles.notesText}>{kycData.identityReview.notes}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Upload Card Header */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.headerLeft}>
                        <View style={styles.idIconCircle}>
                          <MaterialIcons name="badge" size={24} color="#0A45B5" />
                        </View>
                        <View>
                          <Text style={styles.cardHeaderTitle}>Upload Government ID</Text>
                          <Text style={styles.cardHeaderSub}>Aadhaar, PAN, Voter ID, or Passport</Text>
                        </View>
                      </View>
                      <View style={styles.statusPillUnverified}>
                        <MaterialIcons name="lock" size={11} color="#0A45B5" />
                        <Text style={styles.statusPillUnverifiedText}>Required</Text>
                      </View>
                    </View>

                    {/* Accepted Document Chips Strip */}
                    <View style={styles.docTagsRow}>
                      <View style={styles.docTag}>
                        <MaterialIcons name="credit-card" size={13} color="#0A45B5" />
                        <Text style={styles.docTagText}>Aadhaar Card</Text>
                      </View>
                      <View style={styles.docTag}>
                        <MaterialIcons name="assignment-ind" size={13} color="#0A45B5" />
                        <Text style={styles.docTagText}>PAN Card</Text>
                      </View>
                      <View style={styles.docTag}>
                        <MaterialIcons name="how-to-vote" size={13} color="#0A45B5" />
                        <Text style={styles.docTagText}>Voter ID</Text>
                      </View>
                      <View style={styles.docTag}>
                        <MaterialIcons name="flight-takeoff" size={13} color="#0A45B5" />
                        <Text style={styles.docTagText}>Passport</Text>
                      </View>
                    </View>

                    {/* Interactive Drop Zone */}
                    <TouchableOpacity
                      style={[
                        styles.dropZone,
                        isDragging && styles.dropZoneActive,
                      ]}
                      onPress={handlePickFiles}
                      activeOpacity={0.88}
                      // @ts-ignore Web drag and drop events
                      onDragOver={(e: any) => {
                        if (Platform.OS === "web") {
                          e.preventDefault();
                          setIsDragging(true);
                        }
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      <View style={styles.dropZoneIconCircle}>
                        <MaterialIcons name="cloud-upload" size={26} color="#0A45B5" />
                      </View>
                      <Text style={styles.dropZoneTitle}>
                        {files.length > 0 ? "Add more identity documents" : "Choose identity documents"}
                      </Text>
                      <Text style={styles.dropZoneSub}>
                        Click to browse or drag & drop files here
                      </Text>
                      <View style={styles.dropZoneSpecsBadge}>
                        <Text style={styles.dropZoneSpecsText}>JPG, PNG or PDF (up to 5 MB · max 3 files)</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Selected Files List */}
                    {files.length > 0 ? (
                      <View style={styles.filesList}>
                        {files.map((file, idx) => {
                          const isPdf =
                            file.name?.toLowerCase().endsWith(".pdf") ||
                            file.mimeType?.includes("pdf");
                          return (
                            <View key={file.uri + idx} style={styles.fileRow}>
                              <View style={styles.fileIconWrap}>
                                <MaterialIcons
                                  name={isPdf ? "picture-as-pdf" : "image"}
                                  size={18}
                                  color="#0A45B5"
                                />
                              </View>
                              <View style={styles.fileNameCol}>
                                <Text style={styles.fileNameText} numberOfLines={1}>
                                  {file.name}
                                </Text>
                                <View style={styles.fileMetaRow}>
                                  <Text style={styles.fileSizeText}>{formatFileSize(file.size)}</Text>
                                  <Text style={styles.fileMetaDot}>•</Text>
                                  <View style={styles.fileReadyPill}>
                                    <MaterialIcons name="check" size={11} color="#059669" />
                                    <Text style={styles.fileReadyPillText}>Ready</Text>
                                  </View>
                                </View>
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
                          <Text style={styles.primaryBtnText}>Submitting Documents...</Text>
                        </>
                      ) : (
                        <>
                          <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.primaryBtnText}>Submit Documents</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Clean Fast Demo Divider */}
                    <View style={styles.orDivider}>
                      <View style={styles.orLine} />
                      <Text style={styles.orText}>OR INSTANT VERIFICATION</Text>
                      <View style={styles.orLine} />
                    </View>

                    {/* Demo Mode Action Card */}
                    <TouchableOpacity
                      style={styles.demoActionCard}
                      onPress={handleDemoVerify}
                      disabled={demoSubmitting}
                      activeOpacity={0.85}
                    >
                      <View style={styles.demoIconWrap}>
                        <MaterialIcons name="bolt" size={18} color="#0A45B5" />
                      </View>
                      <View style={styles.demoTextWrap}>
                        <Text style={styles.demoActionTitle}>Activate Instant Demo Verification</Text>
                        <Text style={styles.demoActionSub}>
                          1-click test verification for immediate testing without uploading real files
                        </Text>
                      </View>
                      {demoSubmitting ? (
                        <ActivityIndicator size="small" color="#0A45B5" />
                      ) : (
                        <MaterialIcons name="arrow-forward" size={16} color="#0A45B5" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Security Footnote */}
                  <View style={styles.securityFootnote}>
                    <MaterialIcons name="lock" size={13} color="#059669" />
                    <Text style={styles.securityFootnoteText}>
                      Bank-grade 256-bit encrypted transmission · Strict zero-leakage security.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Right Column: Data Privacy, Protection & Guidelines (Exact Same Size & Shape) */}
            <View style={[styles.columnWrapper, isWide && styles.columnWrapperWide]}>
              <View style={styles.glassCard}>
                <View>
                  {/* Mirrored Header */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.headerLeft}>
                      <View style={[styles.idIconCircle, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                        <MaterialIcons name="security" size={24} color="#059669" />
                      </View>
                      <View>
                        <Text style={styles.cardHeaderTitle}>Data Privacy & Protection</Text>
                        <Text style={styles.cardHeaderSub}>Your documents are shielded & encrypted</Text>
                      </View>
                    </View>
                    <View style={[styles.statusPillUnverified, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                      <MaterialIcons name="verified-user" size={11} color="#059669" />
                      <Text style={[styles.statusPillUnverifiedText, { color: "#059669" }]}>Protected</Text>
                    </View>
                  </View>

                  {/* Mirrored Feature Chips Strip */}
                  <View style={styles.docTagsRow}>
                    <View style={styles.docTag}>
                      <MaterialIcons name="lock" size={12} color="#059669" />
                      <Text style={styles.docTagText}>AES-256 Vault</Text>
                    </View>
                    <View style={styles.docTag}>
                      <MaterialIcons name="block" size={12} color="#059669" />
                      <Text style={styles.docTagText}>Zero Sharing</Text>
                    </View>
                    <View style={styles.docTag}>
                      <MaterialIcons name="verified" size={12} color="#059669" />
                      <Text style={styles.docTagText}>Bihar RERA</Text>
                    </View>
                    <View style={styles.docTag}>
                      <MaterialIcons name="delete-forever" size={12} color="#059669" />
                      <Text style={styles.docTagText}>Data Purge Right</Text>
                    </View>
                  </View>

                  {/* Privacy Guarantees Box (Mirrors Dropzone Size) */}
                  <View style={styles.privacyFeatureBox}>
                    <View style={styles.privacyFeatureItem}>
                      <MaterialIcons name="check-circle" size={15} color="#059669" style={styles.privacyCheckIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureItemBold}>Bank-Grade 256-Bit Vault Storage</Text>
                        <Text style={styles.featureItemText}>
                          Identity documents are stored in encrypted vaults with restricted, staff-only audit access.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.privacyFeatureItem}>
                      <MaterialIcons name="check-circle" size={15} color="#059669" style={styles.privacyCheckIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureItemBold}>Zero Third-Party Commercial Sharing</Text>
                        <Text style={styles.featureItemText}>
                          We never sell, rent, or distribute your identity papers to brokers or marketing agencies.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.privacyFeatureItem}>
                      <MaterialIcons name="check-circle" size={15} color="#059669" style={styles.privacyCheckIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureItemBold}>Purpose-Limited Verification</Text>
                        <Text style={styles.featureItemText}>
                          Used solely for Bihar Bhumi Jamabandi matching and authentic owner verification.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.privacyFeatureItem}>
                      <MaterialIcons name="check-circle" size={15} color="#059669" style={styles.privacyCheckIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureItemBold}>Right to Permanent Data Erasure</Text>
                        <Text style={styles.featureItemText}>
                          You can request complete document deletion at any time via Account Privacy settings.
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Document Guidelines Card (Mirrors Demo Card) */}
                  <View style={styles.guidelinesBox}>
                    <View style={styles.guidelineHeaderRow}>
                      <MaterialIcons name="assignment" size={16} color="#0A45B5" />
                      <Text style={styles.guidelineHeaderTitle}>Guidelines for Instant Approval</Text>
                    </View>
                    <View style={styles.guidelinesList}>
                      <View style={styles.guidelineRow}>
                        <View style={styles.guidelineDot} />
                        <Text style={styles.guidelineText}>
                          <Text style={{ fontWeight: "700", color: "#0B1B3F" }}>Full Document: </Text>
                          Ensure all 4 corners and government stamp are clearly visible.
                        </Text>
                      </View>
                      <View style={styles.guidelineRow}>
                        <View style={styles.guidelineDot} />
                        <Text style={styles.guidelineText}>
                          <Text style={{ fontWeight: "700", color: "#0B1B3F" }}>High Clarity: </Text>
                          Name, photo, and ID number must be legible with zero blur or glare.
                        </Text>
                      </View>
                      <View style={styles.guidelineRow}>
                        <View style={styles.guidelineDot} />
                        <Text style={styles.guidelineText}>
                          <Text style={{ fontWeight: "700", color: "#0B1B3F" }}>Both Sides: </Text>
                          For Aadhaar Card or Voter ID, upload both front and back sides.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Mirrored Footnote */}
                <View style={styles.securityFootnote}>
                  <MaterialIcons name="verified" size={13} color="#059669" />
                  <Text style={styles.securityFootnoteText}>
                    100% Direct Owner Transparency across all 38 districts of Bihar.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Three Visual Benefit Cards across the full width */}
          <View style={[styles.benefitsRow, compact && styles.benefitsRowCompact]}>
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIconWrap, { backgroundColor: "#ECFDF5" }]}>
                <MaterialIcons name="verified" size={20} color="#059669" />
              </View>
              <Text style={styles.benefitTitle}>Certified Badge</Text>
              <Text style={styles.benefitDesc}>
                Builds instant buyer trust with a verified owner mark on all your properties
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIconWrap, { backgroundColor: "#EFF6FF" }]}>
                <MaterialIcons name="chat" size={20} color="#0A45B5" />
              </View>
              <Text style={styles.benefitTitle}>Direct Deals</Text>
              <Text style={styles.benefitDesc}>
                Connect directly with property owners and buyers with zero middleman interference
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIconWrap, { backgroundColor: "#EEF2FF" }]}>
                <MaterialIcons name="security" size={20} color="#4F46E5" />
              </View>
              <Text style={styles.benefitTitle}>Private & Safe</Text>
              <Text style={styles.benefitDesc}>
                Bank-grade encrypted review. Your documents are strictly shielded and deleted post-audit
              </Text>
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
    maxWidth: 1240, // Perfectly aligned with AppHeader and WebFooter
    alignSelf: "center",
    paddingHorizontal: 20, // Matches AppHeader paddingHorizontal
    paddingTop: 24,
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
    marginBottom: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
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
  complianceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 10,
  },
  complianceChipText: {
    color: "#059669",
    fontSize: 11.5,
    fontWeight: "700",
  },
  heroTitle: {
    color: "#0B1B3F",
    fontSize: 30,
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

  // Content Grid (Two equal columns, stretching to the exact same height)
  contentGrid: {
    width: "100%",
    marginBottom: 24,
  },
  contentGridRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 24,
  },
  columnWrapper: {
    width: "100%",
  },
  columnWrapperWide: {
    flex: 1, // Exactly 50% width on left and right
    display: "flex",
  },

  // Glass Card (Unified style, full height flex stretch)
  glassCard: {
    flex: 1,
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
    justifyContent: "space-between",
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 460,
    gap: 12,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 13.5,
  },

  // Verified Hero
  verifiedHero: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 18,
  },
  verifiedIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  verifiedMainTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.4,
  },
  verifiedMainSubtitle: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 460,
    lineHeight: 21,
  },
  verifiedInfoStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 20,
  },
  verifiedInfoCol: {
    flex: 1,
    alignItems: "center",
  },
  verifiedInfoDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E2E8F0",
  },
  verifiedInfoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  verifiedInfoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1B3F",
    marginTop: 4,
  },
  verifiedStatusInline: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  // Pending Hero
  pendingHero: {
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 18,
  },
  pendingIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFBEB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1B3F",
  },
  pendingMainSubtitle: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    maxWidth: 460,
    lineHeight: 21,
  },
  pendingInfoStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    marginBottom: 20,
  },
  pendingInfoText: {
    flex: 1,
    color: "#92400E",
    fontSize: 12.5,
    lineHeight: 18,
  },

  // Card Header Row (Upload state)
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  idIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0B1B3F",
  },
  cardHeaderSub: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 2,
  },
  statusPillUnverified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillUnverifiedText: {
    color: "#0A45B5",
    fontSize: 11.5,
    fontWeight: "700",
  },

  // Document Tags Row
  docTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  docTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  docTagText: {
    color: "#334155",
    fontSize: 11.5,
    fontWeight: "600",
  },

  // Dropzone
  dropZone: {
    borderWidth: 2,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
    backgroundColor: "#F8FAFF",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginBottom: 16,
  },
  dropZoneActive: {
    borderColor: "#0A45B5",
    backgroundColor: "#EFF6FF",
  },
  dropZoneIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  dropZoneTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0A45B5",
  },
  dropZoneSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    textAlign: "center",
  },
  dropZoneSpecsBadge: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dropZoneSpecsText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },

  // Files List
  filesList: {
    gap: 8,
    marginBottom: 16,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  fileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  fileNameCol: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B1B3F",
  },
  fileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  fileSizeText: {
    fontSize: 11,
    color: "#64748B",
  },
  fileMetaDot: {
    fontSize: 11,
    color: "#94A3B8",
  },
  fileReadyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  fileReadyPillText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "700",
  },
  removeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    cursor: "pointer",
  },

  // Notes Box
  notesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#B45309",
    marginBottom: 2,
  },
  notesText: {
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
    shadowOpacity: 0.18,
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

  // Divider
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  orText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // Demo Action Card
  demoActionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
  },
  demoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  demoTextWrap: {
    flex: 1,
  },
  demoActionTitle: {
    color: "#0A45B5",
    fontSize: 12.5,
    fontWeight: "700",
  },
  demoActionSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  // Right Side Privacy Box (Mirrors Dropzone shape and size)
  privacyFeatureBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  privacyFeatureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  privacyCheckIcon: {
    marginTop: 2,
  },
  featureItemBold: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0B1B3F",
  },
  featureItemText: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1,
    lineHeight: 16,
  },

  // Right Side Guidelines Box (Mirrors Demo Mode Box)
  guidelinesBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    padding: 12,
  },
  guidelineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  guidelineHeaderTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0A45B5",
  },
  guidelinesList: {
    gap: 6,
  },
  guidelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  guidelineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#0A45B5",
    marginTop: 5,
  },
  guidelineText: {
    flex: 1,
    fontSize: 11.5,
    color: "#334155",
    lineHeight: 16,
  },

  // Security Footnote
  securityFootnote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  securityFootnoteText: {
    color: "#64748B",
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
  },

  // Benefits Row (Full Width below grid)
  benefitsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    marginTop: 4,
  },
  benefitsRowCompact: {
    flexDirection: "column",
    gap: 12,
  },
  benefitItem: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    alignItems: "center",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  benefitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B1B3F",
  },
  benefitDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 18,
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
