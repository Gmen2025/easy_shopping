import React, { useContext, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { AuthContext } from "../../Context/store/Auth";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Location from "expo-location";
import { rideRequest, newRideStop, balanceRideStops, rideFare, isEthiopia, addressText } from "../../assets/common/rides";
import { storeRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";
import RideRouteMap from "../../Shared/RideRouteMap";
import AddressSearchInput from "../../Shared/AddressSearchInput";

const fields = [["label", "Stop label"], ["address1", "Street address / landmark"], ["address2", "Apartment / unit (optional)"],
  ["city", "City"], ["zip", "ZIP code"], ["country", "Country"]];
const locatedFields = ["address1", "city", "zip", "country"];
const vehicleStyles = [
  { name: "Motorcycle", icon: "motorcycle", detail: "Quick trips" },
  { name: "Car", icon: "car", detail: "Everyday rides" },
  { name: "Van", icon: "shuttle-van", detail: "More passengers" },
  { name: "Truck", icon: "truck", detail: "Larger loads" },
];

const ui = {
  page: { flexGrow: 1, backgroundColor: "#f5f6f8" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  brand: { color: "#131923", fontSize: 20, fontWeight: "800" },
  tagline: { color: "#68717e", fontSize: 12, marginTop: 2 },
  myRides: { borderWidth: 1, borderColor: "#d8dce2", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  myRidesText: { color: "#202833", fontSize: 12, fontWeight: "700" },
  intro: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 4 },
  title: { color: "#161a20", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#69727f", fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: "#171b20", fontSize: 16, fontWeight: "800", marginBottom: 2 },
  sectionNote: { color: "#6a7380", fontSize: 12, lineHeight: 17 },
  card: { padding: 14, backgroundColor: "#fff", borderRadius: 14, gap: 9 },
  stopCard: { padding: 12, backgroundColor: "#fff", borderRadius: 14, gap: 8, borderWidth: 1, borderColor: "#e8eaed" },
  stopHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  marker: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pickupMarker: { backgroundColor: "#e8f6ed" },
  dropoffMarker: { backgroundColor: "#fff0ef" },
  markerText: { fontSize: 12, fontWeight: "900", color: "#16864b" },
  dropoffMarkerText: { color: "#e03535" },
  stopTitle: { color: "#171b20", fontSize: 14, fontWeight: "700" },
  stopAddress: { color: "#747d89", fontSize: 11, marginTop: 2 },
  stopDivider: { height: 1, backgroundColor: "#edf0f3", marginVertical: 1 },
  vehicleRow: { flexDirection: "row", gap: 8 },
  vehicleItem: { flex: 1, minHeight: 78, alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 8, paddingHorizontal: 4, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e8ec", borderRadius: 11 },
  vehicleGlyph: { height: 27, alignItems: "center", justifyContent: "center" },
  vehicleName: { color: "#292f38", fontSize: 11, fontWeight: "700" },
  vehicleDetail: { color: "#858d98", fontSize: 9, textAlign: "center" },
  modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  modeTitle: { color: "#202630", fontSize: 14, fontWeight: "700" },
  modeText: { color: "#6a7380", fontSize: 12, lineHeight: 18 },
  smallText: { color: "#68717e", fontSize: 11, lineHeight: 16 },
  error: { color: "#b91c1c", backgroundColor: "#fff", borderRadius: 10, padding: 12 },
  details: { backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 8 },
  primaryButton: { backgroundColor: "#ffd400", borderRadius: 12, marginTop: 2 },
  quoteCard: { padding: 14, backgroundColor: "#fff", borderRadius: 14, gap: 10 },
  fare: { color: "#111820", fontWeight: "800", fontSize: 20 },
};

export default function RideBooking({ navigation }) {
  const { isAuthenticated, loading, logout, user } = useContext(AuthContext);
  const focused = useIsFocused();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [mode, setMode] = useState("regular");
  const [stops, setStops] = useState([newRideStop("pickup"), newRideStop("dropoff")]);
  const [expandedStops, setExpandedStops] = useState({});
  const [saved, setSaved] = useState([]);
  const [config, setConfig] = useState(null);
  const [quote, setQuote] = useState(null);
  const [database, setDatabase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickupLocationError, setPickupLocationError] = useState("");
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
  const locatePickup = async (db) => {
    setPickupLocationError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Allow location access to use your current pickup, or enter a pickup address below.");
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (await getDatabaseNameFromStorage() !== db) {
        throw new Error("The region changed. Reload the ride form before choosing your pickup.");
      }
      const address = await rideRequest("places/current-location", { method: "post", data: {
        latitude: position.coords.latitude, longitude: position.coords.longitude,
      } });
      if (await getDatabaseNameFromStorage() !== db) {
        throw new Error("The region changed. Reload the ride form before choosing your pickup.");
      }
      setQuote(null);
      setStops((previous) => previous.map((stop, index) => index === 0 ? {
        ...stop, address: { ...stop.address, ...address, placeId: undefined, address2: "" },
      } : stop));
    } catch (failure) {
      if (failure.response?.status === 401) throw failure;
      const message = failure.response?.data?.message || failure.message || "Unable to locate your pickup. Enter it manually.";
      console.warn("Ride pickup location failed:", message);
      setPickupLocationError(message);
    }
  };
  const load = () => run(async () => {
    const db = await getDatabaseNameFromStorage();
    const [policy, addresses, current] = await Promise.all([
      rideRequest("config"), storeRequest("delivery-addresses"), storeRequest("delivery-current-address"),
    ]);
    setDatabase(db); setConfig(policy);
    setSaved([{ ...current, _id: "current", label: "Current account address" }, ...addresses]);
    const phone = current.phone || user?.phone || "";
    setStops(["pickup", "dropoff"].map((type) => {
      const stop = newRideStop(type, /usa/i.test(db) ? "USA" : "Ethiopia");
      return { ...stop, address: { ...stop.address, phone } };
    }));
    setExpandedStops({});
    setQuote(null);
    setPickupLocationError("");
    if (policy.enabled) await locatePickup(db);
  });
  useEffect(() => {
    if (focused && isAuthenticated && !loading) {
      setNeedsSignIn(false);
      load();
    }
  }, [focused, isAuthenticated, loading]);
  const update = (index, patch) => {
    setQuote(null);
    setStops((previous) => balanceRideStops(previous.map((stop, at) => at === index ? { ...stop, ...patch } : stop)));
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
  return <ScrollView style={ui.page} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <View style={ui.header}>
      <View>
        <Text style={ui.brand}>Addu Genet Ride</Text>
        <Text style={ui.tagline}>Safe  •  Fast  •  Reliable</Text>
      </View>
      <TouchableOpacity disabled={busy} accessibilityRole="button" style={ui.myRides}
        onPress={() => navigation.navigate("MyRides", { database })}>
        <Text style={ui.myRidesText}>My rides</Text>
      </TouchableOpacity>
    </View>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={ui.error}>{error}</Text> : null}
    {!config?.enabled ? <View style={ui.intro}>
      <Text style={ui.title}>Ride service unavailable</Text>
      <Text style={ui.subtitle}>Ride service is not enabled in this region. Sign in and reload, or contact Admin.</Text>
      <Button disabled={busy} onPress={load}>Reload region & addresses</Button>
    </View> : <>
      <View style={ui.intro}>
        <Text style={ui.title}>Where would you like to go?</Text>
        <Text style={ui.subtitle}>Add your pickup and destination to get a ride estimate.</Text>
      </View>

      <View style={ui.card}>
        <Text style={ui.sectionTitle}>Your trip</Text>
        {stops.map((stop, index) => <View key={index} style={ui.stopCard}>
          <View style={ui.stopHeader}>
            <View style={[ui.marker, stop.type === "pickup" ? ui.pickupMarker : ui.dropoffMarker]}>
              <Text style={[ui.markerText, stop.type === "dropoff" ? ui.dropoffMarkerText : null]}>
                {stop.type === "pickup" ? "●" : "●"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ui.stopTitle}>{stop.type === "pickup" ? "Pickup" : "Drop-off"}{stops.length > 2 ? ` ${index + 1}` : ""}</Text>
              <Text style={ui.stopAddress} numberOfLines={1}>
                {addressText(stop.address) || (stop.type === "pickup" ? "Enter pickup address or place" : "Enter drop-off address or place")}
              </Text>
            </View>
          </View>
          {index === 0 && stop.type === "pickup" ? <>
            <Button disabled={busy} icon="crosshairs-gps" onPress={() => run(async () => {
              await ensureRegion();
              await locatePickup(database);
            })}>Use my current location</Button>
            {pickupLocationError ? <Text accessibilityRole="alert" style={ui.error}>{pickupLocationError}</Text> : null}
            <Text style={ui.smallText}>Your current location is the default pickup. Search below to change it, or edit the address in stop details.</Text>
          </> : null}
          <AddressSearchInput
            label={stop.type === "pickup" ? "Search pickup location" : "Search drop-off location"}
            disabled={busy}
            selectedText={stop.address.placeId || stop.address.currentLocation
              ? stop.address.formattedAddress || addressText(stop.address) : ""}
            onSelect={(place) => update(index, { address: { ...stop.address, ...place,
              currentLocation: undefined, label: stop.address.label, phone: stop.address.phone,
              address2: stop.address.address2 } })} />
          <TextInput label="Contact phone" keyboardType="phone-pad" autoComplete="tel" value={stop.address.phone || ""}
            disabled={busy} onChangeText={(phone) => update(index, { address: { ...stop.address, phone } })}
            style={styles.input} />
          <Button compact mode="text" disabled={busy} onPress={() => setExpandedStops((previous) => ({
            ...previous, [index]: !previous[index],
          }))}>{expandedStops[index] ? "Hide stop details" : "Saved address & passenger details"}</Button>
          {expandedStops[index] ? <View style={ui.details}>
            <Picker selectedValue="" enabled={!busy} onValueChange={(value) => {
              const address = saved.find((entry) => entry._id === value);
              if (address) update(index, { address: { ...address, label: stop.address.label } });
            }}>
              <Picker.Item label="Choose a saved address..." value="" />
              {saved.map((address) => <Picker.Item key={address._id} label={address.label} value={address._id} />)}
            </Picker>
            <TextInput label={stop.type === "pickup" ? "Passengers boarding" : "Passengers leaving"} keyboardType="number-pad"
              value={stop.passengers} disabled={busy || index === stops.length - 1} onChangeText={(passengers) => {
                if (mode === "shared") {
                  setQuote(null);
                  setStops((previous) => previous.map((entry) => ({ ...entry, passengers })));
                } else update(index, { passengers });
              }} />
            {index === stops.length - 1 ? <Text style={ui.smallText}>
              Everyone still onboard leaves at the final drop-off. This count updates automatically.
            </Text> : null}
            {mode === "regular" ? <>
              <Picker selectedValue={stop.type} enabled={!busy && index > 0 && index < stops.length - 1}
                onValueChange={(type) => update(index, { type })}>
                <Picker.Item label="Pickup" value="pickup" /><Picker.Item label="Drop-off" value="dropoff" />
              </Picker>
              {index > 0 && index < stops.length - 1 ? <Button disabled={busy} onPress={() => {
                setQuote(null); setStops((previous) => balanceRideStops(previous.filter((_, at) => at !== index)));
              }}>Remove stop</Button> : null}
            </> : null}
            {fields.filter(([key]) => !(key === "zip" && isEthiopia(stop.address.country))).map(([key, label]) =>
              <TextInput key={key} label={label} value={stop.address[key] || ""} disabled={busy}
                onChangeText={(value) => update(index, { address: { ...stop.address, [key]: value,
                  ...(locatedFields.includes(key) ? {
                    placeId: undefined, formattedAddress: undefined, location: undefined, currentLocation: undefined,
                  } : {}) } })}
                style={styles.input} />)}
          </View> : null}
        </View>)}
        {mode === "regular" ? <Button disabled={busy || stops.length >= 12} onPress={() => {
          setQuote(null); setStops((previous) => {
            const stop = newRideStop("pickup", previous[0].address.country);
            stop.address.phone = previous[0].address.phone;
            return balanceRideStops([...previous.slice(0, -1), stop, previous.at(-1)]);
          });
        }}>+ Add another stop</Button> : null}
        <Text style={ui.smallText}>Stops are served in the order shown. Start with a pickup and finish with a drop-off.</Text>
      </View>

      <View style={ui.card}>
        <Text style={ui.sectionTitle}>Choose a ride type</Text>
        <View style={ui.vehicleRow}>
          {vehicleStyles.map((vehicle) => <View key={vehicle.name} style={ui.vehicleItem}>
            <View style={ui.vehicleGlyph}><FontAwesome5 name={vehicle.icon} size={19} color="#252b32" /></View>
            <Text style={ui.vehicleName}>{vehicle.name}</Text>
            <Text style={ui.vehicleDetail}>{vehicle.detail}</Text>
          </View>)}
        </View>
        <Text style={ui.sectionNote}>Vehicle styles are shown for reference only. Your driver is matched by availability and passenger seats.</Text>
      </View>

      <View style={ui.card}>
        <View style={ui.modeRow}>
          <Text style={ui.modeTitle}>Shared ride</Text>
          <Switch value={mode === "shared"} disabled={busy} onValueChange={(shared) => {
            setMode(shared ? "shared" : "regular"); setQuote(null);
            setStops((previous) => balanceRideStops([previous[0], previous.at(-1)]));
          }} />
        </View>
        <Text style={ui.modeText}>{mode === "regular"
          ? "Regular ride: arrange the stops and pay one fare for everyone in your booking."
          : "Shared ride: you may ride with unrelated customers on a compatible route. You pay only your booking's fare, not their detours."}</Text>
        <Text style={ui.smallText}>Base {config.baseFare}; per {/usa/i.test(database) ? "mile" : "km"} {config.distanceRate}; per minute {config.minuteRate}.
          Shared discount {config.sharedDiscountPercent}%. Maximum pickup wait {config.maxPickupMinutes} min; shared extra travel {config.maxDetourMinutes} min.</Text>
        <Text style={ui.smallText}>Pay only after your ride is complete. Your final fare may be based on the actual route and travel time.</Text>
      </View>

      <Button mode="contained" disabled={busy} style={ui.primaryButton} labelStyle={{ color: "#171717", fontWeight: "800" }}
        onPress={() => run(async () => {
          await ensureRegion();
          setQuote(await rideRequest("quote", { method: "post", timeout: 120000,
            data: { mode, stops: stops.map((stop) => ({ ...stop, passengers: Number(stop.passengers) })) } }));
        })}>Calculate road route & fare</Button>
      <Button disabled={busy} onPress={load}>Reload region & addresses</Button>
      {quote ? <View style={ui.quoteCard}>
        <Text style={ui.sectionTitle}>Trip summary</Text>
        <Text>{addressText(quote.stops?.[0]?.address || stops[0].address)} → {addressText(quote.stops?.at(-1)?.address || stops.at(-1).address)}</Text>
        <Text style={ui.fare}>Estimated fare: {rideFare(quote, quote.estimate)}</Text>
        <RideRouteMap ride={quote} distanceUnit={/usa/i.test(database) ? "mile" : "km"} />
        <Text style={ui.smallText}>{quote.seats} passenger seats needed. Solo/planned travel {quote.baseline.minutes.toFixed(1)} minutes.
          Quote expires {new Date(quote.expiresAt).toLocaleTimeString()}.</Text>
        <Button mode="contained" disabled={busy} style={ui.primaryButton} labelStyle={{ color: "#171717", fontWeight: "800" }}
          onPress={() => run(async () => {
            await ensureRegion();
            const ride = await rideRequest(`${quote._id}/request`, { method: "post", timeout: 120000 });
            navigation.navigate("MyRides", { rideId: ride._id, database });
          })}>Request driver (pay after ride)</Button>
      </View> : null}
    </>}
  </ScrollView>;
}
