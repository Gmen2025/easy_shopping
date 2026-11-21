import React, { useRef, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Constants from "expo-constants";
import { canRenderNativeMap, formatDirectionsError, MAP_UNAVAILABLE_MESSAGE } from "../assets/common/mapsConfiguration";
import { driverDeliveryRoute } from "../assets/common/internationalHub";

const directionsKey = process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY ||
  Constants.expoConfig?.extra?.googleDirectionsApiKey || "";

export default function InternationalDriverMap({ shipment }) {
  const map = useRef(null);
  const mapReady = useRef(false);
  const routeCoordinates = useRef([]);
  const [error, setError] = useState("");
  const [endpoints, setEndpoints] = useState([]);
  const { pickup, destination, url } = driverDeliveryRoute(shipment);
  const point = typeof destination === "object" ? destination : null;
  const fit = () => {
    if (mapReady.current && routeCoordinates.current.length > 1) map.current?.fitToCoordinates(routeCoordinates.current, {
      edgePadding: { top: 45, right: 45, bottom: 45, left: 45 }, animated: false,
    });
  };
  const openRoute = async () => {
    try { await Linking.openURL(url); }
    catch { setError("Unable to open the driving route in Google Maps."); }
  };
  if (!url) return <Text>Driving route unavailable: the hub pickup address or recipient address is missing. Ask the hub to verify the shipment.</Text>;
  return <View>
    <Text style={styles.heading}>Hub-to-recipient driving route</Text>
    {canRenderNativeMap && directionsKey ? <MapView
      ref={map} style={styles.map}
      initialRegion={{ latitude: point?.latitude || 0, longitude: point?.longitude || 0, latitudeDelta: point ? 0.1 : 180, longitudeDelta: point ? 0.1 : 360 }}
      onMapReady={() => { mapReady.current = true; fit(); }}
    >
      {endpoints.map((coordinate, index) => <Marker key={index} coordinate={coordinate} title={index === 0 ? "Hub pickup" : "Recipient delivery"} />)}
      <MapViewDirections origin={pickup} destination={point ? `${point.latitude},${point.longitude}` : destination} apikey={directionsKey} mode="DRIVING"
        strokeWidth={4} strokeColor="#2563eb"
        onReady={(result) => {
          setError("");
          if (result.coordinates?.length > 1) {
            routeCoordinates.current = result.coordinates;
            setEndpoints([result.coordinates[0], result.coordinates[result.coordinates.length - 1]]);
            fit();
          } else setError("No driving route was returned. Use external navigation.");
        }}
        onError={(failure) => { routeCoordinates.current = []; setEndpoints([]); setError(formatDirectionsError(failure)); }} />
    </MapView> : <Text>{canRenderNativeMap
      ? "In-app driving directions require a configured Directions API key."
      : MAP_UNAVAILABLE_MESSAGE}</Text>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <TouchableOpacity accessibilityRole="link" onPress={openRoute}>
      <Text style={styles.link}>Open hub-to-recipient driving route in Google Maps</Text>
    </TouchableOpacity>
    <Text>Verify both locations in the map before driving. This route does not include travel to the hub.</Text>
  </View>;
}

const styles = StyleSheet.create({
  heading: { fontWeight: "700", marginTop: 10 },
  map: { width: "100%", height: 250, marginTop: 8, borderRadius: 8 },
  error: { color: "#b91c1c", marginTop: 6 },
  link: { color: "#2563eb", marginVertical: 8 },
});
