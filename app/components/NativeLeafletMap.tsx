import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { nativeMapHtml, validMapPoint, type NativeMapOptions, type MapPoint, type MapFocus } from "../src/utils/nativeMapHtml";

export default function NativeLeafletMap({ options, focus, onSelect, onPoints }: { options: NativeMapOptions; focus?: MapFocus; onSelect?: (id: string) => void; onPoints?: (points: MapPoint[]) => void }) {
  const html = useMemo(() => nativeMapHtml(options), [options]);
  const [attempt, setAttempt] = useState(0);
  return <NativeMapContent key={html + attempt} html={html} options={options} focus={focus} onSelect={onSelect} onPoints={onPoints} retry={() => setAttempt(value => value + 1)} />;
}
function NativeMapContent({ html, options, focus, onSelect, onPoints, retry }: { html: string; options: NativeMapOptions; focus?: MapFocus; onSelect?: (id: string) => void; onPoints?: (points: MapPoint[]) => void; retry: () => void }) {
  const webview = useRef<WebView>(null);
  const source = useMemo(() => ({ html, baseUrl: "https://malikse.local/" }), [html]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [boundaryError, setBoundaryError] = useState(false);
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
        if (request.url.startsWith("https://www.openstreetmap.org/") || request.url.startsWith("https://indianopenmaps.com/")) Linking.openURL(request.url).catch(() => {});
        return false;
      }}
      onError={() => setStatus("error")} onHttpError={({ nativeEvent }) => {
        // Android also reports failed subresources here; one failed tile must not hide the map.
        if (nativeEvent.url === source.baseUrl) setStatus("error");
      }} onContentProcessDidTerminate={() => setStatus("error")} onRenderProcessGone={() => setStatus("error")}
      onMessage={({ nativeEvent }) => {
        try {
          const message = JSON.parse(nativeEvent.data);
          if (message.type === "ready") setStatus("ready");
          else if (message.type === "error") setStatus("error");
          else if (message.type === "boundaryError") setBoundaryError(true);
          else if (message.type === "select" && typeof message.payload === "string" && (options.pins?.some(pin => pin.id === message.payload) || options.regions?.groups.some(group => group.key === message.payload))) onSelect?.(message.payload);
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
