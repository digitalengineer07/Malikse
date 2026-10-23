import api from "./authService";
import type { PropertyType } from "../types/property.types";
import { fetchGooglePlaceSuggestions } from "../utils/googleMaps";
import { BIHAR_DISTRICTS_DATA } from "../data/biharDistrictsData";

export type RegionGroup = { key: string; name: string; count: number; lat: number; lng: number };
export type RegionCounts = { level: "state" | "district" | "pincode"; groups: RegionGroup[] };
export type LocationSuggestion = {
  kind: "state" | "district" | "pincode" | "address";
  label: string;
  state: string;
  district?: string;
  pincode?: string;
  lat: number;
  lng: number;
  placeId?: string;
};

export async function fetchRegionCounts(
  filters: { state?: string; district?: string; type?: PropertyType },
  signal?: AbortSignal
): Promise<RegionCounts> {
  return (await api.get("/properties/regions", { params: filters, signal })).data;
}

export async function fetchLocationSuggestions(
  q: string,
  type?: PropertyType,
  signal?: AbortSignal
): Promise<LocationSuggestion[]> {
  const term = q.trim().toLowerCase();
  if (!term || term.length < 2) return [];

  // 1. Instant local matching for Bihar districts & prominent economic corridors
  const districtMatches: LocationSuggestion[] = [];
  for (const d of BIHAR_DISTRICTS_DATA) {
    const matchesName = d.name.toLowerCase().includes(term);
    const matchesHQ = d.headquarters.toLowerCase().includes(term);
    const matchesHub = d.prominentHubs.toLowerCase().includes(term);
    if (matchesName || matchesHQ || matchesHub) {
      districtMatches.push({
        kind: "district",
        label: `${d.name}, Bihar`,
        state: "Bihar",
        district: d.name,
        lat: d.lat,
        lng: d.lng,
      });
    }
  }

  // 2. Query MongoDB backend for verified property titles, blocks, mauzas and pincodes
  const backendPromise = api
    .get("/properties/regions/suggest", { params: { q, type }, signal })
    .then((res) => (Array.isArray(res.data) ? (res.data as LocationSuggestion[]) : []))
    .catch(() => [] as LocationSuggestion[]);

  // 3. Query Google Places API for real-world landmark & place predictions
  const googlePromise = fetchGooglePlaceSuggestions(q)
    .then((places) =>
      places.slice(0, 5).map((p) => ({
        kind: "address" as const,
        label: p.description,
        state: "Bihar",
        placeId: p.placeId,
        lat: 0,
        lng: 0,
      }))
    )
    .catch(() => [] as LocationSuggestion[]);

  const [backendList, googleList] = await Promise.all([backendPromise, googlePromise]);

  // Combine and deduplicate
  const seen = new Set<string>();
  const results: LocationSuggestion[] = [];

  for (const item of [...districtMatches, ...backendList, ...googleList]) {
    const key = item.label.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(item);
    }
    if (results.length >= 8) break;
  }

  return results;
}
