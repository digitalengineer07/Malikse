import api from "./authService";
import type { PropertyType } from "../types/property.types";
import { searchGeneration, searchKey } from "./searchCache";
export type RegionGroup = { key: string; name: string; count: number; lat: number; lng: number };
export type RegionCounts = { level: "state" | "district" | "pincode"; groups: RegionGroup[] };
export type LocationSuggestion = { kind: "state" | "district" | "pincode" | "address"; label: string; state: string; district?: string; pincode?: string; lat: number; lng: number };
type RegionFilters = { state?: string; district?: string; type?: PropertyType };
const regionResults = new Map<string, { data: RegionCounts; fetchedAt: number; generation: number }>();
export function cachedRegionCounts(filters: RegionFilters): RegionCounts | undefined {
  const cached = regionResults.get(searchKey(filters));
  return cached && cached.generation === searchGeneration && Date.now() - cached.fetchedAt < 300000
    ? cached.data : undefined;
}
export async function fetchRegionCounts(filters: RegionFilters, signal?: AbortSignal): Promise<RegionCounts> {
  const key = searchKey(filters);
  const cached = regionResults.get(key);
  if (cached && cached.generation === searchGeneration && Date.now() - cached.fetchedAt < 15000) return cached.data;
  const generation = searchGeneration;
  const data: RegionCounts = (await api.get("/properties/regions", { params: filters, signal })).data;
  if (generation === searchGeneration && !signal?.aborted) {
    regionResults.delete(key);
    regionResults.set(key, { data, fetchedAt: Date.now(), generation });
    if (regionResults.size > 20) regionResults.delete(regionResults.keys().next().value!);
  }
  return data;
}
export async function fetchLocationSuggestions(q: string, type?: PropertyType, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  return (await api.get("/properties/regions/suggest", { params: { q, type }, signal })).data;
}
