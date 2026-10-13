/**
 * MalikSe — Deal & Advisor Types
 */

export type DealStatus =
  | "offered"
  | "countered"
  | "accepted"
  | "rejected"
  | "token_paid"
  | "completed"
  | "cancelled";

export interface Deal {
  id: string;
  propertyId: string;
  buyerId: string;
  ownerId: string;
  offerAmount: number;
  status: DealStatus;
  commissionAmount: number;     // 1% + tax, per side
  tokenPaymentRef?: string;
  registryDateEstimate?: string;
  createdAt: string;
}

export interface AdvisorChecklistItem {
  key: string;
  label: string;
  checked: boolean;
}

export interface AdvisorReport {
  id?: string;
  propertyId: string;
  advisorId: string;
  gpsCheckIn: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  checklist: Record<string, boolean>;
  photos: string[];        // uploaded photo URLs
  notes: string;
  signature?: string;      // digital signature reference
  submittedAt?: string;
}

export interface AdvisorTask {
  propertyId: string;
  propertyTitle: string;
  ownerName: string;
  ownerMobile: string;
  location: {
    lat: number;
    lng: number;
    district: string;
    state: string;
  };
  status: "assigned" | "in_progress" | "completed";
  assignedAt: string;
}
