import { Image } from 'react-native';
import { preloadMapAssets } from './mapAssets';
import { propertyService } from './propertyService';
import { fetchRegionCounts } from './regionService';

// Public data only. Keep failures isolated so offline startup and login still work.
export async function preloadStartupResources() {
  await Promise.allSettled([
    preloadMapAssets(),
    fetchRegionCounts({ state: 'Bihar' }),
    propertyService.searchProperties({ state: 'Bihar', limit: 50, view: 'full' }),
    propertyService.searchProperties({ limit: 50 }).then(async properties => {
      const photos = properties.slice(0, 6).map(property => property.media?.photos?.[0]).filter((url): url is string => !!url && /^https?:\/\//.test(url));
      await Promise.allSettled(photos.map(url => Image.prefetch(url)));
    }),
  ]);
}
