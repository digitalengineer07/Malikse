import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import type { NativeMapAssets } from '../utils/nativeMapHtml';

// Pin executable map libraries so a changed CDN response is never cached as code.
const resources = {
  leafletJs: { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', hash: 'db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a' },
  leafletCss: { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', hash: 'a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6' },
  vectorGridJs: { url: 'https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js', hash: 'ed1e89e4c9582593890d0e869d03ed7a4ab56f511c6d2036392d6d50938aa4d5' },
};
let cached: NativeMapAssets | undefined;
let pending: Promise<NativeMapAssets> | undefined;
export const cachedMapAssets = () => cached;

async function readResource(name: string, resource: { url: string; hash: string }): Promise<string> {
  const directory = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}map-assets/` : undefined;
  const file = directory ? `${directory}${name}-${resource.hash}.txt` : undefined;
  const valid = async (text: string) => (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text)) === resource.hash;
  if (file) {
    try {
      const text = await FileSystem.readAsStringAsync(file);
      if (await valid(text)) return text;
    } catch { /* Missing or incomplete cache: retry the download. */ }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let text: string;
  try {
    const response = await fetch(resource.url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Map resource download failed (${response.status})`);
    text = await response.text();
    if (!(await valid(text))) throw new Error('Map resource integrity check failed');
  } finally {
    clearTimeout(timeout);
  }
  if (file && directory) {
    try {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      await FileSystem.writeAsStringAsync(file, text);
    } catch { /* A full disk must not prevent the map from using verified data in memory. */ }
  }
  return text;
}

export function preloadMapAssets(): Promise<NativeMapAssets> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = Promise.all(Object.entries(resources).map(async ([name, resource]) => [name, await readResource(name, resource)] as const))
    .then(entries => {
      cached = Object.fromEntries(entries) as NativeMapAssets;
      return cached;
    }).finally(() => { pending = undefined; });
  return pending;
}
