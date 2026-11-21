import React, { useEffect, useState } from "react";
import { Image, Platform, type ImageProps, type ImageURISource } from "react-native";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";

export interface PropertyImageProps extends ImageProps {
  isPublic?: boolean;
  thumbnailWidth?: number;
}

// In-memory cache for private blob URLs to prevent redundant network fetches
const blobCache = new Map<string, string>();

// Never send account credentials to externally hosted listing images.
export default function PropertyImage(props: PropertyImageProps) {
  const { isPublic, thumbnailWidth, source: rawSource, ...restProps } = props;
  const accessToken = useAuthStore(state => state.accessToken);
  const source = rawSource as ImageURISource | undefined;
  const originalUri = typeof source === "object" && !Array.isArray(source) ? source?.uri : undefined;

  // Append thumbnail width optimization query if applicable
  const uri = React.useMemo(() => {
    if (!originalUri) return undefined;
    if (thumbnailWidth && originalUri.includes("/property-photos/") && !originalUri.includes("w=")) {
      const sep = originalUri.includes("?") ? "&" : "?";
      return `${originalUri}${sep}w=${thumbnailWidth}`;
    }
    return originalUri;
  }, [originalUri, thumbnailWidth]);

  let protectedUri = false;
  try {
    const url = new URL(uri || "");
    protectedUri = url.origin === new URL(api.defaults.baseURL!).origin && url.pathname.startsWith("/property-photos/");
  } catch { /* Bundled images and external images need no authentication. */ }

  const cacheKey = uri && accessToken ? `${accessToken}\n${uri}` : undefined;
  const cachedBlob = cacheKey ? blobCache.get(cacheKey) : undefined;
  const [download, setDownload] = useState<{ key: string; blob: string }>();

  useEffect(() => {
    // If it's a public listing image, the browser/app can fetch directly without auth headers
    if (isPublic) return;
    if (Platform.OS !== "web" || !protectedUri || !uri || !cacheKey || cachedBlob) return;

    const controller = new AbortController();
    api.get(uri, { responseType: "blob", signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      const blob = URL.createObjectURL(response.data);
      blobCache.set(cacheKey, blob);
      setDownload({ key: cacheKey, blob });
    }).catch(() => {});

    return () => {
      controller.abort();
    };
  }, [uri, protectedUri, cacheKey, cachedBlob, isPublic]);

  // If public or unauthenticated, let browser render natively and leverage HTTP/disk caching
  if (isPublic || !protectedUri || !accessToken) {
    return <Image {...restProps} source={uri ? { ...source, uri } : rawSource} />;
  }

  if (Platform.OS === "web") {
    const activeBlob = download && download.key === cacheKey ? download.blob : cachedBlob;
    return <Image {...restProps} source={activeBlob ? { uri: activeBlob } : (uri ? { ...source, uri } : rawSource)} />;
  }

  return <Image {...restProps} source={{ ...source, uri, headers: { ...source?.headers, Authorization: `Bearer ${accessToken}` } }} />;
}
