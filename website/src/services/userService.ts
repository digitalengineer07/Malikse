import api from "./authService";
import type { Property } from "../types/property.types";
import type { UserProfile } from "../types/auth.types";

export const userService = {
  async isWishlisted(id: string): Promise<boolean> { return (await api.get(`/users/wishlist/${id}`)).data.isWishlisted; },
  async getProfile(): Promise<UserProfile> {
    const res = await api.get("/users/profile");
    return res.data;
  },

  async updateProfile(data: { name?: string; email?: string }): Promise<UserProfile> {
    const res = await api.put("/users/profile", data);
    return res.data;
  },

  async getMyProperties(): Promise<Property[]> {
    const res = await api.get("/users/my-properties");
    return res.data;
  },

  async getWishlist(cursor?: string): Promise<Property[]> {
    const res = await api.get("/users/wishlist", { params: { cursor } });
    return res.data;
  },

  async toggleWishlist(propertyId: string): Promise<{ success: boolean; isWishlisted: boolean }> {
    const res = await api.post(`/users/wishlist/${propertyId}`);
    return res.data;
  }
};
