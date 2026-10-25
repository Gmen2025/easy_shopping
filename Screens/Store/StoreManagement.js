import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import { storeRequest } from "../../assets/common/storefront";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { useCurrency } from "../../assets/common/currency";
import StoreLogoField from "../../Shared/StoreLogoField";
import { normalizeStoreLogo } from "../../assets/common/storeLogo";

const emptyProfile = { name: "", address: "", logo: "", description: "", latitude: "", longitude: "" };
const StoreManagement = () => {
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [stock, setStock] = useState({ price: "", countInStock: "", minStock: "5" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const { formatPrice } = useCurrency();
  const selectLocation = async (store) => {
    setSelectedId(store._id);
    setCreatingBranch(false);
    setProfile({
      name: store.name, address: store.address, logo: store.logo || "", description: store.description || "",
      latitude: String(store.location?.coordinates?.[1] ?? ""),
      longitude: String(store.location?.coordinates?.[0] ?? ""),
    });
    setProductId("");
    setRows([]);
    setRows(await storeRequest(`me/locations/${store._id}/inventory`));
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const databaseName = await getDatabaseNameFromStorage();
      const [data, products] = await Promise.all([
        storeRequest("me/locations"),
        axios.get(`${baseUrl}products`, { headers: { "x-database-name": databaseName }, timeout: 20000 }),
      ]);
      setLocations(data.stores);
      setEnabled(data.inventoryEnabled);
      setCatalog(Array.isArray(products.data) ? products.data : products.data.products || []);
      if (data.stores.length) await selectLocation(data.stores[0]);
    } catch (failure) { setError(failure.response?.data?.message || "Unable to load store management. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const run = async (action) => {
    if (saving || logoBusy) return;
    setSaving(true);
    try { await action(); }
    catch (failure) { Alert.alert("Store update failed", failure.response?.data?.message || failure.message); }
    finally { setSaving(false); }
  };
  const chooseProduct = (id) => {
    setProductId(id);
    const row = rows.find((entry) => entry.product?._id === id);
    const product = catalog.find((entry) => entry._id === id);
    setStock({
      price: String(row?.price ?? product?.price ?? ""),
      countInStock: String(row?.countInStock ?? 0),
      minStock: String(row?.minStock ?? 5),
    });
  };
  const saveProfile = () => run(async () => {
    const payload = { ...profile, logo: normalizeStoreLogo(profile.logo) };
    if (creatingBranch) {
      const root = locations.find((store) => !store.parentStore);
      const branch = await storeRequest(`me/locations/${root._id}/branches`, { method: "post", data: payload });
      setLocations((current) => [...current, branch]);
      await selectLocation(branch);
    } else {
      const updated = await storeRequest(`me/locations/${selectedId}`, { method: "put", data: payload });
      setLocations((current) => current.map((store) => store._id === updated._id ? updated : store));
      await selectLocation(updated);
    }
    Alert.alert("Saved", "Your storefront profile is updated.");
  });
  if (loading) return <ActivityIndicator style={styles.loading} />;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My store & inventory</Text>
      {error ? <TouchableOpacity onPress={load}><Text style={styles.warning}>{error} Tap to retry.</Text></TouchableOpacity> : null}
      {!enabled ? <Text style={styles.warning}>Admin must migrate inventory before store stock can be edited.</Text> : null}
      <Picker selectedValue={selectedId} enabled={!saving && !logoBusy} onValueChange={(id) => run(() => selectLocation(locations.find((store) => store._id === id)))}>
        {locations.map((store) => <Picker.Item key={store._id} label={store.name} value={store._id} />)}
      </Picker>
      {selectedId ? <>
        <Text selectable>Store ID: {selectedId}</Text>
        <View style={styles.card}>
          <Text style={styles.heading}>{creatingBranch ? "New branch" : "Store profile"}</Text>
          <StoreLogoField name={profile.name} value={profile.logo} disabled={saving} onBusyChange={setLogoBusy}
            onChange={(logo) => setProfile((current) => ({ ...current, logo }))} />
          {Object.keys(emptyProfile).filter((field) => field !== "logo").map((field) => (
            <TextInput key={field} style={styles.input} placeholder={field}
              value={profile[field]} editable={!saving}
              onChangeText={(value) => setProfile((current) => ({ ...current, [field]: value }))} />
          ))}
          <TouchableOpacity style={styles.button} disabled={saving || logoBusy} onPress={saveProfile}><Text>Save profile</Text></TouchableOpacity>
          {!creatingBranch ? <TouchableOpacity style={styles.button} disabled={saving || logoBusy} onPress={() => { setCreatingBranch(true); setProfile(emptyProfile); }}>
            <Text>Add a branch</Text>
          </TouchableOpacity> : <TouchableOpacity disabled={saving || logoBusy} onPress={() => run(() => selectLocation(locations.find((store) => store._id === selectedId)))}><Text>Cancel branch</Text></TouchableOpacity>}
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Add or adjust a catalog product</Text>
          <Text>Choose an existing category and product. Categories and shared products are managed by Admin.</Text>
          <Picker selectedValue={category} onValueChange={setCategory}>
            <Picker.Item label="All existing categories" value="" />
            {[...new Map(catalog.filter((item) => item.category?._id).map((item) => [item.category._id, item.category])).values()]
              .map((item) => <Picker.Item key={item._id} label={item.name} value={item._id} />)}
          </Picker>
          <Picker selectedValue={productId} onValueChange={chooseProduct}>
            <Picker.Item label="Select catalog product" value="" />
            {catalog.filter((item) => !category || item.category?._id === category)
              .map((item) => <Picker.Item key={item._id} label={item.name} value={item._id} />)}
          </Picker>
          {productId ? <>
            {["price", "countInStock", "minStock"].map((field) => <View key={field}>
              <Text>{({ price: "Store price", countInStock: "Physical stock (including reservations)", minStock: "Low-stock threshold" })[field]}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={stock[field]} editable={!saving && enabled}
                onChangeText={(value) => setStock((current) => ({ ...current, [field]: value }))} />
            </View>)}
            <TouchableOpacity style={styles.button} disabled={saving || !enabled} onPress={() => run(async () => {
              await storeRequest(`me/locations/${selectedId}/inventory/${productId}`, { method: "put", data: stock });
              setRows(await storeRequest(`me/locations/${selectedId}/inventory`));
              Alert.alert("Saved", "Store stock and price updated.");
            })}><Text>Save inventory</Text></TouchableOpacity>
          </> : null}
        </View>
        <Text style={styles.heading}>Your store products</Text>
        {rows.map((row) => <View key={row._id} style={styles.card}>
          <Text style={styles.heading}>{row.product?.name || "Removed catalog product"}</Text>
          <Text>{formatPrice(row.price)} | Physical: {row.countInStock} | Reserved: {row.reserved}</Text>
          <Text style={row.countInStock - row.reserved <= row.minStock ? styles.warning : null}>
            Available: {row.countInStock - row.reserved}{row.countInStock - row.reserved <= row.minStock ? " - Low stock" : ""}
          </Text>
          <TouchableOpacity style={styles.button} disabled={saving || !row.product} onPress={() => chooseProduct(row.product._id)}><Text>Adjust inventory</Text></TouchableOpacity>
          <TouchableOpacity disabled={saving} onPress={() => Alert.alert("Remove store product?", "This removes the listing from this location only, not the shared catalog.", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => run(async () => {
              await storeRequest(`me/locations/${selectedId}/inventory/${row.product?._id}`, { method: "delete" });
              setRows(await storeRequest(`me/locations/${selectedId}/inventory`));
              setProductId("");
            }) },
          ])}><Text style={styles.warning}>Remove from store</Text></TouchableOpacity>
        </View>)}
      </> : <Text>No store profile is linked to your account. Contact Admin.</Text>}
    </ScrollView>
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 16, paddingBottom: 32 },
  loading: { marginTop: 40 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  heading: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginVertical: 10 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginVertical: 8 },
  button: { backgroundColor: "#facc15", padding: 12, borderRadius: 8, alignItems: "center", marginVertical: 8 },
  warning: { color: "#b45309", marginVertical: 8 },
});
export default StoreManagement;
