import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rideRequest, offerSeconds, rideFare, addressText } from "../../assets/common/rides";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import baseUrl from "../../assets/common/baseUrl";
import CloudinaryUploader from "../../Shared/CloudinaryUploader";
import { styles } from "../../Shared/DeliveryCheckout";

const RIDE_PHOTO_REFRESH_MS = 90 * 24 * 60 * 60 * 1000;

export default function DriverRides({ navigation }) {
  const focused = useIsFocused();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const [terminationReason, setTerminationReason] = useState("");
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
    setData(await rideRequest("me/driver"));
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
  const pending = data?.trip?.stops.filter((stop) => !stop.completedAt) || [];
  const next = pending[0];
  return <SafeAreaView style={styles.screen}><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Button onPress={() => navigation.goBack()}>Back to delivery dashboard</Button>
    <Text style={styles.title}>Ride assignments & route</Text>
    <Button disabled={busy} onPress={() => run(() => refresh(true))}>Refresh / enable GPS</Button>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {gpsError ? <Text style={styles.error}>GPS: {gpsError}</Text> : null}
    <Text>Keep this screen open during rides for GPS reporting and new offers. Turn-by-turn navigation opens externally; return here to confirm each stop.</Text>
    {data ? <>
      <View style={styles.card}>
        <Text style={styles.heading}>Ride profile photo</Text>
        {data.driver.profilePhotoUrl ? <Image source={{ uri: data.driver.profilePhotoUrl }}
          style={{ width: 88, height: 88, borderRadius: 44, alignSelf: "center" }} /> : null}
        {data.driver.rideProfilePhotoRequired
          ? <Text style={styles.error}>Take a current photo to enable or receive ride offers. Refresh your photo every 90 days. Any ride already in progress can be completed safely.</Text>
          : <Text>Photo saved. Next refresh due {new Date(new Date(data.driver.rideProfilePhotoUpdatedAt).getTime() + RIDE_PHOTO_REFRESH_MS).toLocaleDateString()}.</Text>}
        <Button mode={data.driver.rideProfilePhotoRequired ? "contained" : "outlined"} disabled={busy}
          onPress={updateProfilePhoto}>{data.driver.rideProfilePhotoRequired ? "Take profile photo" : "Refresh profile photo"}</Button>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Service preferences</Text>
        <Text>{data.driver.vehicleType}: {data.driver.passengerSeats || "Admin must configure"} passenger seats (excluding you).</Text>
        <Text>Approval: {data.driver.approvalStatus}. {data.driver.isAvailable ? "Online" : "Offline"}{data.driver.isSuspended ? " - Suspended" : ""}.</Text>
        {[["delivery", "Store product delivery"], ["regular", "Regular rides"], ["shared", "Shared rides"]].map(([mode, label]) => {
          const enabled = data.driver.serviceModes?.[mode] ?? mode === "delivery";
          const requiresPhoto = mode !== "delivery" && data.driver.rideProfilePhotoRequired && !enabled;
          return <View key={mode}>
            <Text>{label}</Text><Switch value={enabled} disabled={busy || requiresPhoto}
              onValueChange={(nextEnabled) => setMode(mode, nextEnabled)} />
            {requiresPhoto ? <Text>Update the required driver photo before enabling this ride service.</Text> : null}
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
      <View style={styles.card}>
        <Text style={styles.heading}>Separate ride assignment list</Text>
        {data.offer && remaining > 0 ? <>
          <Text>{data.offer.mode} - {data.offer.seats} seats - estimate {rideFare(data.offer, data.offer.estimate)}</Text>
          <Text style={styles.heading}>Claim within {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</Text>
          {data.driver.rideProfilePhotoRequired
            ? <Text style={styles.error}>Refresh your ride profile photo before accepting this offer.</Text>
            : null}
          {data.offer.stops.map((stop) => <Text key={stop.key}>{stop.type}: {addressText(stop.address)}</Text>)}
          <Button mode="contained" disabled={busy || data.driver.rideProfilePhotoRequired}
            onPress={() => act(`me/offers/${data.offer._id}/accept`, {})}>Claim ride</Button>
          <Button disabled={busy} onPress={() => act(`me/offers/${data.offer._id}/reject`, {})}>Reject & reroute</Button>
        </> : <Text>{data.offer ? "Offer expired and is being rerouted." : "No current ride offer. Offers expire after three minutes."}</Text>}
      </View>
      {data.trip ? <View style={styles.card}>
        <Text style={styles.heading}>Active {data.trip.mode} route</Text>
        <Text>Onboard {data.trip.onboardSeats} / {data.trip.seatCapacity} seats.</Text>
        {pending.map((stop, index) => <Text key={`${stop.ride}:${stop.key}`}>
          {index + 1}. {stop.type} {stop.passengers} passengers - {addressText(stop.address)} - contact {stop.address.phone}</Text>)}
        {next ? <>
          <Button disabled={busy} onPress={() => run(async () => {
            const coordinates = next.address.location.coordinates;
            await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${coordinates[1]},${coordinates[0]}&travelmode=driving`);
          })}>Navigate to next {next.type}</Button>
          <Button mode="contained" disabled={busy || Boolean(gpsError)} onPress={() => Alert.alert("Confirm next stop?", next.type === "pickup"
            ? "Confirm only after the listed passengers are inside the vehicle." : "Confirm only after the listed passengers have left the vehicle.", [
            { text: "Not yet", style: "cancel" }, { text: "Confirm", onPress: () => run(async () => {
              await location(false, true);
              try { await rideRequest("me/next-stop", { method: "post", timeout: 120000, data: { stopKey: `${next.ride}:${next.key}` } }); }
              finally { await refresh(); }
            }) },
          ])}>{next.type === "pickup" ? "Passengers onboard" : "Passengers dropped off"}</Button>
        </> : null}
        <Text style={styles.heading}>End a booking without completion</Text>
        <Text>Use only after the affected passengers have safely exited. This does not confirm arrival at the destination. Other bookings remain active; payment goes to Admin review.</Text>
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
      </View> : <Text>No active passenger ride.</Text>}
      <View style={styles.card}>
        <Text style={styles.heading}>Ended ride payments & reviews</Text>
        {data.payments.map((ride) => <View key={ride._id}>
          {ride.status === "terminated" ? <Text>Terminated without completion. {ride.paymentStatus === "review_required" ? "Payment on hold for Admin review." : ride.paymentStatus}</Text> : null}
          <Text>#{String(ride._id).slice(-6)} {rideFare(ride)} - {ride.paymentMethod || "Not selected"} / {ride.paymentStatus}</Text>
          {ride.paymentMethod === "cash" && ride.paymentStatus !== "completed" ? <Button disabled={busy}
            onPress={() => Alert.alert("Cash received?", `Confirm only after receiving ${rideFare(ride)} from this booking's payer.`, [
              { text: "Not received", style: "cancel" }, { text: "Received", onPress: () => act(`${ride._id}/received-payment`, {}) },
            ])}>Confirm cash received</Button> : null}
        </View>)}
      </View>
    </> : null}
  </ScrollView></SafeAreaView>;
}
