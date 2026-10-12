import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { storeRequest, apiRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";

const addressFields = [["label", "Hub label"], ["address1", "US street address"], ["address2", "Unit (optional)"],
  ["city", "US city"], ["zip", "US ZIP"], ["country", "Country (USA)"], ["phone", "Hub phone"]];
const tariffFields = [["baseUsd", "Base shipping fee (USD)"], ["perKgUsd", "USD per billable kg"],
  ["minimumUsd", "Minimum shipment fee (USD)"], ["volumetricDivisor", "Volumetric divisor (cm3 / kg)"],
  ["maxWeightKg", "Maximum billable kg per recipient"], ["maxDimensionCm", "Maximum parcel dimension (cm)"]];
export default function InternationalShippingSettings({ navigation }) {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const region = useRef("");
  const run = async (action) => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (!/usa/i.test(db)) throw new Error("Select the USA region to configure exports to Ethiopia.");
      if (region.current && region.current !== db) throw new Error("Region changed. Reopen shipping settings.");
      region.current = db; await action();
    } catch (failure) {
      const message = failure.response?.data?.message || failure.message;
      setError(message); Alert.alert("International shipping", message);
    } finally { guard.current = false; setBusy(false); }
  };
  const load = async () => {
    const [policy, catalog] = await Promise.all([storeRequest("international-shipping-config"), apiRequest("products", "")]);
    setConfig({ ...policy, hub: policy.hub || Object.fromEntries(addressFields.map(([field]) => [field, field === "country" ? "USA" : ""])) });
    setProducts(catalog);
  };
  useEffect(() => { run(load); }, []);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>US-to-Ethiopia shipping</Text>
    <Text>US stores deliver to your US consolidation hub. Admin handles international shipment and delivery to the Ethiopian recipient. This screen does not book a carrier or purchase labels.</Text>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button disabled={busy} onPress={() => run(load)}>Reload shipping policy</Button>
    {config ? <View style={styles.card}>
      <Text>Enable international shipping (daily birr exchange policy must also be enabled/current)</Text>
      <Switch value={Boolean(config.enabled)} disabled={busy} onValueChange={(enabled) => setConfig((previous) => ({ ...previous, enabled }))} />
      {addressFields.map(([field, label]) => <TextInput key={field} label={label} disabled={busy} value={config.hub[field] || ""}
        onChangeText={(value) => setConfig((previous) => ({ ...previous, hub: { ...previous.hub, [field]: value } }))} />)}
      {tariffFields.map(([field, label]) => <TextInput key={field} label={label} disabled={busy} keyboardType="decimal-pad"
        value={config[field] == null ? "" : String(config[field])} onChangeText={(value) => setConfig((previous) => ({ ...previous, [field]: value }))} />)}
      <Text>For each recipient, billable kg is the greater of actual kg and the sum of each unit's packaged length x width x height / divisor. Rounded up to 0.001 kg.
        Shipping USD = max(minimum, base + billable kg x rate), once per recipient, even with multiple pickup stores. US road delivery fees are added separately.</Text>
      <Text>Tariff includes final Ethiopian address delivery, but excludes import duties/customs. Review carrier pricing, import/export restrictions and recipient coverage before approving products.</Text>
      <Button mode="contained" disabled={busy} onPress={() => run(async () => {
        setConfig(await storeRequest("international-shipping-config", { method: "put", data: config, timeout: 60000 }));
        Alert.alert("Saved", "Hub and shipping tariff saved. Outstanding quotes must be recalculated; prepared orders retain their snapshot.");
      })}>Save hub & shipping tariff</Button>
    </View> : null}
    <View style={styles.card}>
      <Text style={styles.heading}>Products approved for export</Text>
      <Text>Products are not exportable by default. Approve only products you have checked for legal shipment/import and accurate packaged dimensions.</Text>
      <TextInput label="Search US catalog" value={search} onChangeText={setSearch} />
      {products.filter((entry) => String(entry.name).toLowerCase().includes(search.toLowerCase())).map((product) => <View key={product._id || product.id}>
        <Text>{product.name} - {product.exportToEthiopia ? "Export approved" : "Domestic only"}</Text>
        <Button disabled={busy} onPress={() => run(async () => {
          const updated = await storeRequest(`international-products/${product._id || product.id}`, { method: "put", data: { exportToEthiopia: !product.exportToEthiopia } });
          setProducts((previous) => previous.map((entry) => (entry._id || entry.id) === (product._id || product.id) ? updated : entry));
        })}>{product.exportToEthiopia ? "Remove export approval" : "Approve for Ethiopia export"}</Button>
      </View>)}
      <Button onPress={() => navigation.navigate("VehicleDeliverySettings")}>Configure US hub vehicles & product package sizes</Button>
      <Button onPress={() => navigation.navigate("DeliveryCheckouts", { admin: true })}>Manage payments & shipment tracking</Button>
    </View>
  </ScrollView>;
}
