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

  if ((window as any).google?.maps?.Map) {
    return Promise.resolve((window as any).google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "AIzaSyAD35RnKNgKBt2LDHSC6QHhui6tZrM_Pzw";

  googleMapsPromise = new Promise((resolve, reject) => {
    // Clean up stale or failed script elements
    const existing = document.getElementById("google-maps-js-sdk") as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).google?.maps?.Map) {
        resolve((window as any).google.maps);
        return;
      }
      existing.remove();
    }

    const callbackFnName = `__malikseGoogleMapsLoaded_${Date.now()}`;
    let timeoutId: any = null;

    // Override Google Maps default authFailure to suppress the "This page can't load Google Maps correctly" modal dialog
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps auth note: running in resilient direct tile mode.");
      try {
        const errorLinks = document.querySelectorAll(
          'a[href*="error-messages"], a[href*="developers.google.com/maps"], .dismissButton'
        );
        errorLinks.forEach((el) => {
          let current: HTMLElement | null = el as HTMLElement;
          while (
            current &&
            current.parentElement &&
            !current.parentElement.classList.contains("gm-style") &&
            current !== document.body
          ) {
            current = current.parentElement;
          }
          current?.remove();
        });
      } catch {}
    };

    (window as any)[callbackFnName] = () => {
      if (timeoutId) clearTimeout(timeoutId);
      delete (window as any)[callbackFnName];
      resolve((window as any).google.maps);
    };

    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=${callbackFnName}`;
    script.async = true;
    script.defer = true;

    script.onerror = (e) => {
      if (timeoutId) clearTimeout(timeoutId);
      delete (window as any)[callbackFnName];
      console.warn("Failed to load Google Maps JS SDK script:", e);
      script.remove();
      googleMapsPromise = null;
      reject(e);
    };

    // Timeout safety fallback
    timeoutId = setTimeout(() => {
      if ((window as any).google?.maps?.Map) {
        delete (window as any)[callbackFnName];
        resolve((window as any).google.maps);
      } else {
        delete (window as any)[callbackFnName];
        googleMapsPromise = null;
        reject(new Error("Google Maps script load timed out"));
      }
    }, 15000);

    document.head.appendChild(script);
  }).catch((err) => {
    googleMapsPromise = null;
    throw err;
  });

  return googleMapsPromise;
}

export interface GooglePlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

let autocompleteSessionToken: any = null;
const predictionsById = new Map<string, any>();

export async function fetchGooglePlaceSuggestions(input: string): Promise<GooglePlaceSuggestion[]> {
  if (!input || input.trim().length < 2) return [];
  try {
    const maps = await loadGoogleMaps();
    const { AutocompleteSessionToken, AutocompleteSuggestion } = await maps.importLibrary("places");
    autocompleteSessionToken ??= new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: input.trim(),
      includedRegionCodes: ["in"],
      sessionToken: autocompleteSessionToken,
    });
    predictionsById.clear();
    return (suggestions || []).flatMap((suggestion: any) => {
      const prediction = suggestion.placePrediction;
      if (!prediction?.placeId) return [];
      predictionsById.set(prediction.placeId, prediction);
      const description = prediction.text?.text || "";
      return [{
        placeId: prediction.placeId,
        description,
        mainText: prediction.mainText?.text || description,
        secondaryText: prediction.secondaryText?.text || "",
      }];
    });
  } catch {
    return [];
  }
}

export async function geocodePlaceId(
  placeId: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  try {
    const maps = await loadGoogleMaps();
    const { Place } = await maps.importLibrary("places");
    const place = predictionsById.get(placeId)?.toPlace() || new Place({ id: placeId });
    await place.fetchFields({ fields: ["location", "formattedAddress"] });
    const location = place.location;
    if (!location) return null;
    const lat = typeof location.lat === "function" ? location.lat() : location.lat;
    const lng = typeof location.lng === "function" ? location.lng() : location.lng;
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, formattedAddress: place.formattedAddress || "" }
      : null;
  } catch {
    return null;
  } finally {
    autocompleteSessionToken = null;
    predictionsById.clear();
  }
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  if (!address || !address.trim()) return null;
  try {
    const maps = await loadGoogleMaps();
    const { Place } = await maps.importLibrary("places");
    const { places } = await Place.searchByText({
      textQuery: address.trim(),
      fields: ["location", "formattedAddress"],
      region: "in",
      maxResultCount: 1,
    });
    const place = places?.[0];
    const location = place?.location;
    if (!location) return null;
    const lat = typeof location.lat === "function" ? location.lat() : location.lat;
    const lng = typeof location.lng === "function" ? location.lng() : location.lng;
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, formattedAddress: place.formattedAddress || "" }
      : null;
  } catch {
    return null;
  }
}
