import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { TextInput } from "react-native-paper";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { apiRequest } from "../../assets/common/storefront";
import { errorMessage } from "../../assets/common/internationalHub";
import { formatDistance, toLatLng } from "../../assets/common/orderTracking";
import { canRenderNativeMap, MAP_UNAVAILABLE_MESSAGE } from "../../assets/common/mapsConfiguration";

export default function InternationalRouteScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const shipment = params.shipment;
  const [stage, setStage] = useState(shipment.actions.includes("deliver") ? "delivery" : "pickup");
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Waiting for live GPS");
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const locationRef = useRef(null);
  const mapRef = useRef(null);
  const guard = useRef(false);
  const nextRequest = useRef(0);
  const recipient = shipment.recipient || {};
  const address = stage === "pickup" ? shipment.pickupFrom?.address :
    [recipient.address1, recipient.address2, recipient.city, recipient.zip, recipient.country || shipment.destinationCountry].filter(Boolean).join(", ");
  const targetAddress = stage === "pickup" && address ? [address, shipment.destinationCountry].filter(Boolean).join(", ") : address;
  const base = `driver/deliveries/${encodeURIComponent(shipment.groupId)}/${encodeURIComponent(shipment.shipmentId)}`;

  useEffect(() => {
    let active = true;
    let subscription;
    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (active) setLocationStatus("Location permission denied. Enable GPS to calculate your route.");
        return;
      }
      const update = (position) => {
        if (!active) return;
        const point = toLatLng(position.coords);
        if (!point) { locationRef.current = null; setLocation(null); setLocationStatus("Live GPS returned an invalid location."); return; }
        locationRef.current = { ...point, timestamp: position.timestamp || Date.now() };
        setLocation(locationRef.current);
        setLocationStatus("Tracking live location");
      };
      update(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
      if (!active) return;
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 10 }, update);
      if (!active) subscription.remove();
    };
    start().catch(() => { if (active) setLocationStatus("Live GPS unavailable. Check location services and permissions."); });
    return () => { active = false; subscription?.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    let pending = false;
    setRoute(null);
    setError("");
    nextRequest.current = Math.min(nextRequest.current, Date.now() + 10000);
    const load = async () => {
      const origin = locationRef.current;
      if (!origin || Date.now() - origin.timestamp > 120000) {
        if (active && origin) { setRoute(null); setLocation(null); setMapReady(false); setLocationStatus("Waiting for fresh live GPS. Enable location services."); }
        return;
      }
      if (pending || Date.now() < nextRequest.current) return;
      pending = true;
      nextRequest.current = Date.now() + 60000;
      try {
        const result = await apiRequest("international", `${base}/route`, { method: "post", data: { origin }, timeout: 20000 });
        if (result.stage !== stage) throw new Error("Shipment stage changed. Return to the delivery list and refresh.");
        if (!Array.isArray(result.coordinates) || result.coordinates.length < 2 ||
          !result.coordinates.every((point) => toLatLng(point)) || !toLatLng(result.destination) ||
          !Number.isFinite(result.distance) || result.distance < 0 || !Number.isFinite(result.duration) || result.duration < 0) {
          throw new Error("The server returned incomplete driving-route data.");
        }
        if (active) { setRoute(result); setError(""); }
      } catch (failure) {
        if (!active) return;
        if (failure.response?.status === 429) {
          const seconds = Number(failure.response.headers?.["retry-after"]);
          nextRequest.current = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 10) * 1000;
        }
        setRoute(null);
        setError(errorMessage(failure));
      } finally { pending = false; }
    };
    load();
    const timer = setInterval(load, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [base, stage]);

  useEffect(() => {
    if (mapReady && route?.coordinates?.length > 1) mapRef.current?.fitToCoordinates(route.coordinates, {
      edgePadding: { top: 80, right: 50, bottom: 260, left: 50 }, animated: true,
    });
  }, [mapReady, route]);

  const act = async (action, data) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await apiRequest("international", `${base}/${action}`, { method: "post", data, timeout: 60000 });
      if (action === "pickup") { setStarted(false); setStage("delivery"); }
      else navigation.goBack();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { guard.current = false; setBusy(false); }
  };
  const confirm = () => {
    if (stage === "delivery" && !proof.trim()) { Alert.alert("Proof required", "Enter who received the shipment or another delivery proof."); return; }
    Alert.alert(stage === "pickup" ? "Confirm hub pickup" : "Confirm delivery",
      stage === "pickup" ? "Confirm you collected this shipment from the hub." : "Confirm the shipment was handed to the recipient.", [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => act(stage === "pickup" ? "pickup" : "deliver", stage === "pickup" ? {} : { note: proof.trim() }) },
      ]);
  };
  const openDirections = async () => {
    const target = toLatLng(route?.stage === stage ? route.destination : null) ||
      (stage === "delivery" ? toLatLng(recipient.location) : null);
    const destination = target ? `${target.latitude},${target.longitude}` : targetAddress;
    if (!destination) { setError("The current stop has no address. Ask the hub to verify the shipment."); return; }
    const origin = locationRef.current;
    const fresh = origin && Date.now() - origin.timestamp <= 120000;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving` +
      (fresh ? `&origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}` : "");
    try { await Linking.openURL(url); }
    catch { setError("Unable to open Google Maps directions."); }
  };
  const callRecipient = async () => {
    const phone = String(recipient.phone || "").replace(/[^\d+*#,;]/g, "");
    if (!phone) { setError("The recipient phone number is invalid."); return; }
    try { await Linking.openURL(`tel:${phone}`); } catch { setError("Unable to open the phone dialer."); }
  };
  const shownRoute = route?.stage === stage ? route : null;
  return <SafeAreaView style={styles.screen}>
    <View style={styles.container}>
      {canRenderNativeMap && location ? <MapView ref={mapRef} style={styles.map}
        initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        onMapReady={() => setMapReady(true)}>
        <Marker coordinate={location} title="Driver" />
        {shownRoute ? <Marker coordinate={shownRoute.destination} title={stage === "pickup" ? "Hub pickup" : "Recipient"} /> : null}
        {shownRoute ? <Polyline coordinates={shownRoute.coordinates} strokeWidth={4} strokeColor="#8a6c09" /> : null}
      </MapView> : <View style={[styles.map, styles.mapPlaceholder]}>
        <Text>{canRenderNativeMap ? "Waiting for live GPS to show the driving map." : MAP_UNAVAILABLE_MESSAGE}</Text>
      </View>}
      <View style={styles.panel}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Back to deliveries</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setCollapsed(!collapsed)}>
            <Text style={styles.link}>{collapsed ? "Expand active route" : "Collapse"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Active route - {shipment.trackingCode}</Text>
        {!collapsed ? <ScrollView style={styles.details}>
          <Text>Pickup: {shipment.pickupFrom?.name || "Hub"} - {shipment.pickupFrom?.address || "Address unavailable"}</Text>
          <Text>Drop-off: {[recipient.address1, recipient.address2, recipient.city, recipient.zip, recipient.country || shipment.destinationCountry].filter(Boolean).join(", ") || "Address unavailable"}</Text>
          {recipient.phone ? <TouchableOpacity onPress={callRecipient}><Text style={styles.link}>Call recipient: {recipient.phone}</Text></TouchableOpacity> : null}
          <Text style={styles.stage}>{stage === "pickup" ? "Stage 1: Drive to hub and confirm pickup" : "Stage 2: Drive to recipient and confirm delivery"}</Text>
          <Text>{locationStatus}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Text>Driving ETA: {shownRoute ? `${Math.round(shownRoute.duration)} min` : "Unavailable"}</Text>
          <Text>Driving distance: {shownRoute ? formatDistance(shownRoute.distance, shipment.destinationCountry) : "Unavailable"}</Text>
          <TouchableOpacity onPress={openDirections}><Text style={styles.link}>Open current stop in Google Maps</Text></TouchableOpacity>
          {stage === "delivery" ? <TextInput dense label="Received by / delivery proof" maxLength={300} value={proof} onChangeText={setProof} /> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondary} disabled={busy} onPress={confirm}><Text>{stage === "pickup" ? "Confirm pickup" : "Confirm delivery"}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.primary} onPress={() => setStarted(true)}><Text style={styles.primaryText}>{started ? "Driving to current stop..." : stage === "pickup" ? "Start driving to hub" : "Start delivery route"}</Text></TouchableOpacity>
          </View>
        </ScrollView> : null}
      </View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" }, container: { flex: 1 }, map: { flex: 1 },
  mapPlaceholder: { alignItems: "center", justifyContent: "center", padding: 24 },
  panel: { position: "absolute", left: 16, right: 16, bottom: 18, backgroundColor: "#fff", borderRadius: 18, padding: 16, elevation: 8 },
  header: { flexDirection: "row", justifyContent: "space-between" }, details: { maxHeight: 360 },
  title: { fontWeight: "700", fontSize: 18 }, stage: { fontWeight: "700", marginTop: 8 },
  link: { color: "#1d4ed8", marginVertical: 5 }, error: { color: "#b91c1c" },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  secondary: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#e5e7eb", alignItems: "center" },
  primary: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#8a6c09", alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700" },
});
