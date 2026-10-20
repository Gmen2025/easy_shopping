import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rideRequest, offerSeconds, rideFare, rideOptionName, addressText, rideStopPoint } from "../../assets/common/rides";
import RideRouteMap from "../../Shared/RideRouteMap";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import baseUrl from "../../assets/common/baseUrl";
import CloudinaryUploader from "../../Shared/CloudinaryUploader";

const RIDE_PHOTO_REFRESH_MS = 90 * 24 * 60 * 60 * 1000;

export default function DriverRides({ navigation }) {
  const focused = useIsFocused();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const [terminationReason, setTerminationReason] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [selectedTab, setSelectedTab] = useState("home");
  const [now, setNow] = useState(Date.now());
  const running = useRef(false);
  const region = useRef("");
  const run = async (action, notify = true) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (region.current && region.current !== db) throw new Error("The region changed. Return to your dashboard and reopen rides.");
      region.current = db; await action();
    } catch (failure) {
      const message = failure.response?.data?.message || failure.message;
      setError(message); if (notify) Alert.alert("Driver rides", message);
    } finally { running.current = false; setBusy(false); }
  };
  const location = async (ask = false, requireSuccess = false) => {
    try {
      const permission = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission is required for ride offers and confirming stops.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await rideRequest("me/location", { method: "post", data: {
        latitude: position.coords.latitude, longitude: position.coords.longitude,
      } });
      setGpsError("");
    } catch (failure) {
      setGpsError(failure.response?.data?.message || failure.message);
      console.warn("Driver ride GPS failed:", failure.message);
      if (requireSuccess) throw failure;
    }
  };
  const refresh = async (ask = false) => {
    await location(ask);
    const updated = await rideRequest("me/driver");
    setData(updated);
    setVehicleType((selected) => selected || updated.driver.pendingVehicleType || updated.driver.vehicleType);
    setNow(Date.now());
  };
  useEffect(() => {
    if (!focused) return;
    run(() => refresh(true));
    const timer = setInterval(() => run(() => refresh(), false), 15000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); clearInterval(clock); };
  }, [focused]);
  const act = (path, body) => run(async () => {
    try { await rideRequest(path, { method: "post", data: body, timeout: 120000 }); }
    finally { await refresh(); }
  });
  const updateProfilePhoto = () => run(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      throw new Error("Camera permission is required to take your ride profile photo.");
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const photo = result.assets?.[0];
    if (!photo?.uri) throw new Error("The camera did not return a photo. Please try again.");
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Sign in again before updating your ride profile photo.");
    const signatureUrl = `${baseUrl.replace(/\/$/, "")}/sign`;
    const signature = await CloudinaryUploader.getSignature(signatureUrl, { folder: "driver_profiles" }, { token });
    const upload = await CloudinaryUploader.uploadToCloudinary(photo.uri, signature, {
      folder: "driver_profiles",
      fileName: "ride-driver-profile.jpg",
      fileType: photo.mimeType || "image/jpeg",
    });
    if (!upload.secure_url) throw new Error("Photo upload did not return a secure image URL.");
    await rideRequest("me/profile-photo", { method: "put", data: { profilePhotoUrl: upload.secure_url } });
    await refresh();
    Alert.alert("Profile photo updated", "Your new photo is saved. Take another photo in 90 days to keep accepting ride offers.");
  });
  const setMode = (mode, enabled) => {
    const save = () => run(async () => {
      await rideRequest("me/modes", { method: "put", data: { delivery: true, regular: false, shared: false,
        ...data.driver.serviceModes, [mode]: enabled } });
      await refresh();
    });
    if (mode === "shared" && !enabled) Alert.alert("Disable shared rides?", "Accepted riders not yet picked up will immediately be rerouted. Onboard riders stay with you.", [
      { text: "Keep enabled", style: "cancel" }, { text: "Disable & reroute", onPress: save },
    ]);
    else save();
  };
  const remaining = data?.offer ? offerSeconds(data.offer.offerDeadline, now) : 0;
  const pending = useMemo(() => data?.trip?.stops.filter((stop) => !stop.completedAt) || [], [data?.trip]);
  const driverLocation = useMemo(() => rideStopPoint({ address: { location: data?.driver.location } }), [data?.driver.location]);
  const next = pending[0];
  const payments = data?.payments || [];
  const completedRides = payments.filter((ride) => ride.status === "completed");
  const recentCompletedFares = completedRides.reduce((total, ride) => total + Number(ride.finalFare || 0), 0);
  const tabItems = [
    ["home", "Home"],
    ["rides", "My Rides"],
    ["earnings", "Earnings"],
    ["profile", "Profile"],
  ];
  return <SafeAreaView style={s.screen}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.appHeader}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to delivery dashboard"
          onPress={() => navigation.goBack()} style={s.backButton}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={s.brand}>
          <Text style={s.brandTitle}>Addu Genet Ride</Text>
          <Text style={s.brandSubtitle}>Driver</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh ride status"
          disabled={busy} onPress={() => run(() => refresh(true))} style={s.refreshButton}>
          <Text style={s.refreshText}>{busy ? "..." : "Refresh"}</Text>
        </TouchableOpacity>
      </View>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {gpsError ? <Text accessibilityRole="alert" style={s.error}>GPS: {gpsError}</Text> : null}
    <Text style={s.helper}>Keep this screen open during rides for GPS reporting and new offers. Turn-by-turn navigation opens externally; return here to confirm each stop.</Text>
    {data ? <>
      {selectedTab === "home" ? <>
        <View style={s.profileCard}>
          {data.driver.profilePhotoUrl
            ? <Image source={{ uri: data.driver.profilePhotoUrl }} style={s.avatar} />
            : <View style={s.avatarPlaceholder}><Text style={s.avatarInitial}>{(data.driver.name || "D").slice(0, 1).toUpperCase()}</Text></View>}
          <View style={s.profileDetails}>
            <Text style={s.driverName}>{data.driver.name || "Ride Driver"}</Text>
            <Text style={s.vehicleText}>{data.driver.vehicleType}{data.driver.passengerSeats ? ` · ${data.driver.passengerSeats} passenger seats` : ""}</Text>
            <Text style={s.approvalText}>Approval: {data.driver.approvalStatus}</Text>
          </View>
          <View style={[s.statusPill, data.driver.isAvailable ? s.onlinePill : s.offlinePill]}>
            <Text style={s.statusText}>{data.driver.isAvailable ? "Online" : "Offline"}</Text>
          </View>
        </View>

        <View style={s.metricsCard}>
          <View style={s.metric}>
            <Text style={s.metricValue}>{completedRides.length}</Text>
            <Text style={s.metricLabel}>Recent rides</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metric}>
            <Text style={s.metricValue}>{data.trip?.onboardSeats || 0}</Text>
            <Text style={s.metricLabel}>Passengers onboard</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metric}>
            <Text style={s.metricValue}>{data.trip ? "Active" : "Ready"}</Text>
            <Text style={s.metricLabel}>Ride status</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.sectionHeadingRow}>
            <Text style={s.heading}>Ride availability</Text>
            <Text style={[s.statusText, data.driver.isAvailable ? s.onlineText : s.offlineText]}>
              {data.driver.isAvailable ? "● Online" : "● Offline"}
            </Text>
          </View>
          <Text style={s.bodyText}>{data.trip
            ? "Your passenger trip is in progress. Open My Rides to follow the route and confirm each stop."
            : data.offer && remaining > 0
              ? "A new ride request is waiting for your response."
              : "You are ready to receive ride requests when your ride service is enabled."}</Text>
          {data.driver.isSuspended ? <Text style={s.error}>Your driver account is suspended. Contact an administrator for help.</Text> : null}
          <TouchableOpacity style={s.primaryButton} onPress={() => setSelectedTab("rides")}>
            <Text style={s.primaryButtonText}>{data.trip ? "Open active ride" : data.offer ? "View ride request" : "View ride assignments"}</Text>
          </TouchableOpacity>
        </View>

        {data.trip && pending.length ? <View style={s.card}>
          <Text style={s.heading}>Live route</Text>
          <RideRouteMap ride={{ _id: data.trip._id, stops: pending }} routeEndpoint="me/route" startAtDriver
            routeVersion={data.trip.version} driverLocation={driverLocation}
            distanceUnit={/usa/i.test(region.current) ? "mile" : "km"} />
          {next ? <Text style={s.bodyText}>Next stop: {next.type === "pickup" ? "Pickup" : "Drop-off"} · {addressText(next.address)}</Text> : null}
        </View> : null}

        <View style={s.card}>
          <View style={s.sectionHeadingRow}>
            <Text style={s.heading}>Recent rides</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => setSelectedTab("earnings")}>
              <Text style={s.link}>View all ›</Text>
            </TouchableOpacity>
          </View>
          {payments.slice(0, 3).length ? payments.slice(0, 3).map((ride) => (
            <View key={ride._id} style={s.paymentRow}>
              <View style={s.paymentDetails}>
                <Text style={s.bodyText} numberOfLines={1}>{ride.stops?.[0]?.address?.address1 || "Ride"} → {ride.stops?.at(-1)?.address?.address1 || "Destination"}</Text>
                <Text style={s.mutedText}>{ride.status === "terminated" ? "Ended early" : "Completed"} · {ride.paymentStatus || "Payment pending"}</Text>
              </View>
              <Text style={s.fareText} numberOfLines={1} adjustsFontSizeToFit>{rideFare(ride)}</Text>
            </View>
          )) : <Text style={s.mutedText}>Completed ride history will appear here.</Text>}
        </View>
      </> : null}

      {selectedTab === "profile" ? <>
      <View style={s.card}>
        <Text style={s.heading}>Ride profile photo</Text>
        {data.driver.profilePhotoUrl ? <Image source={{ uri: data.driver.profilePhotoUrl }}
          style={s.largeAvatar} /> : null}
        {data.driver.rideProfilePhotoRequired
          ? <Text style={s.error}>Take a current photo to enable or receive ride offers. Refresh your photo every 90 days. Any ride already in progress can be completed safely.</Text>
          : <Text style={s.bodyText}>Photo saved. Next refresh due {new Date(new Date(data.driver.rideProfilePhotoUpdatedAt).getTime() + RIDE_PHOTO_REFRESH_MS).toLocaleDateString()}.</Text>}
        <Button mode={data.driver.rideProfilePhotoRequired ? "contained" : "outlined"} disabled={busy}
          buttonColor={data.driver.rideProfilePhotoRequired ? "#facc00" : undefined} textColor="#111827"
          onPress={updateProfilePhoto}>{data.driver.rideProfilePhotoRequired ? "Take profile photo" : "Refresh profile photo"}</Button>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Service preferences</Text>
        <Text style={s.bodyText}>{data.driver.vehicleType}: {data.driver.passengerSeats || "Admin must configure"} passenger seats (excluding you).</Text>
        {data.driver.carClass ? <Text>Car class: {data.driver.carClass}</Text> : null}
        {data.driver.vehicleType === "car" && !data.driver.carClass ? <Text style={s.error}>
          Ask Admin to assign Economy or Comfort before receiving bookings for a selected car class.
        </Text> : null}
        <Text style={s.bodyText}>Select the vehicle you drive. A different type requires Admin verification; passenger offers pause while it is pending.
          Motorcycle and truck are delivery-only. Cars and vans require Admin-configured passenger seats.</Text>
        {data.driver.pendingVehicleType ? <Text style={s.error}>
          Awaiting Admin verification: {data.driver.pendingVehicleType}. Registered vehicle remains {data.driver.vehicleType}.
        </Text> : null}
        <Picker style={s.picker} selectedValue={vehicleType} enabled={!busy && !data.trip && !data.offer} onValueChange={setVehicleType}>
          <Picker.Item label="Select registered vehicle..." value="" />
          {[["motorcycle", "Motorcycle"], ["car", "Car"], ["van", "Van"], ["truck", "Truck"]].map(([value, label]) =>
            <Picker.Item key={value} label={label} value={value} />)}
        </Picker>
        <Button mode="contained" buttonColor="#facc00" textColor="#111827" disabled={busy || !vehicleType || Boolean(data.trip || data.offer)} onPress={() => run(async () => {
          await rideRequest("me/vehicle", { method: "put", data: { vehicleType } });
          await refresh();
          Alert.alert("Vehicle selection saved", "Admin must verify a changed vehicle before new passenger offers. Select your registered type again to cancel a pending change.");
        })}>Submit vehicle selection</Button>
        <Text style={s.bodyText}>Approval: {data.driver.approvalStatus}. {data.driver.isAvailable ? "Online" : "Offline"}{data.driver.isSuspended ? " - Suspended" : ""}.</Text>
        {[["delivery", "Store product delivery"], ["regular", "Regular rides"], ["shared", "Shared rides"]].map(([mode, label]) => {
          const enabled = data.driver.serviceModes?.[mode] ?? mode === "delivery";
          const requiresPhoto = mode !== "delivery" && data.driver.rideProfilePhotoRequired && !enabled;
          const requiresVehicle = mode !== "delivery" && Boolean(data.driver.pendingVehicleType) && !enabled;
          return <View key={mode}>
            <View style={s.preferenceRow}><Text style={s.bodyText}>{label}</Text><Switch color="#16a34a" value={enabled} disabled={busy || requiresPhoto || requiresVehicle}
              onValueChange={(nextEnabled) => setMode(mode, nextEnabled)} />
            </View>
            {requiresPhoto ? <Text style={s.mutedText}>Update the required driver photo before enabling this ride service.</Text> : null}
          </View>;
        })}
        {data.driver.serviceModes?.shared ? <>
          <Text>Shared intake: {data.driver.sharedIntakeOpen ? "Open" : "Closed"}</Text>
          <Button disabled={busy} onPress={() => data.driver.sharedIntakeOpen
            ? Alert.alert("Stop new shared pickups?", "All accepted-but-not-picked-up riders are immediately rerouted to another driver. Only onboard riders remain in your route.", [
              { text: "Keep open", style: "cancel" }, { text: "Stop & reroute", onPress: () => act("me/shared-intake", { open: false }) },
            ]) : act("me/shared-intake", { open: true })}>{data.driver.sharedIntakeOpen ? "Stop shared intake" : "Reopen shared intake"}</Button>
        </> : null}
      </View>
      </> : null}

      {selectedTab === "rides" ? <View style={s.card}>
        <View style={s.sectionHeadingRow}>
          <Text style={s.heading}>Ride request</Text>
          {data.offer && remaining > 0 ? <Text style={s.countdown}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</Text> : null}
        </View>
        {data.offer && remaining > 0 ? <>
          <Text style={s.bodyText}>{rideOptionName(data.offer.vehicleOption) || data.offer.mode} · {data.offer.seats} passenger{data.offer.seats === 1 ? "" : "s"}</Text>
          {data.offer.vehicleOption ? <Text style={s.mutedText}>Requested vehicle: {rideOptionName(data.offer.vehicleOption)}</Text> : null}
          <View style={s.fareBox}><Text style={s.mutedText}>Estimated fare</Text><Text style={s.fareLarge} numberOfLines={1} adjustsFontSizeToFit>{rideFare(data.offer, data.offer.estimate)}</Text></View>
          {data.driver.rideProfilePhotoRequired
            ? <Text style={s.error}>Refresh your ride profile photo before accepting this offer.</Text>
            : null}
          {data.offer.stops.map((stop, index) => <View key={stop.key} style={s.stopRow}>
            <View style={[s.stopDot, stop.type === "pickup" ? s.pickupDot : s.dropoffDot]} />
            <View style={s.stopDetails}>
              <Text style={[s.stopLabel, stop.type === "pickup" ? s.pickupText : s.dropoffText]}>{index + 1}. {stop.type === "pickup" ? "Pickup" : "Drop-off"}</Text>
              <Text style={s.bodyText}>{addressText(stop.address)}</Text>
            </View>
          </View>)}
          <View style={s.actionsRow}>
          <Button mode="outlined" disabled={busy} textColor="#111827" onPress={() => act(`me/offers/${data.offer._id}/reject`, {})}>Decline</Button>
          <Button mode="contained" buttonColor="#facc00" textColor="#111827" disabled={busy || data.driver.rideProfilePhotoRequired}
            onPress={() => run(async () => {
              await rideRequest(`me/offers/${data.offer._id}/accept`, { method: "post", data: {}, timeout: 120000 });
              navigation.navigate("DriverRideTrip", { database: region.current });
            })}>Accept Ride</Button>
          </View>
        </> : <Text style={s.mutedText}>{data.offer ? "Offer expired and is being rerouted." : "No current ride offer. New offers expire after three minutes."}</Text>}
      </View> : null}

      {selectedTab === "rides" && data.trip ? <View style={s.card}>
        <Text style={s.heading}>Active {data.trip.mode} trip</Text>
        <Button mode="contained" buttonColor="#facc00" textColor="#111827" disabled={busy}
          onPress={() => navigation.navigate("DriverRideTrip", { database: region.current })}>Open full-screen ride map</Button>
        <Text style={s.bodyText}>Onboard {data.trip.onboardSeats} / {data.trip.seatCapacity} seats.</Text>
        <RideRouteMap ride={{ _id: data.trip._id, stops: pending }} routeEndpoint="me/route" startAtDriver
          routeVersion={data.trip.version} driverLocation={driverLocation}
          distanceUnit={/usa/i.test(region.current) ? "mile" : "km"} />
        {pending.map((stop, index) => <Text key={`${stop.ride}:${stop.key}`}>
          {index + 1}. {stop.type} {stop.passengers} passengers - {addressText(stop.address)}</Text>)}
        {next ? <>
          <Button disabled={busy} textColor="#14532d" onPress={() => run(async () => {
            const coordinates = next.address.location.coordinates;
            await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${coordinates[1]},${coordinates[0]}&travelmode=driving`);
          })}>Navigate to next {next.type}</Button>
          <Button mode="contained" buttonColor="#facc00" textColor="#111827" disabled={busy || Boolean(gpsError)} onPress={() => Alert.alert("Confirm next stop?", next.type === "pickup"
            ? "Confirm only after the listed passengers are inside the vehicle." : "Confirm only after the listed passengers have left the vehicle.", [
            { text: "Not yet", style: "cancel" }, { text: "Confirm", onPress: () => run(async () => {
              await location(false, true);
              try { await rideRequest("me/next-stop", { method: "post", timeout: 120000, data: { stopKey: `${next.ride}:${next.key}` } }); }
              finally { await refresh(); }
            }) },
          ])}>{next.type === "pickup" ? "Passengers onboard" : "Passengers dropped off"}</Button>
        </> : null}
        <Text style={s.heading}>End a booking without completion</Text>
        <Text style={s.bodyText}>Use only after the affected passengers have safely exited. This does not confirm arrival at the destination. Other bookings remain active; payment goes to Admin review.</Text>
        <TextInput label="Termination reason" value={terminationReason} maxLength={500} disabled={busy}
          onChangeText={setTerminationReason} />
        {data.riders.map((rider) => <Button key={rider._id} disabled={busy || !terminationReason.trim()}
          onPress={() => Alert.alert("Terminate this booking?", "Confirm the affected passengers have safely exited. The booking will end at your reported GPS, not be marked completed. Admin will review any fare.", [
            { text: "Keep booking", style: "cancel" },
            { text: "Terminate booking", style: "destructive", onPress: () => run(async () => {
              await location(false, true);
              try {
                await rideRequest(`me/rides/${rider._id}/terminate`, { method: "post",
                  data: { reason: terminationReason }, timeout: 120000 });
                setTerminationReason("");
              } finally { await refresh(); }
            }) },
          ])}>Terminate booking #{String(rider._id).slice(-6)}</Button>)}
      </View> : selectedTab === "rides" ? <View style={s.card}><Text style={s.bodyText}>No active passenger ride.</Text></View> : null}

      {selectedTab === "earnings" ? <View style={s.card}>
        <Text style={s.heading}>Completed ride fares</Text>
        <Text style={s.mutedText}>Fare total from the 20 most recent ended rides. Payment status is shown for each ride below.</Text>
        <Text style={s.fareLarge} numberOfLines={1} adjustsFontSizeToFit>{rideFare({ currency: payments[0]?.currency || (region.current.toLowerCase().includes("usa") ? "usd" : "etb") }, recentCompletedFares)}</Text>
        <Text style={s.mutedText}>{completedRides.length} completed ride{completedRides.length === 1 ? "" : "s"} in recent history</Text>
        <View style={s.divider} />
        <Text style={s.heading}>Ride history</Text>
        {payments.length ? payments.map((ride) => <View key={ride._id} style={s.historyCard}>
          <View style={s.sectionHeadingRow}>
            <Text style={[s.bodyText, s.historyRoute]}>{ride.stops?.[0]?.address?.address1 || "Pickup"} → {ride.stops?.at(-1)?.address?.address1 || "Drop-off"}</Text>
            <Text style={s.fareText} numberOfLines={1} adjustsFontSizeToFit>{rideFare(ride)}</Text>
          </View>
          <Text style={s.mutedText}>#{String(ride._id).slice(-6)} · {ride.status === "terminated" ? "Terminated" : "Completed"} · {ride.paymentMethod || "Payment method not selected"} · {ride.paymentStatus || "Payment pending"}</Text>
          {ride.status === "terminated" ? <Text style={s.mutedText}>Ended without completion. {ride.paymentStatus === "review_required" ? "Payment is on hold for Admin review." : ""}</Text> : null}
          {ride.paymentMethod === "cash" && ride.paymentStatus !== "completed" ? <Button disabled={busy}
            onPress={() => Alert.alert("Cash received?", `Confirm only after receiving ${rideFare(ride)} from this booking's payer.`, [
              { text: "Not received", style: "cancel" }, { text: "Received", onPress: () => act(`${ride._id}/received-payment`, {}) },
            ])}>Confirm cash received</Button> : null}
        </View>) : <Text style={s.mutedText}>Completed ride history will appear here.</Text>}
      </View> : null}
    </> : null}
    </ScrollView>
    <View style={s.tabBar}>
      {tabItems.map(([key, label]) => <TouchableOpacity key={key} accessibilityRole="button"
        accessibilityLabel={label} accessibilityState={{ selected: selectedTab === key }}
        onPress={() => setSelectedTab(key)} style={s.tabItem}>
        <Text style={[s.tabIcon, selectedTab === key && s.tabIconActive]}>{key === "home" ? "⌂" : key === "rides" ? "◉" : key === "earnings" ? "$" : "○"}</Text>
        <Text style={[s.tabLabel, selectedTab === key && s.tabLabelActive]}>{label}</Text>
      </TouchableOpacity>)}
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 20, gap: 12 },
  appHeader: { minHeight: 62, marginHorizontal: -14, marginTop: -14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: "#ffd400" },
  backButton: { width: 40, height: 42, justifyContent: "center" },
  backText: { fontSize: 34, lineHeight: 38, color: "#111827" },
  brand: { flex: 1 },
  brandTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  brandSubtitle: { fontSize: 12, color: "#374151" },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#ffffff" },
  refreshText: { fontSize: 12, color: "#111827", fontWeight: "700" },
  helper: { fontSize: 12, color: "#64748b" },
  card: { padding: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5eaf1", gap: 10, elevation: 2 },
  profileCard: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5eaf1", gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#e2e8f0" },
  avatarPlaceholder: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 24, fontWeight: "700", color: "#334155" },
  profileDetails: { flex: 1, gap: 2 },
  driverName: { fontSize: 16, fontWeight: "800", color: "#111827" },
  vehicleText: { fontSize: 12, color: "#475569", textTransform: "capitalize" },
  approvalText: { fontSize: 11, color: "#64748b" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  onlinePill: { backgroundColor: "#dcfce7" },
  offlinePill: { backgroundColor: "#f1f5f9" },
  statusText: { fontSize: 12, fontWeight: "700" },
  onlineText: { color: "#15803d" },
  offlineText: { color: "#64748b" },
  metricsCard: { flexDirection: "row", alignItems: "center", paddingVertical: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5eaf1" },
  metric: { flex: 1, alignItems: "center", gap: 3 },
  metricValue: { fontSize: 17, fontWeight: "800", color: "#111827" },
  metricLabel: { textAlign: "center", fontSize: 10, color: "#64748b" },
  metricDivider: { width: 1, height: 34, backgroundColor: "#e2e8f0" },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  heading: { fontSize: 16, fontWeight: "800", color: "#111827" },
  bodyText: { fontSize: 13, lineHeight: 19, color: "#1f2937" },
  mutedText: { fontSize: 12, lineHeight: 17, color: "#64748b" },
  link: { fontSize: 12, fontWeight: "700", color: "#8a6c09" },
  primaryButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#ffd400", marginTop: 4 },
  primaryButtonText: { color: "#111827", fontWeight: "800", fontSize: 14 },
  largeAvatar: { width: 88, height: 88, borderRadius: 44, alignSelf: "center" },
  picker: { backgroundColor: "#f8fafc", borderRadius: 10 },
  preferenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  countdown: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: "#fff4cc", color: "#8a5b00", fontSize: 13, fontWeight: "800" },
  fareBox: { padding: 12, borderRadius: 12, backgroundColor: "#fff9dc" },
  fareLarge: { width: "100%", fontSize: 22, fontWeight: "800", color: "#111827" },
  fareText: { maxWidth: "45%", flexShrink: 1, textAlign: "right", fontSize: 14, fontWeight: "800", color: "#111827" },
  historyRoute: { flex: 1, minWidth: 0 },
  stopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  stopDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  pickupDot: { backgroundColor: "#16a34a" },
  dropoffDot: { backgroundColor: "#ef4444" },
  stopDetails: { flex: 1, gap: 2 },
  stopLabel: { fontSize: 12, fontWeight: "700" },
  pickupText: { color: "#15803d" },
  dropoffText: { color: "#dc2626" },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 4 },
  paymentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  paymentDetails: { flex: 1, minWidth: 0, gap: 3 },
  historyCard: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9", gap: 5 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 4 },
  error: { color: "#b91c1c", fontSize: 12, lineHeight: 18, padding: 10, backgroundColor: "#fef2f2", borderRadius: 8 },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e5eaf1", paddingTop: 8, paddingBottom: 6 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  tabIcon: { fontSize: 20, color: "#64748b", lineHeight: 22 },
  tabIconActive: { color: "#eab308" },
  tabLabel: { fontSize: 10, color: "#64748b" },
  tabLabelActive: { color: "#ca8a04", fontWeight: "800" },
});
