import { Platform } from "react-native";
import * as Location from "expo-location";
import { validMapPoint, type MapPoint } from "../utils/nativeMapHtml";

export class LocationPermissionBlocked extends Error {
  constructor() { super("Allow location access in app settings, then try again."); }
}

// Called from an explicit location action.
export async function currentMapLocation({ allowRecent = false } = {}): Promise<MapPoint> {
  let coordinates: { latitude: number; longitude: number };
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) throw new Error("Location is unavailable in this browser. You can still search by district.");
    coordinates = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      error => reject(new Error(error.code === 1
        ? "Allow location access for this site, then try again."
        : "Couldn’t get your location. Check your device’s location settings or search by area.")),
      { enableHighAccuracy: false, timeout: 30000, maximumAge: allowRecent ? 120000 : 0 },
    ));
  } else {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted && !permission.canAskAgain) throw new LocationPermissionBlocked();
    if (permission.status !== "granted") throw new Error("Location permission was denied. You can still search by district.");
    if (!await Location.hasServicesEnabledAsync()) {
      throw new Error("Turn on Location in your phone’s settings, then try again.");
    }
    if (allowRecent) {
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 1500 }).catch(() => null);
      const point = cached && { lat: cached.coords.latitude, lng: cached.coords.longitude };
      if (point && validMapPoint(point)) return point;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      coordinates = (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: true })
          .catch(() => { throw new Error("Couldn’t get your location. Check your phone’s location settings, then try again."); }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Your phone couldn’t get a location fix. Try again near a window or search by area.")), 30000); }),
      ])).coords;
    } finally { clearTimeout(timeout); }
  }
  const point = { lat: coordinates.latitude, lng: coordinates.longitude };
  if (!validMapPoint(point)) throw new Error("Your location could not be determined. Search by district instead.");
  return point;
}
