import { isAxiosError } from "axios";
import api from "../../services/authService";
import { useAuthStore } from "../../store/authStore";
import type { ChatConversation, MessagePageResponse } from "./chatTypes";
import { chatRetryDelay, confirmedMessage, InvalidChatResponse, parseInbox } from "./chatWire";

const cooldown = new Map<string, { until: number; failures: number }>();
let maxBatch = 1;
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) cooldown.clear();
});
export function transcriptRetryAt(thread: string) { return cooldown.get(thread)?.until ?? 0; }

function reportRequestFailure(operation: string, error: unknown) {
  const response = isAxiosError(error) ? error.response : undefined;
  console.warn("[chat transport]", JSON.stringify({ operation, status: response?.status,
    code: isAxiosError(error) ? error.code : "invalid_response", requestId: response?.headers["x-request-id"],
    edgeRequestId: response?.headers["x-hcdn-request-id"], contentType: response?.headers["content-type"],
    retryAfter: response?.headers["retry-after"], rateLimit: response?.headers.ratelimit }));
}

export const chatApi = {
  batchSize: () => maxBatch,
  async sendBatch(thread: string, items: {text: string; key: string; id: string}[], signal: AbortSignal) {
    try {
      const batch = items.map(item => ({ text: item.text, clientMessageId: item.key }));
      const { data } = await api.post(`/inquiries/${thread}/message`, { batch }, { timeout: 12000, signal });
      return items.map(item => confirmedMessage(data, item.id));
    } catch (error) {
      reportRequestFailure("sendBatch", error);
      throw error;
    }
  },
  /**
   * Fetch all conversations for current user.
   */
  async getConversations(sort: "activity" | "created" = "activity"): Promise<ChatConversation[]> {
    const res = await api.get("/inquiries", { params: { sort }, timeout: 10000 });
    return parseInbox(res.data);
  },

  /**
   * Fetch a single conversation summary.
   */
  async getConversation(inquiryId: string): Promise<ChatConversation> {
    try {
      const res = await api.get(`/inquiries/${inquiryId}`, { timeout: 10000 });
      if (res.data?._id !== inquiryId) throw new InvalidChatResponse("Invalid conversation response");
      return res.data;
    } catch (err: any) {
      console.warn(`[chatApi] getConversation(${inquiryId}) error:`, err?.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Fetch messages for a conversation.
   * If before is omitted, returns latest 6 messages + read timestamps + nextBefore cursor.
   */
  async getMessages(inquiryId: string, before?: number, sync?: { since?: number; watch?: string; signal: AbortSignal }): Promise<MessagePageResponse> {
    if (Date.now() < transcriptRetryAt(inquiryId)) throw new Error("Transcript refresh deferred");
    const actor = useAuthStore.getState().user?.id;
    try {
      const res = await api.get(`/inquiries/${inquiryId}/messages`, {
        params: before !== undefined ? { before } : sync ? { live: 1, since: sync.since, watch: sync.watch } : undefined,
        signal: sync?.signal,
        timeout: sync?.watch ? 30000 : 10000,
      });
      if (!Array.isArray(res.data?.messages)) throw new InvalidChatResponse("Invalid transcript response");
      if (actor === useAuthStore.getState().user?.id && Date.now() >= transcriptRetryAt(inquiryId)) cooldown.delete(inquiryId);
      return {
        messages: res.data.messages,
        nextBefore: typeof res.data?.nextBefore === "number" ? res.data.nextBefore : null,
        recipientReadAt: res.data?.recipientReadAt ?? null,
        ownReadAt: res.data?.ownReadAt ?? null,
        live: typeof res.data.liveCursor === "string" && Number.isSafeInteger(res.data.messageCount)
          ? { cursor: res.data.liveCursor, count: res.data.messageCount, more: res.data.more === true, canWait: res.data.canWait === true } : undefined,
      };
    } catch (err: any) {
      if (sync?.signal.aborted) throw err;
      const status = err.response?.status;
      if (actor === useAuthStore.getState().user?.id && (!status || status === 408 || status === 429 || status >= 500)) {
        const failures = cooldown.get(inquiryId)?.failures ?? 0;
        cooldown.set(inquiryId, { failures: failures + 1, until: Math.max(transcriptRetryAt(inquiryId),
          Date.now() + chatRetryDelay(failures, status, err.response?.headers?.["retry-after"])) });
      }
      reportRequestFailure("transcript", err);
      throw err;
    }
  },

  /**
   * Send a new message in a conversation.
   */
  async sendMessage(inquiryId: string, text: string, clientMessageId: string, expectedId: string, signal: AbortSignal) {
    try {
      const res = await api.post(`/inquiries/${inquiryId}/message`, { text, clientMessageId }, { timeout: 12000, signal });
      maxBatch = res.data?.maxBatch === 8 ? 8 : 1;
      return confirmedMessage(res.data, expectedId);
    } catch (error) {
      reportRequestFailure("send", error);
      throw error;
    }
  },

  /**
   * Acknowledge messages read up to a timestamp.
   */
  async markRead(inquiryId: string, throughIsoString: string): Promise<void> {
    try {
      await api.post(`/inquiries/${inquiryId}/read`, { through: throughIsoString }, { timeout: 8000 });
    } catch (err: any) {
      // Let the conversation retry an unacknowledged receipt.
      console.warn(`[chatApi] markRead(${inquiryId}) non-fatal error:`, err?.message);
      throw err;
    }
  },

  /**
   * Submit an initial property inquiry or structured offer.
   */
  async submitInquiry(data: { propertyId: string; message: string; offerAmount?: number; requestKey?: string }): Promise<ChatConversation> {
    try {
      const res = await api.post("/inquiries", data, { timeout: 12000 });
      return res.data;
    } catch (err: any) {
      console.error("[chatApi] submitInquiry error:", err?.response?.data || err.message);
      throw err;
    }
  },
};
