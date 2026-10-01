import React, { useCallback, useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { AuthContext } from "../../Context/store/Auth";
import baseUrl from "../../assets/common/baseUrl";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const CompanyStoreDashboard = () => {
  const { logout, user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}products/company/my-products`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
    } catch (error) {
      Alert.alert("Unable to load products", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  const markReady = async (product) => {
    setActingId(product._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      await axios.put(`${baseUrl}products/${product._id}/company-ready`, {}, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setProducts((current) => current.filter((item) => item._id !== product._id));
    } catch (error) {
      Alert.alert("Unable to mark ready", error?.response?.data?.message || "Please try again.");
    } finally {
      setActingId("");
    }
  };

  const rejectProduct = async (product) => {
    setActingId(product._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      await axios.put(`${baseUrl}products/${product._id}/company-reject`, {}, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setProducts((current) => current.filter((item) => item._id !== product._id));
    } catch (error) {
      Alert.alert("Unable to reject", error?.response?.data?.message || "Please try again.");
    } finally {
      setActingId("");
    }
  };

  const renderProduct = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.detail}>{item.category?.name || "Uncategorized"}</Text>
      <Text style={styles.detail}>Price: {item.price}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.readyButton} disabled={actingId === item._id} onPress={() => markReady(item)}>
          <Text style={styles.actionText}>{actingId === item._id ? "..." : "Mark Ready"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectButton} disabled={actingId === item._id} onPress={() => rejectProduct(item)}>
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Company Fulfillment</Text>
          <Text style={styles.headerSubtitle}>{user?.name || "Company store"}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Icon name="sign-out" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          renderItem={renderProduct}
          onRefresh={loadProducts}
          refreshing={loading}
          contentContainerStyle={products.length ? styles.list : styles.emptyList}
          ListEmptyComponent={<Text style={styles.empty}>No products need fulfillment near you right now.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 48,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  headerSubtitle: { fontSize: 12, color: "#5a6c7d", marginTop: 2 },
  list: { padding: 16 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "#6b7280", textAlign: "center", padding: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eef2f7",
  },
  name: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  detail: { fontSize: 12, color: "#5a6c7d", marginTop: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  readyButton: {
    flex: 1,
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#b91c1c",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700" },
});

export default CompanyStoreDashboard;
