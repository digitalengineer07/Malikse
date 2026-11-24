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
  advisorCode?: string;
  assignedDistricts?: string[];
};

type StaffListing = { _id: string; title?: string; status: string };
type StaffWorkload = { assigned: StaffListing[]; history: StaffListing[]; nextAssigned?: string; nextHistory?: string };

export const adminService = {
  async reviewIdentity(userId: string, approved: boolean, notes: string) {
    return (await api.put(`/admin/users/${userId}/identity`, { approved, notes })).data;
  },
  async listStaff(cursor?: string, search?: string, signal?: AbortSignal): Promise<StaffAccount[] & { nextCursor?: string }> {
    const response = await api.get("/admin/staff", { params: { cursor, search: search || undefined }, signal });
    return response.data;
  },
  async getStaff(id: string, signal?: AbortSignal): Promise<StaffAccount> {
    return (await api.get("/admin/staff/" + encodeURIComponent(id), { signal })).data;
  },
  async updateStaffDistricts(id: string, assignedDistricts: string[]): Promise<{ assignedDistricts: string[] }> {
    return (await api.put("/admin/staff/" + encodeURIComponent(id) + "/districts", { assignedDistricts })).data;
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
        photos: p.media.photos?.map((photo: string) => photo.replace(/^https?:\/\/malikse\.onrender\.com/i, "https://malikseserver.devoxa.in"))
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
  async getStaffWorkload(staffId: string, cursors: { assignedCursor?: string; historyCursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<StaffWorkload> {
    const response = await api.get(`/admin/staff/${staffId}/workload`, { params: cursors, signal });
    return response.data;
  },
  async getPropertyAudit(propertyId: string): Promise<any> {
    const response = await api.get(`/admin/properties/${propertyId}/audit`);
    return response.data;
  },
};
