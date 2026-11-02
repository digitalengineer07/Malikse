import { Schema, model } from "mongoose";

interface IPushReceipt {
  ticketId: string;
  token: string;
  createdAt: Date;
}

const PushReceiptSchema = new Schema<IPushReceipt>({
  ticketId: { type: String, required: true, unique: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: "2d" },
});

export const PushReceipt = model<IPushReceipt>("PushReceipt", PushReceiptSchema);
