import api from "./authService";
import type { PropertyType } from "../types/property.types";
export type RegionGroup = { key: string; name: string; count: number; lat: number; lng: number };
export type RegionCounts = { level: "state" | "district" | "pincode"; groups: RegionGroup[] };
export type LocationSuggestion = { kind: "state" | "district" | "pincode" | "address"; label: string; state: string; district?: string; pincode?: string; lat: number; lng: number };
export async function fetchRegionCounts(filters: { state?: string; district?: string; type?: PropertyType }, signal?: AbortSignal): Promise<RegionCounts> {
  return (await api.get("/properties/regions", { params: filters, signal })).data;
}
export async function fetchLocationSuggestions(q: string, type?: PropertyType, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  return (await api.get("/properties/regions/suggest", { params: { q, type }, signal })).data;
}
