const DEFAULT_WEBSITE_URL = "https://malikse.com";

/** Resolve the configured MalikSe website origin and optional path without duplicate slashes. */
export function websiteUrl(path = ""): string {
  const base = (process.env.EXPO_PUBLIC_WEBSITE_URL || DEFAULT_WEBSITE_URL).replace(/\/+$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
