import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { Action, Check, Field, ui, WorkflowScreen } from "./WorkflowUI";
import MapParcelPicker, { LatLngPoint } from "./MapParcelPicker";
import { useAuthStore } from "../src/store/authStore";
import { propertyService } from "../src/services/propertyService";
import { documentService } from "../src/services/documentService";
import { workflowService } from "../src/services/workflowService";
import { dashboardRoutes } from "../src/utils/accountRoutes";

const initialForm = { title: "", description: "", type: "land", price: "", totalArea: "", sellableArea: "", state: "Bihar", district: "", pincode: "", block: "", mauza: "", policeStation: "", khata: "", khesra: "", holdingNumber: "", boundary: "", roadWidth: "", lat: "", lng: "", photos: "", videos: "", possessionStatus: "With Owner" };
const docTypes = ["Registry", "Mutation", "LPC/Jamabandi", "Map", "Rent Receipt", "Owner ID Proof"];
type Picked = { asset: DocumentPicker.DocumentPickerAsset; type: string };

export default function ListingEditorScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const initialId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
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
  const submitting = useRef(false);
  const change = (key: keyof typeof initialForm, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const onParcelChange = useCallback((next: LatLngPoint[]) => {
    setPoints(next);
    if (next.length) setForm(previous => ({ ...previous, lat: String(next[0].lat), lng: String(next[0].lng) }));
  }, []);
  useEffect(() => {
    let active = true;
    if (!initialId || authState !== "AUTHENTICATED") return;
    (async () => {
      try {
        const property = await workflowService.detail(initialId);
        if (!["draft", "correction_required"].includes(property.status)) throw new Error("Only drafts and correction requests can be edited.");
        const documents = await documentService.getDocuments(initialId);
        if (!active) return;
        const next = { ...initialForm };
        for (const key of ["title", "description", "type", "price", "totalArea", "sellableArea", "khata", "khesra", "holdingNumber", "boundary", "roadWidth"] as const) next[key] = String(property[key] ?? "");
        for (const key of ["state", "district", "pincode", "block", "mauza", "policeStation", "lat", "lng"] as const) next[key] = String(property.location[key] ?? "");
        next.photos = property.media?.photos?.join("\n") || "";
        next.videos = property.media?.videos?.join("\n") || "";
        next.possessionStatus = property.disclosures?.possessionStatus || "With Owner";
        setForm(next); setPoints(property.parcelPoints || []); setExistingDocs(documents);
        setNegotiable(property.negotiable ?? true); setHasLoan(!!property.disclosures?.hasLoan); setHasDispute(!!property.disclosures?.hasDispute);
      } catch (cause: any) { if (active) { setError(cause.response?.data?.message || cause.message || "Could not load listing"); setLoadFailed(true); } }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [initialId, authState]);
  const validate = (location = false) => {
    if (form.pincode && !/^[1-9]\d{5}$/.test(form.pincode.trim())) return "Enter a valid six-digit pincode.";
    if (!form.state.trim() || !form.district.trim()) return "Enter state and district.";
    if (![form.price, form.totalArea, form.sellableArea].every(value => value.trim() && Number.isFinite(Number(value)) && Number(value) > 0)) return "Enter a positive price, total area and sellable area.";
    if (Number(form.sellableArea) > Number(form.totalArea)) return "Sellable area cannot exceed total area.";
    if (form.roadWidth && (!Number.isFinite(Number(form.roadWidth)) || Number(form.roadWidth) < 0)) return "Enter a valid road width.";
    if (location && (!form.lat.trim() || !form.lng.trim() || !Number.isFinite(Number(form.lat)) || Math.abs(Number(form.lat)) > 90 || !Number.isFinite(Number(form.lng)) || Math.abs(Number(form.lng)) > 180)) return "Mark the property on the map or enter valid GPS coordinates.";
    if (location && points.length > 0 && points.length < 3) return "Complete the boundary with at least three points, or clear it and use GPS coordinates.";
    const urls = [form.photos, form.videos].flatMap(value => value.split("\n").map(line => line.trim()).filter(Boolean));
    if (urls.some(url => !/^https?:\/\/\S+$/i.test(url))) return "Media links must be valid http or https URLs.";
    return "";
  };
  const next = () => {
    const message = validate(step === 2) || (step === 2 && !form.photos.trim() && !photoFiles.length ? "Add at least one property photo." : "");
    setError(message);
    if (!message) setStep(value => value + 1);
  };
  const pickPhotos = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "image/webp"], multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      if (result.assets.some(asset => (asset.size || 0) > 10 * 1024 * 1024)) { setError("Each photo must be under 10 MB."); return; }
      if (form.photos.split("\n").filter(Boolean).length + photoFiles.length + result.assets.length > 10) { setError("Choose up to 10 photos."); return; }
      setPhotoFiles(previous => [...previous, ...result.assets]); setError("");
    } catch { setError("Could not select photos. Please try again."); }
  };
  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (!result.canceled) setPicked(previous => [...previous, ...result.assets.map(asset => ({ asset, type: "Registry" }))]);
    } catch { setError("Could not select document. Please try again."); }
  };
  const submit = async () => {
    if (submitting.current) return;
    const message = validate(true) || (!form.photos.trim() && !photoFiles.length ? "Add at least one property photo." : "");
    if (message || !consent) { setError(message || "Accept the seller declaration."); return; }
    submitting.current = true; setBusy(true); setError("");
    try {
      const data = { title: form.title.trim() || `${form.type} in ${form.district}`, description: form.description.trim(), type: form.type, price: Number(form.price), totalArea: Number(form.totalArea), sellableArea: Number(form.sellableArea), khata: form.khata, khesra: form.khesra, holdingNumber: form.holdingNumber, boundary: form.boundary, roadWidth: form.roadWidth ? Number(form.roadWidth) : undefined, negotiable, location: { state: form.state.trim(), district: form.district.trim(), pincode: form.pincode.trim(), block: form.block, mauza: form.mauza, policeStation: form.policeStation, lat: Number(form.lat), lng: Number(form.lng) }, parcelPoints: points, disclosures: { hasLoan, hasDispute, possessionStatus: form.possessionStatus }, media: { photos: form.photos.split("\n").map(value => value.trim()).filter(Boolean), videos: form.videos.split("\n").map(value => value.trim()).filter(Boolean) } };
      let savedId = propertyId;
      if (savedId) await propertyService.updateProperty(savedId, data);
      else { const property = await propertyService.createProperty(data); savedId = property._id || property.id; setPropertyId(savedId); }
      for (const asset of photoFiles) {
        const file: any = Platform.OS === "web" ? asset.file || new File([await (await fetch(asset.uri)).blob()], asset.name, { type: asset.mimeType }) : { uri: asset.uri, name: asset.name, type: asset.mimeType || "image/jpeg" };
        const result = await propertyService.uploadPhoto(savedId!, file, asset.name);
        setForm(previous => ({ ...previous, photos: [previous.photos, result.url].filter(Boolean).join("\n") }));
        setPhotoFiles(previous => previous.filter(item => item !== asset));
      }
      for (const document of picked) {
        const { asset } = document;
        const file: any = Platform.OS === "web" ? asset.file || new File([await (await fetch(asset.uri)).blob()], asset.name, { type: asset.mimeType }) : { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream" };
        await documentService.uploadDocument(savedId!, document.type, file, asset.name);
        setPicked(previous => previous.filter(item => item !== document));
      }
      await workflowService.submit(savedId!);
      router.replace("/my-properties");
    } catch (cause: any) { setError(cause.response?.data?.message || "Could not finish submission. Any saved draft and uploaded documents are retained. Please retry."); }
    finally { submitting.current = false; setBusy(false); }
  };
  const locate = async () => {
    setBusy(true); setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Location permission denied. Enter coordinates manually.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm(previous => ({ ...previous, lat: String(position.coords.latitude), lng: String(position.coords.longitude) }));
    } catch (cause: any) { setError(cause.message || "Could not obtain location"); }
    finally { setBusy(false); }
  };
  if (!hydrated) return <ActivityIndicator />;
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;
  if (user.role !== "user") return <Redirect href={dashboardRoutes[user.role]} />;
  if (!user.demoKycComplete) return <Redirect href="/kyc" />;
  const field = (key: keyof typeof initialForm, label: string, numeric = false, multiline = false) => <Field key={key} label={label} value={form[key]} onChangeText={value => change(key, value)} numeric={numeric} multiline={multiline} />;
  return <WorkflowScreen title={initialId ? "Update property listing" : "List a property"}>
    <Text style={ui.text}>Step {step} of 3 · {step === 1 ? "Property details" : step === 2 ? "Location and boundaries" : "Documents and submission"}</Text>
    <Text style={ui.muted}>Submitted properties remain private until an Advisor and a Verifier approve them.</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {loading ? <ActivityIndicator /> : !loadFailed && <>
      {step === 1 && <View style={ui.card}>
        {field("title", "Property title (optional)")}
        <Text style={ui.label}>Property type</Text>
        <View style={ui.row}>{["land", "flat", "house", "shop", "office"].map(type => <Action key={type} title={type} secondary={form.type !== type} onPress={() => change("type", type)} />)}</View>
        {field("state", "State *")}{field("district", "District *")}{field("pincode", "Pincode (6 digits)")}{field("block", "Block / circle")}{field("mauza", "Mauza")}{field("policeStation", "Police station number")}
        {field("khata", "Khata number")}{field("khesra", "Khesra / plot number")}{field("holdingNumber", "Holding number")}
        {field("price", "Price (₹) *", true)}{field("totalArea", "Total area (sq.ft) *", true)}{field("sellableArea", "Sellable area (sq.ft) *", true)}
        <Check label="Price is negotiable" checked={negotiable} onPress={() => setNegotiable(!negotiable)} />
        {field("description", "Description", false, true)}
        <Check label="Property has an existing loan" checked={hasLoan} onPress={() => setHasLoan(!hasLoan)} />
        <Check label="Property has a dispute" checked={hasDispute} onPress={() => setHasDispute(!hasDispute)} />
        {field("possessionStatus", "Possession details")}
      </View>}
      {step === 2 && <View style={ui.card}>
        <Text style={ui.muted}>Draw the boundary on the map, or enter the property GPS coordinates. Use current location only while at the property.</Text>
        <View style={{ minHeight: Platform.OS === "web" ? 550 : 460 }}><MapParcelPicker initialPoints={points} onParcelChange={onParcelChange} areaSqFt={form.totalArea} /></View>
        <Action title="Use current GPS location" secondary disabled={busy} onPress={locate} />
        {field("lat", "Latitude *", true)}{field("lng", "Longitude *", true)}
        {field("boundary", "Boundary description", false, true)}{field("roadWidth", "Road width (feet)", true)}
        <Text style={ui.heading}>Property photos *</Text>
        <Text style={ui.muted}>Add 1–10 JPEG, PNG or WebP photos, up to 10 MB each. The first photo is your listing cover. Photos are publicly visible after upload; do not include private documents.</Text>
        <View style={ui.row}>{form.photos.split("\n").filter(Boolean).map((uri, index) => <View key={uri} style={{ gap: 6 }}><Image source={{ uri }} style={{ width: 130, height: 100, borderRadius: 14 }} /><Text style={ui.muted}>{index === 0 ? "Cover photo" : "Uploaded"}</Text><Action title="Remove photo" secondary disabled={busy} onPress={() => change("photos", form.photos.split("\n").filter(value => value !== uri).join("\n"))} /></View>)}
        {photoFiles.map((asset, index) => <View key={`${asset.uri}-${index}`} style={{ gap: 6 }}><Image source={{ uri: asset.uri }} style={{ width: 130, height: 100, borderRadius: 14 }} /><Text style={ui.muted}>{!form.photos && index === 0 ? "Cover photo" : "Ready to upload"}</Text><Action title="Remove photo" secondary disabled={busy} onPress={() => setPhotoFiles(previous => previous.filter((_, i) => i !== index))} /></View>)}</View>
        <Action title="Upload property photos" secondary disabled={busy} onPress={pickPhotos} />
        {field("videos", "Video / drone footage URLs (optional, one per line)", false, true)}
      </View>}
      {step === 3 && <View style={ui.card}>
        <Text style={ui.heading}>Ownership documents (optional)</Text>
        <Text style={ui.muted}>You can submit with no documents. Uploaded files are visible only to you, assigned reviewers and Admin. Maximum 20 MB per file.</Text>
        {existingDocs.map(doc => <Text key={doc._id || doc.id} style={ui.text}>Uploaded: {doc.fileName}</Text>)}
        {picked.map((document, index) => <View key={`${document.asset.uri}-${index}`} style={ui.card}>
          <Text style={ui.text}>{document.asset.name}</Text>
          <View style={ui.row}>{docTypes.map(type => <Action key={type} title={type} secondary={type !== document.type} disabled={busy} onPress={() => setPicked(previous => previous.map((item, i) => i === index ? { ...item, type } : item))} />)}</View>
          <Action title="Remove" secondary disabled={busy} onPress={() => setPicked(previous => previous.filter((_, i) => i !== index))} />
        </View>)}
        <Action title="Add documents" secondary disabled={busy} onPress={pick} />
        <Text style={ui.heading}>Review submission</Text>
        <Text style={ui.text}>{form.title || form.type} · {form.district}, {form.state} · ₹{Number(form.price).toLocaleString("en-IN")}</Text>
        <Text style={ui.text}>Sellable area: {form.sellableArea} sq.ft · GPS: {form.lat}, {form.lng}</Text>
        <Check label="I confirm the property information and disclosures are accurate and authorize review of this listing." checked={consent} onPress={() => setConsent(!consent)} />
        <Action title={busy ? "Submitting…" : "Submit for Advisor verification"} disabled={busy || !consent} onPress={submit} />
      </View>}
      <View style={ui.row}>{step > 1 && <Action title="Back" secondary disabled={busy} onPress={() => { setStep(value => value - 1); setError(""); }} />}{step < 3 && <Action title="Continue" disabled={busy} onPress={next} />}</View>
    </>}
    <Action title="Back to my listings" secondary disabled={busy} onPress={() => router.replace("/my-properties")} />
  </WorkflowScreen>;
}
