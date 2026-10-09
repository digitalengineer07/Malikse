import api from "./authService";

export type StaffRole = "advisor" | "verifier";
export type StaffAccount = {
  id: string;
  role: StaffRole;
  name: string;
  mobile: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
};

export const adminService = {
  async listStaff(): Promise<StaffAccount[]> {
    const response = await api.get("/admin/staff");
    return response.data;
  },
  async createStaff(input: { role: StaffRole; name: string; mobile: string; email?: string; password: string }): Promise<StaffAccount> {
    const response = await api.post("/admin/staff", input);
    return response.data;
  },
  async listUsers(): Promise<any[]> {
    const response = await api.get("/admin/users");
    return response.data;
  },
  async getUserProperties(userId: string): Promise<any[]> {
    const response = await api.get(`/admin/users/${userId}/properties`);
    return response.data;
  },
  async suspendUser(userId: string): Promise<any> {
    const response = await api.put(`/admin/users/${userId}/suspend`);
    return response.data;
  },
  async toggleStaffStatus(staffId: string): Promise<any> {
    const response = await api.put(`/admin/staff/${staffId}/status`);
    return response.data;
  },
  async getUserTransactions(userId: string): Promise<any> {
    const response = await api.get(`/admin/users/${userId}/transactions`);
    return response.data;
  },
  async getStaffWorkload(staffId: string): Promise<any> {
    const response = await api.get(`/admin/staff/${staffId}/workload`);
    return response.data;
  },
  async getPropertyAudit(propertyId: string): Promise<any> {
    const response = await api.get(`/admin/properties/${propertyId}/audit`);
    return response.data;
  },
};
