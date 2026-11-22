import { preloadMapAssets } from './mapAssets';

// Property and region data load when their screens are opened.
export async function preloadStartupResources() {
  await preloadMapAssets().catch(() => {});
}
