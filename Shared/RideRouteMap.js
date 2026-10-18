import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { canRenderNativeMap, MAP_UNAVAILABLE_MESSAGE } from "../assets/common/mapsConfiguration";
import { rideRequest, rideStopPoint, rideDirectionsUrl } from "../assets/common/rides";

const EDGE_PADDING = { top: 50, right: 40, bottom: 40, left: 40 };

const RideRouteMap = ({ ride, driverLocation, distanceUnit = "km", routeEndpoint, routeVersion, startAtDriver = false, fullScreen = false, bottomInset = 0, onSelectLocation, selectionDisabled = false }) => {
  const mapRef = useRef(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const stops = useMemo(() => (ride?.stops || []).map((stop, index) => ({
    stop, index, point: rideStopPoint(stop),
  })), [ride?.stops]);
  const located = stops.filter((entry) => entry.point);

  useEffect(() => {
    setRoute(null); setError(""); setLoading(false);
    if (!ride?._id) return undefined;
    let active = true;
    setLoading(true);
    rideRequest(routeEndpoint || `${ride._id}/route`, { timeout: 60000 })
      .then((path) => { if (active) setRoute(path); })
      .catch((failure) => {
        if (active) setError(failure.response?.data?.message || failure.message || "Driving route unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ride?._id, routeEndpoint, routeVersion, retry]);

  const fit = () => {
    const points = [...(route?.coordinates || []), ...located.map((entry) => entry.point), ...(driverLocation ? [driverLocation] : [])];
    if (mapReady && points.length) mapRef.current?.fitToCoordinates(points, {
      edgePadding: fullScreen ? { ...EDGE_PADDING, top: 190, bottom: Math.max(50, bottomInset + 20) } : EDGE_PADDING,
      animated: false,
    });
  };
  useEffect(fit, [mapReady, route, driverLocation, ride?.stops, bottomInset]);

  const openDirections = async () => {
    const url = rideDirectionsUrl(startAtDriver && driverLocation ? [
      { address: { location: { coordinates: [driverLocation.longitude, driverLocation.latitude] } } },
      ...(ride?.stops || []),
    ] : ride?.stops);
    if (!url) {
      setError("Enable GPS or refresh the route before opening Google Maps.");
      return;
    }
    try { await Linking.openURL(url); }
    catch { setError("Unable to open Google Maps on this device."); }
  };

  const initialPoint = located[0]?.point || driverLocation || route?.coordinates?.[0];
  const missingLocations = located.length < stops.length;
  const distance = route ? (distanceUnit === "mile" ? route.distanceKm / 1.609344 : route.distanceKm) : null;
  return (
    <View style={fullScreen ? styles.fullScreen : undefined}>
      {canRenderNativeMap ? (
        <MapView
          ref={mapRef}
          style={fullScreen ? StyleSheet.absoluteFillObject : styles.map}
          initialRegion={initialPoint ? { ...initialPoint, latitudeDelta: 0.08, longitudeDelta: 0.08 } : undefined}
          onMapReady={() => setMapReady(true)}
          onLayout={fit}
          onPress={onSelectLocation && !selectionDisabled ? (event) => onSelectLocation(event.nativeEvent.coordinate) : undefined}
        >
          {route?.coordinates?.length > 1 ? (
            <Polyline coordinates={route.coordinates} strokeColor="#ffd400" strokeWidth={5} />
          ) : null}
          {located.map(({ stop, index, point }) => (
            <Marker
              key={`${stop.key || index}-${index}`}
              coordinate={point}
              title={`${index + 1}. ${stop.type === "pickup" ? "Pickup" : "Drop-off"}`}
              description={stop.address?.address1 || stop.address?.label || ""}
              pinColor={stop.type === "pickup" ? "green" : "red"}
            />
          ))}
          {driverLocation ? <Marker coordinate={driverLocation} title="Driver" pinColor="blue" /> : null}
        </MapView>
      ) : null}
      <View pointerEvents="box-none" style={fullScreen ? styles.mapControls : undefined}>
      {onSelectLocation ? <Text style={styles.note}>Tap the map to choose the selected stop. The address is verified before saving.</Text> : null}
      {!canRenderNativeMap ? <Text accessibilityRole="alert" style={styles.error}>{MAP_UNAVAILABLE_MESSAGE}</Text> : null}
      {missingLocations ? <Text accessibilityRole="alert" style={styles.error}>
        Some stops have no verified map coordinates. Their pins cannot be shown. Refresh / GPS to reload trip locations.
      </Text> : null}
      {loading ? <ActivityIndicator style={styles.spacing} /> : null}
      {route ? (
        <Text style={styles.note}>
          Driving route: {distance.toFixed(1)} {distanceUnit === "mile" ? "mi" : "km"}, about {Math.round(route.minutes)} min.
          Green pins are pickups, red pins are drop-offs.
        </Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}{canRenderNativeMap && located.length ? " Available stop pins are still shown." : ""}</Text> : null}
      {error ? <TouchableOpacity accessibilityRole="button" onPress={() => setRetry((value) => value + 1)}>
        <Text style={styles.link}>Retry driving route</Text>
      </TouchableOpacity> : null}
      <TouchableOpacity accessibilityRole="link" onPress={openDirections}>
        <Text style={styles.link}>Open route in Google Maps</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  mapControls: { position: "absolute", top: 70, left: 12, right: 12, padding: 10, borderRadius: 12, backgroundColor: "#ffffffee" },
  map: { width: "100%", height: 260, marginTop: 8, borderRadius: 8 },
  note: { fontSize: 12, color: "#4b5563", marginTop: 6 },
  error: { fontSize: 12, color: "#b91c1c", marginTop: 6 },
  link: { fontSize: 13, color: "#2563eb", marginVertical: 8 },
  spacing: { marginTop: 6 },
});

export default RideRouteMap;
