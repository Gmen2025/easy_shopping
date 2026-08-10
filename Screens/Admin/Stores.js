import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import { createStore, fetchStores, getStoredStores } from "../../assets/common/stores";

const Stores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadStores = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem("token");
    const remoteStores = await fetchStores(token);
    setStores(remoteStores);
    setLoading(false);
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleCreateDemoStore = async () => {
    const token = await AsyncStorage.getItem("token");
    const created = await createStore({
      name: "Demo Pickup Store",
      address: "Bole Road",
      city: "Addis Ababa",
      country: "Ethiopia",
      phone: "0912345678",
      latitude: 8.9851,
      longitude: 38.7642,
      isActive: true,
    }, token);

    if (created) {
      Toast.show({ type: "success", text1: "Store saved", text2: "Customers can now be routed to this store" });
      loadStores();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stores</Text>
      <Text style={styles.subtitle}>Admin-managed pickup locations for customer orders.</Text>
      <EasyButton style={styles.button} tertiary large onPress={handleCreateDemoStore}>
        <Text style={styles.buttonText}>{loading ? "Loading..." : "Create demo store"}</Text>
      </EasyButton>
      <ScrollView style={styles.list}>
        {stores.map((store) => (
          <View key={store.id} style={styles.card}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeText}>{store.address}</Text>
            <Text style={styles.storeText}>{store.city}, {store.country}</Text>
            <Text style={styles.storeText}>Phone: {store.phone || "-"}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f3f6fb" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 6, color: "#6b7280" },
  button: { marginTop: 16 },
  buttonText: { color: "#111827", fontWeight: "700" },
  list: { marginTop: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10 },
  storeName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  storeText: { marginTop: 4, color: "#4b5563" },
});

export default Stores;
