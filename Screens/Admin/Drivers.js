import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [selectedDb, setSelectedDb] = useState("E_Shopping");

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      setSelectedDb(currentDb);
      const response = await axios.get(`${baseUrl}drivers`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "x-database-name": currentDb,
        },
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

  const normalizeDriverAfterAccess = (item, action, responseData) => {
    const nextItem = { ...item, ...(responseData || {}) };

    if (action === "unsuspend") {
      nextItem.isSuspended = false;
      nextItem.suspended = false;
      nextItem.approvalStatus = "approved";
      nextItem.status = "approved";
    }

    if (action === "suspend") {
      nextItem.isSuspended = true;
      nextItem.suspended = true;
      nextItem.approvalStatus = nextItem.approvalStatus || "approved";
      nextItem.status = "suspended";
    }

    return nextItem;
  };

  const updateDriverAccess = async (driver, action) => {
    setUpdatingId(driver._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const candidateActions = action === "suspend"
        ? ["suspend", "deny"]
        : action === "unsuspend"
          ? ["unsuspend", "approve", "recover"]
          : [action];

      let lastError = null;
      let response = null;

      for (const candidateAction of candidateActions) {
        try {
          response = await axios.put(
            `${baseUrl}drivers/${driver._id}/${candidateAction}`,
            { databaseName: currentDb },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "x-database-name": currentDb,
              },
            }
          );
          break;
        } catch (error) {
          lastError = error;
          const status = error?.response?.status;
          if (![404, 405, 400].includes(status)) {
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Unable to update driver access right now.");
      }

      const responseDriver = response.data?.driver || response.data?.data || null;
      setDrivers((current) => current.map((item) => item._id === driver._id ? normalizeDriverAfterAccess(item, action, responseDriver) : item));
      await loadDrivers();
      Alert.alert("Driver updated", response?.data?.message || "Driver access was updated.");
    } catch (error) {
      Alert.alert("Update failed", error?.response?.data?.message || error?.message || "Unable to update driver access right now.");
    } finally {
      setUpdatingId("");
    }
  };

  const deleteDriver = (driver) => {
    Alert.alert(
      "Delete Driver",
      `Are you sure you want to permanently delete driver "${driver.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdatingId(driver._id);
            try {
              const token = await AsyncStorage.getItem("token");
              const currentDb = await getDatabaseNameFromStorage();
              await axios.delete(`${baseUrl}drivers/${driver._id}`, {
                headers: { 
                  Authorization: `Bearer ${token}`,
                  "x-database-name": currentDb,
                },
                data: { databaseName: currentDb },
                params: { databaseName: currentDb },
              });
              setDrivers((current) => current.filter((item) => item._id !== driver._id));
              Alert.alert("Driver deleted", "Driver record was successfully deleted.");
            } catch (error) {
              Alert.alert(
                "Delete failed",
                error?.response?.data?.message || error?.response?.data?.error || "Unable to delete driver right now."
              );
            } finally {
              setUpdatingId("");
            }
          },
        },
      ]
    );
  };

  const getEffectiveSuspension = (item) => {
    const approvalStatus = item?.approvalStatus || "approved";

    if (approvalStatus === "approved") {
      return false;
    }

    return Boolean(item?.isSuspended);
  };

  const getDriverStatus = (item) => {
    if (getEffectiveSuspension(item)) return "suspended";
    return item?.approvalStatus || "approved";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "suspended":
        return "#b91c1c";
      case "denied":
        return "#991b1b";
      case "pending":
        return "#8a6c09";
      default:
        return "#0f766e";
    }
  };

  const formatDepositBalance = (value, currency = "USD") => {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) {
      return `0 ${currency}`;
    }

    const normalizedCurrency = String(currency || "USD").toUpperCase();

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: normalizedCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericValue);
    } catch (error) {
      return `${numericValue.toFixed(2)} ${normalizedCurrency}`;
    }
  };

  const renderDriver = ({ item }) => {
    const status = getDriverStatus(item);
    const isSuspended = getEffectiveSuspension(item);
    const depositBalance = Number(
      item?.depositBalance ??
      item?.driverDepositBalance ??
      item?.availableBalance ??
      item?.walletBalance ??
      item?.balance ??
      0
    );
    const currencyFromItem = String(item?.currency || "").toUpperCase();
    const currency =
      currencyFromItem === "USD" || currencyFromItem === "ETB"
        ? currencyFromItem
        : selectedDb?.toUpperCase().includes("USA")
          ? "USD"
          : "ETB";

    return (
      <View style={styles.driverRow}>
        <View style={styles.driverDetails}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.detail}>{item.email}</Text>
          {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
          <Text style={[styles.status, { color: getStatusColor(status) }]}>{status}</Text>
          <Text style={styles.detail}>Deposit: {formatDepositBalance(depositBalance, currency)}</Text>
          {item.vehicle?.type || item.vehicleType ? <Text style={styles.detail}>{item.vehicle?.type || item.vehicleType}</Text> : null}
          {item.vehicle?.year ? <Text style={styles.detail}>{item.vehicle.year} {item.vehicle?.make} {item.vehicle?.model}</Text> : null}
        </View>
        <View style={styles.actions}>
          {!isSuspended && status !== "approved" ? <TouchableOpacity accessibilityLabel={`Approve ${item.name}`} style={styles.approveButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "approve")}><Icon name="check" size={16} color="#ffffff" /></TouchableOpacity> : null}
          {!isSuspended && status === "denied" ? <TouchableOpacity accessibilityLabel={`Recover ${item.name}`} style={styles.recoverButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "recover")}><Icon name="undo" size={16} color="#ffffff" /></TouchableOpacity> : null}
          {!isSuspended && status !== "denied" ? <TouchableOpacity accessibilityLabel={`Deny ${item.name}`} style={styles.denyButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "deny")}><Icon name="ban" size={16} color="#ffffff" /></TouchableOpacity> : null}
          {isSuspended ? <TouchableOpacity accessibilityLabel={`Unsuspend ${item.name}`} style={styles.recoverButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "unsuspend")}><Icon name="toggle-on" size={16} color="#ffffff" /></TouchableOpacity> : <TouchableOpacity accessibilityLabel={`Suspend ${item.name}`} style={styles.denyButton} disabled={updatingId === item._id} onPress={() => updateDriverAccess(item, "suspend")}><Icon name="pause" size={16} color="#ffffff" /></TouchableOpacity>}
          <TouchableOpacity accessibilityLabel={`Delete ${item.name}`} style={styles.deleteButton} disabled={updatingId === item._id} onPress={() => deleteDriver(item)}><Icon name="trash" size={16} color="#ffffff" /></TouchableOpacity>
        </View>
      </View>
    );
  };

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
  status: { fontSize: 12, fontWeight: "700", marginTop: 5, textTransform: "uppercase" },
  actions: { gap: 8 },
  approveButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#0f766e", borderRadius: 8 },
  denyButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#b91c1c", borderRadius: 8 },
  recoverButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb", borderRadius: 8 },
  deleteButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#4b5563", borderRadius: 8 },
  emptyText: { color: "#5a6c7d", fontSize: 15, textAlign: "center" },
});

export default Drivers;