/**
 * MalikSe — Property Service
 */
import api from "./authService";
import type { Property, PropertySearchFilters } from "../types/property.types";

export const propertyService = {
  async uploadPhoto(propertyId: string, file: File | Blob, fileName: string): Promise<{ url: string }> {
    const body = new FormData();
    body.append("file", file, fileName);
    return (await api.post(`/properties/${propertyId}/photos`, body, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  async createProperty(data: any): Promise<Property> {
    const res = await api.post("/properties", data);
    return res.data;
  },

  async getMyProperties(): Promise<Property[]> {
    const res = await api.get("/properties/mine");
    return res.data;
  },

  async searchProperties(filters: PropertySearchFilters): Promise<Property[]> {
    const res = await api.get("/properties/search", { params: filters });
    return res.data;
  },

  async getPropertyById(id: string): Promise<Property> {
    const res = await api.get(`/properties/${id}`);
    return res.data;
  },

  async updateProperty(id: string, data: Partial<Property>): Promise<Property> {
    const res = await api.patch(`/properties/${id}`, data);
    return res.data;
  }
};
