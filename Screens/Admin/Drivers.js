import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${baseUrl}drivers?allDatabases=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDrivers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Alert.alert("Unable to load drivers", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadDrivers();
  }, [loadDrivers]));

  const updateDriverAccess = async (driver, action) => {
    setUpdatingId(driver._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.put(
        `${baseUrl}drivers/${driver._id}/${action}`,
        { databaseName: driver.databaseName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDrivers((current) => current.map((item) => item._id === driver._id ? { ...response.data.driver, databaseName: item.databaseName } : item));
      Alert.alert("Driver updated", response?.data?.message || "Driver access was updated.");
    } catch (error) {
      Alert.alert("Update failed", error?.response?.data?.message || "Unable to update driver access right now.");
    } finally {
      setUpdatingId("");
    }
  };

  const renderDriver = ({ item }) => (
    <View style={styles.driverRow}>
      <View style={styles.driverDetails}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>{item.email}</Text>
        {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
        <Text style={styles.status}>{item.approvalStatus || "approved"}</Text>
        {item.vehicle?.type || item.vehicleType ? <Text style={styles.detail}>{item.vehicle?.type || item.vehicleType}</Text> : null}
        {item.vehicle?.year ? <Text style={styles.detail}>{item.vehicle.year} {item.vehicle?.make} {item.vehicle?.model}</Text> : null}
        {item.databaseName ? <Text style={styles.database}>{item.databaseName}</Text> : null}
      </View>
      <View style={styles.actions}>
        {item.approvalStatus !== "approved" ? <TouchableOpacity accessibilityLabel={`Approve ${item.name}`} style={styles.approveButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "approve")}><Icon name="check" size={16} color="#ffffff" /></TouchableOpacity> : null}
        {item.approvalStatus === "denied" ? <TouchableOpacity accessibilityLabel={`Recover ${item.name}`} style={styles.recoverButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "recover")}><Icon name="undo" size={16} color="#ffffff" /></TouchableOpacity> : null}
        {item.approvalStatus !== "denied" ? <TouchableOpacity accessibilityLabel={`Deny ${item.name}`} style={styles.denyButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "deny")}><Icon name="ban" size={16} color="#ffffff" /></TouchableOpacity> : null}
      </View>
    </View>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#0f766e" /></View>;
  }

  return (
    <FlatList
      contentContainerStyle={drivers.length ? styles.list : styles.emptyList}
      data={drivers}
      keyExtractor={(item) => item._id}
      renderItem={renderDriver}
      onRefresh={loadDrivers}
      refreshing={loading}
      ListEmptyComponent={<Text style={styles.emptyText}>No drivers found.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  list: { padding: 16 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  driverRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 14, marginBottom: 10 },
  driverDetails: { flex: 1 },
  name: { color: "#1a237e", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  detail: { color: "#5a6c7d", fontSize: 13, marginTop: 2 },
  database: { color: "#0f766e", fontSize: 12, fontWeight: "600", marginTop: 6 },
  status: { color: "#8a6c09", fontSize: 12, fontWeight: "700", marginTop: 5, textTransform: "uppercase" },
  actions: { gap: 8 },
  approveButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#0f766e", borderRadius: 8 },
  denyButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#b91c1c", borderRadius: 8 },
  recoverButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb", borderRadius: 8 },
  emptyText: { color: "#5a6c7d", fontSize: 15, textAlign: "center" },
});

export default Drivers;