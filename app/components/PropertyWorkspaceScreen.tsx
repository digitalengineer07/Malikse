import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, Linking, Modal, ScrollView, Text, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { Action, Check, Field, ui, WorkflowScreen } from "./WorkflowUI";
import { useAuthStore } from "../src/store/authStore";
import { actorId, Listing, statusLabels, workflowService } from "../src/services/workflowService";
import { documentService } from "../src/services/documentService";
import api from "../src/services/authService";
import MiniMapPreview from "./MiniMapPreview";
import PublicPropertyDetails from "./PublicPropertyDetails";
import OfferSheet from "./OfferSheet";
import { inquiryService } from "../src/services/inquiryService";
import { userService } from "../src/services/userService";
import { AppTheme } from "../constants/theme";

const checks: Record<string, string> = { ownership: "Ownership information reviewed", location: "Property location reviewed", boundaries: "Boundaries and access reviewed", area: "Property area reviewed", disclosures: "Loans, disputes and possession reviewed", documentsReviewed: "Available documents reviewed (uploads are optional)", advisorReport: "Advisor report and inspection reviewed" };

export default function PropertyWorkspaceScreen({ publicView = false }: { publicView?: boolean }) {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
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
  const canReview = !publicView && property && ((user?.role === "advisor" && property.status === "pending" && actorId(property.assignedAdvisorId) === user.id) || (user?.role === "verifier" && property.status === "advisor_verified" && actorId(property.assignedVerifierId) === user.id));
  const keys = Object.keys(checks).filter(key => user?.role === "verifier" || key !== "advisorReport");
  if (publicView && !loading && property) return <PublicPropertyDetails property={property} isSaved={isSaved} onToggleSave={async () => {
    if (!user || authState !== "AUTHENTICATED") return router.push("/login");
    const previous = isSaved;
    setIsSaved(!previous);
    try {
      const res = await userService.toggleWishlist(id);
      setIsSaved(res.isWishlisted);
    } catch { setIsSaved(previous); }
  }} canOffer={!user || user.role === "user"} onOffer={() => {
    if (!user || authState !== "AUTHENTICATED") router.push("/login");
    else if (!user.demoKycComplete) router.push("/kyc");
    else setShowOffer(true);
  }}>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {showOffer && <Modal transparent animationType="slide" onRequestClose={() => setShowOffer(false)}><View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#10233470" }}><ScrollView style={{ maxHeight: "85%", width: "100%", maxWidth: 650, alignSelf: "center", backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}><OfferSheet propertyId={id} askingPrice={property.price} onCancel={() => setShowOffer(false)} onSubmit={async amount => {
      setError("");
      await inquiryService.submitInquiry({ propertyId: id, message: "I would like to make an offer.", offerAmount: amount }); setShowOffer(false); setOfferResult("Your offer was submitted.");
    }} /></ScrollView></View></Modal>}
    {!!offerResult && <Text style={ui.text}>{offerResult}</Text>}
  </PublicPropertyDetails>;
  return <WorkflowScreen title={publicView ? "Property details" : "Verification workspace"}>
    <Action title="Refresh" secondary onPress={() => setRevision(value => value + 1)} disabled={busy} />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {loading && <ActivityIndicator color={AppTheme.colors.primary} />}
    {!loading && property && <>
      <View style={ui.card}>
        <Text style={ui.heading}>{property.title || `${property.type} in ${property.location.district}`}</Text>
        <Text style={ui.text}>{statusLabels[property.status]}</Text>
        <Text style={ui.heading}>₹{property.price.toLocaleString("en-IN")}</Text>
        <Text style={ui.text}>{property.type} · {property.location.district}, {property.location.state}</Text>
        <Text style={ui.text}>Total: {property.totalArea} sq.ft · Sellable: {property.sellableArea} sq.ft · {property.negotiable ? "Negotiable" : "Fixed price"}</Text>
        {!!property.description && <Text style={ui.text}>{property.description}</Text>}
        <Text style={ui.text}>Boundary: {property.boundary || "Not provided"} · Road width: {property.roadWidth ?? "Not provided"}</Text>
        <Text style={ui.text}>Loan: {property.disclosures?.hasLoan ? "Yes" : "No"} · Dispute: {property.disclosures?.hasDispute ? "Yes" : "No"} · Possession: {property.disclosures?.possessionStatus || "Not provided"}</Text>
        <Text style={ui.muted}>GPS: {property.location.lat}, {property.location.lng}</Text>
        <MiniMapPreview property={{ id: property._id, type: property.type, status: property.status, price: property.price, location: property.location, parcelPoints: property.parcelPoints }} />
        {!!property.parcelPoints?.length && <Text style={ui.muted}>Recorded boundary: {property.parcelPoints.map(point => `${point.lat}, ${point.lng}`).join(" → ")}</Text>}
        <Action title="Open location in maps" secondary onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${property.location.lat},${property.location.lng}`).catch(() => setError("Could not open maps"))} />
        {property.media?.photos?.map((url, index) => <Image key={index} source={{ uri: url }} style={{ width: "100%", height: 220 }} />)}
        {property.media?.videos?.map((url, index) => <Action key={index} title={`View property video ${index + 1}`} secondary onPress={() => Linking.openURL(url).catch(() => setError("Could not open video"))} />)}
        {publicView && <Text style={ui.muted}>Approved by an Advisor and a Verifier. This is not a guarantee of legal title. KYC is currently a demo.</Text>}
        {publicView && (!user || user.role === "user") && <Action title="Make an offer" onPress={() => {
          if (!user || authState !== "AUTHENTICATED") router.push("/login");
          else if (!user.demoKycComplete) router.push("/kyc");
          else setShowOffer(true);
        }} />}
        {publicView && showOffer && <OfferSheet propertyId={id} askingPrice={property.price} onCancel={() => setShowOffer(false)} onSubmit={async amount => {
          setError("");
          await inquiryService.submitInquiry({ propertyId: id, message: "I would like to make an offer.", offerAmount: amount }); setShowOffer(false); setOfferResult("Your offer was submitted.");
        }} />}
        {!!offerResult && <Text style={ui.text}>{offerResult}</Text>}
      </View>
      {!publicView && <>
        <View style={ui.card}>
          <Text style={ui.heading}>Seller and property records</Text>
          {typeof property.ownerId === "object" && <Text style={ui.text}>{property.ownerId.name} · {property.ownerId.mobile}</Text>}
          <Text style={ui.text}>Block: {property.location.block || "—"} · Mauza: {property.location.mauza || "—"} · Police station: {property.location.policeStation || "—"}</Text>
          <Text style={ui.text}>Khata: {property.khata || "—"} · Khesra: {property.khesra || "—"} · Holding: {property.holdingNumber || "—"}</Text>
          <Text style={ui.text}>Advisor: {property.assignedAdvisorId && typeof property.assignedAdvisorId === "object" ? property.assignedAdvisorId.name : property.assignedAdvisorId || "Awaiting assignment"}</Text>
          <Text style={ui.text}>Verifier: {property.assignedVerifierId && typeof property.assignedVerifierId === "object" ? property.assignedVerifierId.name : property.assignedVerifierId || "Awaiting assignment"}</Text>
          <Text style={ui.heading}>Documents (optional)</Text>
          {docs.length === 0 && <Text style={ui.muted}>No documents uploaded.</Text>}
          {user?.role === "admin" && staffCursor && <Action title="Load more staff choices" secondary onPress={async () => { try { const response = await api.get("/admin/staff", { params: { cursor: staffCursor } }); setStaff(old => [...old, ...response.data]); setStaffCursor(response.data.nextCursor); } catch { setError("Could not load staff"); } }} />}
          {docCursor && <Action title="More documents" secondary onPress={async () => { try { const rows = await documentService.getDocuments(id, docCursor); setDocs(old => [...old, ...rows]); setDocCursor((rows as any).nextCursor); } catch { setError("Could not load documents"); } }} />}
          {docs.map(doc => <Action key={doc._id || doc.id} title={`${doc.type}: ${doc.fileName}`} secondary onPress={() => Linking.openURL(doc.fileUrl).catch(() => setError("Could not open document. Refresh to get a new link."))} />)}
        </View>
        {property.rejectionReason && <Text style={ui.error}>Review feedback: {property.rejectionReason}</Text>}
        {user?.role === "user" && ["draft", "correction_required"].includes(property.status) && <Action title="Edit and submit for review" onPress={() => router.push({ pathname: "/listing/create", params: { id } })} />}
        {[property.advisorReview, property.verifierReview].filter(Boolean).map(report => <View key={report!.role} style={ui.card}>
          <Text style={ui.heading}>{report!.role === "advisor" ? "Advisor" : "Verifier"} report · {report!.decision}</Text>
          <Text style={ui.text}>{report!.notes}</Text>
          <Text style={ui.muted}>Signed: {report!.signature} · {new Date(report!.submittedAt).toLocaleString()}</Text>
          {Object.entries(report!.checklist).map(([key, value]) => <Text key={key} style={ui.text}>{value ? "✓" : "—"} {checks[key] || key}</Text>)}
          {report!.gpsCheckIn && <Text style={ui.text}>Site check-in: {report!.gpsCheckIn.lat}, {report!.gpsCheckIn.lng} · {new Date(report!.gpsCheckIn.timestamp).toLocaleString()}</Text>}
        </View>)}
        {canReview && <View style={ui.card}>
          <Text style={ui.heading}>{user?.role === "advisor" ? "Advisor inspection" : "Final Verifier review"}</Text>
          {keys.map(key => <Check key={key} label={checks[key]} checked={!!checklist[key]} onPress={() => setChecklist(previous => ({ ...previous, [key]: !previous[key] }))} />)}
          {user?.role === "advisor" && <><Action title="Capture site GPS check-in (if visited)" secondary disabled={busy} onPress={captureGps} />{gps && <Text style={ui.text}>{gps.lat}, {gps.lng}</Text>}</>}
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
          <View style={ui.row}>{(["approve", "correction", "reject"] as const).map(decision => <Action key={decision} title={decision === "approve" ? user?.role === "advisor" ? "Approve → Verifier" : "Approve and publish" : decision === "correction" ? "Request corrections" : "Reject"} disabled={busy || signature.trim().length < 2 || notes.trim().length < 5 || (decision === "approve" && keys.some(key => !checklist[key]))} secondary={decision !== "approve"} onPress={() => run(() => workflowService.review(id, { decision, notes, signature, checklist, gpsCheckIn: gps }))} />)}</View>
        </View>}
        {user?.role === "admin" && ["pending", "advisor_verified"].includes(property.status) && <View style={ui.card}>
          <Text style={ui.heading}>Assign / reassign reviewer</Text>
          {!staff.some(person => person.isActive !== false && person.role === (property.status === "pending" ? "advisor" : "verifier")) && <Text style={ui.muted}>Create an account for this reviewer role first.</Text>}
          {staff.filter(person => person.role === (property.status === "pending" ? "advisor" : "verifier")).map(person => <Action key={person.id} title={`${person.name} (${person.mobile})`} secondary disabled={busy} onPress={() => run(() => workflowService.assign(id, person.id))} />)}
          <Action title="Manage staff accounts" secondary onPress={() => router.push("/admin/staff")} />
        </View>}
        <View style={ui.card}>
          <Text style={ui.heading}>Verification history</Text>
          {!property.verificationHistory?.length && <Text style={ui.muted}>No recorded review events yet.</Text>}
          {property.verificationHistory?.map((event, index) => <View key={index} style={{ gap: 4 }}>
            <Text style={ui.text}>{event.action} · {event.role} · {new Date(event.at).toLocaleString()}</Text>
            <Text style={ui.muted}>{statusLabels[event.fromStatus]} → {statusLabels[event.toStatus]}</Text>
            <Text selectable style={ui.muted}>Actor: {event.actorId}{event.staffId ? ` · Assigned: ${event.staffId}` : ""}</Text>
            {event.report && <Text style={ui.text}>{event.report.signature}: {event.report.notes}</Text>}
          </View>)}
        </View>
      </>}
    </>}
  </WorkflowScreen>;
}
