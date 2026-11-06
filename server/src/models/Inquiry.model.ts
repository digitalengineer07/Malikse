import mongoose, { Schema, Document } from "mongoose";

export interface IInquiry extends Document {
  propertyId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  staffId: mongoose.Types.ObjectId;
  dealId?: mongoose.Types.ObjectId;
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
  buyerReadAt?: Date;
  staffReadAt?: Date;
}

const InquirySchema = new Schema<IInquiry>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dealId: { type: Schema.Types.ObjectId, ref: "Deal" },
    message: { type: String, required: true },
    offerAmount: { type: Number },
    buyerReadAt: Date,
    staffReadAt: Date,
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
InquirySchema.index({ staffId: 1 });
InquirySchema.index({ buyerId: 1, createdAt: -1 }, { name: "inquiry_buyer_newest" });
InquirySchema.index({ staffId: 1, createdAt: -1 }, { name: "inquiry_seller_newest" });

InquirySchema.index({ buyerId: 1, createdAt: -1, _id: -1 }, { name: "inquiry_buyer_cursor" });
InquirySchema.index({ staffId: 1, createdAt: -1, _id: -1 }, { name: "inquiry_seller_cursor" });
export const Inquiry = mongoose.model<IInquiry>("Inquiry", InquirySchema);
