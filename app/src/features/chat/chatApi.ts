import api from "../../services/authService";
import type { ChatConversation, MessagePageResponse } from "./chatTypes";

export const chatApi = {
  /**
   * Fetch all conversations for current user.
   */
  async getConversations(sort: "activity" | "created" = "activity"): Promise<ChatConversation[]> {
    try {
      const res = await api.get("/inquiries", {
        params: { sort },
        timeout: 10000,
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (err: any) {
      console.warn("[chatApi] getConversations error:", err?.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Fetch a single conversation summary.
   */
  async getConversation(inquiryId: string): Promise<ChatConversation> {
    try {
      const res = await api.get(`/inquiries/${inquiryId}`, { timeout: 10000 });
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
  async getMessages(inquiryId: string, before?: number): Promise<MessagePageResponse> {
    try {
      const res = await api.get(`/inquiries/${inquiryId}/messages`, {
        params: before !== undefined ? { before } : undefined,
        timeout: 10000,
      });
      return {
        messages: Array.isArray(res.data?.messages) ? res.data.messages : [],
        nextBefore: typeof res.data?.nextBefore === "number" ? res.data.nextBefore : null,
        recipientReadAt: res.data?.recipientReadAt ?? null,
        ownReadAt: res.data?.ownReadAt ?? null,
      };
    } catch (err: any) {
      console.warn(`[chatApi] getMessages(${inquiryId}) error:`, err?.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Send a new message in a conversation.
   */
  async sendMessage(inquiryId: string, text: string): Promise<ChatConversation> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    try {
      const res = await api.post(`/inquiries/${inquiryId}/message`, { text: trimmed }, { timeout: 12000 });
      return res.data;
    } catch (err: any) {
      console.error(`[chatApi] sendMessage(${inquiryId}) error:`, err?.response?.data || err.message);
      throw err;
    }
  },

  /**
   * Acknowledge messages read up to a timestamp.
   */
  async markRead(inquiryId: string, throughIsoString: string): Promise<void> {
    try {
      await api.post(`/inquiries/${inquiryId}/read`, { through: throughIsoString }, { timeout: 8000 });
    } catch (err: any) {
      // Non-fatal, just log
      console.warn(`[chatApi] markRead(${inquiryId}) non-fatal error:`, err?.message);
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
