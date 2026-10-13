import api from "./authService";

export interface InquiryData {
  unread?: boolean;
  _id: string;
  propertyId: any;
  buyerId: any;
  sellerId: any;
  message: string;
  offerAmount?: number;
  status: "pending" | "accepted" | "rejected" | "countered";
  buyerReadAt?: string;
  sellerReadAt?: string;
  messages?: {
    _id: string;
    senderId: string;
    text: string;
    createdAt: string;
  }[];
  createdAt: string;
}

export const inquiryService = {
  async getConversations(cursor?: string): Promise<InquiryData[]> { return (await api.get("/inquiries", { params: { cursor } })).data; },
  async getMessages(id: string, before?: number): Promise<{ messages: NonNullable<InquiryData["messages"]>; nextBefore: number | null }> {
    return (await api.get(`/inquiries/${id}/messages`, { params: { before } })).data;
  },
  async markRead(inquiryId: string, through: string): Promise<void> {
    await api.post(`/inquiries/${inquiryId}/read`, { through });
  },
  async submitInquiry(data: { propertyId: string; message: string; offerAmount?: number }): Promise<InquiryData> {
    const res = await api.post("/inquiries", data);
    return res.data;
  },

  async getSentInquiries(cursor?: string): Promise<InquiryData[]> {
    const res = await api.get("/inquiries/sent", { params: { cursor } });
    return res.data;
  },

  async getReceivedInquiries(cursor?: string): Promise<InquiryData[]> {
    const res = await api.get("/inquiries/received", { params: { cursor } });
    return res.data;
  },

  async updateInquiryStatus(inquiryId: string, status: "pending" | "accepted" | "rejected" | "countered"): Promise<InquiryData> {
    const res = await api.put(`/inquiries/${inquiryId}/status`, { status });
    return res.data;
  },

  async sendMessage(inquiryId: string, text: string): Promise<InquiryData> {
    const res = await api.post(`/inquiries/${inquiryId}/message`, { text });
    return res.data;
  }
};
