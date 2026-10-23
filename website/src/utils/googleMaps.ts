/**
 * Google Maps Platform SDK Loader & Services
 * Uses EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 */

let googleMapsPromise: Promise<any> | null = null;

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== "undefined" && !!(window as any).google?.maps;
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in a browser environment"));
  }

  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not defined"));
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-js-sdk") as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps);
      } else {
        existing.addEventListener("load", () => resolve((window as any).google.maps));
        existing.addEventListener("error", (err) => reject(err));
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve((window as any).google?.maps);
    };
    script.onerror = (e) => {
      console.warn("Failed to load Google Maps JS SDK:", e);
      googleMapsPromise = null;
      reject(e);
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export interface GooglePlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

let autocompleteService: any = null;

export async function fetchGooglePlaceSuggestions(input: string): Promise<GooglePlaceSuggestion[]> {
  if (!input || input.trim().length < 2) return [];
  try {
    const maps = await loadGoogleMaps();
    if (!maps?.places?.AutocompleteService) return [];
    if (!autocompleteService) {
      autocompleteService = new maps.places.AutocompleteService();
    }
    return new Promise((resolve) => {
      autocompleteService.getPlacePredictions(
        {
          input: input.trim(),
          componentRestrictions: { country: "in" },
        },
        (predictions: any[], status: string) => {
          if (status !== maps.places.PlacesServiceStatus?.OK || !predictions) {
            resolve([]);
            return;
          }
          resolve(
            predictions.map((p) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || "",
            }))
          );
        }
      );
    });
  } catch {
    return [];
  }
}

let geocoderInstance: any = null;

export async function geocodePlaceId(
  placeId: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  try {
    const maps = await loadGoogleMaps();
    if (!geocoderInstance) {
      geocoderInstance = new maps.Geocoder();
    }
    return new Promise((resolve) => {
      geocoderInstance.geocode({ placeId }, (results: any[], status: string) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          resolve({
            lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
            lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
            formattedAddress: results[0].formatted_address,
          });
        } else {
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  if (!address || !address.trim()) return null;
  try {
    const maps = await loadGoogleMaps();
    if (!geocoderInstance) {
      geocoderInstance = new maps.Geocoder();
    }
    return new Promise((resolve) => {
      geocoderInstance.geocode(
        { address: address.trim(), componentRestrictions: { country: "in" } },
        (results: any[], status: string) => {
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            resolve({
              lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
              lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
              formattedAddress: results[0].formatted_address,
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch {
    return null;
  }
}
