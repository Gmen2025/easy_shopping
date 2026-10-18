import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../../assets/common/baseUrl";
import { storeRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";
import { rideRequest } from "../../assets/common/rides";
import RideVehiclePricing, { normalizeRideRates } from "../../Shared/RideVehiclePricing";

const VEHICLES = ["motorcycle", "car", "van", "truck"];
const CAPACITIES = [
  ["baseFee", "Base fee"], ["distanceRate", "Distance rate"], ["maxWeightKg", "Usable payload (kg)"],
  ["maxVolumeLiters", "Usable cargo volume (liters)"], ["lengthCm", "Cargo length (cm)"],
  ["widthCm", "Cargo width (cm)"], ["heightCm", "Cargo height (cm)"],
];
const PACKAGE = [["weightKg", "Packaged weight (kg)"], ["lengthCm", "Packaged length (cm)"], ["widthCm", "Packaged width (cm)"], ["heightCm", "Packaged height (cm)"]];
const empty = () => ({ enabled: false, vehicles: Object.fromEntries(VEHICLES.map((type) =>
  [type, { enabled: false, ...Object.fromEntries(CAPACITIES.map(([field]) => [field, "0"])) }])) });

const VehicleDeliverySettings = ({ route, navigation }) => {
  const [config, setConfig] = useState(empty);
  const [rideRates, setRideRates] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState(route.params?.productId || "");
  const [size, setSize] = useState({});
  const [database, setDatabase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const guard = useRef(false);
  const run = async (action) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); }
    catch (failure) { setError(failure.response?.data?.message || failure.message); }
    finally { guard.current = false; setBusy(false); }
  };
  const load = () => run(async () => {
    const db = await getDatabaseNameFromStorage();
    const token = await AsyncStorage.getItem("token");
    const [settings, response, rides] = await Promise.all([
      storeRequest("delivery-config"),
      axios.get(`${baseUrl}products`, { headers: { Authorization: `Bearer ${token}`, "x-database-name": db } }),
      rideRequest("config"),
    ]);
    setDatabase(db);
    setConfig({ ...empty(), ...settings, vehicles: { ...empty().vehicles, ...settings.vehicles } });
    setProducts(response.data);
    setRideRates(normalizeRideRates(rides.vehicleRates));
  });
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const product = products.find((entry) => String(entry._id || entry.id) === productId);
    setSize(Object.fromEntries(PACKAGE.map(([field]) => [field, product?.packageSize?.[field] == null ? "" : String(product.packageSize[field])])));
  }, [products, productId]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}
    <Button disabled={busy} onPress={load}>Reload configuration</Button>
    <Text style={styles.title}>Vehicle configuration</Text>
    {rideRates ? <View style={styles.card}>
      <RideVehiclePricing rates={rideRates} onChange={setRideRates} disabled={busy} />
      <Text>Uses the same passenger rates as Admin Rides. Saving here does not change delivery fees,
        ride activation, shared discounts or route limits. Configure those and assign driver car classes in Ride settings first.</Text>
      <Button disabled={busy} onPress={() => navigation.navigate("RideSettings")}>Ride settings & driver car classes</Button>
      <Button mode="contained" disabled={busy} onPress={() => run(async () => {
        const ensureRegion = async () => {
          if (await getDatabaseNameFromStorage() !== database) throw new Error("Region changed. Reload configuration before saving passenger prices.");
        };
        await ensureRegion();
        const current = await rideRequest("config");
        await ensureRegion();
        const saved = await rideRequest("config", { method: "put", data: { ...current, vehicleRates: rideRates } });
        setRideRates(normalizeRideRates(saved.vehicleRates));
        setMessage("Passenger Economy, Comfort and Van prices saved.");
      })}>Save passenger vehicle prices</Button>
    </View> : null}
    <View style={styles.card}>
      <Text style={styles.title}>Vehicle delivery pricing</Text>
      <Text>Fees use this region's currency. Distance rates are per {/usa/i.test(database) ? "mile" : "kilometer"} of the pickup-to-destination driving route.</Text>
      <Text>Configure real usable vehicle capacities before enabling. Product packaged measurements are optional for domestic checkout.
        Missing measurements require customers to choose a vehicle manually; full capacity cannot be verified. International shipping requires complete measurements.</Text>
      <Text>Enable multi-delivery checkout</Text>
      <Switch disabled={busy} value={config.enabled} onValueChange={(enabled) => setConfig((previous) => ({ ...previous, enabled }))} />
    </View>
    {VEHICLES.map((type) => <View key={type} style={styles.card}>
      <Text style={styles.heading}>{type}</Text>
      <Switch disabled={busy} value={config.vehicles[type].enabled} onValueChange={(enabled) => setConfig((previous) => ({
        ...previous, vehicles: { ...previous.vehicles, [type]: { ...previous.vehicles[type], enabled } },
      }))} />
      {CAPACITIES.map(([field, label]) => <TextInput key={field}
        label={field === "distanceRate" ? `${label} per ${/usa/i.test(database) ? "mile" : "km"}` : label}
        keyboardType="decimal-pad" value={String(config.vehicles[type][field])} style={styles.input}
        onChangeText={(value) => setConfig((previous) => ({
          ...previous, vehicles: { ...previous.vehicles, [type]: { ...previous.vehicles[type], [field]: value } },
        }))} />)}
    </View>)}
    <Button mode="contained" disabled={busy} onPress={() => run(async () => {
      setConfig(await storeRequest("delivery-config", { method: "put", data: config }));
      setMessage("Vehicle capacities and pricing saved.");
    })}>Save vehicle configuration</Button>
    <View style={styles.card}>
      <Text style={styles.title}>Product packaged dimensions</Text>
      <Text>Optional for domestic checkout. Measure one sale unit including packaging. Leave unavailable measurements blank.
        Weight and volume are multiplied by the delivery quantity. International shipping requires all measurements.</Text>
      <TextInput label="Search catalog" value={search} onChangeText={setSearch} />
      <Picker selectedValue={productId} enabled={!busy} onValueChange={setProductId}>
        <Picker.Item label="Select a catalog product..." value="" />
        {products.filter((product) => String(product.name).toLowerCase().includes(search.toLowerCase())).map((product) =>
          <Picker.Item key={product._id || product.id} label={`${product.name}${PACKAGE.every(([key]) =>
            Number.isFinite(product.packageSize?.[key]) && product.packageSize[key] > 0) ? "" : " (measurements unavailable)"}`} value={String(product._id || product.id)} />)}
      </Picker>
      {productId ? <>
        {PACKAGE.map(([field, label]) => <TextInput key={field} label={label} style={styles.input}
          keyboardType="decimal-pad" value={size[field] || ""} onChangeText={(value) => setSize((previous) => ({ ...previous, [field]: value }))} />)}
        <Button mode="contained" disabled={busy} onPress={() => run(async () => {
          const product = await storeRequest(`delivery-products/${productId}`, { method: "put", data: size });
          setProducts((previous) => previous.map((entry) => String(entry._id || entry.id) === productId ? product : entry));
          setMessage("Product packaged dimensions saved.");
        })}>Save product shipping size</Button>
      </> : null}
    </View>
    <Text>Approved drivers must use motorcycle, car, van or truck as their vehicle type. Each vehicle-sized delivery occupies the driver exclusively until completion.</Text>
  </ScrollView>;
};
export default VehicleDeliverySettings;
