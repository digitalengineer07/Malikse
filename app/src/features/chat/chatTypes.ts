export interface ChatParticipant {
  _id: string;
  name?: string;
  role?: string;
  mobile?: string;
}

export interface PropertySnippet {
  _id: string;
  title?: string;
  price?: number;
  status?: string;
  location?: {
    block?: string;
    district?: string;
    state?: string;
    policeStation?: string;
  };
}

export interface ChatMessage {
  _id: string;
  senderId: string | { _id: string; name?: string };
  text: string;
  createdAt: string;
  clientTempId?: string;
  sending?: boolean;
  sendError?: boolean;
  failureReason?: string;
}

export interface ChatConversation {
  _id: string;
  propertyId?: PropertySnippet;
  buyerId?: ChatParticipant | string;
  staffId?: ChatParticipant | string;
  dealId?: string | { _id: string; status?: string; offerAmount?: number; counterAmount?: number };
  message: string;
  offerAmount?: number;
  status: "pending" | "accepted" | "rejected" | "countered";
  messages?: ChatMessage[];
  unread?: boolean;
  unreadCount?: number;
  buyerReadAt?: string;
  staffReadAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MessagePageResponse {
  messages: ChatMessage[];
  nextBefore: number | null;
  recipientReadAt?: string | null;
  ownReadAt?: string | null;
  live?: { cursor: string; count: number; more: boolean; canWait: boolean };
}
