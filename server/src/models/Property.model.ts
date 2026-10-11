import mongoose, { Schema, Document } from "mongoose";

export interface IProperty extends Document {
  __v: number;
  title?: string;
  description?: string;
  ownerId: mongoose.Types.ObjectId;
  jointOwnerIds: mongoose.Types.ObjectId[];
  type: "land" | "flat" | "house" | "shop" | "office";
  location: {
    state: string;
    district: string;
    block: string;
    mauza: string;
    policeStation: string;
    lat: number;
    lng: number;
  };
  parcelPoints?: { lat: number; lng: number }[];
  khata?: string;
  khesra?: string;
  holdingNumber?: string;
  totalArea: number;
  sellableArea: number;
  boundary?: string;
  roadWidth?: number;
  price: number;
  negotiable: boolean;
  media: { photos: string[]; videos: string[] };
  documents: mongoose.Types.ObjectId[];
  disclosures: { hasLoan: boolean; hasDispute: boolean; possessionStatus: string };
  status: "draft" | "queued" | "pending" | "advisor_verified" | "correction_required" | "rejected" | "verified" | "sold";
  submission?: { id: string; digest: string; attempts: number; nextAttemptAt: Date; leaseUntil?: Date; leaseToken?: string; error?: string; completedAt?: Date };
  assignedVerifierId?: mongoose.Types.ObjectId;
  advisorReview?: any;
  verifierReview?: any;
  verificationHistory: any[];
  badges: {
    identityVerified: boolean;
    documentsChecked: boolean;
    siteVisited: boolean;
    lawyerReviewed: boolean;
    fullyVerified: boolean;
  };
  assignedAdvisorId?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
}

const PropertySchema = new Schema<IProperty>(
  {
    title: { type: String, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    assignedVerifierId: { type: Schema.Types.ObjectId, ref: "User" },
    advisorReview: Schema.Types.Mixed,
    verifierReview: Schema.Types.Mixed,
    verificationHistory: { type: [Schema.Types.Mixed], default: [] } as any,
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    jointOwnerIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    type: {
      type: String,
      enum: ["land", "flat", "house", "shop", "office"],
      required: true,
    },
    location: {
      state: { type: String, required: true },
      district: { type: String, required: true },
      block: { type: String, default: "" },
      mauza: { type: String, default: "" },
      policeStation: { type: String, default: "" },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    parcelPoints: {
      type: [
        {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
        },
      ],
      default: [],
    },
    khata: String,
    khesra: String,
    holdingNumber: String,
    totalArea: { type: Number, required: true },
    sellableArea: { type: Number, required: true },
    boundary: String,
    roadWidth: Number,
    price: { type: Number, required: true },
    negotiable: { type: Boolean, default: true },
    media: {
      photos: { type: [String], default: [] },
      videos: { type: [String], default: [] },
    },
    documents: { type: [Schema.Types.ObjectId], ref: "Document", default: [] },
    disclosures: {
      hasLoan: { type: Boolean, default: false },
      hasDispute: { type: Boolean, default: false },
      possessionStatus: { type: String, default: "With Owner" },
    },
    status: {
      type: String,
      enum: ["draft", "queued", "pending", "advisor_verified", "correction_required", "rejected", "verified", "sold"],
      default: "pending",
    },
    badges: {
      identityVerified: { type: Boolean, default: false },
      documentsChecked: { type: Boolean, default: false },
      siteVisited: { type: Boolean, default: false },
      lawyerReviewed: { type: Boolean, default: false },
      fullyVerified: { type: Boolean, default: false },
    },
    assignedAdvisorId: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: String,
    submission: {
      type: new Schema({
        id: String, digest: String, attempts: { type: Number, default: 0 },
        nextAttemptAt: Date, leaseUntil: Date, leaseToken: String,
        error: String, completedAt: Date,
      }, { _id: false }),
      default: undefined,
    },
  },
  { timestamps: true }
);

// Geospatial + search indexes
PropertySchema.index({ "location.lat": 1, "location.lng": 1 });
PropertySchema.index({ status: 1, price: 1 });
PropertySchema.index({ type: 1, status: 1 });
// Additive secondary indexes; existing indexes are retained until measured.
PropertySchema.index({ title: "text", "location.state": "text", "location.district": "text", "location.block": "text", "location.mauza": "text" }, { name: "property_location_text", default_language: "none" });
PropertySchema.index({ status: 1, type: 1, createdAt: -1, _id: -1 }, { name: "property_type_newest" });
PropertySchema.index({ status: 1, price: 1, createdAt: -1, _id: -1 }, { name: "property_price_newest" });
PropertySchema.index({ status: 1, "submission.nextAttemptAt": 1, "submission.leaseUntil": 1 }, { name: "property_submission_queue" });

export const Property = mongoose.model<IProperty>("Property", PropertySchema);
