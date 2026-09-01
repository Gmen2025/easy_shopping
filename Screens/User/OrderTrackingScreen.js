import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome";

import baseUrl from "../../assets/common/baseUrl";
import {
  disconnectCustomerSocket,
  getCustomerSocket,
} from "../../assets/common/socketClient";

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  "";

const DEFAULT_REGION = {
  latitude: 8.9806,
  longitude: 38.7578,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const DELIVERY_STEPS = [
  { key: "Pending", label: "Pending", icon: "clock-o" },
  { key: "Driver Assigned", label: "To pickup", icon: "user" },
  { key: "Picked Up", label: "To you", icon: "cube" },
  { key: "Delivered", label: "Delivered", icon: "check" },
];

const POLL_INTERVAL_MS = 15000;
const NEARBY_POLL_INTERVAL_MS = 30000;
const NEARBY_DRIVERS_RADIUS_KM = 5;

const toLatLng = (value) => {
  if (!value) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
};

const formatRecordedAt = (value) => {
  if (!value) return "waiting for GPS fix";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "waiting for GPS fix";
  return `updated ${date.toLocaleTimeString()}`;
};

const OrderTrackingScreen = (props) => {
  const orderId =
    props.route?.params?.orderId || props.route?.params?.order?._id || "";

  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(null);
  const [liveDriverLocation, setLiveDriverLocation] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [routeStats, setRouteStats] = useState(null);

  const fetchTracking = useCallback(async () => {
    if (!orderId) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${baseUrl}orders/${orderId}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTracking(response.data);
      setError("");
    } catch (err) {
      setError(
        err?.response?.data?.message || "Unable to load tracking information"
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Initial load + polling fallback (in case socket updates are missed).
  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  // Live updates: join the order room and listen for driver GPS + status changes.
  useEffect(() => {
    if (!orderId) return undefined;

    let cancelled = false;
    let socket;

    const connect = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        socket = await getCustomerSocket(token);
        if (cancelled) return;

        setSocketConnected(true);
        socket.emit("track_order", { orderId });

        socket.on("driver_location", (payload = {}) => {
          if (String(payload.orderId) !== String(orderId)) return;
          const point = toLatLng(payload);
          if (point) {
            setLiveDriverLocation({
              ...point,
              recordedAt: payload.recordedAt || null,
            });
          }
        });

        socket.on("order_status_updated", (payload = {}) => {
          if (String(payload.orderId) !== String(orderId)) return;
          if (payload.deliveryStatus) {
            setLiveStatus(payload.deliveryStatus);
          }
          fetchTracking();
        });

        socket.on("connect", () => {
          setSocketConnected(true);
          socket.emit("track_order", { orderId });
        });
        socket.on("disconnect", () => setSocketConnected(false));
      } catch (err) {
        if (!cancelled) setSocketConnected(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit("untrack_order", { orderId });
        socket.off("driver_location");
        socket.off("order_status_updated");
        socket.off("connect");
        socket.off("disconnect");
      }
      disconnectCustomerSocket();
    };
  }, [orderId, fetchTracking]);

  const deliveryStatus = liveStatus || tracking?.deliveryStatus || "Pending";
  const pickup = useMemo(() => toLatLng(tracking?.pickup), [tracking]);
  const dropoff = useMemo(() => toLatLng(tracking?.dropoff), [tracking]);
  const driverPoint = liveDriverLocation || toLatLng(tracking?.driverLocation);
  const isDelivered = deliveryStatus === "Delivered";
  const isDeliveryLeg = deliveryStatus === "Picked Up";

  // Route leg: driver -> pickup while heading to the store, then driver -> customer.
  const routeOrigin = isDelivered
    ? pickup
    : driverPoint || (isDeliveryLeg ? pickup : null);
  const routeDestination = isDelivered
    ? dropoff
    : isDeliveryLeg
      ? dropoff
      : pickup;

  // Available drivers around the pickup point.
  useEffect(() => {
    if (!pickup) return undefined;

    let cancelled = false;

    const fetchNearbyDrivers = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const response = await axios.get(`${baseUrl}drivers/nearby`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            radiusKm: NEARBY_DRIVERS_RADIUS_KM,
          },
        });
        if (!cancelled) {
          setNearbyDrivers(
            Array.isArray(response.data?.drivers) ? response.data.drivers : []
          );
        }
      } catch (err) {
        if (!cancelled) setNearbyDrivers([]);
      }
    };

    fetchNearbyDrivers();
    const interval = setInterval(fetchNearbyDrivers, NEARBY_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pickup?.latitude, pickup?.longitude]);

  const nearbyDriverPoints = useMemo(
    () =>
      nearbyDrivers
        .map((driver) => ({ ...driver, point: toLatLng(driver) }))
        .filter((driver) => driver.point),
    [nearbyDrivers]
  );

  const mapPoints = useMemo(
    () =>
      [driverPoint, pickup, dropoff, ...nearbyDriverPoints.map((d) => d.point)].filter(
        Boolean
      ),
    [driverPoint, pickup, dropoff, nearbyDriverPoints]
  );

  useEffect(() => {
    if (mapRef.current && mapPoints.length > 1) {
      mapRef.current.fitToCoordinates(mapPoints, {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: true,
      });
    }
  }, [mapPoints]);

  const activeStepIndex = Math.max(
    0,
    DELIVERY_STEPS.findIndex((step) => step.key === deliveryStatus)
  );

  const driverInfo = tracking?.driver || null;
  const dropoffAddress = tracking?.dropoff || {};
  const dropoffAddressText = [
    dropoffAddress.address1,
    dropoffAddress.city,
    dropoffAddress.country,
  ]
    .filter(Boolean)
    .join(", ");

  if (loading && !tracking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8a6c09" />
          <Text style={styles.mutedText}>Loading delivery tracking…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()}>
          <Icon name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Track your delivery</Text>
          <Text style={styles.headerSubtitle}>
            Order #{String(orderId).slice(-8)} ·{" "}
            {socketConnected ? "live" : "reconnecting"}
          </Text>
        </View>
        <TouchableOpacity onPress={fetchTracking}>
          <Icon name="refresh" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Status timeline */}
        <View style={styles.timeline}>
          {DELIVERY_STEPS.map((step, index) => {
            const isActive = index <= activeStepIndex;
            const isCurrent = index === activeStepIndex;
            return (
              <View key={step.key} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    isActive && styles.timelineDotActive,
                    isCurrent && styles.timelineDotCurrent,
                  ]}
                >
                  <Icon
                    name={step.icon}
                    size={12}
                    color={isActive ? "#fff" : "#9ca3af"}
                  />
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    isActive && styles.timelineLabelActive,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.legBanner}>
          {isDelivered
            ? "Your order has been delivered 🎉"
            : isDeliveryLeg
              ? "Driver is on the way to you"
              : deliveryStatus === "Driver Assigned"
                ? "Driver is heading to the pickup location"
                : "Waiting for a driver to be assigned"}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Map */}
        {mapPoints.length > 0 ? (
          <View style={styles.mapWrapper}>
            <MapView ref={mapRef} style={styles.map} initialRegion={DEFAULT_REGION}>
              {googleMapsApiKey && routeOrigin && routeDestination ? (
                <MapViewDirections
                  origin={routeOrigin}
                  destination={routeDestination}
                  apikey={googleMapsApiKey}
                  strokeWidth={5}
                  strokeColor="#176b87"
                  mode="DRIVING"
                  onReady={(result) => {
                    setRouteStats({
                      distance: result.distance,
                      duration: result.duration,
                    });
                  }}
                  onError={() => setRouteStats(null)}
                />
              ) : null}

              {!googleMapsApiKey && routeOrigin && routeDestination ? (
                <Polyline
                  coordinates={[routeOrigin, routeDestination]}
                  strokeColor="#176b87"
                  strokeWidth={4}
                />
              ) : null}

              {driverPoint ? (
                <Marker coordinate={driverPoint} pinColor="#176b87">
                  <View style={styles.driverMarker}>
                    <Icon name="motorcycle" size={14} color="#fff" />
                  </View>
                </Marker>
              ) : null}

              {pickup ? (
                <Marker coordinate={pickup} pinColor="#d97706">
                  <View style={styles.markerBadge}>
                    <Icon name="shopping-bag" size={12} color="#fff" />
                  </View>
                </Marker>
              ) : null}

              {dropoff ? (
                <Marker coordinate={dropoff} pinColor="#be123c">
                  <View style={[styles.markerBadge, styles.dropoffBadge]}>
                    <Icon name="home" size={12} color="#fff" />
                  </View>
                </Marker>
              ) : null}

              {nearbyDriverPoints.map((driver) => (
                <Marker
                  key={driver.driverId}
                  coordinate={driver.point}
                  pinColor="#16a34a"
                  title={driver.name || "Available driver"}
                  description={
                    driver.distanceKm != null
                      ? `${driver.distanceKm} km from pickup`
                      : "Available driver"
                  }
                >
                  <View style={[styles.markerBadge, styles.nearbyBadge]}>
                    <Icon name="motorcycle" size={10} color="#fff" />
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>
        ) : (
          <View style={styles.noMapCard}>
            <Icon name="map-marker" size={28} color="#9ca3af" />
            <Text style={styles.mutedText}>
              Map will appear once location coordinates are available.
            </Text>
          </View>
        )}

        {/* Trip details */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Icon name="user" size={14} color="#8a6c09" />
            <Text style={styles.cardLabel}>Driver</Text>
            <Text style={styles.cardValue}>
              {driverInfo
                ? `${driverInfo.name || "Assigned driver"}${
                    driverInfo.vehicleType ? ` · ${driverInfo.vehicleType}` : ""
                  }`
                : "Not assigned yet"}
            </Text>
          </View>

          <View style={styles.row}>
            <Icon name="shopping-bag" size={14} color="#d97706" />
            <Text style={styles.cardLabel}>Pickup</Text>
            <Text style={styles.cardValue} numberOfLines={2}>
              {tracking?.pickup?.name || "Store"}
              {tracking?.pickup?.address ? ` — ${tracking.pickup.address}` : ""}
            </Text>
          </View>

          <View style={styles.row}>
            <Icon name="home" size={14} color="#be123c" />
            <Text style={styles.cardLabel}>Dropoff</Text>
            <Text style={styles.cardValue} numberOfLines={2}>
              {dropoffAddressText || "Shipping address"}
            </Text>
          </View>

          {routeStats ? (
            <View style={styles.row}>
              <Icon name="road" size={14} color="#176b87" />
              <Text style={styles.cardLabel}>
                {isDeliveryLeg ? "To you" : "To pickup"}
              </Text>
              <Text style={styles.cardValue}>
                {routeStats.distance.toFixed(1)} km · ~
                {Math.round(routeStats.duration)} min
              </Text>
            </View>
          ) : null}

          {driverPoint ? (
            <View style={styles.row}>
              <Icon name="location-arrow" size={14} color="#176b87" />
              <Text style={styles.cardLabel}>Driver GPS</Text>
              <Text style={styles.cardValue}>
                {formatRecordedAt(
                  liveDriverLocation?.recordedAt ||
                    tracking?.driverLocation?.recordedAt
                )}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Nearby available drivers */}
        <View style={styles.card}>
          <View style={styles.nearbyHeader}>
            <Icon name="motorcycle" size={16} color="#16a34a" />
            <Text style={styles.nearbyTitle}>
              Available drivers around pickup
            </Text>
          </View>
          {nearbyDriverPoints.length > 0 ? (
            nearbyDriverPoints.map((driver) => (
              <View key={driver.driverId} style={styles.nearbyRow}>
                <Text style={styles.nearbyName}>{driver.name || "Driver"}</Text>
                <Text style={styles.mutedText}>
                  {driver.vehicleType ? `${driver.vehicleType} · ` : ""}
                  {driver.distanceKm != null
                    ? `${driver.distanceKm} km away`
                    : "nearby"}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>
              No available drivers detected within {NEARBY_DRIVERS_RADIUS_KM} km
              of the pickup right now.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f6fa" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    backgroundColor: "#8a6c09",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  headerSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  timelineItem: { alignItems: "center", flex: 1 },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActive: { backgroundColor: "#8a6c09" },
  timelineDotCurrent: {
    borderWidth: 2,
    borderColor: "#176b87",
  },
  timelineLabel: {
    marginTop: 6,
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
  },
  timelineLabelActive: { color: "#111827", fontWeight: "700" },
  legBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    textAlign: "center",
    color: "#176b87",
    fontWeight: "700",
    fontSize: 14,
  },
  errorText: {
    color: "#b91c1c",
    textAlign: "center",
    marginHorizontal: 16,
    marginTop: 8,
  },
  mapWrapper: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    backgroundColor: "#fff",
  },
  map: { width: "100%", height: 300 },
  driverMarker: {
    backgroundColor: "#176b87",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerBadge: {
    backgroundColor: "#d97706",
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
  },
  dropoffBadge: { backgroundColor: "#be123c" },
  nearbyBadge: { backgroundColor: "#16a34a" },
  noMapCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  cardLabel: {
    marginLeft: 8,
    width: 80,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardValue: { flex: 1, color: "#111827", fontSize: 13, fontWeight: "500" },
  nearbyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  nearbyTitle: { marginLeft: 8, fontWeight: "700", color: "#111827" },
  nearbyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  nearbyName: { color: "#111827", fontWeight: "600" },
  mutedText: { color: "#6b7280", fontSize: 12, marginTop: 4 },
});

export default OrderTrackingScreen;
