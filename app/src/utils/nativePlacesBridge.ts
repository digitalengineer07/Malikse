// Run the same Google Maps browser SDK as the website in the map WebView.
type Method = 'fetchGooglePlaceSuggestions' | 'geocodePlaceId' | 'geocodeAddress';
type Request = { id: number; method: Method; value: string };
type Pending = { request: Request; resolve: (result: any) => void; timer: ReturnType<typeof setTimeout> };
let nextId = 0;
let transport: ((request: Request) => void) | undefined;
const pending = new Map<number, Pending>();

export function requestPlaceService<T>(method: Method, value: string, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); resolve(fallback); }, 18000);
    const request = { id, method, value };
    pending.set(id, { request, resolve: result => resolve(result ?? fallback), timer });
    transport?.(request);
  });
}

export function attachPlacesTransport(send: (request: Request) => void) {
  transport = send;
  pending.forEach(item => send(item.request));
  return () => { if (transport === send) transport = undefined; };
}

export function receivePlaceResult(id: number, result: unknown) {
  const item = pending.get(id);
  if (!item) return;
  clearTimeout(item.timer);
  pending.delete(id);
  item.resolve(result);
}
