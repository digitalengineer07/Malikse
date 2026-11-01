import React, { useEffect, useState } from "react";
import { Image, Platform, type ImageProps, type ImageURISource } from "react-native";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";

// Never send account credentials to externally hosted listing images.
export default function PropertyImage(props: ImageProps) {
  const accessToken = useAuthStore(state => state.accessToken);
  const source = props.source as ImageURISource | undefined;
  const uri = typeof source === "object" && !Array.isArray(source) ? source?.uri : undefined;
  let protectedUri = false;
  try {
    const url = new URL(uri || "");
    protectedUri = url.origin === new URL(api.defaults.baseURL!).origin && url.pathname.startsWith("/property-photos/");
  } catch { /* Bundled images and external images need no authentication. */ }
  const [download, setDownload] = useState<{ uri: string; token: string | null; blob: string }>();
  useEffect(() => {
    if (Platform.OS !== "web" || !protectedUri || !uri || !accessToken) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    api.get(uri, { responseType: "blob", signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(response.data);
      setDownload({ uri, token: accessToken, blob: objectUrl });
    }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [uri, protectedUri, accessToken]);
  if (!protectedUri || !accessToken) return <Image {...props} />;
  if (Platform.OS === "web") return <Image {...props} source={download && download.uri === uri && download.token === accessToken ? { uri: download.blob } : undefined} />;
  return <Image {...props} source={{ ...source, headers: { ...source?.headers, Authorization: `Bearer ${accessToken}` } }} />;
}
