/**
 * MalikSe — Property Types
 */

export type PropertyType = "land" | "flat" | "house" | "shop" | "office";
export type PropertyStatus = "draft" | "queued" | "pending" | "advisor_verified" | "correction_required" | "rejected" | "verified" | "sold";

export interface PropertyBadges {
  identityVerified: boolean;
  documentsChecked: boolean;
  siteVisited: boolean;
  lawyerReviewed: boolean;
  fullyVerified: boolean;
}

export interface PropertyLocation {
  pincode?: string;
  state: string;
  district: string;
  block?: string;
  mauza?: string;
  policeStation?: string;
  lat: number;
  lng: number;
}

export interface PropertyDisclosures {
  hasLoan?: boolean;
  hasDispute?: boolean;
  possessionStatus?: string;
}

export interface Property {
  id: string;
  _id?: string;
  title?: string;
  image?: string;
  area?: string;
  verified?: boolean;
  date?: string;
  ownerId?: string;
  jointOwnerIds?: string[];
  type: PropertyType | string;
  location: PropertyLocation;
  parcelPoints?: { lat: number; lng: number }[];
  khata?: string;
  khesra?: string;
  holdingNumber?: string;
  totalArea?: number;       // in sq ft or sq m
  sellableArea?: number;
  boundary?: string;       // chauhaddi description
  roadWidth?: number;
  price: number;           // in INR
  negotiable?: boolean;
  media?: {
    photos: string[];      // S3/GridFS URLs
    videos?: string[];
  };
  documents?: string[];     // Document IDs
  disclosures?: PropertyDisclosures;
  status: PropertyStatus | string;
  badges?: PropertyBadges | any;
  createdAt?: string;
  updatedAt?: string;
  // Populated fields (from server joins)
  ownerName?: string;
  locationName?: string;   // Human-readable address
}

export interface PropertySearchFilters {
  address?: string;
  pincode?: string;
  cursor?: string;
  district?: string;
  state?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  type?: PropertyType;
  verifiedOnly?: boolean;
  page?: number;
  limit?: number;
}
