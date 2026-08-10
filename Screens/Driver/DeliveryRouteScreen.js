import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import * as Location from "expo-location";
import Constants from "expo-constants";

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  "";

const haversineDistanceKm = (start, end) => {
  if (!start || !end) {
    return 0;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(end.latitude - start.latitude);
  const dLon = toRad(end.longitude - start.longitude);
  const lat1 = toRad(start.latitude);
  const lat2 = toRad(end.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const DeliveryRouteScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeStats, setRouteStats] = useState({ distance: 0, duration: 0 });
  const [routeError, setRouteError] = useState("");
  const [fallbackEstimate, setFallbackEstimate] = useState(null);
  const [serviceAreaMessage, setServiceAreaMessage] = useState("");
  const [pickupRouteStarted, setPickupRouteStarted] = useState(false);
  const [deliveryRouteStarted, setDeliveryRouteStarted] = useState(false);
  const [locationStatus, setLocationStatus] = useState("Waiting for live GPS");

  const request = route?.params?.request || {};
  const orderStatus = route?.params?.orderStatus || "Driver Assigned";
  const currentStage = orderStatus === "Picked Up" ? "delivery" : "pickup";
  const liveOrderStatus = request?.rawPayload?.status || orderStatus;
  const isCompleted = liveOrderStatus === "Delivered" || liveOrderStatus === "completed" || orderStatus === "Delivered";
  const driverCoordinates = request.driverCoordinates || {
    latitude: 8.9806,
    longitude: 38.7578,
  };
  const storeCoordinates = request.storeLocation || request.pickupLocation || {
    latitude: 8.9851,
    longitude: 38.7642,
  };
  const customerCoordinates = request.customerLocation || request.deliveryLocation || request.dropOffLocation || {
    latitude: 8.9818,
    longitude: 38.7728,
  };

  const destination = useMemo(() => {
    return orderStatus === "Picked Up" ? customerCoordinates : storeCoordinates;
  }, [customerCoordinates, orderStatus, storeCoordinates]);

  const shouldUseLiveLocation = useMemo(() => {
    if (!driverLocation) {
      return false;
    }

    const distanceKm = haversineDistanceKm(driverLocation, destination);
    return distanceKm <= 300;
  }, [destination, driverLocation]);

  const origin = useMemo(() => {
    if (driverLocation && shouldUseLiveLocation) {
      return driverLocation;
    }
    return orderStatus === "Picked Up" ? storeCoordinates : driverCoordinates;
  }, [driverCoordinates, driverLocation, orderStatus, shouldUseLiveLocation, storeCoordinates]);

  const hasValidRoutePoints = Boolean(
    origin?.latitude != null &&
      origin?.longitude != null &&
      destination?.latitude != null &&
      destination?.longitude != null
  );

  const isOutsideServiceArea = useMemo(() => {
    if (!hasValidRoutePoints) {
      return false;
    }

    const distanceKm = haversineDistanceKm(origin, destination);
    return distanceKm > 300;
  }, [destination, hasValidRoutePoints, origin]);

  useEffect(() => {
    console.log("[Route Debug] key present:", Boolean(googleMapsApiKey));
    console.log("[Route Debug] origin:", origin);
    console.log("[Route Debug] destination:", destination);
    console.log("[Route Debug] hasValidRoutePoints:", hasValidRoutePoints);
    console.log("[Route Debug] usingLiveLocation:", shouldUseLiveLocation);
    console.log("[Route Debug] isOutsideServiceArea:", isOutsideServiceArea);
  }, [destination, googleMapsApiKey, hasValidRoutePoints, isOutsideServiceArea, origin, shouldUseLiveLocation]);

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
      setLocationStatus("Live GPS active");

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
          setLocationStatus("Tracking live location");
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
    if (mapRef.current && origin) {
      mapRef.current.fitToCoordinates([origin, destination], {
        edgePadding: {
          top: 100,
          right: 60,
          bottom: 240,
          left: 60,
        },
        animated: true,
      });
    }
  }, [destination, origin]);

  useEffect(() => {
    if (isOutsideServiceArea) {
      setRouteError("");
      setServiceAreaMessage("Outside service area. Route guidance is unavailable for this delivery.");
      setFallbackEstimate(null);
      return;
    }

    if (routeStats.distance > 0 || routeStats.duration > 0) {
      setFallbackEstimate(null);
      return;
    }

    if (origin?.latitude != null && origin?.longitude != null && destination?.latitude != null && destination?.longitude != null) {
      const distanceKm = haversineDistanceKm(origin, destination);
      const estimatedMinutes = Math.max(5, Math.round(distanceKm * 2));
      setServiceAreaMessage("");
      setFallbackEstimate({ distanceKm, estimatedMinutes });
    }
  }, [destination, isOutsideServiceArea, origin, routeStats.distance, routeStats.duration]);

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
          {driverLocation && hasValidRoutePoints && googleMapsApiKey ? (
            <MapViewDirections
              origin={origin}
              destination={destination}
              apikey={googleMapsApiKey}
              strokeWidth={4}
              strokeColor="#8a6c09"
              onReady={(result) => {
                setRouteError("");
                setRouteStats({
                  distance: result.distance,
                  duration: result.duration,
                });
              }}
              onError={(error) => {
                console.warn("[Route Debug] MapViewDirections error:", error);
                console.log("[Route Debug] route request failed with key:", Boolean(googleMapsApiKey));
                setRouteError("Route unavailable right now. Showing the map without navigation.");
                setRouteStats({ distance: 0, duration: 0 });
              }}
            />
          ) : null}
        </MapView>

        <View style={styles.bottomPanel}>
          <Text style={styles.panelTitle}>Active route</Text>
          <Text style={styles.panelSubtitle}>{request.pickupStoreName || "Delivery route"}</Text>
          <Text style={styles.stageLabel}>
            {isCompleted
              ? "Delivery completed"
              : currentStage === "pickup"
                ? "Stage 1: Drive to store and confirm pickup"
                : deliveryRouteStarted
                  ? "Stage 2: Driving to delivery address"
                  : "Stage 2: Drive to customer and confirm drop-off"}
          </Text>
          <Text style={styles.locationStatus}>{locationStatus}</Text>
          {(routeError || serviceAreaMessage) ? (
            <Text style={styles.routeWarning}>{routeError || serviceAreaMessage}</Text>
          ) : null}
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>ETA</Text>
              <Text style={styles.metricValue}>
                {routeStats.duration > 0
                  ? `${Math.max(1, Math.round(routeStats.duration))} min`
                  : fallbackEstimate
                    ? `${fallbackEstimate.estimatedMinutes} min`
                    : "—"}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>
                {routeStats.distance > 0
                  ? `${routeStats.distance.toFixed(1)} km`
                  : fallbackEstimate
                    ? `${fallbackEstimate.distanceKm.toFixed(1)} km`
                    : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.actionsRow}>
            {isCompleted ? (
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => navigation.navigate("DriverDashboard")}
              >
                <Text style={styles.primaryActionText}>Back to dashboard</Text>
              </TouchableOpacity>
            ) : currentStage === "pickup" ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => {
                    navigation.navigate("DeliveryProgress", {
                      request,
                      orderStatus: "Picked Up",
                      mode: "pickup",
                    });
                  }}
                >
                  <Text style={styles.secondaryActionText}>Confirm pickup</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() => {
                    setPickupRouteStarted(true);
                  }}
                >
                  <Text style={styles.primaryActionText}>{pickupRouteStarted ? "Driving to store..." : "Start driving to store"}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => {
                    navigation.navigate("DriverDashboard", {
                      pendingDelivery: request,
                    });
                  }}
                >
                  <Text style={styles.secondaryActionText}>Deliver later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() => {
                    if (deliveryRouteStarted) {
                      navigation.navigate("DriverDashboard", {
                        completedDelivery: request,
                      });
                      return;
                    }

                    setDeliveryRouteStarted(true);
                  }}
                >
                  <Text style={styles.primaryActionText}>{deliveryRouteStarted ? "Confirm delivery" : "Start delivery route"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
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
  stageLabel: {
    marginTop: 8,
    color: "#8a6c09",
    fontSize: 12,
    fontWeight: "700",
  },
  locationStatus: {
    marginTop: 6,
    color: "#4b5563",
    fontSize: 12,
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
  routeWarning: {
    marginTop: 10,
    color: "#b45309",
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionsRow: {
    marginTop: 14,
    gap: 10,
  },
  primaryAction: {
    backgroundColor: "#8a6c09",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryActionText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryAction: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryActionText: {
    color: "#111827",
    fontWeight: "700",
  },
});

export default DeliveryRouteScreen;
