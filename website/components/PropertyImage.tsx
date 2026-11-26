import React, { useEffect, useState } from "react";
import { Image, Platform, type ImageProps, type ImageURISource } from "react-native";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";

export interface PropertyImageProps extends ImageProps {
  isPublic?: boolean;
  thumbnailWidth?: number;
  fallbackUri?: string;
}

// Never send account credentials to externally hosted listing images.
export default function PropertyImage(props: PropertyImageProps) {
  const { isPublic, thumbnailWidth, fallbackUri, source: rawSource, onError, ...restProps } = props;
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

  const usingFallback = Boolean(optimizedUri && failedUri === optimizedUri && fallbackUri);
  const uri = usingFallback ? fallbackUri : (optimizedUri || fallbackUri);

  let protectedUri = false;
  try {
    const url = new URL(uri || "");
    const base = api.defaults.baseURL || (typeof window !== "undefined" ? window.location.origin : "https://malikseserver.devoxa.in");
    protectedUri = url.origin === new URL(base, typeof window !== "undefined" ? window.location.origin : undefined).origin && url.pathname.startsWith("/property-photos/");
  } catch { /* Bundled images and external images need no authentication. */ }

  const [download, setDownload] = useState<{ uri: string; token: string; blob: string }>();

  useEffect(() => {
    // If it's a public listing image, the browser can fetch directly without auth headers
    if (isPublic || usingFallback) return;
    if (Platform.OS !== "web" || !protectedUri || !uri || !accessToken) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    api.get(uri, { responseType: "blob", signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(response.data);
      setDownload({ uri, token: accessToken, blob: objectUrl });
    }).catch(() => {
      if (!controller.signal.aborted && fallbackUri) {
        setFailedUri(uri);
      }
    });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri, protectedUri, accessToken, isPublic, usingFallback, fallbackUri]);

  const handleError = (event: any) => {
    if (optimizedUri && fallbackUri && !usingFallback && optimizedUri !== fallbackUri) {
      setFailedUri(optimizedUri);
    }
    onError?.(event);
  };

  // If public, unauthenticated, or fallen back to local asset, render natively with HTTP/disk caching
  if (isPublic || usingFallback || !protectedUri || !accessToken) {
    return (
      <Image
        {...restProps}
        onError={handleError}
        source={uri ? { ...(typeof source === "object" && !Array.isArray(source) ? source : {}), uri } : rawSource}
      />
    );
  }

  if (Platform.OS === "web") {
    const activeBlob = download?.uri === uri && download?.token === accessToken ? download?.blob : undefined;
    const webSource = activeBlob ? { uri: activeBlob } : (fallbackUri ? { uri: fallbackUri } : undefined);
    return <Image {...restProps} onError={handleError} source={webSource} />;
  }

  return (
    <Image
      {...restProps}
      onError={handleError}
      source={{ ...source, uri, headers: { ...source?.headers, Authorization: `Bearer ${accessToken}` } }}
    />
  );
}
