import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import { Action, Check, Field, ui, WorkflowScreen } from "./WorkflowUI";
import MapParcelPicker, { LatLngPoint } from "./MapParcelPicker";
import { useAuthStore } from "../src/store/authStore";
import { propertyService } from "../src/services/propertyService";
import { documentService } from "../src/services/documentService";
import { workflowService } from "../src/services/workflowService";
import { dashboardRoutes } from "../src/utils/accountRoutes";

const initialForm = {
  title: "",
  description: "",
  type: "land",
  price: "",
  totalArea: "",
  sellableArea: "",
  state: "Bihar",
  district: "",
  pincode: "",
  block: "",
  mauza: "",
  policeStation: "",
  khata: "",
  khesra: "",
  holdingNumber: "",
  boundary: "",
  roadWidth: "",
  lat: "",
  lng: "",
  photos: "",
  videos: "",
  possessionStatus: "With Owner",
};

const PROPERTY_TYPES: {
  value: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { value: "land", label: "Land / Plot", icon: "landscape" },
  { value: "flat", label: "Flat / Apartment", icon: "apartment" },
  { value: "house", label: "House / Villa", icon: "cottage" },
  { value: "shop", label: "Commercial Shop", icon: "storefront" },
  { value: "office", label: "Office Space", icon: "business" },
];

const docTypes = [
  "Registry",
  "Mutation",
  "LPC/Jamabandi",
  "Map",
  "Rent Receipt",
  "Owner ID Proof",
];

type Picked = { asset: DocumentPicker.DocumentPickerAsset; type: string };

