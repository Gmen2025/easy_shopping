import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { canRenderNativeMap, MAP_UNAVAILABLE_MESSAGE } from "../assets/common/mapsConfiguration";
import { rideRequest, rideStopPoint, rideDirectionsUrl } from "../assets/common/rides";

const EDGE_PADDING = { top: 50, right: 40, bottom: 40, left: 40 };

const RideRouteMap = ({ ride, driverLocation, distanceUnit = "km", routeEndpoint, routeVersion, startAtDriver = false }) => {
  const mapRef = useRef(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const stops = useMemo(() => (ride?.stops || []).map((stop, index) => ({
    stop, index, point: rideStopPoint(stop),
  })), [ride?.stops]);
  const located = stops.filter((entry) => entry.point);

  useEffect(() => {
    if (!ride?._id) return undefined;
    let active = true;
    setRoute(null); setError(""); setLoading(true);
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
    if (points.length > 1) mapRef.current?.fitToCoordinates(points, { edgePadding: EDGE_PADDING, animated: false });
  };
  useEffect(fit, [route, driverLocation, ride?.stops]);

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

  if (!located.length) return null;
  const distance = route ? (distanceUnit === "mile" ? route.distanceKm / 1.609344 : route.distanceKm) : null;
  return (
    <View>
      {canRenderNativeMap ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{ ...located[0].point, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
          onMapReady={fit}
        >
          {route?.coordinates?.length > 1 ? (
            <Polyline coordinates={route.coordinates} strokeColor="#2563eb" strokeWidth={5} />
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
      ) : <Text style={styles.note}>{MAP_UNAVAILABLE_MESSAGE}</Text>}
      {loading ? <ActivityIndicator style={styles.spacing} /> : null}
      {route ? (
        <Text style={styles.note}>
          Driving route: {distance.toFixed(1)} {distanceUnit === "mile" ? "mi" : "km"}, about {Math.round(route.minutes)} min.
          Green pins are pickups, red pins are drop-offs.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error} Stop pins are still shown.</Text> : null}
      {error ? <TouchableOpacity accessibilityRole="button" onPress={() => setRetry((value) => value + 1)}>
        <Text style={styles.link}>Retry driving route</Text>
      </TouchableOpacity> : null}
      <TouchableOpacity accessibilityRole="link" onPress={openDirections}>
        <Text style={styles.link}>Open route in Google Maps</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  map: { width: "100%", height: 260, marginTop: 8, borderRadius: 8 },
  note: { fontSize: 12, color: "#4b5563", marginTop: 6 },
  error: { fontSize: 12, color: "#b91c1c", marginTop: 6 },
  link: { fontSize: 13, color: "#2563eb", marginVertical: 8 },
  spacing: { marginTop: 6 },
});

export default RideRouteMap;
