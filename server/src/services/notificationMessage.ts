import { isObjectIdOrHexString, Types } from "mongoose";
import { Inquiry } from "../models/Inquiry.model";

export const genericChatTitle = "New message";

export function chatNotificationTitle(displayName?: string) {
  const name = displayName?.replace(/[\s\u202a-\u202e\u2066-\u2069]+/gu, " ").trim();
  return name ? Array.from(name).slice(0, 60).join("") : genericChatTitle;
}

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