export default function ListingEditorScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const initialId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const { user, authState, hydrated } = useAuthStore();
  const [form, setForm] = useState(initialForm);
  const [points, setPoints] = useState<LatLngPoint[]>([]);
  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState(initialId);
  const [loading, setLoading] = useState(!!initialId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [negotiable, setNegotiable] = useState(true);
  const [hasLoan, setHasLoan] = useState(false);
  const [hasDispute, setHasDispute] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const submitting = useRef(false);

  const change = (key: keyof typeof initialForm, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const onParcelChange = useCallback((next: LatLngPoint[]) => {
    setPoints(next);
    if (next.length) {
      setForm((previous) => ({
        ...previous,
        lat: String(next[0].lat),
        lng: String(next[0].lng),
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!initialId || authState !== "AUTHENTICATED") return;
    (async () => {
      try {
        const property = await workflowService.detail(initialId);
        if (!["draft", "correction_required"].includes(property.status)) {
          throw new Error("Only drafts and correction requests can be edited.");
        }
        const documents = await documentService.getDocuments(initialId);
        if (!active) return;
        const next = { ...initialForm };
        for (const key of [
          "title",
          "description",
          "type",
          "price",
          "totalArea",
          "sellableArea",
          "khata",
          "khesra",
          "holdingNumber",
          "boundary",
          "roadWidth",
        ] as const) {
          next[key] = String(property[key] ?? "");
        }
        for (const key of [
          "state",
          "district",
          "pincode",
          "block",
          "mauza",
          "policeStation",
          "lat",
          "lng",
        ] as const) {
          next[key] = String(property.location[key] ?? "");
        }
        next.photos = property.media?.photos?.join("\n") || "";
        next.videos = property.media?.videos?.join("\n") || "";
        next.possessionStatus =
          property.disclosures?.possessionStatus || "With Owner";
        setForm(next);
        setPoints(property.parcelPoints || []);
        setExistingDocs(documents);
        setNegotiable(property.negotiable ?? true);
        setHasLoan(!!property.disclosures?.hasLoan);
        setHasDispute(!!property.disclosures?.hasDispute);
      } catch (cause: any) {
        if (active) {
          setError(
            cause.response?.data?.message ||
              cause.message ||
              "Could not load listing"
          );
          setLoadFailed(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialId, authState]);

  const validate = (location = false) => {
    if (form.pincode && !/^[1-9]\d{5}$/.test(form.pincode.trim())) {
      return "Enter a valid six-digit pincode.";
    }
    if (!form.state.trim() || !form.district.trim()) {
      return "Enter state and district.";
    }
    if (
      ![form.price, form.totalArea, form.sellableArea].every(
        (value) =>
          value.trim() &&
          Number.isFinite(Number(value)) &&
          Number(value) > 0
      )
    ) {
      return "Enter a positive price, total area and sellable area.";
    }
    if (Number(form.sellableArea) > Number(form.totalArea)) {
      return "Sellable area cannot exceed total area.";
    }
    if (
      form.roadWidth &&
      (!Number.isFinite(Number(form.roadWidth)) || Number(form.roadWidth) < 0)
    ) {
      return "Enter a valid road width.";
    }
    if (
      location &&
      (!form.lat.trim() ||
        !form.lng.trim() ||
        !Number.isFinite(Number(form.lat)) ||
        Math.abs(Number(form.lat)) > 90 ||
        !Number.isFinite(Number(form.lng)) ||
        Math.abs(Number(form.lng)) > 180)
    ) {
      return "Mark the property on the map or enter valid GPS coordinates.";
    }
    if (location && points.length > 0 && points.length < 3) {
      return "Complete the boundary with at least three points, or clear it and use GPS coordinates.";
    }
    const urls = [form.photos, form.videos].flatMap((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    );
    if (urls.some((url) => !/^https?:\/\/\S+$/i.test(url))) {
      return "Media links must be valid http or https URLs.";
    }
    return "";
  };

  const next = () => {
    const message =
      validate(step === 2) ||
      (step === 2 && !form.photos.trim() && !photoFiles.length
        ? "Add at least one property photo."
        : "");
    setError(message);
    if (!message) {
      setStep((value) => value + 1);
      window?.scrollTo?.({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep((value) => value - 1);
      setError("");
      window?.scrollTo?.({ top: 0, behavior: "smooth" });
    } else {
      router.replace("/my-properties");
    }
  };

  const pickPhotos = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      if (result.assets.some((asset) => (asset.size || 0) > 10 * 1024 * 1024)) {
        setError("Each photo must be under 10 MB.");
        return;
      }
      if (
        form.photos.split("\n").filter(Boolean).length +
          photoFiles.length +
          result.assets.length >
        10
      ) {
        setError("Choose up to 10 photos.");
        return;
      }
      setPhotoFiles((previous) => [...previous, ...result.assets]);
      setError("");
    } catch {
      setError("Could not select photos. Please try again.");
    }
  };

  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        setPicked((previous) => [
          ...previous,
          ...result.assets.map((asset) => ({ asset, type: "Registry" })),
        ]);
      }
    } catch {
      setError("Could not select document. Please try again.");
    }
  };

  const submit = async () => {
    if (submitting.current) return;
    const message =
      validate(true) ||
      (!form.photos.trim() && !photoFiles.length
        ? "Add at least one property photo."
        : "");
    if (message || !consent) {
      setError(message || "Accept the seller declaration.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const data = {
        title: form.title.trim() || `${form.type} in ${form.district}`,
        description: form.description.trim(),
        type: form.type,
        price: Number(form.price),
        totalArea: Number(form.totalArea),
        sellableArea: Number(form.sellableArea),
        khata: form.khata,
        khesra: form.khesra,
        holdingNumber: form.holdingNumber,
        boundary: form.boundary,
        roadWidth: form.roadWidth ? Number(form.roadWidth) : undefined,
        negotiable,
        location: {
          state: form.state.trim(),
          district: form.district.trim(),
          pincode: form.pincode.trim(),
          block: form.block,
          mauza: form.mauza,
          policeStation: form.policeStation,
          lat: Number(form.lat),
          lng: Number(form.lng),
        },
        parcelPoints: points,
        disclosures: {
          hasLoan,
          hasDispute,
          possessionStatus: form.possessionStatus,
        },
        media: {
          photos: form.photos
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
          videos: form.videos
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      };
      let savedId = propertyId;
      if (savedId) {
        await propertyService.updateProperty(savedId, data);
      } else {
        const property = await propertyService.createProperty(data);
        savedId = property._id || property.id;
        setPropertyId(savedId);
      }
      for (const asset of photoFiles) {
        const file: any =
          Platform.OS === "web"
            ? asset.file ||
              new File([await (await fetch(asset.uri)).blob()], asset.name, {
                type: asset.mimeType,
              })
            : {
                uri: asset.uri,
                name: asset.name,
                type: asset.mimeType || "image/jpeg",
              };
        const result = await propertyService.uploadPhoto(savedId!, file, asset.name);
        setForm((previous) => ({
          ...previous,
          photos: [previous.photos, result.url].filter(Boolean).join("\n"),
        }));
        setPhotoFiles((previous) => previous.filter((item) => item !== asset));
      }
      for (const document of picked) {
        const { asset } = document;
        const file: any =
          Platform.OS === "web"
            ? asset.file ||
              new File([await (await fetch(asset.uri)).blob()], asset.name, {
                type: asset.mimeType,
              })
            : {
                uri: asset.uri,
                name: asset.name,
                type: asset.mimeType || "application/octet-stream",
              };
        await documentService.uploadDocument(
          savedId!,
          document.type,
          file,
          asset.name
        );
        setPicked((previous) => previous.filter((item) => item !== document));
      }
      await workflowService.submit(savedId!);
      setSubmissionSuccess(true);
    } catch (cause: any) {
      setError(
        cause.response?.data?.message ||
          "Could not finish submission. Any saved draft and uploaded documents are retained. Please retry."
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const locate = async () => {
    setBusy(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Location permission denied. Enter coordinates manually.");
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setForm((previous) => ({
        ...previous,
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
      }));
    } catch (cause: any) {
      setError(cause.message || "Could not obtain location");
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) return <ActivityIndicator />;
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;
  if (user.role !== "user") return <Redirect href={dashboardRoutes[user.role]} />;
  if (!user.demoKycComplete) return <Redirect href="/kyc" />;

  const field = (
    key: keyof typeof initialForm,
    label: string,
    numeric = false,
    multiline = false,
    placeholder = ""
  ) => (
    <Field
      key={key}
      label={label}
      value={form[key]}
      onChangeText={(value) => change(key, value)}
      numeric={numeric}
      multiline={multiline}
      placeholder={placeholder}
    />
  );

  return (
    <WorkflowScreen showBack={false} hideHeaderTitle fallbackRoute="/my-properties">
      <View style={styles.pageContainer}>
        {/* Top Back & Breadcrumb Strip */}
        <View style={styles.topBar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButtonPill}
            onPress={handlePrevStep}
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-back" size={16} color="#03456C" />
            <Text style={styles.backButtonPillText}>
              {step > 1 ? "Previous step" : "Back to listings"}
            </Text>
          </TouchableOpacity>

          <View style={styles.breadcrumbTrail}>
            <Text style={styles.breadcrumbMuted}>Dashboard</Text>
            <MaterialIcons name="chevron-right" size={14} color="#94A3B8" />
            <Text style={styles.breadcrumbMuted}>My Properties</Text>
            <MaterialIcons name="chevron-right" size={14} color="#94A3B8" />
            <Text style={styles.breadcrumbActive}>
              {initialId ? "Edit Listing" : "List a Property"}
            </Text>
          </View>
        </View>

        {/* Page Hero Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.pageTitle}>
            {initialId ? "Update Property Listing" : "List a Property"}
          </Text>
          <Text style={styles.pageSubtitle}>
            Publish your property to verified Bihar buyers and institutional investors with MalikSe cadastral verification.
          </Text>
        </View>

        {/* Visual 3-Stage Progress Stepper */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepperTrack}>
            {/* Step 1 Item */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBadge,
                  step === 1
                    ? styles.stepBadgeActive
                    : step > 1
                    ? styles.stepBadgeCompleted
                    : styles.stepBadgePending,
                ]}
              >
                {step > 1 ? (
                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="home-work" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  step >= 1 ? styles.stepLabelActive : styles.stepLabelPending,
                ]}
              >
                1. Property Details
              </Text>
            </View>

            {/* Connecting Line 1-2 */}
            <View
              style={[
                styles.stepLine,
                step >= 2 ? styles.stepLineActive : styles.stepLinePending,
              ]}
            />

            {/* Step 2 Item */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBadge,
                  step === 2
                    ? styles.stepBadgeActive
                    : step > 2
                    ? styles.stepBadgeCompleted
                    : styles.stepBadgePending,
                ]}
              >
                {step > 2 ? (
                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                ) : (
                  <MaterialIcons
                    name="map"
                    size={16}
                    color={step >= 2 ? "#FFFFFF" : "#64748B"}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  step >= 2 ? styles.stepLabelActive : styles.stepLabelPending,
                ]}
              >
                2. Location & Media
              </Text>
            </View>

            {/* Connecting Line 2-3 */}
            <View
              style={[
                styles.stepLine,
                step >= 3 ? styles.stepLineActive : styles.stepLinePending,
              ]}
            />

            {/* Step 3 Item */}
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBadge,
                  step === 3
                    ? styles.stepBadgeActive
                    : styles.stepBadgePending,
                ]}
              >
                <MaterialIcons
                  name="verified-user"
                  size={16}
                  color={step === 3 ? "#FFFFFF" : "#64748B"}
                />
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  step === 3 ? styles.stepLabelActive : styles.stepLabelPending,
                ]}
              >
                3. Ownership & Submit
              </Text>
            </View>
          </View>
        </View>

        {/* Error Notice */}
        {!!error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color="#DC2626" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Main Well-Defined Form Card */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#03456C" />
            <Text style={styles.loadingText}>Loading property information...</Text>
          </View>
        ) : !loadFailed ? (
          <View style={styles.mainCard}>
            {/* STEP 1: Property Details */}
            {step === 1 && (
              <View style={styles.formContainer}>
                {/* Card Top Header */}
                <View style={styles.cardHeaderBox}>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>STEP 1 OF 3</Text>
                  </View>
                  <Text style={styles.cardTitle}>Basic Details & Location</Text>
                  <Text style={styles.cardDesc}>
                    Provide property classification, revenue jurisdiction, and area specifications.
                  </Text>
                </View>

                {/* Section 1: Basic Info */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="info" size={18} color="#03456C" />
                    <Text style={styles.sectionHeaderText}>General Information</Text>
                  </View>

                  {field(
                    "title",
                    "Property title (optional)",
                    false,
                    false,
                    "e.g. Modern 4 BHK Duplex Villa in Kankarbagh"
                  )}

                  {/* Property Type Selection Pills */}
                  <View style={styles.typeBlock}>
                    <Text style={styles.fieldLabel}>Property category *</Text>
                    <View style={styles.typeGrid}>
                      {PROPERTY_TYPES.map((item) => {
                        const isSelected = form.type === item.value;
                        return (
                          <TouchableOpacity
                            key={item.value}
                            accessibilityRole="button"
                            onPress={() => change("type", item.value)}
                            style={[
                              styles.typePill,
                              isSelected
                                ? styles.typePillActive
                                : styles.typePillInactive,
                            ]}
                            activeOpacity={0.8}
                          >
                            <MaterialIcons
                              name={item.icon}
                              size={17}
                              color={isSelected ? "#38BDF8" : "#0284C7"}
                            />
                            <Text
                              style={[
                                styles.typePillText,
                                isSelected
                                  ? styles.typePillTextActive
                                  : styles.typePillTextInactive,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Section 2: Location & Revenue Jurisdiction */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="location-on" size={18} color="#03456C" />
                    <Text style={styles.sectionHeaderText}>
                      Location & Revenue Jurisdiction
                    </Text>
                  </View>

                  <View style={[styles.gridRow, isDesktop && styles.gridRow2Col]}>
                    <View style={styles.gridCol}>
                      <View style={{ gap: 6 }}>
                        <Text style={styles.fieldLabel}>State *</Text>
                        <View style={styles.fixedStateBox}>
                          <MaterialIcons name="verified" size={16} color="#0284C7" />
                          <Text style={styles.fixedStateText}>Bihar</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.gridCol}>
                      {field("district", "District *", false, false, "e.g. Patna, Gaya, Muzaffarpur")}
                    </View>
                  </View>

                  <View style={[styles.gridRow, isDesktop && styles.gridRow2Col]}>
                    <View style={styles.gridCol}>
                      {field("pincode", "Pincode (6 digits) *", true, false, "e.g. 800020")}
                    </View>
                    <View style={styles.gridCol}>
                      {field("block", "Block / circle", false, false, "e.g. Patna Sadar, Bihta")}
                    </View>
                  </View>

                  <View style={[styles.gridRow, isDesktop && styles.gridRow2Col]}>
                    <View style={styles.gridCol}>
                      {field("mauza", "Revenue Mauza", false, false, "e.g. Kankarbagh, Danapur")}
                    </View>
                    <View style={styles.gridCol}>
                      {field("policeStation", "Police station number / Thana", false, false, "e.g. Kankarbagh Thana")}
                    </View>
                  </View>
                </View>

                {/* Section 3: Cadastral Land Records (Optional) */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="description" size={18} color="#03456C" />
                    <Text style={styles.sectionHeaderText}>
                      Cadastral & Title Records (Optional)
                    </Text>
                  </View>

                  <View style={[styles.gridRow, isDesktop && styles.gridRow3Col]}>
                    <View style={styles.gridCol}>
                      {field("khata", "Khata number", false, false, "e.g. 142")}
                    </View>
                    <View style={styles.gridCol}>
                      {field("khesra", "Khesra / plot number", false, false, "e.g. 859")}
                    </View>
                    <View style={styles.gridCol}>
                      {field("holdingNumber", "Holding number", false, false, "e.g. H-22")}
                    </View>
                  </View>
                </View>

                {/* Section 4: Pricing & Area Breakdown */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="payments" size={18} color="#03456C" />
                    <Text style={styles.sectionHeaderText}>Pricing & Area Measurements</Text>
                  </View>

                  <View style={[styles.gridRow, isDesktop && styles.gridRow3Col]}>
                    <View style={styles.gridCol}>
                      {field("price", "Asking Price (₹) *", true, false, "e.g. 7600000")}
                    </View>
                    <View style={styles.gridCol}>
                      {field("totalArea", "Total area (sq.ft) *", true, false, "e.g. 2800")}
                    </View>
                    <View style={styles.gridCol}>
                      {field("sellableArea", "Sellable area (sq.ft) *", true, false, "e.g. 2800")}
                    </View>
                  </View>

                  {/* Negotiable Toggle Pill */}
                  <TouchableOpacity
                    onPress={() => setNegotiable(!negotiable)}
                    style={[
                      styles.toggleCard,
                      negotiable && styles.toggleCardActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={negotiable ? "check-box" : "check-box-outline-blank"}
                      size={20}
                      color={negotiable ? "#0284C7" : "#94A3B8"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleCardTitle}>Price is negotiable</Text>
                      <Text style={styles.toggleCardSubtitle}>
                        Allows buyers to submit counter-offers for your review
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Section 5: Description & Disclosures */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="security" size={18} color="#03456C" />
                    <Text style={styles.sectionHeaderText}>Description & Disclosures</Text>
                  </View>

                  {field(
                    "description",
                    "Property Description",
                    false,
                    true,
                    "Describe property highlights, road connectivity, landmark proximity, water/electricity access..."
                  )}

                  <View style={{ gap: 10, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => setHasLoan(!hasLoan)}
                      style={[styles.toggleCard, hasLoan && styles.toggleCardWarning]}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={hasLoan ? "check-box" : "check-box-outline-blank"}
                        size={20}
                        color={hasLoan ? "#D97706" : "#94A3B8"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleCardTitle}>
                          Property has an existing bank loan / mortgage
                        </Text>
                        <Text style={styles.toggleCardSubtitle}>
                          Discloses active encumbrance to advisor for NOC assistance
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setHasDispute(!hasDispute)}
                      style={[styles.toggleCard, hasDispute && styles.toggleCardDanger]}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={hasDispute ? "check-box" : "check-box-outline-blank"}
                        size={20}
                        color={hasDispute ? "#DC2626" : "#94A3B8"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleCardTitle}>
                          Property has a dispute or litigation
                        </Text>
                        <Text style={styles.toggleCardSubtitle}>
                          Requires legal review prior to buyer marketing
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginTop: 12 }}>
                    {field(
                      "possessionStatus",
                      "Possession status",
                      false,
                      false,
                      "e.g. With Owner, Ready to Move, Immediate"
                    )}
                  </View>
                </View>

                {/* Continue Action */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.primaryBtn}
                    onPress={next}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.primaryBtnText}>
                      Continue to Location & Media
                    </Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 2: Location and Boundaries */}
            {step === 2 && (
              <View style={styles.formContainer}>
                <View style={styles.cardHeaderBox}>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>STEP 2 OF 3</Text>
                  </View>
                  <Text style={styles.cardTitle}>Map Location & Parcel Boundary</Text>
                  <Text style={styles.cardDesc}>
                    Tap points on the cadastral map to outline the property boundary, or enter the GPS coordinates manually.
                  </Text>
                </View>

                <View style={styles.mapContainerBox}>
                  <MapParcelPicker
                    initialPoints={points}
                    onParcelChange={onParcelChange}
                    areaSqFt={form.totalArea}
                  />
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.gpsLocateBtn}
                  disabled={busy}
                  onPress={locate}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="my-location" size={18} color="#0284C7" />
                  <Text style={styles.gpsLocateBtnText}>
                    Use Current GPS Coordinates
                  </Text>
                </TouchableOpacity>

                <View style={[styles.gridRow, isDesktop && styles.gridRow2Col]}>
                  <View style={styles.gridCol}>
                    {field("lat", "Latitude *", true, false, "e.g. 25.6100")}
                  </View>
                  <View style={styles.gridCol}>
                    {field("lng", "Longitude *", true, false, "e.g. 85.1400")}
                  </View>
                </View>

                <View style={[styles.gridRow, isDesktop && styles.gridRow2Col]}>
                  <View style={styles.gridCol}>
                    {field("boundary", "Boundary description", false, false, "e.g. Fenced North-facing")}
                  </View>
                  <View style={styles.gridCol}>
                    {field("roadWidth", "Approach road width (feet)", true, false, "e.g. 30")}
                  </View>
                </View>

                {/* Property Photos Section */}
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="add-a-photo" size={18} color="#03456C" />
                    <Text style={styles.sectionHeaderText}>Property Media Photos *</Text>
                  </View>
                  <Text style={styles.fieldHint}>
                    Upload 1 to 10 high-resolution photos (JPEG, PNG, WebP up to 10 MB each). The first photo serves as the listing cover.
                  </Text>

                  {/* Photos Grid */}
                  <View style={styles.photosGrid}>
                    {form.photos
                      .split("\n")
                      .filter(Boolean)
                      .map((uri, index) => (
                        <View key={uri} style={styles.photoCard}>
                          <Image
                            source={{ uri }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                          />
                          <View style={styles.photoOverlayBadge}>
                            <Text style={styles.photoOverlayText}>
                              {index === 0 ? "Cover Photo" : `Photo ${index + 1}`}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removePhotoBtn}
                            onPress={() =>
                              change(
                                "photos",
                                form.photos
                                  .split("\n")
                                  .filter((value) => value !== uri)
                                  .join("\n")
                              )
                            }
                            accessibilityLabel="Remove photo"
                          >
                            <MaterialIcons name="close" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ))}

                    {photoFiles.map((asset, index) => (
                      <View key={`${asset.uri}-${index}`} style={styles.photoCard}>
                        <Image
                          source={{ uri: asset.uri }}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                        />
                        <View style={styles.photoOverlayBadge}>
                          <Text style={styles.photoOverlayText}>
                            {!form.photos && index === 0
                              ? "Cover Photo"
                              : "Ready to Upload"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removePhotoBtn}
                          onPress={() =>
                            setPhotoFiles((previous) =>
                              previous.filter((_, i) => i !== index)
                            )
                          }
                          accessibilityLabel="Remove photo"
                        >
                          <MaterialIcons name="close" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.uploadBtn}
                    onPress={pickPhotos}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="cloud-upload" size={20} color="#03456C" />
                    <Text style={styles.uploadBtnText}>Upload Property Photos</Text>
                  </TouchableOpacity>

                  {field(
                    "videos",
                    "Video / Drone footage URLs (optional, one per line)",
                    false,
                    true,
                    "https://..."
                  )}
                </View>

                {/* Step 2 Actions */}
                <View style={styles.actionRowSplit}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.secondaryBtn}
                    onPress={handlePrevStep}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="arrow-back" size={18} color="#03456C" />
                    <Text style={styles.secondaryBtnText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.primaryBtn}
                    onPress={next}
                    disabled={busy}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.primaryBtnText}>Continue to Documents</Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 3: Documents and Submission */}
            {step === 3 && (
              <View style={styles.formContainer}>
                <View style={styles.cardHeaderBox}>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>STEP 3 OF 3</Text>
                  </View>
                  <Text style={styles.cardTitle}>Ownership Documents & Submit</Text>
                  <Text style={styles.cardDesc}>
                    Documents are visible only to you, assigned MalikSe Advisors and ground verifiers. Uploading is optional now and can be added later.
                  </Text>
                </View>

                {/* Existing Uploaded Docs */}
                {existingDocs.length > 0 && (
                  <View style={styles.docList}>
                    {existingDocs.map((doc) => (
                      <View key={doc._id || doc.id} style={styles.docItem}>
                        <MaterialIcons name="check-circle" size={18} color="#059669" />
                        <Text style={styles.docItemText}>
                          Verified on record: {doc.fileName}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Picked Docs to Upload */}
                {picked.map((document, index) => (
                  <View key={`${document.asset.uri}-${index}`} style={styles.docCard}>
                    <View style={styles.docCardHeader}>
                      <MaterialIcons name="insert-drive-file" size={20} color="#03456C" />
                      <Text style={styles.docCardTitle} numberOfLines={1}>
                        {document.asset.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setPicked((previous) =>
                            previous.filter((_, i) => i !== index)
                          )
                        }
                      >
                        <MaterialIcons name="close" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.docTypeRow}>
                      {docTypes.map((type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() =>
                            setPicked((previous) =>
                              previous.map((item, i) =>
                                i === index ? { ...item, type } : item
                              )
                            )
                          }
                          style={[
                            styles.docTypePill,
                            type === document.type && styles.docTypePillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.docTypePillText,
                              type === document.type && styles.docTypePillTextActive,
                            ]}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.uploadBtn}
                  onPress={pick}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="note-add" size={20} color="#03456C" />
                  <Text style={styles.uploadBtnText}>Attach Title / Registry Documents</Text>
                </TouchableOpacity>

                {/* Review Submission Summary Card */}
                <View style={styles.reviewSummaryCard}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="fact-check" size={18} color="#03456C" />
                    <Text style={styles.sectionHeaderText}>Review Listing Summary</Text>
                  </View>
                  <Text style={styles.reviewTitle}>
                    {form.title || `${form.type} in ${form.district}`}
                  </Text>
                  <Text style={styles.reviewSub}>
                    {form.district}, {form.state} · Asking Price: ₹
                    {Number(form.price).toLocaleString("en-IN")}
                  </Text>
                  <Text style={styles.reviewSub}>
                    Sellable Area: {form.sellableArea} sq.ft · GPS Coordinates:{" "}
                    {form.lat}, {form.lng}
                  </Text>
                </View>

                {/* Declaration Checkbox */}
                <TouchableOpacity
                  onPress={() => setConsent(!consent)}
                  style={[styles.consentCard, consent && styles.consentCardActive]}
                  activeOpacity={0.85}
                >
                  <MaterialIcons
                    name={consent ? "check-box" : "check-box-outline-blank"}
                    size={22}
                    color={consent ? "#059669" : "#94A3B8"}
                  />
                  <Text style={styles.consentText}>
                    I confirm the property information and disclosures are accurate and authorize MalikSe certified Advisors to inspect and review this listing.
                  </Text>
                </TouchableOpacity>

                {/* Pre-submission Reassurance Note */}
                <View style={styles.submissionNoticeBox}>
                  <MaterialIcons name="security" size={17} color="#0284C7" />
                  <Text style={styles.submissionNoticeText}>
                    Upon submission, your listing will remain private until approved by an Advisor and a Verifier.
                  </Text>
                </View>

                {/* Step 3 Actions */}
                <View style={styles.actionRowSplit}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.secondaryBtn}
                    onPress={handlePrevStep}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="arrow-back" size={18} color="#03456C" />
                    <Text style={styles.secondaryBtnText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[
                      styles.primarySubmitBtn,
                      (!consent || busy) && { opacity: 0.6 },
                    ]}
                    onPress={submit}
                    disabled={busy || !consent}
                    activeOpacity={0.88}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="verified-user" size={19} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>
                          Submit for Advisor Verification
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* Submission Success Confirmation Modal */}
        <Modal
          visible={submissionSuccess}
          transparent
          animationType="fade"
          onRequestClose={() => router.replace("/my-properties")}
        >
          <View style={styles.successModalOverlay}>
            <View style={styles.successCard}>
              <View style={styles.successIconBadge}>
                <MaterialIcons name="check-circle" size={48} color="#059669" />
              </View>
              <Text style={styles.successTitle}>Listing Submitted Successfully!</Text>

              <View style={styles.successPrivacyBanner}>
                <MaterialIcons name="security" size={18} color="#059669" />
                <Text style={styles.successPrivacyBannerText}>
                  Submitted listings remain private until an Advisor and a Verifier inspect & approve them.
                </Text>
              </View>

              <Text style={styles.successSubtext}>
                Your property has been queued for verification. Our certified legal advisors will review your documents and schedule an on-site GPS inspection.
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                style={styles.successDoneBtn}
                onPress={() => router.replace("/my-properties")}
                activeOpacity={0.88}
              >
                <Text style={styles.successDoneBtnText}>Go to My Properties</Text>
                <MaterialIcons name="arrow-forward" size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    width: "100%",
    maxWidth: 880,
    alignSelf: "center",
    paddingTop: 8,
  },

  /* Top Navigation & Breadcrumbs */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  backButtonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
      },
    }),
  },
  backButtonPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#03456C",
  },
  breadcrumbTrail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breadcrumbMuted: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  breadcrumbActive: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  /* Header Block */
  headerBlock: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14.5,
    color: "#64748B",
    lineHeight: 22,
  },

  /* Visual Stepper Tracker */
  stepperContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
      },
    }),
  },
  stepperTrack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeActive: {
    backgroundColor: "#03456C",
  },
  stepBadgeCompleted: {
    backgroundColor: "#059669",
  },
  stepBadgePending: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  stepLabelActive: {
    color: "#0F172A",
  },
  stepLabelPending: {
    color: "#94A3B8",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 12,
  },
  stepLineActive: {
    backgroundColor: "#059669",
  },
  stepLinePending: {
    backgroundColor: "#E2E8F0",
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECDD3",
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  errorBannerText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#DC2626",
    flex: 1,
  },

  /* Loading State */
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
  },

  /* Main Form Card */
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 28,
    ...Platform.select({
      web: {
        boxShadow: "0 16px 40px rgba(3, 69, 108, 0.08)",
      },
    }),
  },
  formContainer: {
    gap: 24,
  },

  /* Card Header Box */
  cardHeaderBox: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 20,
    gap: 8,
  },
  cardBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  cardDesc: {
    fontSize: 13.5,
    color: "#64748B",
    lineHeight: 20,
  },
  submissionNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    padding: 12,
    borderRadius: 12,
  },
  submissionNoticeText: {
    fontSize: 12.5,
    color: "#03456C",
    fontWeight: "500",
    flex: 1,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 25, 47, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: "blur(8px)",
      },
    }),
  },
  successCard: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
      },
      default: {
        elevation: 8,
      },
    }),
  },
  successIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  successPrivacyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 14,
    borderRadius: 14,
    width: "100%",
  },
  successPrivacyBannerText: {
    fontSize: 12.5,
    color: "#047857",
    fontWeight: "700",
    lineHeight: 18,
    flex: 1,
  },
  successSubtext: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  successDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#03456C",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: "100%",
    marginTop: 4,
    ...Platform.select({
      web: {
        cursor: "pointer",
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0A2540 100%)",
        boxShadow: "0 4px 16px rgba(3, 69, 108, 0.3)",
      },
    }),
  },
  successDoneBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* Section Blocks */
  sectionBlock: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: -0.2,
  },

  /* Property Type Grid */
  typeBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    minHeight: 42,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  typePillActive: {
    backgroundColor: "#03456C",
    borderWidth: 1.5,
    borderColor: "#0284C7",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(3, 69, 108, 0.25)",
      },
    }),
  },
  typePillInactive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  typePillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  typePillTextActive: {
    color: "#FFFFFF",
  },
  typePillTextInactive: {
    color: "#334155",
  },

  /* Grid Layouts */
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  gridRow2Col: {
    flexDirection: "row",
  },
  gridRow3Col: {
    flexDirection: "row",
  },
  gridCol: {
    flex: 1,
    minWidth: 220,
  },
  fixedStateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  fixedStateText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#03456C",
  },

  /* Toggle Cards */
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  toggleCardActive: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  toggleCardWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  toggleCardDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECDD3",
  },
  toggleCardTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  toggleCardSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },

  /* Action Buttons */
  actionRow: {
    marginTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    paddingTop: 20,
  },
  actionRowSplit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    paddingTop: 20,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#03456C",
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 14,
    alignSelf: "flex-end",
    ...Platform.select({
      web: {
        cursor: "pointer",
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0A2540 100%)",
        boxShadow: "0 4px 16px rgba(3, 69, 108, 0.3)",
      },
    }),
  },
  primarySubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(5, 150, 105, 0.3)",
      },
    }),
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#03456C",
  },

  /* Step 2 Specific */
  mapContainerBox: {
    minHeight: Platform.OS === "web" ? 520 : 440,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  gpsLocateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    paddingVertical: 12,
    borderRadius: 14,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  gpsLocateBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0284C7",
  },
  fieldHint: {
    fontSize: 12.5,
    color: "#64748B",
    lineHeight: 18,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 6,
  },
  photoCard: {
    width: 140,
    height: 105,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#0A2540",
  },
  photoOverlayBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoOverlayText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(220, 38, 38, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#0284C7",
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#03456C",
  },

  /* Step 3 Specific */
  docList: {
    gap: 8,
  },
  docItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  docItemText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
  },
  docCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  docCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  docCardTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  docTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  docTypePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  docTypePillActive: {
    backgroundColor: "#03456C",
    borderColor: "#03456C",
  },
  docTypePillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#334155",
  },
  docTypePillTextActive: {
    color: "#FFFFFF",
  },
  reviewSummaryCard: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    padding: 16,
    borderRadius: 16,
    gap: 6,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#03456C",
  },
  reviewSub: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  consentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 16,
    borderRadius: 16,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  consentCardActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
    fontWeight: "500",
  },
});
