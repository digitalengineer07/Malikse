import api from "./authService";

export type Listing = {
  _id: string;
  title?: string;
  description?: string;
  type: string;
  status: string;
  price: number;
  totalArea: number;
  sellableArea: number;
  location: { state: string; district: string; pincode?: string; block?: string; mauza?: string; policeStation?: string; lat: number; lng: number };
  parcelPoints?: { lat: number; lng: number }[];
  ownerId?: string | { _id: string; name: string; mobile: string };
  assignedAdvisorId?: string | { _id: string; name: string };
  assignedVerifierId?: string | { _id: string; name: string };
  advisorReview?: Review;
  verifierReview?: Review;
  verificationHistory?: { action: string; actorId: string; role: string; fromStatus: string; toStatus: string; at: string; report?: Review; staffId?: string }[];
  rejectionReason?: string;
  documents?: string[];
  media?: { photos: string[]; videos: string[] };
  khata?: string;
  khesra?: string;
  holdingNumber?: string;
  boundary?: string;
  roadWidth?: number;
  negotiable?: boolean;
  disclosures?: { hasLoan: boolean; hasDispute: boolean; possessionStatus: string };
};
export type Review = { actorId: string; role: string; decision: string; notes: string; signature: string; submittedAt: string; checklist: Record<string, boolean>; gpsCheckIn?: { lat: number; lng: number; timestamp: string } };
export const statusLabels: Record<string, string> = { draft: "Draft", queued: "Submission queued for processing", pending: "Pending Advisor verification", advisor_verified: "Pending Verifier approval", correction_required: "Corrections required", rejected: "Rejected", verified: "Fully verified · Published", sold: "Sold" };
export const actorId = (actor: Listing["assignedAdvisorId"]) => typeof actor === "string" ? actor : actor?._id;
export const workflowService = {
  async queue(role: string, cursor?: string): Promise<Listing[]> { return (await api.get(role === "admin" ? "/admin/properties" : role === "user" ? "/properties/mine" : "/verification/my-tasks", { params: { cursor } })).data; },
  async detail(id: string, publicView = false): Promise<Listing> { return (await api.get(`/properties/${id}${publicView ? "" : "/workspace"}`)).data; },
  async claim(id: string) { return (await api.post(`/verification/${id}/claim`)).data; },
  async review(id: string, body: object) { return (await api.post(`/verification/${id}/report`, body)).data; },
  async submit(id: string) { return (await api.post(`/properties/${id}/submit`, { consent: true })).data; },
  async assign(id: string, staffId: string) { return (await api.post(`/admin/properties/${id}/assign`, { staffId })).data; },
};
