import React, { useContext, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { AuthContext } from "../../Context/store/Auth";
import { ActivityIndicator, Alert, Keyboard, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Switch, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Location from "expo-location";
import { rideRequest, newRideStop, balanceRideStops, rideFare, rideOptions, rideOptionName, isEthiopia, addressText, rideStopPoint } from "../../assets/common/rides";
import { storeRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";
import RideRouteMap from "../../Shared/RideRouteMap";
import AddressSearchInput from "../../Shared/AddressSearchInput";

const fields = [["label", "Stop label"], ["address1", "Street address / landmark"], ["address2", "Apartment / unit (optional)"],
  ["city", "City"], ["zip", "ZIP code"], ["country", "Country"]];
const locatedFields = ["address1", "city", "zip", "country"];

const ui = {
  page: { flex: 1, backgroundColor: "#eef2f6" },
  mapBackground: { ...StyleSheet.absoluteFillObject },
  overlay: { flex: 1 },
  panelPosition: { flex: 1, justifyContent: "flex-end" },
  panel: { maxHeight: "55%", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: "#111827", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
  panelScroll: { flexShrink: 1 },
  keyboardPanel: { maxHeight: "100%" },
  panelHandle: { alignItems: "center", paddingTop: 10, paddingBottom: 8, gap: 5 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d5dae1" },
  handleText: { color: "#374151", fontSize: 12, fontWeight: "700" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", margin: 12,
    padding: 12, borderRadius: 16, backgroundColor: "#ffd400", gap: 8, elevation: 3 },
  brand: { color: "#131923", fontSize: 20, fontWeight: "800" },
  tagline: { color: "#68717e", fontSize: 12, marginTop: 2 },
  myRides: { borderWidth: 1, borderColor: "#d8dce2", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  myRidesText: { color: "#202833", fontSize: 12, fontWeight: "700" },
  intro: { backgroundColor: "#fff", borderRadius: 16, paddingVertical: 12, gap: 4 },
  title: { color: "#161a20", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#69727f", fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: "#171b20", fontSize: 16, fontWeight: "800", marginBottom: 2 },
  sectionNote: { color: "#6a7380", fontSize: 12, lineHeight: 17 },
  card: { padding: 14, backgroundColor: "#fff", borderRadius: 14, gap: 9, borderWidth: 1, borderColor: "#e8eaed" },
  stopCard: { padding: 12, backgroundColor: "#fff", borderRadius: 14, gap: 8, borderWidth: 1, borderColor: "#e8eaed" },
  stopHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  stopActions: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  marker: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pickupMarker: { backgroundColor: "#e8f6ed" },
  dropoffMarker: { backgroundColor: "#fff0ef" },
  markerText: { fontSize: 12, fontWeight: "900", color: "#16864b" },
  dropoffMarkerText: { color: "#e03535" },
  stopTitle: { color: "#171b20", fontSize: 14, fontWeight: "700" },
  stopAddress: { color: "#747d89", fontSize: 11, marginTop: 2 },
  stopDivider: { height: 1, backgroundColor: "#edf0f3", marginVertical: 1 },
  modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  modeTitle: { color: "#202630", fontSize: 14, fontWeight: "700" },
  modeText: { color: "#6a7380", fontSize: 12, lineHeight: 18 },
  smallText: { color: "#68717e", fontSize: 11, lineHeight: 16 },
  error: { color: "#b91c1c", backgroundColor: "#fff", borderRadius: 10, padding: 12 },
  details: { backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 8 },
  primaryButton: { backgroundColor: "#ffd400", borderRadius: 12, marginTop: 2 },
  quoteCard: { padding: 14, backgroundColor: "#fff", borderRadius: 14, gap: 10 },
  fare: { color: "#111820", fontWeight: "800", fontSize: 20 },
  steps: { flexDirection: "row", gap: 6 },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#edf0f3" },
  activeStep: { backgroundColor: "#ffd400" },
  vehicle: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e8eaed", borderRadius: 14 },
  selectedVehicle: { borderColor: "#e8b900", backgroundColor: "#fff9df" },
  vehicleText: { flex: 1, gap: 4 },
  vehicleName: { fontSize: 16, fontWeight: "800", color: "#171b20" },
  vehiclePrice: { fontSize: 16, fontWeight: "800", color: "#171b20" },
  disabledVehicle: { opacity: 0.5 },
  badgeList: { gap: 8, paddingVertical: 4 },
  addressBadge: { maxWidth: 210, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#dce2ea", borderRadius: 22, backgroundColor: "#f8fafc" },
  selectedBadge: { borderColor: "#d5a900", backgroundColor: "#fff7cf" },
  badgeDetails: { flexShrink: 1 },
  badgeLabel: { fontSize: 12, fontWeight: "700", color: "#1f2937" },
  badgeAddress: { fontSize: 10, color: "#64748b", marginTop: 2 },
};
const steps = ["Your trip", "Map & stops", "Select ride", "Trip summary"];

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
  const [quotes, setQuotes] = useState([]);
  const [database, setDatabase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickupLocationError, setPickupLocationError] = useState("");
  const [step, setStep] = useState(0);
  const [mapStop, setMapStop] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const [mapTopInset, setMapTopInset] = useState(120);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const bookingScroll = useRef(null);
  const focusedInput = useRef(null);
  const running = useRef(false);
  const revealFocusedInput = () => {
    if (focusedInput.current != null) {
      bookingScroll.current?.getScrollResponder()?.scrollResponderScrollNativeHandleToKeyboard(
        focusedInput.current, 160, true
      );
    }
  };
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
      setKeyboardVisible(true);
      setPanelCollapsed(false);
      revealFocusedInput();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      focusedInput.current = null;
    });
    return () => { show.remove(); hide.remove(); };
  }, []);
  const invalidateQuotes = () => { setQuote(null); setQuotes([]); };
  const run = async (action) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (failure) {
      if (failure.response?.status === 401) {
        setNeedsSignIn(true); setConfig(null); invalidateQuotes();
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
      const point = rideStopPoint({ address: { location: {
        coordinates: [position.coords.longitude, position.coords.latitude],
      } } });
      if (!point) throw new Error("Your device did not return a valid GPS location. Try again or enter your pickup.");
      setUserLocation(point);
      const address = await rideRequest("places/current-location", { method: "post", data: {
        latitude: position.coords.latitude, longitude: position.coords.longitude,
      } });
      if (await getDatabaseNameFromStorage() !== db) {
        throw new Error("The region changed. Reload the ride form before choosing your pickup.");
      }
      invalidateQuotes();
      setStops((previous) => previous.map((stop, index) => index === 0 ? {
        ...stop, address: { ...stop.address, ...address, _id: undefined, placeId: undefined, address2: "" },
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
    setUserLocation(null);
    setSaved([{ ...current, _id: "current", label: "Current account address" }, ...addresses]);
    const phone = current.phone || user?.phone || "";
    setStops(["pickup", "dropoff"].map((type) => {
      const stop = newRideStop(type, /usa/i.test(db) ? "USA" : "Ethiopia");
      return { ...stop, address: { ...stop.address, phone } };
    }));
    setExpandedStops({});
    setStep(0); setMapStop(0);
    invalidateQuotes();
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
    invalidateQuotes();
    setStops((previous) => balanceRideStops(previous.map((stop, at) => at === index ? { ...stop, ...patch } : stop)));
  };
  const ensureRegion = async () => {
    if (await getDatabaseNameFromStorage() !== database) throw new Error("The region changed. Reload the ride form before requesting.");
  };
  const moveStop = (index, direction) => {
    invalidateQuotes();
    setExpandedStops({});
    setStops((previous) => {
      const reordered = [...previous];
      [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
      return balanceRideStops(reordered);
    });
  };
  const selectMapLocation = (coordinate) => run(async () => {
    await ensureRegion();
    const address = await rideRequest("places/current-location", { method: "post", data: {
      latitude: coordinate.latitude, longitude: coordinate.longitude,
    } });
    await ensureRegion();
    if (!rideStopPoint({ address })) throw new Error("That map location could not be verified. Search for an address or try another point.");
    update(mapStop, { address: { ...stops[mapStop].address, ...address,
      _id: undefined,
      currentLocation: { latitude: coordinate.latitude, longitude: coordinate.longitude }, placeId: undefined, address2: "",
      label: stops[mapStop].address.label, phone: stops[mapStop].address.phone } });
  });
  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated || needsSignIn) return <View style={styles.content}>
    <Text style={styles.title}>Sign in to use rides</Text>
    <Text>{needsSignIn ? error : "Ride bookings and saved addresses require a signed-in account."}</Text>
    <Button disabled={busy} mode="contained" onPress={() => run(async () => {
      if (needsSignIn) await logout();
      navigation.navigate("User", { screen: "Login" });
    })}>Sign in</Button>
  </View>;
  return <View style={ui.page}>
    {config?.enabled ? <View style={ui.mapBackground}>
      <RideRouteMap fullScreen
        ride={step >= 2 ? quote || quotes[0] || { stops } : { stops }}
        userLocation={userLocation}
        topInset={mapTopInset}
        bottomInset={panelHeight}
        onSelectLocation={step === 1 ? selectMapLocation : undefined}
        selectionDisabled={busy}
        distanceUnit={/usa/i.test(database) ? "mile" : "km"} />
    </View> : null}
    <SafeAreaView style={ui.overlay} pointerEvents="box-none">
    <View style={ui.header} onLayout={(event) => {
      const { y, height } = event.nativeEvent.layout;
      setMapTopInset(y + height + 12);
    }}>
      <View>
        <Text style={ui.brand}>Addu Genet Ride</Text>
        <Text style={ui.tagline}>Safe  •  Fast  •  Reliable</Text>
      </View>
      <TouchableOpacity disabled={busy} accessibilityRole="button" style={ui.myRides}
        onPress={() => navigation.navigate("MyRides", { database })}>
        <Text style={ui.myRidesText}>My rides</Text>
      </TouchableOpacity>
    </View>
    <View style={ui.panelPosition} pointerEvents="box-none">
    <View style={keyboardVisible ? [ui.panel, ui.keyboardPanel] : ui.panel} onLayout={(event) => {
      setPanelHeight(event.nativeEvent.layout.height);
      if (keyboardVisible) revealFocusedInput();
    }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={panelCollapsed ? "Show booking details" : "Show more map"}
        accessibilityState={{ expanded: !panelCollapsed }} style={ui.panelHandle}
        onPress={() => {
          Keyboard.dismiss();
          setPanelCollapsed((previous) => !previous);
        }}>
        <View style={ui.handleBar} />
        <Text style={ui.handleText}>{panelCollapsed ? "Show booking details" : "Show more map"}</Text>
      </TouchableOpacity>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
    {!panelCollapsed ? <ScrollView ref={bookingScroll} style={ui.panelScroll} contentContainerStyle={ui.content}
      automaticallyAdjustKeyboardInsets
      onLayout={() => { if (keyboardVisible) revealFocusedInput(); }}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    {!config?.enabled ? <View style={ui.intro}>
      <Text style={ui.title}>Ride service unavailable</Text>
      <Text style={ui.subtitle}>Ride service is not enabled in this region. Sign in and reload, or contact Admin.</Text>
      <Button disabled={busy} onPress={load}>Reload region & addresses</Button>
    </View> : <>
      <View style={ui.steps} accessible accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}>
        {steps.map((title, index) => <View key={title} style={[ui.step, index <= step && ui.activeStep]} />)}
      </View>
      {step > 0 ? <Button disabled={busy} icon="arrow-left" onPress={() => setStep(step - 1)}>Back</Button> : null}
      {step < 2 ? <>
      <View style={ui.intro}>
        <Text style={ui.title}>{step === 0 ? "Where would you like to go?" : "Map & multiple stops"}</Text>
        <Text style={ui.subtitle}>{step === 0 ? "Add your pickup and destination to get a ride estimate." :
          "Choose a stop, then tap the map to set its location. Stops are served in the order shown."}</Text>
      </View>
      {step === 1 ? <View style={ui.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {stops.map((stop, index) => <Button key={index} disabled={busy}
          mode={mapStop === index ? "contained-tonal" : "text"}
          style={mapStop === index ? ui.primaryButton : undefined}
          labelStyle={{ color: "#171717" }}
          onPress={() => setMapStop(index)}>
          {`${index + 1}. ${stop.type === "pickup" ? "Pickup" : "Drop-off"}`}
        </Button>)}
        </ScrollView>
        <Text style={ui.stopTitle}>{addressText(stops[mapStop].address) || "No address selected for this stop"}</Text>
        <Text style={ui.smallText}>Location pins only. Calculate below to get the verified road route and prices.</Text>
      </View> : null}
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
          {mode === "regular" && index > 0 && index < stops.length - 1 ? <View style={ui.stopActions}>
            <Button compact disabled={busy || index === 1} accessibilityLabel={`Move stop ${index + 1} earlier`}
              onPress={() => moveStop(index, -1)}>Move up</Button>
            <Button compact disabled={busy || index === stops.length - 2} accessibilityLabel={`Move stop ${index + 1} later`}
              onPress={() => moveStop(index, 1)}>Move down</Button>
            <Button compact disabled={busy} onPress={() => {
              invalidateQuotes(); setExpandedStops({}); setMapStop(0);
              setStops((previous) => balanceRideStops(previous.filter((_, at) => at !== index)));
            }}>Remove stop</Button>
          </View> : null}
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
            onFocus={(event) => {
              focusedInput.current = event.target ?? event.nativeEvent.target;
              setPanelCollapsed(false);
              revealFocusedInput();
            }}
            selectedText={stop.address.placeId || stop.address.currentLocation
              ? stop.address.formattedAddress || addressText(stop.address) : ""}
            onSelect={(place) => update(index, { address: { ...stop.address, ...place,
              _id: undefined, currentLocation: undefined, label: stop.address.label, phone: stop.address.phone,
              address2: stop.address.address2 } })} />
          {saved.length ? <>
            <Text style={ui.smallText}>Saved addresses</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.badgeList}
              keyboardShouldPersistTaps="handled">
              {saved.map((address) => {
                const selected = stop.address._id === address._id;
                return <TouchableOpacity key={address._id} accessibilityRole="button"
                  accessibilityLabel={`Use ${address.label || "saved address"} for stop ${index + 1}: ${addressText(address)}`}
                  accessibilityState={{ selected, disabled: busy }} disabled={busy}
                  style={[ui.addressBadge, selected && ui.selectedBadge]}
                  onPress={() => update(index, { address: { ...address, label: stop.address.label } })}>
                  <FontAwesome5 name="map-marker-alt" size={14} color={selected ? "#8a6c09" : "#64748b"} />
                  <View style={ui.badgeDetails}>
                    <Text style={ui.badgeLabel} numberOfLines={1}>{address.label || "Saved address"}</Text>
                    <Text style={ui.badgeAddress} numberOfLines={1}>{addressText(address)}</Text>
                  </View>
                </TouchableOpacity>;
              })}
            </ScrollView>
          </> : null}
          <TextInput label="Contact phone" keyboardType="phone-pad" autoComplete="tel" value={stop.address.phone || ""}
            disabled={busy} onChangeText={(phone) => update(index, { address: { ...stop.address, phone } })}
            style={styles.input} />
          <Button compact mode="text" disabled={busy} onPress={() => setExpandedStops((previous) => ({
            ...previous, [index]: !previous[index],
          }))}>{expandedStops[index] ? "Hide stop details" : "Saved address & passenger details"}</Button>
          {expandedStops[index] ? <View style={ui.details}>
            <TextInput label={stop.type === "pickup" ? "Passengers boarding" : "Passengers leaving"} keyboardType="number-pad"
              value={stop.passengers} disabled={busy || index === stops.length - 1} onChangeText={(passengers) => {
                if (mode === "shared") {
                  invalidateQuotes();
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
            </> : null}
            {fields.filter(([key]) => !(key === "zip" && isEthiopia(stop.address.country))).map(([key, label]) =>
              <TextInput key={key} label={label} value={stop.address[key] || ""} disabled={busy}
                onChangeText={(value) => update(index, { address: { ...stop.address, [key]: value,
                  ...(key !== "label" ? { _id: undefined } : {}),
                  ...(locatedFields.includes(key) ? {
                    placeId: undefined, formattedAddress: undefined, location: undefined, currentLocation: undefined,
                  } : {}) } })}
                style={styles.input} />)}
          </View> : null}
        </View>)}
        {mode === "regular" ? <Button disabled={busy || stops.length >= 12} onPress={() => {
          invalidateQuotes(); setExpandedStops({}); setMapStop(0); setStops((previous) => {
            const stop = newRideStop("pickup", previous[0].address.country);
            stop.address.phone = previous[0].address.phone;
            return balanceRideStops([...previous.slice(0, -1), stop, previous.at(-1)]);
          });
        }}>+ Add another stop</Button> : null}
        <Text style={ui.smallText}>Stops are served in the order shown. Start with a pickup and finish with a drop-off.</Text>
      </View>

      <View style={ui.card}>
        <View style={ui.modeRow}>
          <Text style={ui.modeTitle}>Shared ride</Text>
          <Switch value={mode === "shared"} disabled={busy} onValueChange={(shared) => {
            setMode(shared ? "shared" : "regular"); invalidateQuotes();
            setExpandedStops({}); setMapStop(0);
            setStops((previous) => balanceRideStops([previous[0], previous.at(-1)]));
          }} />
        </View>
        <Text style={ui.modeText}>{mode === "regular"
          ? "Regular ride: arrange the stops and pay one fare for everyone in your booking."
          : "Shared ride: you may ride with unrelated customers on a compatible route. You pay only your booking's fare, not their detours."}</Text>
        <Text style={ui.smallText}>Compare Economy, Comfort and Van prices for this route below.
          Shared discount {config.sharedDiscountPercent}%. Maximum pickup wait {config.maxPickupMinutes} min; shared extra travel {config.maxDetourMinutes} min.</Text>
        <Text style={ui.smallText}>Pay only after your ride is complete. Your final fare may be based on the actual route and travel time.</Text>
      </View>
      {step === 0 ? <Button mode="contained" disabled={busy} style={ui.primaryButton}
        labelStyle={{ color: "#171717", fontWeight: "800" }} onPress={() => setStep(1)}>Review map & stops</Button> : null}
      {step === 1 ? <>
      <Button mode="contained" disabled={busy} style={ui.primaryButton} labelStyle={{ color: "#171717", fontWeight: "800" }}
        onPress={() => run(async () => {
          await ensureRegion();
          invalidateQuotes();
          const result = await rideRequest("quote-options", { method: "post", timeout: 120000,
            data: { mode, stops: stops.map((stop) => ({ ...stop, passengers: Number(stop.passengers) })) } });
          await ensureRegion();
          if (!Array.isArray(result?.quotes) || !result.quotes.length || result.quotes.some((entry) =>
            !entry?._id || !rideOptions.some((option) => option.key === entry.vehicleOption) ||
            !Number.isFinite(entry.estimate) || entry.estimate <= 0 ||
            !Number.isFinite(entry.baseline?.minutes) || entry.baseline.minutes < 0 ||
            !Number.isSafeInteger(entry.seats) || entry.seats < 1 ||
            !["usd", "etb"].includes(entry.currency) || !Number.isFinite(new Date(entry.expiresAt).getTime()))) {
            throw new Error("No valid priced ride options were returned. Reload and calculate again.");
          }
          setQuotes(result.quotes);
          setStep(2);
        })}>Calculate road route & fare</Button>
      </> : null}
      <Button disabled={busy} onPress={load}>Reload region & addresses</Button>
      </> : null}
      {step === 2 ? <>
        <Text style={ui.title}>Select ride</Text>
        <View style={ui.card}>
          {stops.map((stop, index) => <Text key={index} style={ui.stopTitle}>
            {index + 1}. {stop.type === "pickup" ? "Pickup" : "Drop-off"}: {addressText(stop.address)}
          </Text>)}
        </View>
        <Text style={ui.sectionNote}>Economy and Comfort are car options. Calculate the route to compare prices, then select a vehicle. Driver availability is confirmed after requesting.</Text>
        {rideOptions.map((option) => {
          const priced = quotes.find((entry) => entry.vehicleOption === option.key);
          const selected = quote?.vehicleOption === option.key;
          return <TouchableOpacity key={option.key} disabled={busy || !priced} accessibilityRole="button"
            accessibilityState={{ selected, disabled: busy || !priced }}
            accessibilityLabel={`${option.name}${priced ? ` - ${rideFare(priced, priced.estimate)}` : " - Unavailable"}`}
            style={[ui.vehicle, selected && ui.selectedVehicle, !priced && ui.disabledVehicle]}
            onPress={() => setQuote(priced)}>
            <FontAwesome5 name={option.icon} size={32} color="#171b20" />
            <View style={ui.vehicleText}>
              <Text style={ui.vehicleName}>{option.name}</Text>
              <Text style={ui.sectionNote}>{option.detail}</Text>
              {priced ? <Text style={ui.smallText}>{priced.seats} seats needed • Trip {priced.baseline.minutes.toFixed(0)} min</Text> : null}
            </View>
            <Text style={ui.vehiclePrice}>{priced ? rideFare(priced, priced.estimate) : "Unavailable"}</Text>
          </TouchableOpacity>;
        })}
        <Button mode="contained" disabled={busy || !quote} style={ui.primaryButton}
          labelStyle={{ color: "#171717", fontWeight: "800" }} onPress={() => setStep(3)}>Continue</Button>
      </> : null}
      {step === 3 && quote ? <View style={ui.quoteCard}>
        <Text style={ui.title}>Trip summary</Text>
        <Text>Selected vehicle: {rideOptionName(quote.vehicleOption)}</Text>
        {(quote.stops || stops).map((stop, index) => <View key={stop.key || index} style={ui.stopCard}>
          <Text style={ui.stopTitle}>{index + 1}. {stop.type === "pickup" ? "Pickup" : "Drop-off"}</Text>
          <Text style={ui.subtitle}>{addressText(stop.address)}</Text>
          <Text style={ui.smallText}>{stop.passengers} passengers • {stop.address.phone}</Text>
        </View>)}
        <Text style={ui.sectionNote}>{mode === "shared" ? "Shared ride" : "Regular ride"} • Stops are served in the order shown.</Text>
        <Text style={ui.fare}>Estimated fare: {rideFare(quote, quote.estimate)}</Text>
        <Text style={ui.smallText}>{quote.seats} passenger seats needed. Solo/planned travel {quote.baseline.minutes.toFixed(1)} minutes.
          Quote expires {new Date(quote.expiresAt).toLocaleTimeString()}.</Text>
        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Payment after your ride</Text>
          <Text style={ui.subtitle}>Choose your payment method after completion. Bank transfer{/usa/i.test(database)
            ? " or card in a supported, configured app build." : " or cash to your driver."}</Text>
          <Text style={ui.smallText}>No payment is taken now. Final fare follows your region's ride rules and may vary from this estimate.</Text>
        </View>
        <Button disabled={busy} onPress={() => { invalidateQuotes(); setStep(0); }}>Edit trip</Button>
        <Button mode="contained" disabled={busy} style={ui.primaryButton} labelStyle={{ color: "#171717", fontWeight: "800" }}
          onPress={() => run(async () => {
            await ensureRegion();
            if (new Date(quote.expiresAt).getTime() <= Date.now()) {
              invalidateQuotes();
              setStep(1);
              throw new Error("Ride prices expired. Calculate again before requesting.");
            }
            const ride = await rideRequest(`${quote._id}/request`, { method: "post", timeout: 120000 });
            navigation.navigate("MyRides", { rideId: ride._id, database });
          })}>Request driver (pay after ride)</Button>
      </View> : null}
    </>}
    </ScrollView> : null}
    </View>
    </View>
    </SafeAreaView>
  </View>;
}
