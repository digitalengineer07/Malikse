import React, { useEffect, useState } from "react";
import { Image, Platform, type ImageProps, type ImageSourcePropType, type ImageURISource } from "react-native";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";

export interface PropertyImageProps extends ImageProps {
  isPublic?: boolean;
  thumbnailWidth?: number;
  fallbackSource?: ImageSourcePropType;
}

// In-memory cache for private blob URLs to prevent redundant network fetches
const blobCache = new Map<string, string>();

// Never send account credentials to externally hosted listing images.
export default function PropertyImage(props: PropertyImageProps) {
  const { isPublic, thumbnailWidth, fallbackSource, source: rawSource, onError, ...restProps } = props;
  const accessToken = useAuthStore(state => state.accessToken);
  const source = rawSource as ImageURISource | undefined;
  const originalUri = typeof source === "object" && !Array.isArray(source) ? source?.uri : undefined;
  const [failedUri, setFailedUri] = useState<string | null>(null);

  // Append thumbnail width optimization query if applicable
  const optimizedUri = React.useMemo(() => {
    if (!originalUri) return undefined;
    if (thumbnailWidth && originalUri.includes("/property-photos/") && !originalUri.includes("w=")) {
      const sep = originalUri.includes("?") ? "&" : "?";
      return `${originalUri}${sep}w=${thumbnailWidth}`;
    }
    return originalUri;
  }, [originalUri, thumbnailWidth]);

  const usingFallback = Boolean(optimizedUri && failedUri === optimizedUri && fallbackSource);
  const uri = usingFallback ? undefined : optimizedUri;

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
    if (isPublic || usingFallback) return;
    if (Platform.OS !== "web" || !protectedUri || !uri || !cacheKey || cachedBlob) return;

    const controller = new AbortController();
    api.get(uri, { responseType: "blob", signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      const blob = URL.createObjectURL(response.data);
      blobCache.set(cacheKey, blob);
      setDownload({ key: cacheKey, blob });
    }).catch(() => {
      if (!controller.signal.aborted && fallbackSource) {
        setFailedUri(uri);
      }
    });

    return () => {
      controller.abort();
    };
  }, [uri, protectedUri, cacheKey, cachedBlob, isPublic, usingFallback, fallbackSource]);

  const handleError = (event: any) => {
    if (optimizedUri && fallbackSource && !usingFallback) {
      setFailedUri(optimizedUri);
    }
    onError?.(event);
  };

  if (usingFallback && fallbackSource) {
    return <Image {...restProps} onError={handleError} source={fallbackSource} />;
  }

  // If public or unauthenticated, let browser/app render natively and leverage HTTP/disk caching
  if (isPublic || !protectedUri || !accessToken) {
    return <Image {...restProps} onError={handleError} source={uri ? { ...source, uri } : (rawSource || fallbackSource)} />;
  }

  if (Platform.OS === "web") {
    const activeBlob = download && download.key === cacheKey ? download.blob : cachedBlob;
    return <Image {...restProps} onError={handleError} source={activeBlob ? { uri: activeBlob } : fallbackSource} />;
  }

  return (
    <Image
      {...restProps}
      onError={handleError}
      source={{ ...source, uri, headers: { ...source?.headers, Authorization: `Bearer ${accessToken}` } }}
    />
  );
}
