import React, { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { useIsFocused } from "@react-navigation/native";
import { rideRequest, rideFare, addressText, rideStopPoint } from "../../assets/common/rides";
import { storeRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import CardPayment, { canPayByCard } from "../../Shared/CheckoutCardPayment";
import { styles } from "../../Shared/DeliveryCheckout";
import { AuthContext } from "../../Context/store/Auth";
import RideRouteMap from "../../Shared/RideRouteMap";

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
  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated || needsSignIn) return <View style={styles.content}>
    <Text style={styles.title}>Sign in to view rides</Text>
    <Text>{needsSignIn ? error : "Your ride history and payments require a signed-in account."}</Text>
    <Button disabled={busy} mode="contained" onPress={() => run(async () => {
      if (needsSignIn) await logout();
      navigation.navigate("User", { screen: "Login" });
    })}>Sign in</Button>
  </View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>My rides</Text>
    <Button disabled={busy} onPress={load}>Refresh rides</Button>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {selected ? <View style={styles.card}>
      <Text selectable style={styles.heading}>Ride #{String(selected._id).slice(-6)} - {selected.mode}</Text>
      <Text>Status: {selected.status}</Text><Text>{selected.dispatchMessage}</Text>
      {selected.status === "terminated" ? <>
        <Text>Termination reason: {selected.termination?.reason}</Text>
        <Text>Terminated: {new Date(selected.termination?.at).toLocaleString()}. This ride did not complete its destination drop-off.</Text>
        <Text>{selected.paymentStatus === "review_required" ? "Payment is on hold for Admin review. Do not pay the original estimate." :
          selected.paymentStatus === "waived" ? "Admin waived the fare. No payment is due." : `Admin review: ${selected.termination?.reviewNote || ""}`}</Text>
      </> : null}
      <RideRouteMap ride={selected} distanceUnit={selected.currency === "usd" ? "mile" : "km"}
        driverLocation={selected.status !== "completed" ? rideStopPoint({ address: { location: selected.assignedDriver?.location } }) : null} />
      {selected.stops.map((stop) => <Text key={stop.key}>{stop.type}: {addressText(stop.address)} ({stop.passengers} passengers)</Text>)}
      <Text>Estimate: {rideFare(selected, selected.estimate)}</Text>
      {selected.assignedDriver ? <>
        <Text>Driver: {selected.assignedDriver.name} - {selected.assignedDriver.vehicleType} {selected.assignedDriver.plateNumber || ""}</Text>
        <Text>Contact: {selected.assignedDriver.phone}</Text>
        {selected.status !== "completed" ? <Text>Driver GPS: {selected.assignedDriver.location?.coordinates?.slice().reverse().join(", ") || "Unavailable"}.
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
    </View> : rides.map((ride) => <View key={ride._id} style={styles.card}>
      <Text>{ride.mode} - {ride.status} - {rideFare(ride)}</Text>
      <Text>{addressText(ride.stops[0].address)} to {addressText(ride.stops.at(-1).address)}</Text>
      <Button disabled={busy} onPress={() => run(() => selectRide(ride._id))}>Track / view / pay</Button>
    </View>)}
  </ScrollView>;
}
