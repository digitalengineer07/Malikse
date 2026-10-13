/**
 * MalikSe — Property Service
 */
import api from "./authService";
import type { Property, PropertySearchFilters } from "../types/property.types";

import { searchResults, pendingSearches, searchKey, searchGeneration } from "./searchCache";

export function cachedPropertySearch(filters: PropertySearchFilters): Property[] | undefined {
  const cached = searchResults.get(searchKey(filters));
  return cached && cached.expires + 60000 > Date.now() ? cached.items : undefined;
}

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
    return res.data.map((p: any) => ({
      ...p,
      media: p.media ? {
        ...p.media,
        photos: p.media.photos?.map((photo: string) => photo.replace("http://malikse.onrender.com", "https://malikse.onrender.com"))
      } : p.media
    }));
  },

  async searchProperties(filters: PropertySearchFilters, force = false): Promise<Property[]> {
    const key = searchKey(filters);
    const cached = searchResults.get(key);
    if (!force && cached && cached.expires > Date.now()) return cached.items;
    if (pendingSearches.has(key)) return pendingSearches.get(key)!;
    const generation = searchGeneration;
    const work = (async () => {
    const res = await api.get("/properties/search", { params: { ...filters, view: "cards" } });
    const properties = res.data.map((p: any) => ({
      ...p,
      media: p.media ? {
        ...p.media,
        photos: p.media.photos?.map((photo: string) => photo.replace("http://malikse.onrender.com", "https://malikse.onrender.com"))
      } : p.media
    }));
    Object.assign(properties, { nextCursor: res.data.nextCursor });
    if (generation === searchGeneration) {
    searchResults.delete(key);
    searchResults.set(key, { items: properties, expires: Date.now() + 15000 });
    if (searchResults.size > 20) searchResults.delete(searchResults.keys().next().value!);
    }
    return properties;
    })();
    pendingSearches.set(key, work);
    try { return await work; } finally { if (pendingSearches.get(key) === work) pendingSearches.delete(key); }
  },

  async getPropertyById(id: string): Promise<Property> {
    const res = await api.get(`/properties/${id}`);
    const p = res.data;
    if (p.media && p.media.photos) {
      p.media.photos = p.media.photos.map((photo: string) => photo.replace("http://malikse.onrender.com", "https://malikse.onrender.com"));
    }
    return p;
  },

  async updateProperty(id: string, data: Partial<Property>): Promise<Property> {
    const res = await api.patch(`/properties/${id}`, data);
    return res.data;
  }
};
