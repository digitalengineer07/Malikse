/**
 * MalikSe — Document Types
 */

export type DocumentType =
  | "Registry"
  | "Mutation"
  | "LPC/Jamabandi"
  | "Map"
  | "Rent Receipt"
  | "Owner ID Proof";

export interface PropertyDocument {
  id: string;
  propertyId: string;
  type: DocumentType;
  fileName: string;
  fileSize: number;
  fileUrl: string;         // S3/GridFS URL (full doc, advisor access only)
  watermarkedUrl?: string; // Watermarked version for buyer preview
  watermarked: boolean;
  uploadedBy: string;      // User ID
  createdAt: string;
}

export interface ShareLink {
  token: string;
  expiresAt: string;       // ISO 8601 — 48 hours from creation
  docId: string;
}
