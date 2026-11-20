import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";
import { validMapPoint, type MapFocus, type MapPoint } from "../src/utils/nativeMapHtml";

type Props = {
  points: MapPoint[];
  location?: MapPoint;
  focus?: MapFocus;
  active: boolean;
  mode: "pin" | "boundary";
  zoomRequest?: { delta: number };
  onPoints: (points: MapPoint[]) => void;
  onPin: (point: MapPoint) => void;
};

const toCoordinate = ({ lat, lng }: MapPoint): LatLng => ({ latitude: lat, longitude: lng });
const fromCoordinate = ({ latitude, longitude }: LatLng): MapPoint => ({ lat: latitude, lng: longitude });

export default function GoogleParcelMap({ points, location, focus, active, mode, zoomRequest, onPoints, onPin }: Props) {
  const map = useRef<MapView>(null);
  const [initialCamera] = useState(() => ({
    center: toCoordinate(focus ?? location ?? points[0] ?? { lat: 25.6, lng: 85.1 }),
    zoom: focus?.zoom ?? (location || points.length ? 17 : 7),
    pitch: 0,
    heading: 0,
  }));
  const zoom = useRef(initialCamera.zoom);
  const [ready, setReady] = useState(false);
  const lastZoomRequest = useRef<NonNullable<Props["zoomRequest"]>>(undefined);
  useEffect(() => {
    if (!ready || !focus || !validMapPoint(focus)) return;
    zoom.current = focus.zoom;
    map.current?.animateCamera({ center: toCoordinate(focus), zoom: focus.zoom }, { duration: 240 });
  }, [focus, ready]);
  useEffect(() => {
    if (!ready || !zoomRequest || zoomRequest === lastZoomRequest.current) return;
    lastZoomRequest.current = zoomRequest;
    zoom.current = Math.max(3, Math.min(20, zoom.current + zoomRequest.delta));
    map.current?.animateCamera({ zoom: zoom.current }, { duration: 180 });
  }, [ready, zoomRequest]);
  const coordinates = points.map(toCoordinate);
  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_GOOGLE}
      mapType="satellite"
      initialCamera={initialCamera}
      onMapReady={() => setReady(true)}
      scrollEnabled={active}
      zoomEnabled={false}
      zoomControlEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      onPress={({ nativeEvent }) => {
        if (!active || nativeEvent.action === "marker-press") return;
        const point = fromCoordinate(nativeEvent.coordinate);
        if (mode === "pin") onPin(point);
        else if (points.length < 500) onPoints([...points, point]);
      }}
    >
      {location && <Marker coordinate={toCoordinate(location)} pinColor="#FCC61C" title="Property location" />}
      {points.length >= 3 ? (
        <Polygon coordinates={coordinates} strokeColor="#059669" fillColor="rgba(5,150,105,0.25)" strokeWidth={3} />
      ) : points.length === 2 ? <Polyline coordinates={coordinates} strokeColor="#059669" strokeWidth={3} /> : null}
      {points.map((point, index) => (
        <Marker key={index} coordinate={toCoordinate(point)} anchor={{ x: 0.5, y: 0.5 }} draggable={active && mode === "boundary"}
          onDragEnd={({ nativeEvent }) => onPoints(points.map((previous, i) => i === index ? fromCoordinate(nativeEvent.coordinate) : previous))}>
          <View collapsable={false} style={styles.corner} />
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  corner: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: "#059669", backgroundColor: "#fff" },
});
