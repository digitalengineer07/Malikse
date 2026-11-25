import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Image from "./PropertyImage";
import { Redirect, useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandLockup } from "./BrandLockup";
import { AccountHeaderBackdrop, accountHeaderStyle } from "./AccountHeaderBackdrop";
import { dashboardRoutes } from "../src/utils/accountRoutes";
import * as Location from "expo-location";
import { Action, Check, Field, ui, WorkflowScreen } from "./WorkflowUI";
import { useAuthStore } from "../src/store/authStore";
import { actorId, Listing, statusLabels, workflowService } from "../src/services/workflowService";
import { documentService } from "../src/services/documentService";
import api from "../src/services/authService";
import MiniMapPreview from "./MiniMapPreview";
import PublicPropertyDetails from "./PublicPropertyDetails";
import OfferSheet from "./OfferSheet";
import { chatApi } from "../src/features/chat";
import { userService } from "../src/services/userService";
import { AppTheme } from "../constants/theme";
import { hydrateUserAffinity, trackPropertyInteraction } from "../src/services/recommendationEngine";
import type { Property } from "../src/types/property.types";

const checks: Record<string, string> = { ownership: "Ownership information reviewed", location: "Property location reviewed", boundaries: "Boundaries and access reviewed", area: "Property area reviewed", disclosures: "Loans, disputes and possession reviewed", documentsReviewed: "Available documents reviewed (uploads are optional)", advisorReport: "Advisor report and inspection reviewed" };

function Metadata({ fields }: { fields: [string, string | number | undefined][] }) {
  return (
    <View style={styles.metadata}>
      {fields.map(([label, value]) => (
        <View key={label} style={styles.metadataItem}>
          <Text style={styles.metadataLabel}>{label}</Text>
          <Text selectable style={styles.metadataValue}>{value ?? "Not recorded"}</Text>
        </View>
      ))}
    </View>
  );
}

function recordedDate(value?: string) {
  const date = value ? new Date(value) : undefined;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : undefined;
}

