import type { ChatConversation, ChatMessage } from "./chatTypes";

export class InvalidChatResponse extends Error {}

export function parseInbox(data: unknown): ChatConversation[] {
  if (!Array.isArray(data) || !data.every(row => typeof row?._id === "string")) {
    throw new InvalidChatResponse("Invalid inbox response");
  }
  return data;
}

export function confirmedMessage(data: unknown, id: string): ChatMessage {
  const messages = (data as Partial<ChatConversation> | null)?.messages;
  const saved = Array.isArray(messages) && messages.find(message => message?._id === id);
  if (!saved || typeof saved.text !== "string" || !saved.createdAt || !saved.senderId) {
    throw new InvalidChatResponse("Message acknowledgement missing");
  }
  return saved;
}

export function retryDelay(attempt: number, retryAfter?: string, now = Date.now()) {
  const floor = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000
    : retryAfter ? Date.parse(retryAfter) - now : 0;
  return Math.max(Number.isFinite(floor) ? floor : 0, Math.min(60000, 1000 * 2 ** Math.min(attempt, 6)))
    + Math.floor(Math.random() * 500);
}

export function chatRetryDelay(attempt: number, status?: number, retryAfter?: string) {
  const delay = retryDelay(attempt, retryAfter);
  // Some gateways return 429 without a reset time. Give that bucket time to refill.
  return status === 429 && !retryAfter ? Math.max(delay, Math.min(120000, 30000 * 2 ** Math.min(attempt, 2)) + Math.random() * 1000) : delay;
}

// A write is durable and idempotent. Retry the first interruption promptly,
// then space out successive attempts while respecting any server cooldown.
export function sendRetryDelay(attempt: number, status?: number, retryAfter?: string) {
  const delay = retryDelay(attempt, retryAfter);
  return status === 429 ? Math.max(delay, Math.min(60000, 3000 * 2 ** Math.min(attempt, 5)) + Math.random() * 800) : delay;
}
