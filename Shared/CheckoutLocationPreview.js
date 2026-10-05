import React, { useRef } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { canRenderNativeMap, MAP_UNAVAILABLE_MESSAGE } from "../assets/common/mapsConfiguration";
import { toLatLng } from "../assets/common/orderTracking";
import { getGoogleMapsPinUrl } from "../assets/common/checkoutLocationPreview";

const CheckoutLocationPreview = ({ preview, onError }) => {
  const mapRef = useRef(null);
  const pickup = toLatLng(preview.storeAssignment?.storeLocation);
  const delivery = toLatLng(preview.customerLocation);
  const points = [pickup, delivery].filter(Boolean);

  const openPin = async (point) => {
    try {
      await Linking.openURL(getGoogleMapsPinUrl(point));
    } catch (error) {
      console.warn("Unable to open checkout location:", error);
      onError("Unable to open Google Maps. Check the coordinates shown below.");
    }
  };

  return (
    <View>
      <Text style={styles.heading}>Delivery location preview</Text>
      <Text style={styles.description}>
        Check that both pins are in the correct area and accessible by road.
        These are locations only, not a calculated driving route.
      </Text>
      {canRenderNativeMap && delivery ? (
        <MapView
          key={`${preview.addressText}:${pickup?.latitude}:${pickup?.longitude}:${delivery.latitude}:${delivery.longitude}`}
          ref={mapRef}
          style={styles.map}
          initialRegion={{ ...delivery, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
          onMapReady={() => mapRef.current?.fitToCoordinates(points, {
            edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
            animated: false,
          })}
        >
          {pickup ? <Marker coordinate={pickup} title="Selected pickup" /> : null}
          <Marker coordinate={delivery} title="Delivery address" pinColor="blue" />
        </MapView>
      ) : <Text style={styles.description}>{MAP_UNAVAILABLE_MESSAGE}</Text>}
      <Text style={styles.heading}>Selected pickup</Text>
      <Text style={styles.description}>
        {preview.storeAssignment?.pickupStoreName || "No pickup store found"}
      </Text>
      {pickup ? (
        <TouchableOpacity accessibilityRole="link" onPress={() => openPin(pickup)}>
          <Text style={styles.link}>
            {pickup.latitude.toFixed(6)}, {pickup.longitude.toFixed(6)} - Open pickup in Google Maps
          </Text>
        </TouchableOpacity>
      ) : <Text style={styles.description}>
        No valid store pin is available. The server may use the store address or
        configured delivery hub; ask the store administrator to verify its location.
      </Text>}
      <Text style={styles.heading}>Delivery address</Text>
      <Text style={styles.description}>{preview.addressText}</Text>
      {delivery ? (
        <TouchableOpacity accessibilityRole="link" onPress={() => openPin(delivery)}>
          <Text style={styles.link}>
            {delivery.latitude.toFixed(6)}, {delivery.longitude.toFixed(6)} - Open delivery in Google Maps
          </Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.description}>
        If the delivery pin is wrong, refine the shipping address and preview again.
        If the pickup pin is wrong, ask the store administrator to correct it.
        The server verifies pickup eligibility when calculating the final fee.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 14, fontWeight: "600", color: "#374151", marginTop: 12 },
  description: { fontSize: 12, color: "#6b7280", marginTop: 6 },
  link: { fontSize: 13, color: "#2563eb", marginVertical: 8 },
  map: { width: "100%", height: 230, marginTop: 12, borderRadius: 8 },
});

export default CheckoutLocationPreview;
