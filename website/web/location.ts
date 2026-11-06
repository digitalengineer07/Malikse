export const Accuracy = { Balanced: 1, High: 2 };
export async function requestForegroundPermissionsAsync() {
 if (!navigator.geolocation) return {status: "unavailable", granted:false};
 try { const result = await navigator.permissions.query({name:"geolocation"}); if(result.state === "denied") return {status:"denied", granted:false}; } catch {}
 // getCurrentPosition triggers the browser's permission prompt from the user's action.
 return {status:"granted", granted:true};
}
export function getCurrentPositionAsync(options?: {accuracy?: number}): Promise<GeolocationPosition> {
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation) return reject(new Error("Geolocation is unavailable. Enter coordinates manually."));
  navigator.geolocation.getCurrentPosition(resolve,()=>reject(new Error("Location permission denied or location unavailable. Enter coordinates manually.")),{enableHighAccuracy:options?.accuracy === Accuracy.High,timeout:15000,maximumAge:60000});
 });
}
