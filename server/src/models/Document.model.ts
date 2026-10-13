import mongoose, { Schema, Document } from "mongoose";

export interface IDocument extends Document {
  propertyId: mongoose.Types.ObjectId;
  type: "Registry" | "Mutation" | "LPC/Jamabandi" | "Map" | "Rent Receipt" | "Owner ID Proof";
  fileName: string;
  fileSize: number;
  fileUrl: string;          // Full-resolution URL (advisor/owner only)
  watermarkedUrl?: string;  // Buyer-visible watermarked version
  watermarked: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  shareToken?: string;      // 48-hour share token
  shareExpiresAt?: Date;
  createdAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    type: {
      type: String,
      enum: ["Registry", "Mutation", "LPC/Jamabandi", "Map", "Rent Receipt", "Owner ID Proof"],
      required: true,
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    watermarkedUrl: String,
    watermarked: { type: Boolean, default: false },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shareToken: String,
    shareExpiresAt: Date,
  },
  { timestamps: true }
);

DocumentSchema.index({ propertyId: 1, createdAt: -1 }, { name: "document_property_newest" });

export const PropertyDocument = mongoose.model<IDocument>("Document", DocumentSchema);
