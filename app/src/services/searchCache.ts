import type { Property, PropertySearchFilters } from "../types/property.types";
export const searchResults = new Map<string, { items: Property[]; expires: number }>();
export const pendingSearches = new Map<string, Promise<Property[]>>();
export let searchGeneration = 0;
export const searchKey = (filters: PropertySearchFilters) => JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))));
export function invalidatePropertySearch() { searchGeneration++; searchResults.clear(); pendingSearches.clear(); }
