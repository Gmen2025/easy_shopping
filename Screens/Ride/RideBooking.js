import React, { useContext, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { AuthContext } from "../../Context/store/Auth";
import { Alert, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { Button, TextInput, Switch } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { rideRequest, newRideStop, rideFare } from "../../assets/common/rides";
import { storeRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";

const fields = [["label", "Stop label"], ["address1", "Street address"], ["address2", "Apartment / unit (optional)"],
  ["city", "City"], ["zip", "Postal code"], ["country", "Country"], ["phone", "Contact phone"]];

export default function RideBooking({ navigation }) {
  const { isAuthenticated, loading, logout } = useContext(AuthContext);
  const focused = useIsFocused();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [mode, setMode] = useState("regular");
  const [stops, setStops] = useState([newRideStop("pickup"), newRideStop("dropoff")]);
  const [saved, setSaved] = useState([]);
  const [config, setConfig] = useState(null);
  const [quote, setQuote] = useState(null);
  const [database, setDatabase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const run = async (action) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (failure) {
      if (failure.response?.status === 401) {
        setNeedsSignIn(true); setConfig(null); setQuote(null);
        setError("Your session has expired or is no longer valid. Sign in again to use rides.");
        return;
      }
      const message = failure.response?.data?.message || failure.message;
      setError(message); Alert.alert("Ride needs attention", message);
    } finally { running.current = false; setBusy(false); }
  };
  const load = () => run(async () => {
    const db = await getDatabaseNameFromStorage();
    const [policy, addresses, current] = await Promise.all([
      rideRequest("config"), storeRequest("delivery-addresses"), storeRequest("delivery-current-address"),
    ]);
    setDatabase(db); setConfig(policy);
    setSaved([{ ...current, _id: "current", label: "Current account address" }, ...addresses]);
    setStops([newRideStop("pickup", /usa/i.test(db) ? "USA" : "Ethiopia"),
      newRideStop("dropoff", /usa/i.test(db) ? "USA" : "Ethiopia")]);
    setQuote(null);
  });
  useEffect(() => {
    if (focused && isAuthenticated && !loading) {
      setNeedsSignIn(false);
      load();
    }
  }, [focused, isAuthenticated, loading]);
  const update = (index, patch) => {
    setQuote(null);
    setStops((previous) => previous.map((stop, at) => at === index ? { ...stop, ...patch } : stop));
  };
  const ensureRegion = async () => {
    if (await getDatabaseNameFromStorage() !== database) throw new Error("The region changed. Reload the ride form before requesting.");
  };
  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated || needsSignIn) return <View style={styles.content}>
    <Text style={styles.title}>Sign in to use rides</Text>
    <Text>{needsSignIn ? error : "Ride bookings and saved addresses require a signed-in account."}</Text>
    <Button disabled={busy} mode="contained" onPress={() => run(async () => {
      if (needsSignIn) await logout();
      navigation.navigate("User", { screen: "Login" });
    })}>Sign in</Button>
  </View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Request a ride</Text>
    <Button disabled={busy} onPress={() => navigation.navigate("MyRides", { database })}>My rides & post-ride payments</Button>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button disabled={busy} onPress={load}>Reload region & addresses</Button>
    {!config?.enabled ? <Text>Ride service is not enabled in this region. Sign in and reload, or contact Admin.</Text> : <>
      <View style={styles.card}>
        <Text style={styles.heading}>Shared ride</Text>
        <Switch value={mode === "shared"} disabled={busy} onValueChange={(shared) => {
          setMode(shared ? "shared" : "regular"); setQuote(null);
          setStops((previous) => [previous[0], { ...previous.at(-1), type: "dropoff",
            passengers: shared ? previous[0].passengers : previous.at(-1).passengers }]);
        }} />
        <Text>{mode === "regular" ? "Regular ride: you arrange the stops and pay one fare for everyone in your booking."
          : "Shared ride: you may ride with unrelated customers on a compatible route. You pay only your booking's fare, not their detours."}</Text>
        <Text>Base {config.baseFare}; per {/usa/i.test(database) ? "mile" : "km"} {config.distanceRate}; per minute {config.minuteRate}.
          Shared discount {config.sharedDiscountPercent}%. Maximum pickup wait {config.maxPickupMinutes} min; shared extra travel {config.maxDetourMinutes} min.</Text>
        <Text>Regular final fare uses planned road distance and elapsed time from first pickup to final drop-off. Shared fare uses your solo route/time, refreshed at pickup. Pay only after completion.</Text>
      </View>
      {stops.map((stop, index) => <View key={index} style={styles.card}>
        <Text style={styles.heading}>Stop {index + 1}: {stop.type === "pickup" ? "Pickup" : "Drop-off"}</Text>
        {mode === "regular" ? <Picker selectedValue={stop.type} enabled={!busy} onValueChange={(type) => update(index, { type })}>
          <Picker.Item label="Pickup" value="pickup" /><Picker.Item label="Drop-off" value="dropoff" />
        </Picker> : null}
        <TextInput label={stop.type === "pickup" ? "Passengers boarding" : "Passengers leaving"} keyboardType="number-pad"
          value={stop.passengers} disabled={busy} onChangeText={(passengers) => {
            if (mode === "shared") { setQuote(null); setStops((previous) => previous.map((entry) => ({ ...entry, passengers }))); }
            else update(index, { passengers });
          }} />
        <Picker selectedValue="" enabled={!busy} onValueChange={(value) => {
          const address = saved.find((entry) => entry._id === value);
          if (address) update(index, { address: { ...address, label: stop.address.label } });
        }}>
          <Picker.Item label="Use current or saved address..." value="" />
          {saved.map((address) => <Picker.Item key={address._id} label={address.label} value={address._id} />)}
        </Picker>
        {fields.map(([key, label]) => <TextInput key={key} label={label} value={stop.address[key] || ""} disabled={busy}
          onChangeText={(value) => update(index, { address: { ...stop.address, [key]: value } })} style={styles.input} />)}
        {mode === "regular" && stops.length > 2 ? <Button disabled={busy} onPress={() => {
          setQuote(null); setStops((previous) => previous.filter((_, at) => at !== index));
        }}>Remove stop</Button> : null}
      </View>)}
      {mode === "regular" ? <Button disabled={busy || stops.length >= 12} onPress={() => {
        setQuote(null); setStops((previous) => [...previous.slice(0, -1), newRideStop("pickup", previous[0].address.country), previous.at(-1)]);
      }}>Add intermediate stop (choose pickup or drop-off)</Button> : null}
      <Text>Stops run in the order shown. Start with a pickup and finish with a drop-off; all boarding passengers must leave by the last stop.</Text>
      <Button mode="contained" disabled={busy} onPress={() => run(async () => {
        await ensureRegion();
        setQuote(await rideRequest("quote", { method: "post", timeout: 120000,
          data: { mode, stops: stops.map((stop) => ({ ...stop, passengers: Number(stop.passengers) })) } }));
      })}>Calculate road route & fare</Button>
      {quote ? <View style={styles.card}>
        <Text style={styles.heading}>Estimated fare: {rideFare(quote, quote.estimate)}</Text>
        <Text>{quote.seats} passenger seats needed. Solo/planned travel {quote.baseline.minutes.toFixed(1)} minutes.
          Quote expires {new Date(quote.expiresAt).toLocaleTimeString()}.</Text>
        <Button mode="contained" disabled={busy} onPress={() => run(async () => {
          await ensureRegion();
          const ride = await rideRequest(`${quote._id}/request`, { method: "post", timeout: 120000 });
          navigation.navigate("MyRides", { rideId: ride._id, database });
        })}>Request driver (pay after ride)</Button>
      </View> : null}
    </>}
  </ScrollView>;
}
