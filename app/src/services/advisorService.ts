/**
 * MalikSe — Advisor Service
 */
import api from "./authService";
import type { AdvisorReport, AdvisorTask } from "../types/deal.types";

export const advisorService = {
  async getAssignedTasks(): Promise<AdvisorTask[]> {
    const res = await api.get("/verification/my-tasks");
    return res.data;
  },

  async submitReport(propertyId: string, report: Partial<AdvisorReport>): Promise<AdvisorReport> {
    const res = await api.post(`/verification/${propertyId}/report`, report);
    return res.data;
  }
};