function readableLabel(value: string) {
  const label = value.replace(/[_-]+/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const historyStatusLabels: Record<string, string> = {
  queued: "Queued for processing",
  pending: "Awaiting staff review",
  advisor_verified: "Awaiting verifier review",
  verified: "Verified · Published",
};

function historyStatus(status: string) {
  return historyStatusLabels[status] || statusLabels[status] || status;
}

function ListingPhotoSlider({ photos }: { photos: string[] }) {
  const [selected, setSelected] = useState(0);
  const count = photos.length;
  if (!count) return null;
  const index = selected % count;
  const slide = (direction: number) => {
    setSelected(current => (current % count + direction + count) % count);
  };

  return (
    <View style={styles.mediaFrame}>
      <Image key={photos[index]} source={{ uri: photos[index] }} style={styles.mediaImage}
        accessibilityLabel={`Listing photo ${index + 1} of ${count}`} />
      {count > 1 && <>
        <View pointerEvents="box-none" style={styles.mediaControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous listing photo"
            onPress={() => slide(-1)} style={styles.mediaArrowTarget}>
            <View style={styles.mediaArrow}><MaterialIcons name="chevron-left" size={19} color="#FCC61C" /></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next listing photo"
            onPress={() => slide(1)} style={styles.mediaArrowTarget}>
            <View style={styles.mediaArrow}><MaterialIcons name="chevron-right" size={19} color="#FCC61C" /></View>
          </Pressable>
        </View>
        <Text style={styles.mediaCounter} accessibilityLiveRegion="polite">{index + 1} / {count}</Text>
      </>}
    </View>
  );
}

export default function PropertyWorkspaceScreen({ publicView = false }: { publicView?: boolean }) {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { user, authState, hydrated } = useAuthStore();
  const [property, setProperty] = useState<Listing | null>(null);
  const [docCursor, setDocCursor] = useState<string>();
  const [staffCursor, setStaffCursor] = useState<string>();
  const [docs, setDocs] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [gps, setGps] = useState<{ lat: number; lng: number }>();
  const [revision, setRevision] = useState(0);
  const [expandedEvent, setExpandedEvent] = useState<string>();
  const [showOffer, setShowOffer] = useState(false);
  const [offerResult, setOfferResult] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!publicView && authState !== "AUTHENTICATED") return;
    setLoading(true); setError(""); setProperty(null); setDocs([]); setChecklist({}); setGps(undefined); setNotes(""); setSignature("");
    (async () => {
      try {
        const result = await workflowService.detail(id, publicView);
        if (!active) return;
        setProperty(result);
        if (publicView) void hydrateUserAffinity().then(() => { if (active) trackPropertyInteraction(result as unknown as Property, "view"); });
        if (!publicView) {
          const documents = await documentService.getDocuments(id);
          if (active) { setDocs(documents); setDocCursor((documents as any).nextCursor); }
          if (user?.role === "admin") { const response = await api.get("/admin/staff"); if (active) { setStaff(response.data); setStaffCursor(response.data.nextCursor); } }
        } else if (authState === "AUTHENTICATED" && user) {
          const saved = await userService.isWishlisted(id);
          if (active) setIsSaved(saved);
        }
      } catch (cause: any) { if (active) setError(cause.response?.data?.message || "Could not load property"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  // Account changes and successful mutations must invalidate the loaded private record.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, publicView, authState, user?.id, user?.role, revision]));
  if (!publicView && !hydrated) return <ActivityIndicator />;
  if (!publicView && (!user || authState !== "AUTHENTICATED")) return <Redirect href="/login" />;
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); setRevision(value => value + 1); }
    catch (cause: any) { setError(cause.response?.data?.message || cause.message || "Action failed"); }
    finally { setBusy(false); }
  };
  const captureGps = async () => {
    setBusy(true); setError("");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is required for a site check-in");
      const result = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Location took too long. Check GPS and try again.")), 15000); }),
      ]);
      setGps({ lat: result.coords.latitude, lng: result.coords.longitude });
    } catch (cause: any) { setError(cause.message || "Unable to capture location"); }
    finally { clearTimeout(timeout); setBusy(false); }
  };
  const canReview = !publicView && property && ((user?.role === "advisor" && property.status === "pending" && actorId(property.assignedAdvisorId) === user.id) || (user?.role === "verifier" && property.status === "pending" && actorId(property.assignedVerifierId) === user.id));
  const keys = Object.keys(checks).filter(key => key !== "advisorReport");
  if (publicView && !loading && property) return <PublicPropertyDetails property={property} isSaved={isSaved} onToggleSave={async () => {
    if (!user || authState !== "AUTHENTICATED") return router.push("/login");
    const previous = isSaved;
    setIsSaved(!previous);
    try {
      const res = await userService.toggleWishlist(id);
      setIsSaved(res.isWishlisted);
      if (res.isWishlisted) { await hydrateUserAffinity(); trackPropertyInteraction(property as unknown as Property, "save"); }
    } catch { setIsSaved(previous); }
  }} canOffer={!user || user.role === "user"} onOffer={() => {
    if (!user || authState !== "AUTHENTICATED") router.push("/login");
    else if (!(user.isVerifiedIdentity || user.demoKycComplete)) router.push("/kyc");
    else setShowOffer(true);
  }}>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {showOffer && <Modal transparent animationType="slide" onRequestClose={() => setShowOffer(false)}><View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#10233470" }}><ScrollView style={{ maxHeight: "85%", width: "100%", maxWidth: 650, alignSelf: "center", backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}><OfferSheet propertyId={id} askingPrice={property.price} onCancel={() => setShowOffer(false)} onSubmit={async amount => {
      setError("");
      await chatApi.submitInquiry({ propertyId: id, message: "I would like to make an offer.", offerAmount: amount }); setShowOffer(false); setOfferResult("Your offer was submitted.");
    }} /></ScrollView></View></Modal>}
    {!!offerResult && <Text style={ui.text}>{offerResult}</Text>}
  </PublicPropertyDetails>;
  const refresh = () => setRevision(value => value + 1);
  const workspaceHeader = !publicView ? (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      {focused && <StatusBar style="light" />}
      <AccountHeaderBackdrop top={insets.top + 4} />
      <View style={styles.headerInner}>
        <View style={styles.toolbar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace(user?.role === "advisor" ? "/advisor/properties" : dashboardRoutes[user?.role ?? "user"])}>
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <BrandLockup style={styles.brand} />
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh verification" disabled={busy || loading} onPress={refresh} style={styles.headerButton}>
            <MaterialIcons name="refresh" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={accountHeaderStyle.titleGroup}>
          <Text accessibilityRole="header" style={[styles.heading, accountHeaderStyle.heading]}>Verification workspace</Text>
          <Text style={styles.headerHint}>Review property details, records and inspection history.</Text>
        </View>
      </View>
    </View>
  ) : undefined;
  return <WorkflowScreen title={publicView ? "Property details" : "Verification workspace"} header={workspaceHeader}>
    {publicView && <Action title="Refresh" secondary onPress={refresh} disabled={busy} />}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {loading && <ActivityIndicator color={AppTheme.colors.primary} />}
    {!loading && property && <>
      <View style={styles.card}>
        <View style={styles.summaryTop}>
          <Text accessibilityRole="header" style={styles.propertyTitle}>{property.title || `${property.type} in ${property.location.district}`}</Text>
          <View style={[styles.statusBadge, property.status === "verified" && styles.publishedBadge]}>
            <Text style={styles.statusText}>{property.status === "verified" ? "Verified · Published" : statusLabels[property.status] || property.status}</Text>
          </View>
        </View>
        <Text style={styles.price}>₹{property.price.toLocaleString("en-IN")}</Text>
        <View style={styles.location}>
          <MaterialIcons name="place" size={17} color="#536174" />
          <Text style={[ui.muted, styles.locationText]}>
            {[property.streetAddress, property.location.district, property.location.state].filter(Boolean).join(", ")}
          </Text>
        </View>
        <Metadata fields={[
          ["Property type", readableLabel(property.type)],
          ["Price terms", property.negotiable ? "Negotiable" : "Fixed price"],
          ["Total area", Number.isFinite(property.totalArea) ? `${property.totalArea.toLocaleString("en-IN")} sq.ft` : undefined],
          ["Sellable area", Number.isFinite(property.sellableArea) ? `${property.sellableArea.toLocaleString("en-IN")} sq.ft` : undefined],
        ]} />
        {!!property.description && <>
          <Text style={styles.detailHeading}>Description</Text>
          <Text style={ui.text}>{property.description}</Text>
        </>}
        <Text style={styles.detailHeading}>Access and disclosures</Text>
        <Metadata fields={[
          ["Boundary", property.boundary || undefined],
          ["Road width", property.roadWidth],
          ["Loan", property.disclosures?.hasLoan === undefined ? undefined : property.disclosures.hasLoan ? "Yes" : "No"],
          ["Dispute", property.disclosures?.hasDispute === undefined ? undefined : property.disclosures.hasDispute ? "Yes" : "No"],
          ["Possession", property.disclosures?.possessionStatus || undefined],
        ]} />
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={ui.heading}>Location and boundary</Text>
        <Text selectable style={ui.muted}>GPS: {property.location.lat}, {property.location.lng}</Text>
        <MiniMapPreview fixedPreview={!publicView} property={{ id: property._id, type: property.type, status: property.status, price: property.price, location: property.location, parcelPoints: property.parcelPoints }} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open property location in Google Maps"
          style={({ pressed }) => [styles.mapsButton, pressed && { opacity: 0.85 }]}
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${property.location.lat},${property.location.lng}`).catch(() => setError("Could not open maps"))}
        >
          <MaterialIcons name="place" size={20} color="#14263E" />
          <Text style={styles.mapsButtonText}>Open location in Maps</Text>
          <MaterialIcons name="open-in-new" size={17} color="#14263E" />
        </Pressable>
        {!!property.parcelPoints?.length && <>
          <Text style={styles.detailHeading}>Recorded boundary</Text>
          <Metadata fields={property.parcelPoints.map((point, index) => [`Point ${index + 1}`, `${point.lat}, ${point.lng}`])} />
        </>}
      </View>
      {Boolean(property.media?.photos?.length || property.media?.videos?.length) && <View style={styles.card}>
        <Text accessibilityRole="header" style={ui.heading}>Listing media</Text>
        <ListingPhotoSlider key={property._id} photos={property.media?.photos ?? []} />
        {property.media?.videos?.map((url, index) => <Action key={`video-${index}`} title={`View property video ${index + 1}`} secondary onPress={() => Linking.openURL(url).catch(() => setError("Could not open video"))} />)}
      </View>}
      {publicView && <View style={styles.card}>
        {publicView && <Text style={ui.muted}>Approved by the assigned Advisor or Verifier. This is not a guarantee of legal title.</Text>}
        {publicView && (!user || user.role === "user") && <Action title="Make an offer" onPress={() => {
          if (!user || authState !== "AUTHENTICATED") router.push("/login");
          else if (!(user.isVerifiedIdentity || user.demoKycComplete)) router.push("/kyc");
          else setShowOffer(true);
        }} />}
        {publicView && showOffer && <OfferSheet propertyId={id} askingPrice={property.price} onCancel={() => setShowOffer(false)} onSubmit={async amount => {
          setError("");
          await chatApi.submitInquiry({ propertyId: id, message: "I would like to make an offer.", offerAmount: amount }); setShowOffer(false); setOfferResult("Your offer was submitted.");
        }} />}
        {!!offerResult && <Text style={ui.text}>{offerResult}</Text>}
      </View>}
      {!publicView && <>
        <View style={styles.card}>
          <Text style={ui.heading}>Seller and property records</Text>
          <Metadata fields={[
            ["Seller", typeof property.ownerId === "object" ? property.ownerId?.name : undefined],
            ["Seller phone", typeof property.ownerId === "object" ? property.ownerId?.mobile : undefined],
            ["Block", property.location.block || undefined],
            ["Mauza", property.location.mauza || undefined],
            ["Police station", property.location.policeStation || undefined],
            ["Khata", property.khata || undefined],
            ["Khesra", property.khesra || undefined],
            ["Holding", property.holdingNumber || undefined],
            ["Advisor", typeof property.assignedAdvisorId === "object" ? property.assignedAdvisorId?.name : property.assignedAdvisorId || "Awaiting assignment"],
            ["Verifier", typeof property.assignedVerifierId === "object" ? property.assignedVerifierId?.name : property.assignedVerifierId || "Awaiting assignment"],
          ]} />
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={ui.heading}>Documents</Text>
          {docs.length === 0 && <Text style={ui.muted}>No documents uploaded.</Text>}
          {user?.role === "admin" && staffCursor && <Action title="Load more staff choices" secondary onPress={async () => { try { const response = await api.get("/admin/staff", { params: { cursor: staffCursor } }); setStaff(old => [...old, ...response.data]); setStaffCursor(response.data.nextCursor); } catch { setError("Could not load staff"); } }} />}
          {docCursor && <Action title="More documents" secondary onPress={async () => { try { const rows = await documentService.getDocuments(id, docCursor); setDocs(old => [...old, ...rows]); setDocCursor((rows as any).nextCursor); } catch { setError("Could not load documents"); } }} />}
          {docs.map(doc => <Action key={doc._id || doc.id} title={`${doc.type}: ${doc.fileName}`} secondary onPress={async () => { try { const url = await documentService.getDownloadLink(doc._id || doc.id); await Linking.openURL(url); } catch { setError("Could not open document. Please try again."); } }} />)}
        </View>
        {property.rejectionReason && <Text style={ui.error}>Review feedback: {property.rejectionReason}</Text>}
        {user?.role === "user" && ["draft", "correction_required"].includes(property.status) && <Action title="Edit and submit for review" onPress={() => router.push({ pathname: "/listing/create", params: { id } })} />}
        {([
          ["advisor", property.advisorReview],
          ["verifier", property.verifierReview],
        ] as const).map(([role, report]) => report ? <View key={role} style={styles.card}>
          <View style={styles.summaryTop}>
            <Text accessibilityRole="header" style={styles.detailHeading}>{role === "advisor" ? "Advisor" : "Verifier"} report</Text>
            {!!report.decision && <View style={[styles.statusBadge, report.decision === "approve" && styles.publishedBadge]}>
              <Text style={styles.statusText}>{report.decision === "approve" ? "Approved" : report.decision === "reject" ? "Rejected" : report.decision === "correction" ? "Corrections requested" : readableLabel(report.decision)}</Text>
            </View>}
          </View>
          <Metadata fields={[["Signed by", report.signature?.trim() || undefined], ["Submitted", recordedDate(report.submittedAt)]]} />
          {!!report.notes && <Text style={ui.text}>{report.notes}</Text>}
          {Object.entries(report.checklist || {}).map(([key, value]) => <Text key={key} style={ui.text}>{value ? "✓" : "—"} {checks[key] || readableLabel(key)}</Text>)}
          {report.gpsCheckIn && <Metadata fields={[
            ["Site check-in", `${report.gpsCheckIn.lat}, ${report.gpsCheckIn.lng}`],
            ["Check-in time", recordedDate(report.gpsCheckIn.timestamp)],
          ]} />}
        </View> : null)}
        {canReview && <View style={styles.card}>
          <Text style={ui.heading}>{user?.role === "advisor" ? "Advisor inspection" : "Verifier inspection"}</Text>
          {keys.map(key => <Check key={key} label={checks[key]} checked={!!checklist[key]} onPress={() => setChecklist(previous => ({ ...previous, [key]: !previous[key] }))} />)}
          {["advisor", "verifier"].includes(user?.role || "") && <><Action title="Capture site GPS check-in (if visited)" secondary disabled={busy} onPress={captureGps} />{gps && <Text style={ui.text}>{gps.lat}, {gps.lng}</Text>}</>}
          <Field label="Report notes / correction or rejection reason" value={notes} onChangeText={setNotes} multiline />
          <Field label="Your full name as report signature" value={signature} onChangeText={setSignature} />
          {(() => {
            const missing: string[] = [];
            if (keys.some(key => !checklist[key])) missing.push("tick all checklist items");
            if (notes.trim().length < 5) missing.push("add at least 5 characters of report notes");
            if (signature.trim().length < 2) missing.push("enter your full name as signature");
            if (missing.length > 0) return <Text style={ui.muted}>To approve: {missing.join(" · ")}.</Text>;
            return <Text style={ui.muted}>All set — pick an action below.</Text>;
          })()}
          <View style={ui.row}>{(["approve", "correction", "reject"] as const).map(decision => <Action key={decision} title={decision === "approve" ? "Approve and publish" : decision === "correction" ? "Request corrections" : "Reject"} disabled={busy || signature.trim().length < 2 || notes.trim().length < 5 || (decision === "approve" && keys.some(key => !checklist[key]))} secondary={decision !== "approve"} onPress={() => run(() => workflowService.review(id, { decision, notes, signature, checklist, gpsCheckIn: gps }))} />)}</View>
        </View>}
        {user?.role === "admin" && ["pending", "advisor_verified", "verified", "correction_required"].includes(property.status) && <View style={styles.card}>
          <Text style={ui.heading}>Assign / reassign reviewer</Text>
          {!staff.some(person => person.isActive !== false && ["advisor", "verifier"].includes(person.role)) && <Text style={ui.muted}>Create an account for this reviewer role first.</Text>}
          {staff.filter(person => ["advisor", "verifier"].includes(person.role)).map(person => <Action key={person.id} title={`${person.name} (${person.mobile})`} secondary disabled={busy} onPress={() => run(() => workflowService.assign(id, person.id))} />)}
          <Action title="Manage staff accounts" secondary onPress={() => router.push("/admin/staff")} />
        </View>}
        <View style={styles.card}>
          <Text accessibilityRole="header" style={ui.heading}>Verification history</Text>
          {!property.verificationHistory?.length && <Text style={ui.muted}>No recorded review events yet.</Text>}
          {property.verificationHistory?.map((event, index) => {
            const eventKey = `${property._id}-${event.at}-${event.action}-${index}`;
            const expanded = expandedEvent === eventKey;
            const action = event.action === "approve" ? "Approved" : event.action === "reject" ? "Rejected" : readableLabel(event.action);
            const status = historyStatus(event.toStatus);
            return (
              <View key={eventKey} style={[styles.historyEntry, expanded && styles.historyEntryExpanded]}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
                  onPress={() => setExpandedEvent(expanded ? undefined : eventKey)}
                  style={styles.historyButton}>
                  <View style={styles.historyIcon}><MaterialIcons name="history" size={20} color="#14263E" /></View>
                  <View style={styles.historyCopy}>
                    <Text style={styles.detailHeading}>{action}</Text>
                    <Text style={styles.historyCaption}>{readableLabel(event.role)} · {recordedDate(event.at) ?? "Time not recorded"}</Text>
                    {!!status && <Text style={styles.historyStatus}>{status}</Text>}
                  </View>
                  <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={21} color="#536174" />
                </Pressable>
                {expanded && <View style={styles.historyDetails}>
                  <View style={styles.historyTransition}>
                    <Text style={styles.historyDetailLabel}>Status update</Text>
                    {event.fromStatus && event.fromStatus !== event.toStatus ? (
                      <>
                        <Text style={styles.historyDetailValue}>From {historyStatus(event.fromStatus)}</Text>
                        <Text style={styles.historyStatus}>To {status || "Not recorded"}</Text>
                      </>
                    ) : <Text style={styles.historyStatus}>{status || "Not recorded"}</Text>}
                  </View>
                  {!!event.report?.signature && <View style={styles.historyDetailRow}>
                    <Text style={styles.historyDetailLabel}>Signed by</Text>
                    <Text selectable style={styles.historyDetailValue}>{event.report.signature}</Text>
                  </View>}
                  {!!event.report?.notes && <View style={styles.historyDetailRow}>
                    <Text style={styles.historyDetailLabel}>Report notes</Text>
                    <Text selectable style={styles.historyDetailValue}>{event.report.notes}</Text>
                  </View>}
                  {[
                    ["Actor ID", event.actorId],
                    ["Assigned staff ID", event.staffId],
                  ].map(([label, value]) => value ? (
                    <View key={label} style={styles.historyIdRow}>
                      <Text style={styles.historyDetailLabel}>{label}</Text>
                      <Text selectable style={styles.historyCaption}>{value}</Text>
                    </View>
                  ) : null)}
                </View>}
              </View>
            );
          }).reverse()}
        </View>
      </>}
    </>}
  </WorkflowScreen>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#14263E", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden" },
  headerInner: { width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#244268", alignItems: "center", justifyContent: "center" },
  brand: { flex: 1 },
  heading: { color: "#fff", fontFamily: "Fraunces" },
  headerHint: { color: "#E7EDF5", fontFamily: "Manrope", fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DEDCD5", padding: 16, gap: 11 },
  summaryTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  propertyTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 110, color: "#14263E", fontFamily: "Fraunces", fontSize: 23 },
  statusBadge: { marginStart: "auto", maxWidth: "100%", backgroundColor: "#FFF1C0", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  publishedBadge: { backgroundColor: "#E1F2E7" },
  statusText: { color: "#14263E", fontFamily: "ManropeBold", fontSize: 12 },
  price: { color: "#14263E", fontFamily: "ManropeExtraBold", fontSize: 20 },
  location: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  locationText: { flexShrink: 1 },
  mapsButton: {
    minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: "#FFF1C0", borderRadius: 13, paddingHorizontal: 13, paddingVertical: 9,
  },
  mapsButtonText: { flex: 1, color: "#14263E", fontFamily: "ManropeExtraBold", fontSize: 14 },
  metadata: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metadataItem: { flexGrow: 1, flexBasis: 126, minWidth: 0, padding: 10, gap: 3, backgroundColor: "#F7F4EC", borderRadius: 11 },
  metadataLabel: { color: "#536174", fontFamily: "ManropeBold", fontSize: 12 },
  metadataValue: { color: "#14263E", fontFamily: "Manrope", fontSize: 14, lineHeight: 20 },
  detailHeading: { color: "#14263E", fontFamily: "ManropeExtraBold", fontSize: 15, flexShrink: 1 },
  mediaFrame: { borderRadius: 12, overflow: "hidden", backgroundColor: "#F7F4EC" },
  mediaImage: { width: "100%", height: 220 },
  mediaControls: { position: "absolute", top: 0, bottom: 0, left: 3, right: 3, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mediaArrowTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  mediaArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#14263E", alignItems: "center", justifyContent: "center" },
  mediaCounter: {
    position: "absolute", bottom: 9, alignSelf: "center", borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 3, backgroundColor: "#14263E", color: "#fff",
    fontFamily: "ManropeBold", fontSize: 12,
  },
  historyEntry: { borderWidth: 1, borderColor: "#E5E0D4", borderRadius: 14, overflow: "hidden" },
  historyEntryExpanded: { borderColor: "#DFC052" },
  historyButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, padding: 11 },
  historyIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1C0" },
  historyCopy: { flex: 1, minWidth: 0, gap: 3 },
  historyCaption: { color: "#536174", fontFamily: "Manrope", fontSize: 12, lineHeight: 17 },
  historyStatus: { color: "#14263E", fontFamily: "ManropeBold", fontSize: 12, lineHeight: 17 },
  historyDetails: { padding: 13, gap: 11, borderTopWidth: 1, borderTopColor: "#E5E0D4", backgroundColor: "#FFFCF6" },
  historyTransition: { gap: 5, backgroundColor: "#F4EFE2", borderRadius: 10, padding: 10 },
  historyDetailRow: { gap: 4 },
  historyIdRow: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E0D4" },
  historyDetailLabel: { color: "#536174", fontFamily: "ManropeBold", fontSize: 13, lineHeight: 18 },
  historyDetailValue: { color: "#14263E", fontFamily: "Manrope", fontSize: 14, lineHeight: 21 },
});
