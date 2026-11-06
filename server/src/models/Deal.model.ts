import mongoose, { Schema, Document } from "mongoose";

export interface IDeal extends Document {
  propertyId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  requestKey?: string;
  staffId?: mongoose.Types.ObjectId;
  history: any[];
  offerAmount: number;
  counterAmount?: number;
  status: "offered" | "countered" | "accepted" | "rejected" | "token_paid" | "completed" | "cancelled";
  commissionAmount: number;     // 1% + 18% GST = 1.18%
  tokenPaymentRef?: string;
  registryDateEstimate?: string;
  createdAt: Date;
}

const DealSchema = new Schema<IDeal>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestKey: String,
    staffId: { type: Schema.Types.ObjectId, ref: "User" },
    history: { type: [Schema.Types.Mixed], default: [] } as any,
    offerAmount: { type: Number, required: true },
    counterAmount: Number,
    status: {
      type: String,
      enum: ["offered", "countered", "accepted", "rejected", "token_paid", "completed", "cancelled"],
      default: "offered",
    },
    commissionAmount: { type: Number, required: true },
    tokenPaymentRef: String,
    registryDateEstimate: String,
  },
  { timestamps: true }
);

DealSchema.index({ buyerId: 1, createdAt: -1 }, { name: "deal_buyer_newest" });
DealSchema.index({ ownerId: 1, createdAt: -1 }, { name: "deal_owner_newest" });
DealSchema.index({ status: 1 }, { name: "deal_status" });

DealSchema.index({ buyerId: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: "string" } } });
export const Deal = mongoose.model<IDeal>("Deal", DealSchema);
