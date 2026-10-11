import type { InquiryData } from "../services/inquiryService";

export function inquiryActivity(inquiry: InquiryData, userId: string) {
  const buyerId = typeof inquiry.buyerId === "object" ? inquiry.buyerId?._id : inquiry.buyerId;
  const isBuyer = buyerId === userId;
  const initialText = inquiry.offerAmount ? `Offer of ₹${inquiry.offerAmount.toLocaleString("en-IN")} submitted` : inquiry.message;
  const messages = [...(inquiry.messages || [])].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const latest = messages.at(-1);
  const readAt = Date.parse((isBuyer ? inquiry.buyerReadAt : inquiry.sellerReadAt) || "") || 0;
  const incoming = messages.filter(message => message.senderId !== userId).map(message => Date.parse(message.createdAt));
  if (!isBuyer) incoming.push(Date.parse(inquiry.createdAt));
  const activityAt = latest?.createdAt || inquiry.createdAt;
  return {
    lastMsg: latest?.text || initialText,
    timestampNum: Date.parse(activityAt),
    activityAt,
    time: new Date(activityAt).toLocaleString(),
    unread: incoming.some(timestamp => timestamp > readAt),
  };
}
