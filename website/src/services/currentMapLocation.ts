import { Platform } from "react-native";
import * as Location from "expo-location";
import { validMapPoint, type MapPoint } from "../utils/nativeMapHtml";

// Called only from the user's expand-search gesture; never on page load.
export async function currentMapLocation(): Promise<MapPoint> {
  let coordinates: { latitude: number; longitude: number };
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) throw new Error("Location is unavailable in this browser. You can still search by district.");
    coordinates = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      () => reject(new Error("Location was unavailable or permission was denied. You can still search by district.")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    ));
  } else {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") throw new Error("Location permission was denied. You can still search by district.");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      coordinates = (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Location took too long. You can still search by district.")), 15000); }),
      ])).coords;
    } finally { clearTimeout(timeout); }
  }
  const point = { lat: coordinates.latitude, lng: coordinates.longitude };
  if (!validMapPoint(point)) throw new Error("Your location could not be determined. Search by district instead.");
  return point;
}
