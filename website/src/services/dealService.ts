/**
 * MalikSe — Deal Service
 */
import api from "./authService";
import type { Deal, DealStatus } from "../types/deal.types";

export const dealService = {
  async sendOffer(propertyId: string, amount: number): Promise<Deal> {
    const res = await api.post(`/deals/${propertyId}/offer`, { amount });
    return res.data;
  },

  async getDeal(dealId: string): Promise<Deal> {
    const res = await api.get(`/deals/${dealId}`);
    return res.data;
  },

  async updateDealStatus(dealId: string, status: DealStatus): Promise<Deal> {
    const res = await api.patch(`/deals/${dealId}/status`, { status });
    return res.data;
  }
};
