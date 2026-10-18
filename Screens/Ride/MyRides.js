import React, { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, Share, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { useIsFocused } from "@react-navigation/native";
import { rideRequest, rideFare, rideOptionName, addressText, rideStopPoint, pickupArrivalText } from "../../assets/common/rides";
import { storeRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import CardPayment, { canPayByCard } from "../../Shared/CheckoutCardPayment";
import { styles } from "../../Shared/DeliveryCheckout";
import { AuthContext } from "../../Context/store/Auth";
import RideRouteMap from "../../Shared/RideRouteMap";

const ui = {
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { borderWidth: 1, borderColor: "#e8eaed", borderRadius: 18, padding: 16, gap: 10, backgroundColor: "#fff" },
  status: { backgroundColor: "#fff8d6", borderRadius: 14, padding: 14, gap: 6 },
  title: { color: "#171b20", fontSize: 22, fontWeight: "800" },
  note: { color: "#68717e", fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
};
const statusLabels = {
  quote: "Ride estimate", waiting: "Finding your driver", offered: "Waiting for driver confirmation",
  assigned: "Driver on the way", onboard: "Trip in progress", completed: "You've arrived",
  cancelled: "Ride cancelled", terminated: "Trip ended early",
};

export default function MyRides({ route, navigation }) {
  const { isAuthenticated, loading, logout } = useContext(AuthContext);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const focused = useIsFocused();
  const [rides, setRides] = useState([]);
  const [selected, setSelected] = useState(null);
  const [banks, setBanks] = useState([]);
  const [method, setMethod] = useState("bank");
  const [bankId, setBankId] = useState("");
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [database, setDatabase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [etaNow, setEtaNow] = useState(Date.now);
  const running = useRef(false);
  const region = useRef(route.params?.database || "");
  const run = async (action, notify = true) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (isAuthenticated && !needsSignIn && region.current && region.current !== db) throw new Error("The region changed. Return to the ride booking page before continuing.");
      region.current = db; setDatabase(db);
      await action();
    } catch (failure) {
      if (failure.response?.status === 401) {
        setNeedsSignIn(true); setRides([]); setSelected(null); setBanks([]);
        setError("Your session has expired or is no longer valid. Sign in again to view rides.");
        return;
      }
      const message = failure.response?.data?.message || failure.message;
      setError(message); if (notify) Alert.alert("Ride needs attention", message);
    } finally { running.current = false; setBusy(false); }
  };
  const selectRide = async (rideId) => {
    const ride = await rideRequest(rideId);
    setSelected(ride); setSender(ride.bankSender || ""); setReference(ride.bankReference || "");
  };
  const load = () => run(async () => {
    const [list, accounts] = await Promise.all([rideRequest(), storeRequest("delivery-bank-accounts")]);
    setRides(list); setBanks(accounts); setBankId(accounts[0]?._id || "");
    if (route.params?.rideId) await selectRide(route.params.rideId);
  });
  useEffect(() => {
    if (focused && isAuthenticated && !loading) {
      setNeedsSignIn(false);
      load();
    }
  }, [focused, isAuthenticated, loading, route.params?.rideId]);
  useEffect(() => {
    if (!focused || !isAuthenticated || needsSignIn || selected?.status !== "assigned" ||
        selected.pickupEta?.status !== "available") return undefined;
    setEtaNow(Date.now());
    const timer = setInterval(() => setEtaNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [focused, isAuthenticated, needsSignIn, selected?._id, selected?.status, selected?.pickupEta]);
  useEffect(() => {
    if (!focused || !isAuthenticated || needsSignIn || loading || !selected || ["completed", "cancelled", "terminated", "quote"].includes(selected.status)) return;
    const timer = setInterval(() => run(async () => setSelected(await rideRequest(selected._id)), false), 10000);
    return () => clearInterval(timer);
  }, [focused, isAuthenticated, needsSignIn, loading, selected?._id, selected?.status]);
  const update = async (path, data) => setSelected(await rideRequest(`${selected._id}/${path}`, { method: "post", data, timeout: 120000 }));
  const pay = (confirmPayment) => run(async () => {
    const payment = await rideRequest(`${selected._id}/payment`, { method: "post", timeout: 60000 });
    setSelected(payment.ride);
    if (payment.ride.paymentStatus === "completed") return;
    const result = await confirmPayment(payment.clientSecret, { paymentMethodType: "Card" });
    if (result.error) throw new Error(`${result.error.message} Resume this same ride payment; do not start another payment.`);
    await update("payment-confirm", {});
  });
  const active = selected && !["completed", "cancelled", "terminated", "quote"].includes(selected.status);
  const driverLocation = active ? rideStopPoint({ address: { location: selected.assignedDriver?.location } }) : null;
  const callDriver = () => run(async () => {
    const phone = selected.assignedDriver?.phone;
    if (!phone) throw new Error("The driver's contact number is not available. Refresh this ride.");
    await Linking.openURL(`tel:${encodeURIComponent(phone)}`);
  });
  const shareRide = () => run(async () => {
    await Share.share({ message: `Addu Genet Ride #${String(selected._id).slice(-6)}\nStatus: ${selected.status}\n` +
      selected.stops.map((stop, index) => `${index + 1}. ${stop.type}: ${addressText(stop.address)}`).join("\n") });
  });
  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated || needsSignIn) return <View style={styles.content}>
    <Text style={styles.title}>Sign in to view rides</Text>
    <Text>{needsSignIn ? error : "Your ride history and payments require a signed-in account."}</Text>
    <Button disabled={busy} mode="contained" onPress={() => run(async () => {
      if (needsSignIn) await logout();
      navigation.navigate("User", { screen: "Login" });
    })}>Sign in</Button>
  </View>;
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Text style={ui.title}>{active ? "Track your ride" : "My rides"}</Text>
    <Button disabled={busy} onPress={load}>Refresh rides</Button>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {selected ? <View style={ui.card}>
      <View style={ui.status} accessibilityLiveRegion="polite">
        <Text style={ui.title}>{statusLabels[selected.status] || selected.status}</Text>
        <Text style={ui.note}>{selected.dispatchMessage || (selected.status === "onboard"
          ? "Follow your trip to the next stop." : selected.status === "assigned"
            ? "Your driver is heading to your pickup." : "Your latest booking status is shown below.")}</Text>
        {active ? <Text style={ui.note}>Updates every 10 seconds while this screen is open.</Text> : null}
      </View>
      <RideRouteMap ride={selected} distanceUnit={selected.currency === "usd" ? "mile" : "km"}
        driverLocation={driverLocation} />
      {active ? <View style={ui.status}>
        <Text style={styles.heading}>{selected.status === "onboard" ? "Live trip location" : "Pickup arrival time"}</Text>
        <Text style={ui.note} accessibilityLiveRegion="polite">{selected.status === "onboard"
          ? "The blue pin shows the driver's latest reported location."
          : pickupArrivalText(selected, Math.max(etaNow, Date.now()))}</Text>
        {selected.status === "assigned" && selected.pickupEta?.status === "available" ? <>
          <Text style={ui.note}>Traffic-aware driving estimate{selected.pickupEta.stopsBeforePickup > 0
            ? `, including ${selected.pickupEta.stopsBeforePickup} stop(s) before your pickup` : ""}.
            Boarding time and changing traffic may affect arrival.</Text>
          <Text style={ui.note}>ETA updated: {new Date(selected.pickupEta.computedAt).toLocaleTimeString()}</Text>
        </> : null}
        {!driverLocation ? <Text accessibilityRole="alert" style={styles.error}>Driver location is not available yet.</Text> : null}
        {driverLocation && (!selected.assignedDriver?.locationUpdatedAt ||
          Date.now() - new Date(selected.assignedDriver.locationUpdatedAt).getTime() > 60000 ||
          !Number.isFinite(new Date(selected.assignedDriver.locationUpdatedAt).getTime()))
          ? <Text accessibilityRole="alert" style={styles.error}>Driver GPS may be out of date. Check the last update below.</Text> : null}
      </View> : null}
      <Text selectable style={styles.heading}>Ride #{String(selected._id).slice(-6)} - {selected.mode}</Text>
      {selected.vehicleOption ? <Text>Vehicle: {rideOptionName(selected.vehicleOption)}</Text> : null}
      <Text>Status: {selected.status}</Text><Text>{selected.dispatchMessage}</Text>
      {selected.status === "terminated" ? <>
        <Text>Termination reason: {selected.termination?.reason}</Text>
        <Text>Terminated: {new Date(selected.termination?.at).toLocaleString()}. This ride did not complete its destination drop-off.</Text>
        <Text>{selected.paymentStatus === "review_required" ? "Payment is on hold for Admin review. Do not pay the original estimate." :
          selected.paymentStatus === "waived" ? "Admin waived the fare. No payment is due." : `Admin review: ${selected.termination?.reviewNote || ""}`}</Text>
      </> : null}
      {selected.stops.map((stop) => <Text key={stop.key}>{stop.type}: {addressText(stop.address)} ({stop.passengers} passengers)</Text>)}
      <Text>Estimate: {rideFare(selected, selected.estimate)}</Text>
      {selected.assignedDriver ? <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 8 }}>
          {selected.assignedDriver.profilePhotoUrl
            ? <Image source={{ uri: selected.assignedDriver.profilePhotoUrl }}
              accessibilityLabel={`${selected.assignedDriver.name}'s driver profile photo`}
              style={{ width: 64, height: 64, borderRadius: 32 }} />
            : <View accessibilityLabel="Driver photo unavailable" style={{ width: 64, height: 64,
              borderRadius: 32, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#4b5563", fontSize: 12 }}>Photo</Text>
            </View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Your driver</Text>
            <Text>{selected.assignedDriver.name} - {selected.assignedDriver.vehicleType} {selected.assignedDriver.plateNumber || ""}</Text>
          </View>
        </View>
        <Text>Contact: {selected.assignedDriver.phone}</Text>
        <View style={ui.actions}>
          <Button icon="phone" mode="outlined" disabled={busy || !selected.assignedDriver.phone} onPress={callDriver}>Call driver</Button>
          <Button icon="share-variant" disabled={busy} onPress={shareRide}>Share ride</Button>
        </View>
        {active ? <Text>Driver GPS: {selected.assignedDriver.location?.coordinates?.slice().reverse().join(", ") || "Unavailable"}.
          Updated: {selected.assignedDriver.locationUpdatedAt ? new Date(selected.assignedDriver.locationUpdatedAt).toLocaleTimeString() : "No current GPS"}</Text> : null}
      </> : null}
      {["waiting", "offered", "assigned", "quote"].includes(selected.status) ? <Button disabled={busy}
        onPress={() => Alert.alert("Cancel ride?", "No fare is due when cancelled before pickup.", [
          { text: "Keep ride", style: "cancel" },
          { text: "Cancel ride", style: "destructive", onPress: () => run(() => update("cancel", {})) },
        ])}>Cancel before pickup</Button> : null}
      {selected.status !== "completed" && !(selected.status === "terminated" &&
        selected.termination?.reviewStatus === "resolved" && selected.paymentStatus !== "waived")
        ? <Text>Payment is available only after your ride finishes or Admin approves a terminated ride's fare.</Text> : <>
        <Text style={styles.heading}>Your final fare: {rideFare(selected)}</Text>
        <Text>Payment: {selected.paymentStatus} {selected.paymentMethod || ""}</Text>
        {selected.paymentStatus !== "completed" ? <>
          {!selected.paymentMethod ? <>
            <Picker selectedValue={method} enabled={!busy} onValueChange={setMethod}>
              <Picker.Item label="Bank transfer" value="bank" />
              {/usa/i.test(database) && canPayByCard ? <Picker.Item label="Card" value="card" /> : null}
              {!/usa/i.test(database) ? <Picker.Item label="Cash to driver" value="cash" /> : null}
            </Picker>
            {method === "bank" ? <Picker selectedValue={bankId} enabled={!busy} onValueChange={setBankId}>
              {banks.map((bank) => <Picker.Item key={bank._id} value={bank._id} label={bank.bankName} />)}
            </Picker> : null}
            <Button disabled={busy || (method === "bank" && !bankId)} onPress={() => run(() => update("payment-method", { method, bankAccountId: bankId }))}>Choose payment method</Button>
          </> : selected.paymentMethod === "card" ? <>
            {canPayByCard ? <CardPayment pay={pay} disabled={busy} label="Pay ride fare" /> : <Text style={styles.error}>Card payment requires a configured development/production build, not Expo Go.</Text>}
            <Button disabled={busy} onPress={() => run(() => update("payment-confirm", {}))}>Check existing card payment</Button>
            <Text>After interruptions, resume this ride's existing payment. Never pay a second time.</Text>
          </> : selected.paymentMethod === "bank" ? <>
            <Text>{selected.bankAccount?.bankName} - {selected.bankAccount?.accountHolderName}</Text>
            <Text selectable>{selected.bankAccount?.accountNumber} {selected.bankAccount?.bankCode}</Text>
            <Text>Transfer your fare once. Payment stays pending until Admin confirms receipt.</Text>
            <TextInput label="Transfer sender" value={sender} onChangeText={setSender} />
            <TextInput label="Transfer reference" value={reference} onChangeText={setReference} />
            <Button disabled={busy} onPress={() => run(() => update("payment-confirm", { sender, reference }))}>Submit bank transfer reference</Button>
          </> : <Text>Pay the assigned driver. They will confirm the cash receipt; do not pay twice.</Text>}
        </> : <Text style={styles.success}>Payment received. Thank you.</Text>}
      </>}
      <Button disabled={busy} onPress={() => run(() => selectRide(selected._id))}>Refresh this ride</Button>
      <Button onPress={() => setSelected(null)}>Back to ride list</Button>
    </View> : rides.map((ride) => <View key={ride._id} style={ui.card}>
      <Text>{ride.mode} - {ride.status} - {rideFare(ride)}</Text>
      <Text>{addressText(ride.stops[0].address)} to {addressText(ride.stops.at(-1).address)}</Text>
      <Button disabled={busy} onPress={() => run(() => selectRide(ride._id))}>Track / view / pay</Button>
    </View>)}
  </ScrollView>;
}
