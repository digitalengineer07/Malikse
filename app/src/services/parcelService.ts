/**
 * Parcel service — localStorage-backed for testing
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PARCELS_KEY = "landroid_parcels";
const VAULT_KEY = "landroid_vault";
const INVITES_KEY = "landroid_invites";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Parcel {
  id?: string;
  name: string;
  centroid: { lat: number; lng: number };
  polygon?: any;
  boundary?: any;
  consultantId?: string;
  ownerEmail?: string;
  createdAt?: string;
  tree_analytics?: any;
  location_name?: string;
}

export type VaultDocumentType = "FMB Sketch" | "Patta" | "EC (Encumbrance Certificate)" | "GIS Snapshot";

export interface VaultDocument {
  id?: string;
  parcelId: string;
  fileName: string;
  fileType: VaultDocumentType;
  fileSize: number;
  downloadUrl: string;
  uploadedBy: string;
  createdAt?: string;
}

export type LandownerInvite = {
  id?: string;
  email: string;
  parcelId: string;
  status: string;
  invitedAt?: string;
};

// ── Storage helpers ────────────────────────────────────────────────────────

async function loadParcels(): Promise<Parcel[]> {
  try {
    const raw = await AsyncStorage.getItem(PARCELS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveParcels(parcels: Parcel[]): Promise<void> {
  await AsyncStorage.setItem(PARCELS_KEY, JSON.stringify(parcels));
}

async function loadVault(): Promise<VaultDocument[]> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveVault(docs: VaultDocument[]): Promise<void> {
  await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(docs));
}

async function loadInvites(): Promise<LandownerInvite[]> {
  try {
    const raw = await AsyncStorage.getItem(INVITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveInvites(invites: LandownerInvite[]): Promise<void> {
  await AsyncStorage.setItem(INVITES_KEY, JSON.stringify(invites));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Parcel CRUD ────────────────────────────────────────────────────────────

export async function saveParcelToFirestore(
  parcel: Omit<Parcel, "id">
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const parcels = await loadParcels();
    const id = generateId();
    const newParcel: Parcel = {
      ...parcel,
      id,
      createdAt: new Date().toISOString(),
    };
    parcels.push(newParcel);
    await saveParcels(parcels);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getParcelsByConsultant(consultantId: string): Promise<Parcel[]> {
  const parcels = await loadParcels();
  // Return all parcels (no auth filtering for demo)
  return parcels;
}

export async function getParcelsByOwnerEmail(email: string): Promise<Parcel[]> {
  const parcels = await loadParcels();
  if (!email) return parcels;
  return parcels.filter((p) => p.ownerEmail === email);
}

// ── Vault ──────────────────────────────────────────────────────────────────

export async function uploadParcelDocument(
  parcelId: string,
  userId: string,
  fileName: string,
  fileType: VaultDocumentType,
  file: File
): Promise<VaultDocument | null> {
  try {
    const docs = await loadVault();
    const newDoc: VaultDocument = {
      id: generateId(),
      parcelId,
      fileName,
      fileType,
      fileSize: file.size,
      downloadUrl: URL.createObjectURL(file),
      uploadedBy: userId,
      createdAt: new Date().toISOString(),
    };
    docs.push(newDoc);
    await saveVault(docs);
    return newDoc;
  } catch {
    return null;
  }
}

export async function getParcelDocuments(parcelId: string): Promise<VaultDocument[]> {
  const docs = await loadVault();
  return docs.filter((d) => d.parcelId === parcelId);
}

export async function generateShareLink(doc: VaultDocument): Promise<string> {
  return generateId();
}

export async function updateParcelTreeAnalytics(parcelId: string, data: any): Promise<void> {
  const parcels = await loadParcels();
  const idx = parcels.findIndex((p) => p.id === parcelId);
  if (idx >= 0) {
    parcels[idx].tree_analytics = data;
    await saveParcels(parcels);
  }
}

// ── Invites ────────────────────────────────────────────────────────────────

export async function inviteLandowner(email: string, parcelId: string): Promise<void> {
  const invites = await loadInvites();
  invites.push({
    id: generateId(),
    email,
    parcelId,
    status: "pending",
    invitedAt: new Date().toISOString(),
  });
  await saveInvites(invites);
}

export async function getInvites(userId: string): Promise<LandownerInvite[]> {
  return loadInvites();
}
