import { requestPlaceService } from './nativePlacesBridge';
import type { GooglePlaceSuggestion } from './googleMaps';

type GeocodeResult = { lat: number; lng: number; formattedAddress: string };
export function fetchGooglePlaceSuggestions(input: string): Promise<GooglePlaceSuggestion[]> {
  if (input.trim().length < 2) return Promise.resolve([]);
  return requestPlaceService('fetchGooglePlaceSuggestions', input, []);
}
export function geocodePlaceId(placeId: string): Promise<GeocodeResult | null> {
  return requestPlaceService('geocodePlaceId', placeId, null);
}
export function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address.trim()) return Promise.resolve(null);
  return requestPlaceService('geocodeAddress', address, null);
}
