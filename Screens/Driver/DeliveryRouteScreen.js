import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Icon from "react-native-vector-icons/FontAwesome";
import * as Location from "expo-location";
import baseUrl from "../../assets/common/baseUrl";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { canRenderNativeMap, formatDirectionsError, MAP_UNAVAILABLE_MESSAGE } from "../../assets/common/mapsConfiguration";

import {
  formatScheduledDeliveryDate,
  updateDeliveryStatus,
} from "../../assets/common/delivery";
import { formatDistance, toLatLng } from "../../assets/common/orderTracking";

// Opens the device's Google Maps app/browser with turn-by-turn driving directions for this leg.
const buildGoogleMapsDrivingUrl = (destination, origin) => {
  if (destination?.latitude == null || destination?.longitude == null) {
    return null;
  }
  const params = [
    "api=1",
    `destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}`,
    "travelmode=driving",
  ];
  if (origin?.latitude != null && origin?.longitude != null) {
    params.push(`origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}`);
  }
  return `https://www.google.com/maps/dir/?${params.join("&")}`;
};

const DeliveryRouteScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeStats, setRouteStats] = useState({ distance: 0, duration: 0 });
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeError, setRouteError] = useState("");
  const [pickupRouteStarted, setPickupRouteStarted] = useState(false);
  const [deliveryRouteStarted, setDeliveryRouteStarted] = useState(false);
  const [locationStatus, setLocationStatus] = useState("Waiting for live GPS");
  const [statusError, setStatusError] = useState("");

  const request = route?.params?.request || {};
  const orderStatus = route?.params?.orderStatus || "Driver Assigned";
  const exitRouteName = route?.params?.exitRouteName || "User Profile";
  const isCompanyDriverRoute = exitRouteName === "CompanyDriverHome";
  const customerPhone =
    request.customerPhone ||
    request.rawPayload?.customer?.phone ||
    request.rawPayload?.address?.phone ||
    request.dropoffAddress?.phone ||
    "";
  const currentStage = orderStatus === "Picked Up" ? "delivery" : "pickup";
  const liveOrderStatus = request?.rawPayload?.status || orderStatus;
  const isCompleted = liveOrderStatus === "Delivered" || liveOrderStatus === "completed" || orderStatus === "Delivered";
  const driverCoordinates = useMemo(
    () => toLatLng(request.driverCoordinates) || toLatLng(request.rawPayload?.driverCoordinates),
    [request.driverCoordinates, request.rawPayload]
  );
  const storeCoordinates = useMemo(
    () =>
      toLatLng(request.storeLocation) ||
      toLatLng(request.pickupLocation) ||
      toLatLng(request.pickupStore) ||
      toLatLng(request.storeAssignment?.coordinates) ||
      toLatLng(request.rawPayload?.storeLocation) ||
      toLatLng(request.rawPayload?.pickupStore),
    [request.storeLocation, request.pickupLocation, request.pickupStore, request.storeAssignment, request.rawPayload]
  );
  const customerCoordinates = useMemo(
    () => toLatLng(
      request.customerLocation
    ) || toLatLng(request.deliveryLocation) ||
      toLatLng(request.dropOffLocation) ||
      toLatLng(request.rawPayload?.customerLocation),
    [
      request.customerLocation,
      request.deliveryLocation,
      request.dropOffLocation,
      request.rawPayload,
    ]
  );
  const deliveryCountry =
    request.country || request.dropoffAddress?.country || request.rawPayload?.country || "";

  const pickupAddressLabel = request.storeAddress || request.pickupStoreName || "Pickup location";
  const dropoffAddressLabel = request.revealed
    ? request.fullAddress || "Delivery address"
    : request.dropZoneLabel || "Delivery area";

  const openDirections = async (destination, origin) => {
    const url = buildGoogleMapsDrivingUrl(destination, origin);
    if (!url) {
      return;
    }
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn("Unable to open Google Maps directions:", error);
    }
  };

  const callCustomer = async () => {
    const dialablePhone = String(customerPhone).trim().replace(/[^\d+*#,;]/g, "");
    if (!dialablePhone) {
      return;
    }

    try {
      await Linking.openURL(`tel:${dialablePhone}`);
    } catch (error) {
      setStatusError("Unable to open the phone dialer");
    }
  };

  const saveDeliveryStatus = async (deliveryStatus) => {
    setStatusError("");
    try {
      await updateDeliveryStatus(request, deliveryStatus);
      return true;
    } catch (error) {
      setStatusError(error?.message || "Unable to update delivery status");
      return false;
    }
  };

  const destination = useMemo(() => {
    return orderStatus === "Picked Up" ? customerCoordinates : storeCoordinates;
  }, [customerCoordinates, orderStatus, storeCoordinates]);

  const origin = useMemo(() => {
    if (driverLocation) {
      return driverLocation;
    }
    return orderStatus === "Picked Up" ? storeCoordinates : driverCoordinates;
  }, [driverCoordinates, driverLocation, orderStatus, storeCoordinates]);

  const orderId = request.id || request.orderId || request._id || request.rawPayload?.orderId || request.rawPayload?._id;
  const latestGps = useRef(null);
  latestGps.current = driverLocation;

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    let lastRequest = 0;
    setRouteCoordinates([]);
    setRouteStats({ distance: 0, duration: 0 });
    setRouteError("");
    const loadRoute = async () => {
      if (pending || !latestGps.current || Date.now() - lastRequest < 60000 || isCompleted) return;
      if (!orderId) {
        setRouteError("Driving directions unavailable: missing delivery order ID.");
        return;
      }
      pending = true;
      lastRequest = Date.now();
      try {
        const token = await AsyncStorage.getItem("token");
        const database = await getDatabaseNameFromStorage();
        const response = await axios.post(`${baseUrl}drivers/me/orders/${orderId}/route`, {
          origin: latestGps.current,
        }, {
          headers: { Authorization: `Bearer ${token}`, "x-database-name": database },
          signal: controller.signal, timeout: 20000,
        });
        const result = response.data;
        if (!Array.isArray(result.coordinates) || result.coordinates.length < 2 ||
          !result.coordinates.every((point) => Number.isFinite(point?.latitude) &&
            Number.isFinite(point?.longitude) && Math.abs(point.latitude) <= 90 &&
            Math.abs(point.longitude) <= 180) ||
          !Number.isFinite(result.distance) || !Number.isFinite(result.duration)) {
          throw new Error("The server returned incomplete driving-route data.");
        }
        if (controller.signal.aborted) return;
        setRouteCoordinates(result.coordinates);
        setRouteStats({ distance: result.distance, duration: result.duration });
        setRouteError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = formatDirectionsError(error.response?.data?.message || error);
        console.warn("[Route]", message);
        setRouteError(message);
        setRouteCoordinates([]);
        setRouteStats({ distance: 0, duration: 0 });
      } finally {
        pending = false;
      }
    };
    loadRoute();
    const timer = setInterval(loadRoute, 2000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [orderId, orderStatus, isCompleted]);

  useEffect(() => {
    let active = true;
    let subscription;

    const startWatchingLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (active) setLocationStatus("Location permission denied. Enable location access to calculate driving directions.");
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
      if (!active) subscription.remove();
    };

    startWatchingLocation().catch((error) => {
      if (!active) return;
      console.warn("[Route] GPS unavailable:", error?.message);
      setLocationStatus("Live GPS unavailable. Check location services and permissions.");
    });

    return () => {
      active = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && origin && destination) {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {canRenderNativeMap && origin && destination ? <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: origin.latitude,
            longitude: origin.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          showsUserLocation={false}
          followsUserLocation={false}
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
          {routeCoordinates.length > 1 ? (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={4}
              strokeColor="#8a6c09"
            />
          ) : null}
        </MapView> : (
          <View style={[styles.map, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
            <Text>
              {canRenderNativeMap
                ? "Map and driving route will appear when pickup, delivery, and driver coordinates are available."
                : MAP_UNAVAILABLE_MESSAGE}
            </Text>
          </View>
        )}

        <View style={styles.bottomPanel}>
          <Text style={styles.panelTitle}>Active route</Text>
          <Text style={styles.panelSubtitle}>{request.pickupStoreName || "Delivery route"}</Text>
          {request.deliveryMode === "SCHEDULED" ||
          request.scheduledFor ||
          request.scheduledDeliveryDate ||
          request.scheduledDate ? (
            <Text style={styles.addressLink}>
              Scheduled delivery: {formatScheduledDeliveryDate(request) || "Date unavailable"}
            </Text>
          ) : null}
          <TouchableOpacity onPress={() => openDirections(storeCoordinates, driverLocation || driverCoordinates)}>
            <Text style={styles.addressLink} numberOfLines={1}>📍 Pickup: {pickupAddressLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openDirections(customerCoordinates, storeCoordinates)}>
            <Text style={styles.addressLink} numberOfLines={1}>🏁 Drop-off: {dropoffAddressLabel}</Text>
          </TouchableOpacity>
          {isCompanyDriverRoute && Boolean(customerPhone) ? (
            <TouchableOpacity style={styles.phoneLink} onPress={callCustomer}>
              <Icon name="phone" size={13} color="#047857" />
              <Text style={styles.phoneLinkText} numberOfLines={1}>
                Call customer: {customerPhone}
              </Text>
            </TouchableOpacity>
          ) : null}
          {request.items?.length ? (
            <Text style={styles.itemsSummary} numberOfLines={2}>
              {request.itemCount || request.items.length} item{(request.itemCount || request.items.length) === 1 ? "" : "s"}: {request.items.map((entry) => `${entry.quantity || 1}x ${entry.name}`).join(", ")}
            </Text>
          ) : null}
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
          {(routeError || statusError) ? (
            <Text style={styles.routeWarning}>{routeError || statusError}</Text>
          ) : null}
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Driving ETA</Text>
              <Text style={styles.metricValue}>
                {routeStats.duration > 0
                  ? `${Math.max(1, Math.round(routeStats.duration))} min`
                  : "—"}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Driving distance</Text>
              <Text style={styles.metricValue}>
                {routeStats.distance > 0
                  ? formatDistance(routeStats.distance, deliveryCountry)
                  : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.actionsRow}>
            {isCompleted ? (
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => navigation.navigate(exitRouteName)}
              >
                <Text style={styles.primaryActionText}>Back to dashboard</Text>
              </TouchableOpacity>
            ) : currentStage === "pickup" ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={async () => {
                    if (await saveDeliveryStatus("Picked Up")) {
                      navigation.navigate("DeliveryProgress", {
                        request,
                        orderStatus: "Picked Up",
                        mode: "pickup",
                        exitRouteName,
                      });
                    }
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
                    navigation.navigate(exitRouteName);
                  }}
                >
                  <Text style={styles.secondaryActionText}>Deliver later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={async () => {
                    if (deliveryRouteStarted) {
                      if (await saveDeliveryStatus("Delivered")) {
                        navigation.navigate(exitRouteName);
                      }
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
  addressLink: {
    marginTop: 6,
    color: "#1d4ed8",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  phoneLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  phoneLinkText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  itemsSummary: {
    marginTop: 6,
    color: "#4b5563",
    fontSize: 12,
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
