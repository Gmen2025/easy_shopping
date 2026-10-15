import React, { useEffect, useRef, useState } from "react";
import { Alert, ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { rideRequest, rideFare, addressText } from "../../assets/common/rides";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";

const fields = [["baseFare", "Base fare"], ["distanceRate", "Rate per mile (USA) / km (Ethiopia)"], ["minuteRate", "Rate per minute"],
  ["sharedDiscountPercent", "Shared discount (%)"], ["maxPickupMinutes", "Maximum pickup wait (minutes)"],
  ["maxDetourMinutes", "Maximum shared extra travel (minutes)"], ["driverRadiusKm", "Driver search radius (km)"]];

export default function RideSettings() {
  const [config, setConfig] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [seats, setSeats] = useState({});
  const [payments, setPayments] = useState([]);
  const [reviews, setReviews] = useState({});
  const [database, setDatabase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const region = useRef("");
  const run = async (action) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (region.current && region.current !== db) throw new Error("Region changed. Reopen Ride settings before editing.");
      region.current = db; setDatabase(db); await action();
    } catch (failure) {
      const message = failure.response?.data?.message || failure.message;
      setError(message); Alert.alert("Ride settings", message);
    } finally { running.current = false; setBusy(false); }
  };
  const refresh = async () => {
    const [policy, company, paid] = await Promise.all([rideRequest("config"), rideRequest("admin/drivers"), rideRequest("admin/payments")]);
    setConfig({ ...Object.fromEntries(fields.map(([key]) => [key, ""])), ...policy });
    setDrivers(company); setPayments(paid);
    setSeats(Object.fromEntries(company.map((driver) => [driver._id, String(driver.passengerSeats || "")])));
  };
  useEffect(() => { run(refresh); }, []);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Ride fares, pooling & payments</Text>
    <Text>Region: {database}. Configure rates in the region's currency. Passenger rides are separate from inventory/delivery activation.</Text>
    <Button disabled={busy} onPress={() => run(refresh)}>Reload</Button>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {config ? <View style={styles.card}>
      <Text style={styles.heading}>Enable ride requests</Text>
      <Switch disabled={busy} value={config.enabled} onValueChange={(enabled) => setConfig((previous) => ({ ...previous, enabled }))} />
      {fields.map(([key, label]) => <TextInput key={key} label={label} keyboardType="decimal-pad" disabled={busy}
        value={String(config[key])} onChangeText={(value) => setConfig((previous) => ({ ...previous, [key]: value }))} style={styles.input} />)}
      <Text>Existing bookings retain their agreed tariff. Shared riders pay their solo route/time fare minus the discount, not other riders' detours.
        Regular riders pay one fare based on planned distance and actual elapsed ride time.</Text>
      <Button mode="contained" disabled={busy} onPress={() => run(async () => {
        setConfig(await rideRequest("config", { method: "put", data: config }));
        Alert.alert("Saved", "Ride configuration saved for this region.");
      })}>Save ride configuration</Button>
    </View> : null}
    <View style={styles.card}>
      <Text style={styles.heading}>Company drivers: passenger seats</Text>
      <Text>Set usable seats excluding the driver, only for car/van vehicles. Drivers independently choose delivery, regular and/or shared service modes.
        Seat capacity cannot be changed while a trip or offer is active.</Text>
      {drivers.map((driver) => <View key={driver._id}>
        <Text>{driver.name} - {driver.vehicleType || driver.vehicle?.type}</Text>
        <Text>Modes: {Object.entries(driver.serviceModes || { delivery: true }).filter(([, enabled]) => enabled).map(([mode]) => mode).join(", ")}</Text>
        <TextInput disabled={busy} keyboardType="number-pad" label="Passenger seats (1-16)" value={seats[driver._id]}
          onChangeText={(value) => setSeats((previous) => ({ ...previous, [driver._id]: value }))} />
        <Button disabled={busy} onPress={() => run(async () => {
          await rideRequest(`admin/drivers/${driver._id}`, { method: "put", data: { passengerSeats: Number(seats[driver._id]) } });
          await refresh();
        })}>Save seats for {driver.name}</Button>
      </View>)}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Completed rides & terminated ride reviews (latest 100)</Text>
      {payments.map((ride) => <View key={ride._id}>
        <Text selectable>Ride {ride._id} - payer {ride.user}</Text>
        <Text>{addressText(ride.stops[0].address)} to {addressText(ride.stops.at(-1).address)}</Text>
        <Text>{rideFare(ride)} - {ride.paymentMethod || "Not selected"} / {ride.paymentStatus}</Text>
        {ride.status === "terminated" ? <>
          <Text>Terminated: {ride.termination?.reason}. At {new Date(ride.termination?.at).toLocaleString()}.</Text>
          <Text>Reported GPS (longitude, latitude): {ride.termination?.location?.coordinates?.join(", ")}</Text>
          {ride.paymentStatus === "review_required" ? <>
            <Text>Review the early termination. No automatic fare has been charged.</Text>
            <TextInput label="Reviewed fare (0 to waive)" keyboardType="decimal-pad" disabled={busy}
              value={reviews[ride._id]?.fare || ""}
              onChangeText={(fare) => setReviews((previous) => ({ ...previous,
                [ride._id]: { ...previous[ride._id], fare } }))} />
            <TextInput label="Admin review note" maxLength={500} disabled={busy}
              value={reviews[ride._id]?.note || ""}
              onChangeText={(note) => setReviews((previous) => ({ ...previous,
                [ride._id]: { ...previous[ride._id], note } }))} />
            <Button disabled={busy || !reviews[ride._id]?.fare?.trim() || !reviews[ride._id]?.note?.trim()}
              onPress={() => Alert.alert("Resolve termination review?", "The entered fare will be payable by the rider, or waived if zero. This review cannot be edited through this screen.", [
                { text: "Keep reviewing", style: "cancel" },
                { text: "Resolve review", onPress: () => run(async () => {
                  await rideRequest(`admin/terminations/${ride._id}/review`, { method: "post",
                    data: { fare: Number(reviews[ride._id].fare), note: reviews[ride._id].note } });
                  await refresh();
                }) },
              ])}>Resolve termination review</Button>
          </> : <Text>Review: {ride.termination?.reviewNote}</Text>}
        </> : null}
        {ride.paymentMethod === "bank" ? <>
          <Text>{ride.bankAccount?.bankName} {ride.bankAccount?.accountNumber}</Text>
          <Text selectable>Sender: {ride.bankSender || "Not submitted"}. Reference: {ride.bankReference || "Not submitted"}</Text>
        </> : null}
        {["bank", "cash"].includes(ride.paymentMethod) && ride.paymentStatus !== "completed" ? <Button disabled={busy || (ride.paymentMethod === "bank" && !ride.bankReference)}
          onPress={() => Alert.alert("Verify payment received?", `Verify ${rideFare(ride)} was received for this exact ride before confirming.`, [
            { text: "Not received", style: "cancel" }, { text: "Received", onPress: () => run(async () => {
              await rideRequest(`${ride._id}/received-payment`, { method: "post" }); await refresh();
            }) },
          ])}>Confirm {ride.paymentMethod} received</Button> : null}
      </View>)}
    </View>
  </ScrollView>;
}
