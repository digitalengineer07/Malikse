import { isObjectIdOrHexString, Types } from "mongoose";
import { Inquiry } from "../models/Inquiry.model";

export async function findNotificationMessage(
  recipient: string,
  data: { kind?: unknown; id?: unknown } | undefined,
  messageId: Types.ObjectId | null | undefined,
) {
  if (data?.kind !== "inquiry" || !isObjectIdOrHexString(data.id) || !messageId) return;
  const inquiry = await Inquiry.findOne({
    _id: data.id,
    $or: [{ buyerId: recipient }, { staffId: recipient }],
  }, { messages: { $elemMatch: { _id: messageId } } }).lean();
  return inquiry?.messages?.[0];
}
