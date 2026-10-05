import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { canRenderNativeMap, formatDirectionsError, MAP_UNAVAILABLE_MESSAGE } from "../../assets/common/mapsConfiguration";
import { formatDistance, getTrackingAddress, getShippingAddressText, getTrackingLocations, getTrackingRoute, toLatLng } from "../../assets/common/orderTracking";
import { resolveDeliveryLocation } from "../../assets/common/deliveryLocation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome";

import baseUrl from "../../assets/common/baseUrl";
import {
  disconnectCustomerSocket,
  getCustomerSocket,
} from "../../assets/common/socketClient";

const googleDirectionsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY ||
  Constants.expoConfig?.extra?.googleDirectionsApiKey || "";

const DEFAULT_REGION = {
  latitude: 8.9806,
  longitude: 38.7578,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const DELIVERY_STEPS = [
  { key: "Pending", label: "Pending", icon: "clock-o" },
  { key: "Driver Assigned", label: "Assigned", icon: "user" },
  { key: "Picked Up", label: "In Transit", icon: "cube" },
  { key: "Delivered", label: "Delivered", icon: "check" },
];

const POLL_INTERVAL_MS = 15000;
const NEARBY_POLL_INTERVAL_MS = 30000;
const NEARBY_DRIVERS_RADIUS_KM = 5;

const formatRecordedAt = (value) => {
  if (!value) return "Waiting for GPS fix";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waiting for GPS fix";
  return `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const OrderTrackingScreen = (props) => {
  const order = props.route?.params?.order;
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
  const [routeError, setRouteError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [resolvedDropoff, setResolvedDropoff] = useState(null);
  const [dropoffError, setDropoffError] = useState("");
  const [dropoffRetry, setDropoffRetry] = useState(0);
  const dropoffAddress = useMemo(() => getTrackingAddress(tracking, order), [tracking, order]);
  const shippingAddressText = getShippingAddressText(dropoffAddress);
  const hasAddressCoordinates = order?.customerLocationSource === "shipping-address" &&
    toLatLng(order?.customerLocation) != null;

  useEffect(() => {
    let cancelled = false;
    setResolvedDropoff(null);
    setDropoffError("");
    if (!shippingAddressText || hasAddressCoordinates) {
      return undefined;
    }
    resolveDeliveryLocation(shippingAddressText, dropoffAddress.country).then((point) => {
      if (!cancelled) setResolvedDropoff({ address: shippingAddressText, point });
    }).catch((err) => {
      if (!cancelled) setDropoffError(err?.message || "Unable to locate the delivery address.");
    });
    return () => { cancelled = true; };
  }, [shippingAddressText, dropoffAddress.country, hasAddressCoordinates, dropoffRetry]);

  const fetchTracking = useCallback(async () => {
    if (!orderId) {
      setError("Unable to load tracking: missing order ID.");
      setLoading(false);
      return;
    }
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

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTracking]);

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
  const { pickup, dropoff } = useMemo(
    () => getTrackingLocations(tracking, order,
      resolvedDropoff?.address === shippingAddressText ? resolvedDropoff.point : null),
    [tracking, order, resolvedDropoff, shippingAddressText]
  );
  const driverPoint = useMemo(
    () => toLatLng(liveDriverLocation) || toLatLng(tracking?.driverLocation),
    [liveDriverLocation, tracking?.driverLocation]
  );
  const isDelivered = deliveryStatus === "Delivered";
  const isDeliveryLeg = deliveryStatus === "Picked Up";

  const { origin: routeOrigin, destination: routeDestination } =
    getTrackingRoute(deliveryStatus, pickup, dropoff, driverPoint);

  useEffect(() => {
    setRouteStats(null);
    setRouteError("");
    setRouteCoordinates([]);
  }, [routeOrigin?.latitude, routeOrigin?.longitude,
    routeDestination?.latitude, routeDestination?.longitude]);

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
      [...routeCoordinates, pickup, dropoff, ...(!isDelivered && driverPoint ? [driverPoint] : [])]
        .filter(Boolean),
    [routeCoordinates, driverPoint, pickup, dropoff, isDelivered]
  );

  useEffect(() => {
    if (mapReady && mapRef.current && mapPoints.length > 0) {
      mapRef.current.fitToCoordinates(mapPoints, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [mapReady, mapPoints]);

  const activeStepIndex = Math.max(
    0,
    DELIVERY_STEPS.findIndex((step) => step.key === deliveryStatus)
  );

  const driverInfo = tracking?.driver || null;
  const dropoffAddressText = [
    dropoffAddress.address1,
    dropoffAddress.city,
    dropoffAddress.country,
  ]
    .filter(Boolean)
    .join(", ");

  if (loading && !tracking && !pickup && !dropoff) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={styles.loadingText}>Loading delivery tracking…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Navbar Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => props.navigation.goBack()}>
          <Icon name="arrow-left" size={16} color="#0f172a" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: socketConnected ? "#22c55e" : "#eab308" }]} />
            <Text style={styles.headerSubtitle}>
              #{String(orderId).slice(-8)} • {socketConnected ? "Live Updates" : "Connecting"}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.btnAction} onPress={() => {
          fetchTracking();
          setDropoffRetry((value) => value + 1);
        }}>
          <Icon name="refresh" size={14} color="#000" />
          <Text style={styles.btnActionText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Delivery Progress Stepper */}
        <View style={styles.stepperCard}>
          <View style={styles.timeline}>
            {DELIVERY_STEPS.map((step, index) => {
              const isActive = index <= activeStepIndex;
              const isCurrent = index === activeStepIndex;
              return (
                <View key={step.key} style={styles.timelineItem}>
                  {index < DELIVERY_STEPS.length - 1 && (
                    <View 
                      style={[
                        styles.timelineLine, 
                        index < activeStepIndex && styles.timelineLineActive
                      ]} 
                    />
                  )}
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
                      color={isActive ? "#000000" : "#94a3b8"}
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

          <View style={styles.bannerContainer}>
            <Text style={styles.legBanner}>
              {isDelivered
                ? "Order Delivered"
                : isDeliveryLeg
                  ? "Driver is on the way to you"
                  : deliveryStatus === "Driver Assigned"
                    ? "Driver is heading to pickup"
                    : "Assigning nearest driver"}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {dropoffError ? <Text style={styles.errorText}>{dropoffError}</Text> : null}
        {shippingAddressText && !dropoff && !dropoffError ? (
          <Text style={styles.mutedText}>Locating the delivery address...</Text>
        ) : null}

        {/* Map View */}
        {canRenderNativeMap && mapPoints.length > 0 ? (
          <View style={styles.mapWrapper}>
            <MapView
              ref={mapRef}
              style={styles.map}
              googleRenderer="LATEST"
              initialRegion={{ ...DEFAULT_REGION, ...(pickup || dropoff || driverPoint) }}
              onMapReady={() => setMapReady(true)}
            >
              {googleDirectionsApiKey && routeOrigin && routeDestination ? (
                <MapViewDirections
                  origin={routeOrigin}
                  destination={routeDestination}
                  apikey={googleDirectionsApiKey}
                  strokeWidth={4}
                  strokeColor="#0f172a"
                  mode="DRIVING"
                  onReady={(result) => {
                    setRouteError("");
                    setRouteCoordinates(result.coordinates || []);
                    setRouteStats({
                      distance: result.distance,
                      duration: result.duration,
                    });
                  }}
                  onError={(message) => {
                    setRouteStats(null);
                    setRouteCoordinates([]);
                    setRouteError(formatDirectionsError(message));
                  }}
                />
              ) : null}

              {driverPoint ? (
                <Marker coordinate={driverPoint}>
                  <View style={[styles.markerBadge, styles.driverMarker]}>
                    <Icon name="motorcycle" size={12} color="#000" />
                  </View>
                </Marker>
              ) : null}

              {pickup ? (
                <Marker coordinate={pickup}>
                  <View style={[styles.markerBadge, styles.pickupBadge]}>
                    <Icon name="shopping-bag" size={12} color="#fff" />
                  </View>
                </Marker>
              ) : null}

              {dropoff ? (
                <Marker coordinate={dropoff}>
                  <View style={[styles.markerBadge, styles.dropoffBadge]}>
                    <Icon name="home" size={12} color="#fff" />
                  </View>
                </Marker>
              ) : null}

              {nearbyDriverPoints.map((driver) => (
                <Marker
                  key={driver.driverId}
                  coordinate={driver.point}
                  title={driver.name || "Available Driver"}
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
            <Icon name="map-marker" size={24} color="#94a3b8" />
            <Text style={styles.mutedText}>
              {canRenderNativeMap
                ? "Map will display when coordinates are ready."
                : MAP_UNAVAILABLE_MESSAGE}
            </Text>
          </View>
        )}
        {canRenderNativeMap && routeOrigin && routeDestination &&
          (!googleDirectionsApiKey || routeError) ? (
            <Text style={styles.errorText}>
              {routeError || "Driving directions are not configured. Route distance and ETA are unavailable until a Directions API key is set."}
            </Text>
          ) : null}

        {/* Trip Information Details */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Delivery Info</Text>

          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Icon name="user" size={13} color="#0f172a" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.cardLabel}>Assigned Driver</Text>
              <Text style={styles.cardValue}>
                {driverInfo
                  ? `${driverInfo.name || "Assigned Driver"}${
                      driverInfo.vehicleType ? ` (${driverInfo.vehicleType})` : ""
                    }`
                  : "Searching for nearby driver..."}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Icon name="shopping-bag" size={13} color="#0f172a" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.cardLabel}>Pickup Location</Text>
              <Text style={styles.cardValue} numberOfLines={2}>
                {tracking?.pickup?.name || "Merchant"}
                {tracking?.pickup?.address ? ` — ${tracking.pickup.address}` : ""}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Icon name="home" size={13} color="#0f172a" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.cardLabel}>Delivery Address</Text>
              <Text style={styles.cardValue} numberOfLines={2}>
                {dropoffAddressText || "Destination address"}
              </Text>
            </View>
          </View>

          {routeStats && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Icon name="road" size={13} color="#0f172a" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.cardLabel}>Estimated Arrival</Text>
                  <Text style={styles.cardValue}>
                    {formatDistance(routeStats.distance, dropoffAddress.country)} away • ~{Math.round(routeStats.duration)} mins
                  </Text>
                </View>
              </View>
            </>
          )}

          {driverPoint && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Icon name="location-arrow" size={13} color="#0f172a" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.cardLabel}>GPS Signal</Text>
                  <Text style={styles.cardValue}>
                    {formatRecordedAt(
                      liveDriverLocation?.recordedAt || tracking?.driverLocation?.recordedAt
                    )}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Nearby Drivers Section */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Drivers Nearby Pickup</Text>
          {nearbyDriverPoints.length > 0 ? (
            nearbyDriverPoints.map((driver, i) => (
              <React.Fragment key={driver.driverId}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.nearbyRow}>
                  <View>
                    <Text style={styles.nearbyName}>{driver.name || "Available Driver"}</Text>
                    <Text style={styles.mutedText}>
                      {driver.vehicleType ? `${driver.vehicleType}` : "Delivery Partner"}
                    </Text>
                  </View>
                  <Text style={styles.distanceBadge}>
                    {driver.distanceKm != null
                      ? formatDistance(driver.distanceKm, dropoffAddress.country)
                      : "Nearby"}
                  </Text>
                </View>
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.mutedText}>
              No active drivers detected within {formatDistance(
                NEARBY_DRIVERS_RADIUS_KM,
                dropoffAddress.country
              )} of pickup point.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  
  /* Header Styles */
  header: {
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  headerSubtitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500",
  },

  /* Matching Action Button Styles */
  btnAction: {
    backgroundColor: "#eab308", // Yellow accent background
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  btnActionText: {
    color: "#000000", // Black text
    fontWeight: "700",
    fontSize: 12,
    marginLeft: 6,
  },

  /* Stepper / Timeline */
  stepperCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timelineItem: {
    alignItems: "center",
    flex: 1,
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    top: 14,
    left: "50%",
    width: "100%",
    height: 2,
    backgroundColor: "#e2e8f0",
    zIndex: 0,
  },
  timelineLineActive: {
    backgroundColor: "#eab308",
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineDotActive: {
    backgroundColor: "#eab308", // Yellow background for steps completed
  },
  timelineDotCurrent: {
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  timelineLabel: {
    marginTop: 8,
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
    textAlign: "center",
  },
  timelineLabelActive: {
    color: "#0f172a",
    fontWeight: "700",
  },
  bannerContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    alignItems: "center",
  },
  legBanner: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },

  /* Map Styles */
  mapWrapper: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  map: {
    width: "100%",
    height: 240,
  },
  markerBadge: {
    padding: 7,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarker: {
    backgroundColor: "#eab308",
  },
  pickupBadge: {
    backgroundColor: "#0f172a",
  },
  dropoffBadge: {
    backgroundColor: "#ef4444",
  },
  nearbyBadge: {
    backgroundColor: "#22c55e",
  },
  noMapCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },

  /* Card Component Styles */
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  cardLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardValue: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 10,
  },

  /* Nearby Drivers List */
  nearbyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nearbyName: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
  distanceBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f172a",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mutedText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    marginHorizontal: 16,
  },
});

export default OrderTrackingScreen;
