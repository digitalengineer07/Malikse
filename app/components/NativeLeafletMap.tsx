import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { nativeMapHtml, validMapPoint, type NativeMapOptions, type MapPoint, type MapFocus } from "../src/utils/nativeMapHtml";
import { attachPlacesTransport, receivePlaceResult } from "../src/utils/nativePlacesBridge";
import { currentMapLocation } from "../src/services/currentMapLocation";
import { cachedMapAssets, preloadMapAssets } from "../src/services/mapAssets";

export default function NativeLeafletMap({ options, focus, onSelect, onPoints }: { options: NativeMapOptions; focus?: MapFocus; onSelect?: (id: string) => void; onPoints?: (points: MapPoint[]) => void }) {
  const [assets, setAssets] = useState(cachedMapAssets);
  const [assetsReady, setAssetsReady] = useState(!!assets);
  useEffect(() => {
    let active = true;
    preloadMapAssets().then(value => { if (active) setAssets(value); }).catch(() => {}).finally(() => { if (active) setAssetsReady(true); });
    return () => { active = false; };
  }, []);
  // Region data and camera changes use the bridge, not a new browser document.
  const documentKey = JSON.stringify(options.regions
    ? { ...options, focus: undefined, pins: [], parcels: [], regions: { groups: [], level: "state" } }
    : options);
  const html = useMemo(() => nativeMapHtml(JSON.parse(documentKey), assets), [documentKey, assets]);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setAssetsReady(false);
    preloadMapAssets().then(setAssets).catch(() => {}).finally(() => { setAssetsReady(true); setAttempt(value => value + 1); });
  }, []);
  if (!assetsReady) return <View style={styles.container}><View style={styles.overlay}><ActivityIndicator color="#1A365D" /><Text style={styles.text}>Preparing map…</Text></View></View>;
  if (!assets) return <View style={styles.container}><View style={styles.overlay}><Text style={styles.text}>Map files could not download. Check your connection and try again.</Text><TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={retry}><Text style={styles.retryText}>Retry map</Text></TouchableOpacity></View></View>;
  return <NativeMapContent key={html + attempt} html={html} options={options} focus={focus ?? options.focus} onSelect={onSelect} onPoints={onPoints} retry={retry} />;
}
function NativeMapContent({ html, options, focus, onSelect, onPoints, retry }: { html: string; options: NativeMapOptions; focus?: MapFocus; onSelect?: (id: string) => void; onPoints?: (points: MapPoint[]) => void; retry: () => void }) {
  const webview = useRef<WebView>(null);
  const source = useMemo(() => ({ html, baseUrl: "https://malikse.local/" }), [html]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [boundaryError, setBoundaryError] = useState(false);
  const processGone = useRef(false);
  const recoverProcess = () => {
    processGone.current = true;
    if (AppState.currentState === "active") retry();
  };
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active" && processGone.current) retry();
    });
    return () => subscription.remove();
  }, [retry]);
  const regionsJson = JSON.stringify(options.regions);
  const [previousRegions, setPreviousRegions] = useState(regionsJson);
  if (previousRegions !== regionsJson) { setPreviousRegions(regionsJson); setBoundaryError(false); }
  const propertiesJson = JSON.stringify({ pins: options.pins?.filter(validMapPoint) ?? [], parcels: options.parcels ?? [] });
  useEffect(() => {
    if (status !== "ready" || !options.regions) return;
    webview.current?.injectJavaScript(`(function(){const data=${propertiesJson.replace(/</g, "\\u003c")};window.updatePropertyData(data.pins,data.parcels);})();true;`);
  }, [propertiesJson, status, options.regions]);
  useEffect(() => {
    if (status !== "ready" || !options.marketplace) return;
    return attachPlacesTransport(request => {
      webview.current?.injectJavaScript(`window.runPlaceRequest(${JSON.stringify(request).replace(/</g, "\\u003c")});true;`);
    });
  }, [status, options.marketplace]);
  useEffect(() => {
    if (status !== "ready" || !regionsJson) return;
    webview.current?.injectJavaScript(`window.updateRegions && window.updateRegions(${regionsJson.replace(/</g, "\\u003c")}); true;`);
  }, [regionsJson, status]);
  useEffect(() => {
    if (status === "ready" && focus && validMapPoint(focus) && Number.isFinite(focus.zoom)) {
      webview.current?.injectJavaScript(`window.focusMap && window.focusMap(${focus.lat},${focus.lng},${Math.max(1, Math.min(19, focus.zoom))}); true;`);
    }
  }, [focus, status]);
  useEffect(() => {
    const timeout = setTimeout(() => setStatus(current => current === "loading" ? "error" : current), 20000);
    return () => clearTimeout(timeout);
  }, []);
  return <View style={styles.container}>
    <WebView ref={webview} source={source} originWhitelist={["*"]} javaScriptEnabled scrollEnabled={false} nestedScrollEnabled style={styles.webview}
      onShouldStartLoadWithRequest={request => {
        if (request.url === "about:blank" || request.url === "https://malikse.local/") return true;
        if (request.url.startsWith("https://www.openstreetmap.org/") || request.url.startsWith("https://indianopenmaps.com/") || request.url === "https://maps.google.com/") Linking.openURL(request.url).catch(() => {});
        return false;
      }}
      onError={() => setStatus("error")} onHttpError={({ nativeEvent }) => {
        // Android also reports failed subresources here; one failed tile must not hide the map.
        if (nativeEvent.url === source.baseUrl) setStatus("error");
      }} onContentProcessDidTerminate={recoverProcess} onRenderProcessGone={recoverProcess}
      onMessage={({ nativeEvent }) => {
        try {
          const message = JSON.parse(nativeEvent.data);
          if (message.type === "ready") setStatus("ready");
          else if (message.type === "error") setStatus("error");
          else if (message.type === "boundaryError") setBoundaryError(true);
          else if (message.type === "placeResult" && options.marketplace && typeof message.payload?.id === "number") receivePlaceResult(message.payload.id, message.payload.result);
          else if (message.type === "locate" && options.marketplace) {
            currentMapLocation().then(point => {
              webview.current?.injectJavaScript(`window.focusMap(${point.lat},${point.lng},12);true;`);
            }).catch(() => {
              webview.current?.injectJavaScript("alert('Could not get your location. Check location permissions and try again.');true;");
            });
          }
          else if (message.type === "select" && typeof message.payload === "string" && (options.pins?.some(pin => pin.id === message.payload) || options.parcels?.some(parcel => parcel.id === message.payload) || options.regions?.groups.some(group => group.key === message.payload))) onSelect?.(message.payload);
          else if (message.type === "points" && options.editable && Array.isArray(message.payload) && message.payload.every(validMapPoint)) onPoints?.(message.payload);
        } catch { /* Ignore invalid bridge messages. */ }
      }} />
    {boundaryError && <Text accessibilityRole="alert" style={styles.text}>Boundaries could not load. Search for an area above.</Text>}
    {status !== "ready" && <View style={styles.overlay}>
      {status === "loading" ? <><ActivityIndicator color="#1A365D" /><Text style={styles.text}>Loading map…</Text></> : <><Text style={styles.text}>Map could not load. Check your internet connection and try again.</Text><TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={retry}><Text style={styles.retryText}>Retry map</Text></TouchableOpacity></>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", overflow: "hidden", backgroundColor: "#E9F3FA" },
  webview: { flex: 1, backgroundColor: "#E9F3FA" },
  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#E9F3FA" },
  text: { color: "#284B68", textAlign: "center", lineHeight: 22 },
  retry: { padding: 13, borderRadius: 22, backgroundColor: "#1A365D" }, retryText: { color: "white", fontWeight: "600" },
});
