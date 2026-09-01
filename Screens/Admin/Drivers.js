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
  const [approvingId, setApprovingId] = useState("");

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${baseUrl}drivers?approvalStatus=pending&allDatabases=true`, {
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

  const approveDriver = async (driver) => {
    setApprovingId(driver._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.put(
        `${baseUrl}drivers/${driver._id}/approve`,
        { databaseName: driver.databaseName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDrivers((currentDrivers) => currentDrivers.filter((item) => item._id !== driver._id));
      Alert.alert("Driver approved", response?.data?.message || "The driver can now sign in to the Driver app.");
    } catch (error) {
      Alert.alert("Approval failed", error?.response?.data?.message || "Unable to approve this driver right now.");
    } finally {
      setApprovingId("");
    }
  };

  const renderDriver = ({ item }) => (
    <View style={styles.driverRow}>
      <View style={styles.driverDetails}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>{item.email}</Text>
        {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
        {item.databaseName ? <Text style={styles.database}>{item.databaseName}</Text> : null}
      </View>
      <TouchableOpacity
        accessibilityLabel={`Approve ${item.name}`}
        style={styles.approveButton}
        disabled={approvingId === item._id}
        onPress={() => approveDriver(item)}
      >
        {approvingId === item._id ? <ActivityIndicator color="#ffffff" /> : <Icon name="check" size={16} color="#ffffff" />}
      </TouchableOpacity>
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
      ListEmptyComponent={<Text style={styles.emptyText}>No driver applications are waiting for approval.</Text>}
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
  approveButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#0f766e", borderRadius: 8 },
  emptyText: { color: "#5a6c7d", fontSize: 15, textAlign: "center" },
});

export default Drivers;