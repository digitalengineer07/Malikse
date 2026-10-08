import mongoose, { Schema, Document } from "mongoose";

export interface IInquiry extends Document {
  propertyId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  message: string;
  offerAmount?: number;
  status: "pending" | "accepted" | "rejected" | "countered";
  messages: Array<{
    senderId: mongoose.Types.ObjectId | string;
    text: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const InquirySchema = new Schema<IInquiry>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    offerAmount: { type: Number },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "countered"],
      default: "pending",
    },
    messages: [
      {
        senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

InquirySchema.index({ propertyId: 1 });
InquirySchema.index({ buyerId: 1 });
InquirySchema.index({ sellerId: 1 });

export const Inquiry = mongoose.model<IInquiry>("Inquiry", InquirySchema);
