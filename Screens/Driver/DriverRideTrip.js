import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import RideRouteMap from "../../Shared/RideRouteMap";
import { rideRequest, addressText, rideStopPoint, rideOptionName } from "../../assets/common/rides";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

export default function DriverRideTrip({ navigation, route }) {
  const focused = useIsFocused();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const [collapsed, setCollapsed] = useState(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const running = useRef(false);
  const region = useRef(route.params?.database || "");
  const ensureRegion = async () => {
    const database = await getDatabaseNameFromStorage();
    if (region.current && region.current !== database) throw new Error("Region changed. Return to ride assignments before continuing.");
    region.current = database;
  };
  const run = async (action) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError("");
    try { await ensureRegion(); await action(); }
    catch (failure) {
      const message = failure.response?.data?.message || failure.message;
      setError(message);
      console.warn("Driver ride trip failed:", message);
    } finally { running.current = false; setBusy(false); }
  };
  const reportLocation = async (ask = false) => {
    const permission = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") throw new Error("Allow location access to navigate and confirm passenger stops.");
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await ensureRegion();
    await rideRequest("me/location", { method: "post", data: {
      latitude: position.coords.latitude, longitude: position.coords.longitude,
    } });
  };
  const refresh = async (ask = false) => {
    try { await reportLocation(ask); setGpsError(""); }
    catch (failure) {
      const message = failure.response?.data?.message || failure.message;
      setGpsError(message);
      console.warn("Driver trip GPS failed:", message);
    }
    await ensureRegion();
    setData(await rideRequest("me/driver"));
  };
  useEffect(() => {
    if (!focused) return undefined;
    run(() => refresh(true));
    const timer = setInterval(() => run(() => refresh()), 15000);
    return () => clearInterval(timer);
  }, [focused]);
  const trip = data?.trip;
  const pending = useMemo(() => trip?.stops.filter((stop) => !stop.completedAt) || [], [trip]);
  const driverLocation = useMemo(() => rideStopPoint({ address: { location: data?.driver.location } }), [data?.driver.location]);
  const next = pending[0];
  const pickups = trip?.stops.filter((stop) => stop.type === "pickup") || [];
  const dropoffs = trip?.stops.filter((stop) => stop.type === "dropoff") || [];
  const completedPickups = pickups.filter((stop) => stop.completedAt).length;
  const completedDropoffs = dropoffs.filter((stop) => stop.completedAt).length;
  const started = trip?.startedAt || trip?.stops.some((stop) => stop.completedAt);
  const callCustomer = (phone) => run(async () => {
    const dialable = String(phone || "").trim().replace(/[^\d+]/g, "");
    if (!/\d/.test(dialable)) throw new Error("No callable contact number is available for this stop.");
    try { await Linking.openURL(`tel:${dialable}`); }
    catch { throw new Error("Unable to open the phone dialer on this device."); }
  });
  const confirmNext = () => Alert.alert("Confirm next stop?", next.type === "pickup"
    ? `Confirm only after all ${next.passengers} listed passengers are inside the vehicle.`
    : `Confirm only after all ${next.passengers} listed passengers have left the vehicle.`, [
    { text: "Not yet", style: "cancel" },
    { text: "Confirm", onPress: () => run(async () => {
      await reportLocation();
      setGpsError("");
      await ensureRegion();
      try {
        await rideRequest("me/next-stop", { method: "post", timeout: 120000,
          data: { stopKey: `${next.ride}:${next.key}` } });
      } finally { await refresh(); }
    }) },
  ]);
  return <SafeAreaView style={s.screen}>
    {trip && pending.length ? <RideRouteMap fullScreen startAtDriver
      ride={{ _id: trip._id, stops: pending }} routeEndpoint="me/route" routeVersion={trip.version}
      driverLocation={driverLocation} bottomInset={collapsed ? 60 : panelHeight}
      distanceUnit={/usa/i.test(region.current) ? "mile" : "km"} /> : <View style={s.empty}>
      <Text style={s.title}>{data ? "No active passenger trip" : "Loading passenger trip..."}</Text>
      {data ? <Text>Your trip has ended or is no longer assigned. Check ride assignments for payments and new offers.</Text> : null}
    </View>}
    <View style={s.header}>
      <Text style={s.liveTitle}>Ride in Progress</Text>
      <View style={s.headerActions}>
        <Button mode="contained" buttonColor="#ffffff" textColor="#111827" onPress={() => navigation.goBack()}>Rides</Button>
        <Button mode="contained" buttonColor="#ffffff" textColor="#111827" disabled={busy} onPress={() => run(() => refresh(true))}>Refresh / GPS</Button>
      </View>
    </View>
    {busy ? <ActivityIndicator style={s.loading} /> : null}
    {error || gpsError ? <View style={s.errorBox}>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {gpsError ? <Text accessibilityRole="alert" style={s.error}>GPS: {gpsError}</Text> : null}
    </View> : null}
    {trip ? collapsed ? <View style={collapsed === "side" ? s.sideTab : s.bottomTab}>
      <Button icon={collapsed === "side" ? "chevron-left" : "chevron-up"} mode="contained"
        accessibilityLabel="Expand trip details" onPress={() => setCollapsed(null)}>Trip details</Button>
    </View> : <View style={s.panel} onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}>
      <View style={s.panelHeader}>
        <Text style={s.title}>Active {trip.mode} trip</Text>
        <IconButton icon="chevron-down" accessibilityLabel="Collapse trip details to bottom" onPress={() => setCollapsed("bottom")} />
        <IconButton icon="chevron-right" accessibilityLabel="Collapse trip details to side" onPress={() => setCollapsed("side")} />
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text>Pickups {completedPickups}/{pickups.length} confirmed. Drop-offs {completedDropoffs}/{dropoffs.length} confirmed.</Text>
        <Text>Onboard {trip.onboardSeats} / {trip.seatCapacity} passenger seats.</Text>
        {!started ? <Button mode="contained" buttonColor="#ffd400" textColor="#111827" disabled={busy} onPress={() => run(async () => {
          await rideRequest("me/start-trip", { method: "post", data: { tripId: trip._id } });
          await refresh();
        })}>Start trip to pickup</Button> : <Text>Trip started. Confirm stops only when passengers board or leave.</Text>}
        <Text style={s.note}>Starting the trip does not mark anyone onboard or start the passenger fare timer. Keep this page open for GPS updates.</Text>
        {next ? <>
          <Text style={s.title}>Next: {next.type === "pickup" ? "Pickup" : "Drop-off"} - {next.passengers} passengers</Text>
          <Text>{addressText(next.address)}</Text>
          <Button disabled={busy} icon="navigation" onPress={() => run(async () => {
            const point = rideStopPoint(next);
            if (!point) throw new Error("The next stop has no verified map location.");
            await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=driving`);
          })}>Navigate to next stop</Button>
          <Button mode="contained" buttonColor="#ffd400" textColor="#111827" disabled={busy || !started || Boolean(gpsError)} onPress={confirmNext}>
            {next.type === "pickup"
              ? `Confirm pickup ${completedPickups + 1}/${pickups.length} - ${next.passengers} passengers`
              : `Confirm drop-off ${completedDropoffs + 1}/${dropoffs.length} - ${next.passengers} passengers`}
          </Button>
        </> : null}
        {pending.map((stop, index) => {
          const rider = data.riders.find((entry) => String(entry._id) === String(stop.ride));
          return <View key={`${stop.ride}:${stop.key}`} style={s.stop}>
            <View style={s.panelHeader}>
              <View style={s.customer}>
                <Text style={s.title}>{rider?.customerName || "Customer"}</Text>
                <Text>Booking #{String(stop.ride).slice(-6)}{rider?.vehicleOption ? ` - ${rideOptionName(rider.vehicleOption)}` : ""}</Text>
              </View>
              <IconButton icon="phone" accessibilityLabel={`Call customer for stop ${index + 1}`}
                disabled={busy || !stop.address.phone} onPress={() => callCustomer(stop.address.phone)} />
            </View>
            <Text>{index + 1}. {stop.type === "pickup" ? "Pickup" : "Drop-off"} - {stop.passengers} passengers</Text>
            <Text>{addressText(stop.address)}</Text>
            {!stop.address.phone ? <Text style={s.error}>Contact number unavailable</Text> : null}
          </View>;
        })}
        <Button disabled={busy} onPress={() => navigation.goBack()}>Service preferences & end booking</Button>
      </ScrollView>
    </View> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" },
  header: { position: "absolute", top: 0, left: 0, right: 0, minHeight: 56, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffd400" },
  liveTitle: { color: "#111827", fontSize: 15, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  panel: { position: "absolute", bottom: 12, left: 12, right: 12, maxHeight: "52%", backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e5eaf1", elevation: 8 },
  panelHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  content: { padding: 14, gap: 10 },
  scroll: { flexShrink: 1 },
  customer: { flex: 1 },
  title: { flexShrink: 1, fontSize: 17, fontWeight: "700", color: "#111827" },
  note: { fontSize: 12, color: "#4b5563" },
  stop: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#e5eaf1", gap: 5 },
  sideTab: { position: "absolute", right: 0, top: "48%" },
  bottomTab: { position: "absolute", left: 12, right: 12, bottom: 12 },
  errorBox: { position: "absolute", top: 190, left: 12, right: 12, backgroundColor: "#fff", padding: 10, borderRadius: 10 },
  error: { color: "#b91c1c" },
  loading: { position: "absolute", top: 58, alignSelf: "center" },
  empty: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
});
