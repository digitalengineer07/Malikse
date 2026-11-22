import { Schema, model } from "mongoose";

interface IPushReceipt {
  ticketId: string;
  token: string;
  notificationId?: import("mongoose").Types.ObjectId;
  createdAt: Date;
}

const PushReceiptSchema = new Schema<IPushReceipt>({
  ticketId: { type: String, required: true, unique: true },
  token: { type: String, required: true },
  notificationId: { type: Schema.Types.ObjectId, ref: "Notification" },
  createdAt: { type: Date, default: Date.now, expires: "2d" },
});

export const PushReceipt = model<IPushReceipt>("PushReceipt", PushReceiptSchema);
