import api from "./authService";

export interface InquiryData {
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
  async markRead(inquiryId: string, through: string): Promise<void> {
    await api.post(`/inquiries/${inquiryId}/read`, { through });
  },
  async submitInquiry(data: { propertyId: string; message: string; offerAmount?: number }): Promise<InquiryData> {
    const res = await api.post("/inquiries", data);
    return res.data;
  },

  async getSentInquiries(): Promise<InquiryData[]> {
    const res = await api.get("/inquiries/sent");
    return res.data;
  },

  async getReceivedInquiries(): Promise<InquiryData[]> {
    const res = await api.get("/inquiries/received");
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
