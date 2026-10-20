/** Older records used HTTP for our host, which Android release builds block. */
export function normalizePropertyMedia<T extends { media?: { photos?: string[]; videos?: string[] } }>(property: T): T {
  const secure = (url: string) => url.replace(/^http:\/\/malikse\.onrender\.com(?=\/|$)/i, "https://malikse.onrender.com");
  if (property?.media?.photos) property.media.photos = property.media.photos.map(secure);
  if (property?.media?.videos) property.media.videos = property.media.videos.map(secure);
  return property;
}
