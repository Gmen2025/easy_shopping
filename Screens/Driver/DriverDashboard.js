import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import DeliveryRequestModal from "../../Shared/DeliveryRequestModal";
import {
  disconnectDriverSocket,
  emitDriverEvent,
  getDriverSocket,
  getSocketEventNames,
  registerDriverSocket,
} from "../../assets/common/socketClient";

const DEFAULT_DRIVER_COORDINATES = {
  latitude: 8.9806,
  longitude: 38.7578,
};

const DriverDashboard = () => {
  const navigation = useNavigation();
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [statusText, setStatusText] = useState("Preparing dispatcher connection...");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAlertPlaying, setIsAlertPlaying] = useState(false);
  const soundRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const stopAlert = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }
    } catch (error) {
      console.warn("Unable to stop alert sound:", error);
    } finally {
      soundRef.current = null;
      setIsAlertPlaying(false);
    }
  }, []);

  const playAlert = useCallback(async () => {
    if (isAlertPlaying) {
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
      setIsAlertPlaying(true);
    } catch (error) {
      console.warn("Unable to start alert sound:", error);
    }
  }, [isAlertPlaying]);

  const resetRequestState = useCallback(async () => {
    await stopAlert();
    setActiveRequest(null);
    setCountdown(30);
    setStatusText("Listening for the next delivery request");
  }, [stopAlert]);

  const handleReject = useCallback(async (expired = false) => {
    if (!activeRequest) {
      return;
    }

    const payload = {
      orderId: activeRequest.id,
      reason: expired ? "timed_out" : "rejected",
      rejectedAt: new Date().toISOString(),
    };

    try {
      const { rejectEvent } = getSocketEventNames();
      await emitDriverEvent(rejectEvent, payload);
    } catch (error) {
      console.warn("Unable to emit rejection event:", error);
    }

    await resetRequestState();
  }, [activeRequest, resetRequestState]);

  const handleAccept = useCallback(async () => {
    if (!activeRequest) {
      return;
    }

    setIsTransitioning(true);
    try {
      const { acceptEvent } = getSocketEventNames();
      await emitDriverEvent(acceptEvent, {
        orderId: activeRequest.id,
        acceptedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Unable to emit accept event:", error);
    }

    await resetRequestState();
    navigation.navigate("User", {
      screen: "DeliveryRoute",
      params: {
        request: {
          ...activeRequest,
          driverCoordinates: activeRequest.driverCoordinates || DEFAULT_DRIVER_COORDINATES,
        },
        orderStatus: "Driver Assigned",
      },
    });
    setIsTransitioning(false);
  }, [activeRequest, navigation, resetRequestState]);

  useEffect(() => {
    mountedRef.current = true;
    let socketRef = null;

    const attachSocketListeners = async () => {
      try {
        const socket = await getDriverSocket();
        if (!mountedRef.current) {
          return;
        }

        socketRef = socket;
        setSocketConnected(true);
        setStatusText("Connected to dispatcher. Waiting for requests...");

        const { deliveryEvent, registerEvent } = getSocketEventNames();
        registerDriverSocket({
          driverId: process.env.EXPO_PUBLIC_DRIVER_ID || "demo-driver",
        });

        const handleIncomingRequest = (payload) => {
          const normalizedRequest = {
            id: payload?.id || payload?.orderId || `delivery-${Date.now()}`,
            pickupStoreName: payload?.pickupStoreName || payload?.store?.name || "North Hub Store",
            totalDistance: payload?.totalDistance || "4.8 km",
            payout: payload?.payout || "ETB 220",
            customerName: payload?.customerName || payload?.customer?.name || "Customer",
            customerLocation: payload?.customerLocation || payload?.customer?.location || {
              latitude: 8.9834,
              longitude: 38.7761,
            },
            storeLocation: payload?.storeLocation || payload?.store?.location || {
              latitude: 8.9851,
              longitude: 38.7642,
            },
            driverCoordinates: payload?.driverCoordinates || DEFAULT_DRIVER_COORDINATES,
          };

          setActiveRequest(normalizedRequest);
          setCountdown(30);
          setStatusText(`Incoming request from ${normalizedRequest.pickupStoreName}`);
          playAlert();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        };

        const handleConnect = () => {
          setSocketConnected(true);
          setStatusText("Connected to dispatcher. Waiting for requests...");
        };

        const handleDisconnect = () => {
          setSocketConnected(false);
          setStatusText("Socket disconnected. Reconnecting...");
        };

        socket.on(deliveryEvent, handleIncomingRequest);
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        return () => {
          socket.off(deliveryEvent, handleIncomingRequest);
          socket.off("connect", handleConnect);
          socket.off("disconnect", handleDisconnect);
        };
      } catch (error) {
        console.warn("Socket connection failed:", error);
        setSocketConnected(false);
        setStatusText("Dispatcher unavailable. Offline mode enabled. Check your backend URL.");
      }
    };

    attachSocketListeners();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopAlert();
      if (socketRef) {
        const { deliveryEvent } = getSocketEventNames();
        socketRef.off(deliveryEvent);
      }
      disconnectDriverSocket();
    };
  }, [playAlert, stopAlert]);

  useEffect(() => {
    if (!activeRequest) {
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((previousValue) => {
        if (previousValue <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          handleReject(true);
          return 0;
        }

        return previousValue - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeRequest, handleReject]);

  const simulateDemoRequest = useCallback(() => {
    const demoRequest = {
      id: `demo-${Date.now()}`,
      pickupStoreName: "City Market",
      totalDistance: "6.2 km",
      payout: "ETB 260",
      customerName: "Aster Bekele",
      customerLocation: {
        latitude: 8.9806,
        longitude: 38.7578,
      },
      storeLocation: {
        latitude: 8.9855,
        longitude: 38.7634,
      },
      driverCoordinates: DEFAULT_DRIVER_COORDINATES,
    };

    setActiveRequest(demoRequest);
    setCountdown(30);
    setStatusText("Demo request triggered");
    playAlert();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [playAlert]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Delivery dispatch</Text>
          <Text style={styles.subtitle}>Driver cockpit for incoming orders</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, socketConnected && styles.badgeActive]}>
              <Text style={styles.badgeText}>{socketConnected ? "Connected" : "Connecting"}</Text>
            </View>
            <View style={[styles.badge, isAlertPlaying && styles.badgeActive]}>
              <Text style={styles.badgeText}>{isAlertPlaying ? "Alert on" : "Stand by"}</Text>
            </View>
          </View>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        <TouchableOpacity style={styles.primaryAction} onPress={simulateDemoRequest}>
          <Text style={styles.primaryActionText}>Simulate incoming request</Text>
        </TouchableOpacity>

        <View style={styles.centeredPanel}>
          <Text style={styles.helperText}>
            The dashboard listens for the socket event and shows a full-screen request modal when orders arrive.
          </Text>
          {isTransitioning ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator color="#8a6c09" />
              <Text style={styles.loaderText}>Preparing route...</Text>
            </View>
          ) : null}
        </View>
      </View>

      <DeliveryRequestModal
        visible={Boolean(activeRequest)}
        request={activeRequest}
        secondsLeft={countdown}
        onAccept={handleAccept}
        onReject={() => handleReject(false)}
      />
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
    padding: 20,
    justifyContent: "flex-start",
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6b7280",
    marginTop: 4,
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  badgeActive: {
    backgroundColor: "#8a6c09",
  },
  badgeText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
  },
  statusText: {
    marginTop: 12,
    color: "#374151",
    fontSize: 13,
  },
  primaryAction: {
    backgroundColor: "#8a6c09",
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryActionText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  centeredPanel: {
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 18,
  },
  helperText: {
    color: "#4b5563",
    lineHeight: 20,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  loaderText: {
    color: "#8a6c09",
    fontWeight: "600",
  },
});

export default DriverDashboard;
