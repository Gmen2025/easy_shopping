import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { storeRequest, apiRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";
import { editShippingAddress, shippingRoute } from "../../assets/common/internationalShipping";
import { addressText } from "../../assets/common/rides";
import AddressSearchInput from "../../Shared/AddressSearchInput";

const addressFields = [["label", "Hub label"], ["address1", "Street address"], ["address2", "Unit (optional)"],
  ["city", "City"], ["zip", "Postal code (optional in Ethiopia)"], ["country", "Hub country"], ["phone", "Hub phone"]];
const tariffFields = [["baseUsd", "Base shipping fee (USD)"], ["perKgUsd", "USD per billable kg"],
  ["minimumUsd", "Minimum shipment fee (USD)"], ["volumetricDivisor", "Volumetric divisor (cm3 / kg)"],
  ["maxWeightKg", "Maximum billable kg per recipient"], ["maxDimensionCm", "Maximum parcel dimension (cm)"],
  ["finalDeliveryUsd", "Destination final delivery per recipient (USD; pickup excludes this fee)"]];
export default function InternationalShippingSettings({ navigation }) {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [database, setDatabase] = useState("");
  const route = shippingRoute(/usa/i.test(database) ? undefined : "ethiopia-to-usa");
  const guard = useRef(false);
  const region = useRef("");
  const run = async (action) => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (region.current && region.current !== db) throw new Error("Region changed. Reopen shipping settings.");
      region.current = db; setDatabase(db); await action();
    } catch (failure) {
      const message = failure.response?.data?.message || failure.message;
      setError(message); Alert.alert("International shipping", message);
    } finally { guard.current = false; setBusy(false); }
  };
  const load = async () => {
    const db = await getDatabaseNameFromStorage();
    const [policy, catalog] = await Promise.all([storeRequest("international-shipping-config"), apiRequest("products", "")]);
    setConfig({ ...policy, finalDeliveryUsd: policy.finalDeliveryUsd ?? 0, hub: policy.hub || Object.fromEntries(addressFields.map(([field]) => [field, field === "country" ? /usa/i.test(db) ? "USA" : "Ethiopia" : ""])) });
    setProducts(catalog);
  };
  useEffect(() => { run(load); }, []);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{route.origin}-to-{route.destination} shipping</Text>
    <Text>{route.origin} stores deliver to your {route.origin} consolidation hub. Admin handles international shipment and delivery to the {route.destination} recipient. This screen does not book a carrier or purchase labels.</Text>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button disabled={busy} onPress={() => run(load)}>Reload shipping policy</Button>
    {config ? <View style={styles.card}>
      <Text>Enable international shipping (the regional daily exchange policy must also be enabled/current)</Text>
      <Switch value={Boolean(config.enabled)} disabled={busy} onValueChange={(enabled) => setConfig((previous) => ({ ...previous, enabled }))} />
      <AddressSearchInput label="Search consolidation hub address" country={route.origin} disabled={busy}
        selectedText={config.hub.placeId ? addressText(config.hub) : ""}
        onSelect={(place) => setConfig((previous) => ({ ...previous, hub: { ...previous.hub, ...place } }))} />
      {addressFields.map(([field, label]) => <TextInput key={field} label={label} disabled={busy} value={config.hub[field] || ""}
        onChangeText={(value) => setConfig((previous) => ({ ...previous, hub: editShippingAddress(previous.hub, field, value) }))} />)}
      {tariffFields.map(([field, label]) => <TextInput key={field} label={label} disabled={busy} keyboardType="decimal-pad"
        value={config[field] == null ? "" : String(config[field])} onChangeText={(value) => setConfig((previous) => ({ ...previous, [field]: value }))} />)}
      <Text>For each recipient, billable kg is the greater of actual kg and the sum of each unit's packaged length x width x height / divisor. Rounded up to 0.001 kg.
        Shipping USD = max(minimum, base + billable kg x rate), once per recipient, even with multiple pickup stores. {route.origin} road delivery fees are added separately.</Text>
      <Text>International pickup retains shipping charges. The existing tariff is shipping-only; final delivery starts at zero.
        Duties/customs are excluded. Review carrier pricing, import/export restrictions and recipient coverage before approving products.</Text>
      <Text>Enable customer collection in {route.destination}</Text>
      <Switch value={Boolean(config[route.pickupField])} disabled={busy} onValueChange={(enabled) => setConfig((previous) => ({
        ...previous, [route.pickupField]: enabled ? {
          ...Object.fromEntries(addressFields.map(([field]) => [field, ""])),
          label: `${route.destination} collection`, country: route.destination,
        } : null,
      }))} />
      {config[route.pickupField] ? <>
      <AddressSearchInput label={`Search ${route.destination} collection address`} country={route.destination} disabled={busy}
        selectedText={config[route.pickupField].placeId ? addressText(config[route.pickupField]) : ""}
        onSelect={(place) => setConfig((previous) => ({
          ...previous, [route.pickupField]: { ...previous[route.pickupField], ...place },
        }))} />
      {addressFields.map(([field]) => <TextInput key={field} label={`${route.destination} collection ${field}${field === "address2" || field === "zip" && route.destination === "Ethiopia" ? " (optional)" : ""}`}
        disabled={busy} value={config[route.pickupField][field] || ""} onChangeText={(value) => setConfig((previous) => ({
          ...previous, [route.pickupField]: editShippingAddress(previous[route.pickupField], field, value),
        }))} />)}
      </> : null}
      <Text>Enter the real {route.destination} collection/dispatch street, city, country and contact phone before saving.
        Apartment/unit is optional; postal code is optional in Ethiopia. This saved location also starts the destination delivery map.
        Choose an exact address suggestion if Google cannot verify a typed landmark. Turn collection off to save the tariff before the collection address is ready.</Text>
      <Button mode="contained" disabled={busy} onPress={() => run(async () => {
        setConfig(await storeRequest("international-shipping-config", { method: "put", data: config, timeout: 60000 }));
        Alert.alert("Saved", "Hub and shipping tariff saved. Outstanding quotes must be recalculated; prepared orders retain their snapshot.");
      })}>Save hub & shipping tariff</Button>
    </View> : null}
    <View style={styles.card}>
      <Text style={styles.heading}>Products approved for export</Text>
      <Text>Products are not exportable by default. Approve only products you have checked for legal shipment/import and accurate packaged dimensions.</Text>
      <TextInput label={`Search ${route.origin} catalog`} value={search} onChangeText={setSearch} />
      {products.filter((entry) => String(entry.name).toLowerCase().includes(search.toLowerCase())).map((product) => <View key={product._id || product.id}>
        <Text>{product.name} - {product[route.exportField] ? "Export approved" : "Domestic only"}</Text>
        <Button disabled={busy} onPress={() => run(async () => {
          const updated = await storeRequest(`international-products/${product._id || product.id}`, { method: "put", data: { [route.exportField]: !product[route.exportField] } });
          setProducts((previous) => previous.map((entry) => (entry._id || entry.id) === (product._id || product.id) ? updated : entry));
        })}>{product[route.exportField] ? "Remove export approval" : `Approve for ${route.destination} export`}</Button>
      </View>)}
      <Button onPress={() => navigation.navigate("VehicleDeliverySettings")}>Configure {route.origin} hub vehicles & product package sizes</Button>
      <Button onPress={() => navigation.navigate("DeliveryCheckouts", { admin: true })}>Manage payments & shipment tracking</Button>
    </View>
  </ScrollView>;
}
