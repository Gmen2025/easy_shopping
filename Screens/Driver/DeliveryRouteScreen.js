import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import * as Location from "expo-location";

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const DeliveryRouteScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeStats, setRouteStats] = useState({ distance: 0, duration: 0 });

  const request = route?.params?.request || {};
  const orderStatus = route?.params?.orderStatus || "Driver Assigned";
  const driverCoordinates = request.driverCoordinates || {
    latitude: 8.9806,
    longitude: 38.7578,
  };
  const storeCoordinates = request.storeLocation || {
    latitude: 8.9851,
    longitude: 38.7642,
  };
  const customerCoordinates = request.customerLocation || {
    latitude: 8.9834,
    longitude: 38.7761,
  };

  const origin = useMemo(() => {
    if (driverLocation) {
      return driverLocation;
    }
    return orderStatus === "Picked Up" ? storeCoordinates : driverCoordinates;
  }, [customerCoordinates, driverCoordinates, driverLocation, orderStatus, storeCoordinates]);

  const destination = useMemo(() => {
    return orderStatus === "Picked Up" ? customerCoordinates : storeCoordinates;
  }, [customerCoordinates, orderStatus, storeCoordinates]);

  useEffect(() => {
    let active = true;
    let subscription;

    const startWatchingLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return;
      }

      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (!active) {
        return;
      }

      setDriverLocation({
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
      });

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 10,
        },
        (location) => {
          if (!active) {
            return;
          }

          setDriverLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );
    };

    startWatchingLocation();

    return () => {
      active = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.fitToCoordinates([driverLocation, destination], {
        edgePadding: {
          top: 100,
          right: 60,
          bottom: 240,
          left: 60,
        },
        animated: true,
      });
    }
  }, [destination, driverLocation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: origin.latitude,
            longitude: origin.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          showsUserLocation
          followsUserLocation
        >
          {driverLocation ? (
            <Marker coordinate={driverLocation}>
              <View style={styles.driverMarker}>
                <Text style={styles.markerText}>🚐</Text>
              </View>
            </Marker>
          ) : null}
          <Marker coordinate={storeCoordinates}>
            <View style={styles.storeMarker}>
              <Text style={styles.markerText}>🏪</Text>
            </View>
          </Marker>
          <Marker coordinate={customerCoordinates}>
            <View style={styles.customerMarker}>
              <Text style={styles.markerText}>🏠</Text>
            </View>
          </Marker>
          {driverLocation ? (
            <MapViewDirections
              origin={origin}
              destination={destination}
              apikey={googleMapsApiKey}
              strokeWidth={4}
              strokeColor="#8a6c09"
              onReady={(result) => {
                setRouteStats({
                  distance: result.distance,
                  duration: result.duration,
                });
              }}
            />
          ) : null}
        </MapView>

        <View style={styles.bottomPanel}>
          <Text style={styles.panelTitle}>Active route</Text>
          <Text style={styles.panelSubtitle}>{request.pickupStoreName || "Delivery route"}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>ETA</Text>
              <Text style={styles.metricValue}>{Math.max(1, Math.round(routeStats.duration))} min</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>{routeStats.distance.toFixed(1)} km</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.goBack()}>
            <Text style={styles.actionButtonText}>
              {orderStatus === "Picked Up" ? "Confirm delivery" : "Confirm pickup"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  driverMarker: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#8a6c09",
  },
  storeMarker: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#1d4ed8",
  },
  customerMarker: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#166534",
  },
  markerText: {
    fontSize: 16,
  },
  bottomPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  panelSubtitle: {
    color: "#6b7280",
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 10,
  },
  metricLabel: {
    color: "#6b7280",
    fontSize: 12,
  },
  metricValue: {
    marginTop: 4,
    fontWeight: "700",
    color: "#111827",
  },
  actionButton: {
    marginTop: 14,
    backgroundColor: "#8a6c09",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});

export default DeliveryRouteScreen;
