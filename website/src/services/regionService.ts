import api from "./authService";
import type { PropertyType } from "../types/property.types";
import { fetchGooglePlaceSuggestions } from "../utils/googleMaps";

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
  const backendPromise = api
    .get("/properties/regions/suggest", { params: { q, type }, signal })
    .then((res) => (Array.isArray(res.data) ? (res.data as LocationSuggestion[]) : []))
    .catch(() => [] as LocationSuggestion[]);

  const googlePromise = fetchGooglePlaceSuggestions(q)
    .then((places) =>
      places.slice(0, 4).map((p) => ({
        kind: "address" as const,
        label: p.description,
        state: "India",
        placeId: p.placeId,
        lat: 0,
        lng: 0,
      }))
    )
    .catch(() => [] as LocationSuggestion[]);

  const [backendList, googleList] = await Promise.all([backendPromise, googlePromise]);
  return [...backendList, ...googleList];
}
