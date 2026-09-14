import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/FontAwesome";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

export default function StoreOwners(props) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");

  const loadOwners = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}stores/admin/owners`, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          "x-database-name": currentDb,
        } 
      });
      setOwners(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      Alert.alert("Unable to load store owners", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadOwners(); }, [loadOwners]));

  const updateAccess = async (owner, action) => {
    setUpdatingId(owner._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.put(
        `${baseUrl}stores/${owner._id}/${action}`,
        { databaseName: currentDb },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            "x-database-name": currentDb,
          } 
        }
      );
      setOwners((current) => current.map((item) => item._id === owner._id ? response.data.store : item));
      Alert.alert("Store owner updated", response.data.message || "Access was updated.");
    } catch (error) {
      Alert.alert("Update failed", error?.response?.data?.message || "Unable to update store owner access.");
    } finally { setUpdatingId(""); }
  };

  const deleteOwner = (owner) => {
    Alert.alert(
      "Delete Store Owner",
      `Are you sure you want to permanently delete store owner "${owner.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdatingId(owner._id);
            try {
              const token = await AsyncStorage.getItem("token");
              const currentDb = await getDatabaseNameFromStorage();
              await axios.delete(`${baseUrl}stores/${owner._id}`, {
                headers: { 
                  Authorization: `Bearer ${token}`,
                  "x-database-name": currentDb,
                },
                data: { databaseName: currentDb },
                params: { databaseName: currentDb },
              });
              setOwners((current) => current.filter((item) => item._id !== owner._id));
              Alert.alert("Store owner deleted", "Store owner was successfully deleted.");
            } catch (error) {
              Alert.alert(
                "Delete failed",
                error?.response?.data?.message || error?.response?.data?.error || "Unable to delete store owner right now."
              );
            } finally {
              setUpdatingId("");
            }
          },
        },
      ]
    );
  };

  const renderOwner = ({ item }) => {
    const status = item.approvalStatus || "approved";
    return <View style={styles.row}>
      <View style={styles.details}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>{item.email || "No email"}</Text>
        {item.phone ? <Text style={styles.detail}>{item.phone}</Text> : null}
        <Text style={styles.status}>{status}</Text>
        {item.address ? <Text style={styles.detail}>{item.address}</Text> : null}
      </View>
      <View style={styles.actions}>
        {status !== "approved" ? <Action icon="check" color="#0f766e" label={`Approve ${item.name}`} disabled={updatingId === item._id} onPress={() => updateAccess(item, "approve")} /> : null}
        {status === "denied" ? <Action icon="undo" color="#2563eb" label={`Recover ${item.name}`} disabled={updatingId === item._id} onPress={() => updateAccess(item, "recover")} /> : null}
        {status !== "denied" ? <Action icon="ban" color="#b91c1c" label={`Deny ${item.name}`} disabled={updatingId === item._id} onPress={() => updateAccess(item, "deny")} /> : null}
        <Action icon="trash" color="#4b5563" label={`Delete ${item.name}`} disabled={updatingId === item._id} onPress={() => deleteOwner(item)} />
      </View>
    </View>;
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#0f766e" /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Registered Store Owners</Text>
        <TouchableOpacity
          style={styles.payoutsBtn}
          onPress={() => props?.navigation?.navigate("Payouts")}
        >
          <Icon name="money" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.payoutsBtnText}>Manage Payouts</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={owners}
        keyExtractor={(item) => item._id}
        renderItem={renderOwner}
        contentContainerStyle={owners.length ? styles.list : styles.emptyList}
        onRefresh={loadOwners}
        refreshing={loading}
        ListEmptyComponent={<Text style={styles.empty}>No store owners found.</Text>}
      />
    </View>
  );
}

function Action({ icon, color, label, ...props }) {
  return <TouchableOpacity accessibilityLabel={label} style={[styles.button, { backgroundColor: color }]} {...props}><Icon name={icon} size={16} color="#fff" /></TouchableOpacity>;
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#e6c20eff" },
  payoutsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  payoutsBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  list: { padding: 16 }, emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }, centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 14, marginBottom: 10 }, details: { flex: 1 },
  name: { color: "#1a237e", fontSize: 16, fontWeight: "700", marginBottom: 4 }, detail: { color: "#5a6c7d", fontSize: 13, marginTop: 2 }, status: { color: "#8a6c09", fontSize: 12, fontWeight: "700", marginTop: 5, textTransform: "uppercase" }, database: { color: "#0f766e", fontSize: 12, fontWeight: "600", marginTop: 6 },
  actions: { gap: 8 }, button: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 8 }, empty: { color: "#5a6c7d", fontSize: 15, textAlign: "center" },
});