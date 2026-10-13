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
  async listStaff(cursor?: string): Promise<StaffAccount[]> {
    const response = await api.get("/admin/staff", { params: { cursor } });
    return response.data;
  },
  async createStaff(input: { role: StaffRole; name: string; mobile: string; email?: string; password: string }): Promise<StaffAccount> {
    const response = await api.post("/admin/staff", input);
    return response.data;
  },
  async listUsers(cursor?: string): Promise<any[]> {
    const response = await api.get("/admin/users", { params: { cursor } });
    return response.data;
  },
  async getUserProperties(userId: string, cursor?: string): Promise<any[]> {
    const response = await api.get(`/admin/users/${userId}/properties`, { params: { cursor } });
    return Object.assign(response.data.map((p: any) => ({
      ...p,
      media: p.media ? {
        ...p.media,
        photos: p.media.photos?.map((photo: string) => photo.replace("http://malikse.onrender.com", "https://malikse.onrender.com"))
      } : p.media
    })), { nextCursor: response.data.nextCursor });
  },
  async suspendUser(userId: string, isSuspended: boolean): Promise<any> {
    const response = await api.put(`/admin/users/${userId}/suspend`, { isSuspended });
    return response.data;
  },
  async toggleStaffStatus(staffId: string, isActive: boolean): Promise<any> {
    const response = await api.put(`/admin/staff/${staffId}/status`, { isActive });
    return response.data;
  },
  async getUserTransactions(userId: string, cursors: { inquiriesCursor?: string; dealsCursor?: string } = {}): Promise<any> {
    const response = await api.get(`/admin/users/${userId}/transactions`, { params: cursors });
    return response.data;
  },
  async getStaffWorkload(staffId: string, cursors: { assignedCursor?: string; historyCursor?: string } = {}): Promise<any> {
    const response = await api.get(`/admin/staff/${staffId}/workload`, { params: cursors });
    return response.data;
  },
  async getPropertyAudit(propertyId: string): Promise<any> {
    const response = await api.get(`/admin/properties/${propertyId}/audit`);
    return response.data;
  },
};
