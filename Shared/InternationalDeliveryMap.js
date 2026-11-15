import React, { useRef, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Constants from "expo-constants";
import { canRenderNativeMap, formatDirectionsError, MAP_UNAVAILABLE_MESSAGE } from "../assets/common/mapsConfiguration";
import { toLatLng } from "../assets/common/orderTracking";
import { getGoogleMapsPinUrl } from "../assets/common/checkoutLocationPreview";

const directionsKey = process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY ||
  Constants.expoConfig?.extra?.googleDirectionsApiKey || "";

export default function InternationalDeliveryMap({ origin, destination }) {
  const map = useRef(null);
  const [error, setError] = useState("");
  const pickup = toLatLng(origin?.location);
  const dropoff = toLatLng(destination?.location);
  const fit = () => {
    if (pickup && dropoff) map.current?.fitToCoordinates([pickup, dropoff], {
      edgePadding: { top: 45, right: 45, bottom: 45, left: 45 }, animated: false,
    });
  };
  const openMap = async () => {
    const url = pickup && dropoff
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${pickup.latitude},${pickup.longitude}`)}&destination=${encodeURIComponent(`${dropoff.latitude},${dropoff.longitude}`)}&travelmode=driving`
      : getGoogleMapsPinUrl(dropoff);
    try { await Linking.openURL(url); }
    catch { setError("Unable to open Google Maps on this device."); }
  };
  return <View>
    {dropoff && canRenderNativeMap ? <MapView
      key={`${pickup?.latitude}:${pickup?.longitude}:${dropoff.latitude}:${dropoff.longitude}`}
      ref={map} style={styles.map}
      initialRegion={{ ...dropoff, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
      onMapReady={fit}
    >
      {pickup ? <Marker coordinate={pickup} title="Destination collection/dispatch" pinColor="green" /> : null}
      <Marker coordinate={dropoff} title="Destination address" pinColor="blue" />
      {pickup && directionsKey ? <MapViewDirections origin={pickup} destination={dropoff}
        apikey={directionsKey} mode="DRIVING" strokeWidth={4} strokeColor="#2563eb"
        onReady={() => setError("")} onError={(failure) => setError(formatDirectionsError(failure))} /> : null}
    </MapView> : <Text>{dropoff ? MAP_UNAVAILABLE_MESSAGE : "No verified destination pin is available in this checkout."}</Text>}
    {pickup && dropoff && canRenderNativeMap && !directionsKey ? <Text>
      In-app driving directions need a configured Directions API key. The saved location pins and external Google Maps route are available.
    </Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {dropoff ? <TouchableOpacity accessibilityRole="link" onPress={openMap}>
      <Text style={styles.link}>{pickup ? "Open destination driving route in Google Maps" : "View destination pin in Google Maps"}</Text>
    </TouchableOpacity> : null}
  </View>;
}

const styles = StyleSheet.create({
  map: { width: "100%", height: 250, marginTop: 8, borderRadius: 8 },
  error: { color: "#b91c1c", marginTop: 6 },
  link: { color: "#2563eb", marginVertical: 8 },
});
