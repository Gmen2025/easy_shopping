import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const emptyForm = {
  name: "",
  country: "Ethio",
  address1: "",
  address2: "",
  city: "",
  zip: "",
  email: "",
  phone: "",
  password: "",
};

const AdminStores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [location, setLocation] = useState(null);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [unassignedProducts, setUnassignedProducts] = useState(null);
  const [loadingUnassigned, setLoadingUnassigned] = useState("");
  const [deletingStoreId, setDeletingStoreId] = useState("");
  const [rejectedProducts, setRejectedProducts] = useState([]);
  const [loadingRejections, setLoadingRejections] = useState(false);
  const [deletingRejectionId, setDeletingRejectionId] = useState("");
  const [editingStore, setEditingStore] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", email: "", phone: "", password: "" });
  const [editLocation, setEditLocation] = useState(null);
  const [editLocating, setEditLocating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const detectCurrentLocation = useCallback(async () => {
    setLocatingDevice(true);
    setLocationError("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied. Enable it to auto-detect coordinates.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) {
      setLocationError("Unable to detect the current location. Please try again.");
    } finally {
      setLocatingDevice(false);
    }
  }, []);

  useEffect(() => {
    detectCurrentLocation();
  }, [detectCurrentLocation]);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}stores/admin/company-stores`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setStores(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Alert.alert("Unable to load company stores", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadStores(); }, [loadStores]));

  const loadRejectedProducts = useCallback(async () => {
    setLoadingRejections(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}products/admin/company-rejections`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setRejectedProducts(Array.isArray(response.data?.products) ? response.data.products : []);
    } catch (error) {
      Alert.alert("Unable to load rejected products", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoadingRejections(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRejectedProducts(); }, [loadRejectedProducts]));

  const deleteRejection = async (product, responseId) => {
    setDeletingRejectionId(responseId);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      await axios.delete(`${baseUrl}products/${product._id}/company-responses/${responseId}`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      loadRejectedProducts();
    } catch (error) {
      Alert.alert("Delete failed", error?.response?.data?.message || "Unable to delete this rejection.");
    } finally {
      setDeletingRejectionId("");
    }
  };

  const createStore = async () => {
    const { name, country, address1, address2, city, zip, email, phone, password } = form;
    const isUSA = country === "USA";

    if (!name || !address1 || !city || !email || !phone || !password || (isUSA && !zip)) {
      Alert.alert("Missing fields", "Please fill in all required fields.");
      return;
    }

    if (!location) {
      Alert.alert("Location required", "Waiting for the current device location. Please try again.");
      return;
    }

    const address = isUSA
      ? [address1, address2, city, zip, "USA"].filter(Boolean).join(", ")
      : [address1, address2, city].filter(Boolean).join(", ");

    setCreating(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.post(
        `${baseUrl}stores/admin/company-stores`,
        { name, address, email, phone, password, latitude: location.latitude, longitude: location.longitude },
        { headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb } }
      );
      Alert.alert("Company store created", response?.data?.message || "Store was created successfully.");
      setForm(emptyForm);
      loadStores();
    } catch (error) {
      Alert.alert("Creation failed", error?.response?.data?.message || "Unable to create the company store.");
    } finally {
      setCreating(false);
    }
  };

  const loadUnassignedProducts = async (store) => {
    const coords = store?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      Alert.alert("Missing location", "This store has no registered coordinates.");
      return;
    }

    setLoadingUnassigned(store._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}products/admin/company-fulfillable`, {
        params: { longitude: coords[0], latitude: coords[1], radiusKm: 10 },
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setUnassignedProducts({ storeId: store._id, storeName: store.name, products: response?.data?.products || [] });
    } catch (error) {
      Alert.alert("Unable to load products", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoadingUnassigned("");
    }
  };

  const deleteStore = (store) => {
    Alert.alert(
      "Delete Company Store",
      `Are you sure you want to permanently delete "${store.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingStoreId(store._id);
            try {
              const token = await AsyncStorage.getItem("token");
              const currentDb = await getDatabaseNameFromStorage();
              await axios.delete(`${baseUrl}stores/${store._id}`, {
                headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
                data: { databaseName: currentDb },
                params: { databaseName: currentDb },
              });
              setStores((current) => current.filter((item) => item._id !== store._id));
              Alert.alert("Store deleted", "Company store was successfully deleted.");
            } catch (error) {
              Alert.alert("Delete failed", error?.response?.data?.message || "Unable to delete this store.");
            } finally {
              setDeletingStoreId("");
            }
          },
        },
      ]
    );
  };

  const openEditStore = (store) => {
    setEditingStore(store);
    setEditForm({
      name: store.name || "",
      address: store.address || "",
      email: store.email || "",
      phone: store.phone || "",
      password: "",
    });
    const coords = store.location?.coordinates;
    setEditLocation(
      Array.isArray(coords) && coords.length === 2 ? { latitude: coords[1], longitude: coords[0] } : null
    );
  };

  const closeEditStore = () => {
    setEditingStore(null);
  };

  const refreshEditLocation = async () => {
    setEditLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location permission denied", "Enable location access to auto-detect coordinates.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setEditLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) {
      Alert.alert("Location error", "Unable to detect the current location. Please try again.");
    } finally {
      setEditLocating(false);
    }
  };

  const saveEditStore = async () => {
    const { name, address, email, phone, password } = editForm;
    if (!name || !address || !email || !phone) {
      Alert.alert("Missing fields", "Please fill in all required fields.");
      return;
    }

    setSavingEdit(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const payload = { name, address, email, phone };
      if (password) payload.password = password;
      if (editLocation) {
        payload.latitude = editLocation.latitude;
        payload.longitude = editLocation.longitude;
      }
      const response = await axios.put(
        `${baseUrl}stores/admin/company-stores/${editingStore._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb } }
      );
      Alert.alert("Store updated", response?.data?.message || "Company store was updated successfully.");
      closeEditStore();
      loadStores();
    } catch (error) {
      Alert.alert("Update failed", error?.response?.data?.message || "Unable to update this store.");
    } finally {
      setSavingEdit(false);
    }
  };

  const renderStore = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.details}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>{item.address}</Text>
        <Text style={styles.detail}>{item.email}</Text>
        {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
        {Array.isArray(item.location?.coordinates) ? (
          <Text style={styles.detail}>
            Lat {item.location.coordinates[1]}, Lng {item.location.coordinates[0]}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          style={styles.viewButton}
          disabled={loadingUnassigned === item._id}
          onPress={() => loadUnassignedProducts(item)}
        >
          {loadingUnassigned === item._id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="cubes" size={16} color="#fff" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.editButton} onPress={() => openEditStore(item)}>
          <Icon name="pencil" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          disabled={deletingStoreId === item._id}
          onPress={() => deleteStore(item)}
        >
          {deletingStoreId === item._id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="trash" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <FlatList
        data={stores}
        keyExtractor={(item) => item._id}
        renderItem={renderStore}
        onRefresh={loadStores}
        refreshing={loading}
        ListHeaderComponent={
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create Company Store</Text>
            <TextInput style={styles.input} placeholder="Store name" value={form.name} onChangeText={(text) => setForm({ ...form, name: text })} />
            <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(text) => setForm({ ...form, email: text.toLowerCase() })} />
            <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={form.phone} onChangeText={(text) => setForm({ ...form, phone: text })} />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry value={form.password} onChangeText={(text) => setForm({ ...form, password: text })} />

            <Text style={styles.fieldLabel}>Country</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={form.country} onValueChange={(value) => setForm({ ...form, country: value })} style={styles.picker}>
                <Picker.Item label="Ethiopia" value="Ethio" />
                <Picker.Item label="USA" value="USA" />
              </Picker>
            </View>

            {form.country === "USA" ? (
              <>
                <TextInput style={styles.input} placeholder="Address Line 1" value={form.address1} onChangeText={(text) => setForm({ ...form, address1: text })} />
                <TextInput style={styles.input} placeholder="Address Line 2 (optional)" value={form.address2} onChangeText={(text) => setForm({ ...form, address2: text })} />
                <View style={styles.rowInputs}>
                  <TextInput style={[styles.input, styles.halfInput]} placeholder="City" value={form.city} onChangeText={(text) => setForm({ ...form, city: text })} />
                  <TextInput style={[styles.input, styles.halfInput]} placeholder="Zip Code" keyboardType="numeric" value={form.zip} onChangeText={(text) => setForm({ ...form, zip: text })} />
                </View>
              </>
            ) : (
              <>
                <TextInput style={styles.input} placeholder="Address Line 1" value={form.address1} onChangeText={(text) => setForm({ ...form, address1: text })} />
                <TextInput style={styles.input} placeholder="Address Line 2 (optional)" value={form.address2} onChangeText={(text) => setForm({ ...form, address2: text })} />
                <TextInput style={styles.input} placeholder="City" value={form.city} onChangeText={(text) => setForm({ ...form, city: text })} />
              </>
            )}

            <View style={styles.locationBox}>
              {locatingDevice ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : location ? (
                <Text style={styles.detail}>Detected location: Lat {location.latitude.toFixed(5)}, Lng {location.longitude.toFixed(5)}</Text>
              ) : (
                <Text style={styles.detail}>{locationError || "Location not detected yet."}</Text>
              )}
              <TouchableOpacity onPress={detectCurrentLocation} disabled={locatingDevice}>
                <Text style={styles.refreshLocationText}>Refresh Location</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.createButton} disabled={creating} onPress={createStore}>
              <Text style={styles.createButtonText}>{creating ? "Creating..." : "Create Store"}</Text>
            </TouchableOpacity>

            {unassignedProducts ? (
              <View style={styles.unassignedBox}>
                <Text style={styles.unassignedTitle}>
                  Unassigned products near "{unassignedProducts.storeName}" ({unassignedProducts.products.length})
                </Text>
                {unassignedProducts.products.map((product) => (
                  <Text key={product._id} style={styles.detail}>• {product.name}</Text>
                ))}
                {unassignedProducts.products.length === 0 ? <Text style={styles.detail}>All nearby products are covered by partner stores.</Text> : null}
              </View>
            ) : null}

            <Text style={styles.listTitle}>Registered Company Stores</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.formCard}>
            <View style={styles.rejectionsHeader}>
              <Text style={styles.listTitle}>Rejected Product Requests</Text>
              <TouchableOpacity onPress={loadRejectedProducts} disabled={loadingRejections}>
                <Text style={styles.refreshLocationText}>{loadingRejections ? "Loading..." : "Refresh"}</Text>
              </TouchableOpacity>
            </View>
            {rejectedProducts.length === 0 ? (
              <Text style={styles.detail}>No rejected product requests.</Text>
            ) : (
              rejectedProducts.map((product) => (
                <View key={product._id} style={styles.rejectionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{product.name}</Text>
                    {(product.companyStoreResponses || [])
                      .filter((entry) => entry.status === "rejected")
                      .map((entry) => (
                        <View key={entry._id} style={styles.rejectionEntryRow}>
                          <Text style={styles.detail}>Rejected by {entry.store?.name || "a company store"}</Text>
                          <TouchableOpacity
                            disabled={deletingRejectionId === entry._id}
                            onPress={() => deleteRejection(product, entry._id)}
                          >
                            <Icon name="trash" size={14} color="#b91c1c" />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                </View>
              ))
            )}
          </View>
        }
        contentContainerStyle={stores.length ? styles.list : styles.emptyList}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No company stores yet.</Text> : null}
      />

      <Modal visible={!!editingStore} animationType="slide" transparent onRequestClose={closeEditStore}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.formTitle}>Edit Company Store</Text>
            <TextInput style={styles.input} placeholder="Store name" value={editForm.name} onChangeText={(text) => setEditForm({ ...editForm, name: text })} />
            <TextInput style={styles.input} placeholder="Address" value={editForm.address} onChangeText={(text) => setEditForm({ ...editForm, address: text })} />
            <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={editForm.email} onChangeText={(text) => setEditForm({ ...editForm, email: text.toLowerCase() })} />
            <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={editForm.phone} onChangeText={(text) => setEditForm({ ...editForm, phone: text })} />
            <TextInput style={styles.input} placeholder="New password (optional)" secureTextEntry value={editForm.password} onChangeText={(text) => setEditForm({ ...editForm, password: text })} />

            <View style={styles.locationBox}>
              {editLocating ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : editLocation ? (
                <Text style={styles.detail}>Location: Lat {editLocation.latitude.toFixed(5)}, Lng {editLocation.longitude.toFixed(5)}</Text>
              ) : (
                <Text style={styles.detail}>No location set.</Text>
              )}
              <TouchableOpacity onPress={refreshEditLocation} disabled={editLocating}>
                <Text style={styles.refreshLocationText}>Use Current Location</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeEditStore} disabled={savingEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.createButton, { flex: 1, marginTop: 0 }]} onPress={saveEditStore} disabled={savingEdit}>
                <Text style={styles.createButtonText}>{savingEdit ? "Saving..." : "Save Changes"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  formCard: { padding: 16, backgroundColor: "#fff" },
  formTitle: { fontSize: 16, fontWeight: "700", color: "#1a237e", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  rowInputs: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
  },
  picker: { height: 48 },
  locationBox: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  refreshLocationText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  createButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  createButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  unassignedBox: { marginTop: 16, padding: 12, backgroundColor: "#f1f5f9", borderRadius: 8 },
  unassignedTitle: { fontSize: 13, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  listTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginTop: 20 },
  rejectionsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rejectionRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  rejectionEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  list: { paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    backgroundColor: "#fff",
  },
  details: { flex: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  detail: { fontSize: 12, color: "#5a6c7d", marginTop: 2 },
  rowActions: { flexDirection: "row", alignItems: "center" },
  viewButton: {
    backgroundColor: "#2563eb",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    backgroundColor: "#b91c1c",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: "#d97706",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#6b7280",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default AdminStores;
